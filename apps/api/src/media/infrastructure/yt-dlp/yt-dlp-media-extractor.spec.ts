import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
  mkdir: vi.fn(),
  stat: vi.fn(),
}));

vi.mock('../../domain/media-platform', () => ({
  detectPlatform: vi.fn(() => 'youtube'),
}));

vi.mock('../ssrf/url-safety', () => ({
  ensurePublicUrl: vi.fn(async (url: string) => new URL(url)),
}));

vi.mock('./mime-type', () => ({
  resolveMimeTypeFromFilename: vi.fn(() => 'video/mp4'),
}));

import { spawn } from 'node:child_process';
import { access, mkdir, stat } from 'node:fs/promises';
import { YtDlpMediaExtractor } from './yt-dlp-media-extractor';

class FakeChildProcess extends EventEmitter {
  killed = false;
  exitCode: number | null = null;
  stdout = new EventEmitter();
  stderr = new EventEmitter();

  kill = vi.fn((signal?: string) => {
    this.killed = true;
    if (signal === 'SIGKILL') {
      this.exitCode = 137;
    }
    return true;
  });

  simulateClose(code: number): void {
    this.exitCode = code;
    this.emit('close', code);
  }
}

const waitForSpawn = async () => {
  for (let i = 0; i < 20; i++) {
    await new Promise<void>((r) => setImmediate(r));
    if (vi.mocked(spawn).mock.calls.length > 0) return;
  }
  throw new Error('spawn was never called');
};

const waitForSpawnViaTimers = async () => {
  for (let i = 0; i < 20; i++) {
    await vi.advanceTimersByTimeAsync(0);
    if (vi.mocked(spawn).mock.calls.length > 0) return;
  }
  throw new Error('spawn was never called');
};

describe('YtDlpMediaExtractor', () => {
  let extractor: YtDlpMediaExtractor;

  beforeEach(() => {
    vi.clearAllMocks();
    extractor = new YtDlpMediaExtractor();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ejecuta SIGTERM cuando el signal aborta durante download', async () => {
    const child = new FakeChildProcess();
    vi.mocked(spawn).mockReturnValue(child as never);
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(access).mockResolvedValue(undefined);
    vi.mocked(stat).mockResolvedValue({ size: 1000 } as never);

    const controller = new AbortController();
    const downloadPromise = extractor.download(
      { url: 'https://youtu.be/demo', type: 'video' },
      '/tmp/test',
      controller.signal,
    ).catch((e: unknown) => e);

    await waitForSpawn();

    controller.abort();
    await new Promise<void>((r) => setImmediate(r));

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    child.simulateClose(143);
    await new Promise<void>((r) => setImmediate(r));

    const result = await downloadPromise;
    expect(result).toMatchObject({ message: 'DOWNLOAD_CANCELLED' });
  });

  it('usa SIGKILL despues del grace period si el proceso no termina', async () => {
    vi.useFakeTimers();
    try {
      const child = new FakeChildProcess();
      vi.mocked(spawn).mockReturnValue(child as never);
      vi.mocked(mkdir).mockResolvedValue(undefined);

      const controller = new AbortController();
      const downloadPromise = extractor.download(
        { url: 'https://youtu.be/demo', type: 'video' },
        '/tmp/test',
        controller.signal,
      ).catch((e: unknown) => e);

      await waitForSpawnViaTimers();

      controller.abort();
      await vi.advanceTimersByTimeAsync(0);
      expect(child.kill).toHaveBeenCalledWith('SIGTERM');

      await vi.advanceTimersByTimeAsync(4000);
      expect(child.kill).toHaveBeenCalledWith('SIGKILL');

      child.simulateClose(137);
      await vi.advanceTimersByTimeAsync(0);

      const result = await downloadPromise;
      expect(result).toMatchObject({ message: 'DOWNLOAD_CANCELLED' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('no lanza si el proceso cierra exitosamente', async () => {
    const child = new FakeChildProcess();
    vi.mocked(spawn).mockReturnValue(child as never);
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(access).mockResolvedValue(undefined);
    vi.mocked(stat).mockResolvedValue({ size: 500 } as never);

    const controller = new AbortController();
    const downloadPromise = extractor.download(
      { url: 'https://youtu.be/demo', type: 'video' },
      '/tmp/test',
      controller.signal,
    );

    await waitForSpawn();

    child.stdout.emit('data', Buffer.from('/tmp/test/video.mp4'));
    child.simulateClose(0);
    const result = await downloadPromise;

    expect(result.filePath).toBe('/tmp/test/video.mp4');
    expect(result.fileName).toBe('video.mp4');
    expect(child.kill).not.toHaveBeenCalled();
  });

  it('no aborta si el signal nunca se dispara', async () => {
    const child = new FakeChildProcess();
    vi.mocked(spawn).mockReturnValue(child as never);
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(access).mockResolvedValue(undefined);
    vi.mocked(stat).mockResolvedValue({ size: 2000 } as never);

    const controller = new AbortController();
    const downloadPromise = extractor.download(
      { url: 'https://youtu.be/demo', type: 'audio', audioFormat: 'mp3' },
      '/tmp/test',
      controller.signal,
    );

    await waitForSpawn();

    child.stdout.emit('data', Buffer.from('/tmp/test/track.mp3'));
    child.simulateClose(0);
    const result = await downloadPromise;

    expect(result.filePath).toBe('/tmp/test/track.mp3');
    expect(controller.signal.aborted).toBe(false);
  });

  it('respeta el timeout sin signal y mata el proceso con SIGTERM', async () => {
    vi.useFakeTimers();
    try {
      const child = new FakeChildProcess();
      vi.mocked(spawn).mockReturnValue(child as never);
      vi.mocked(mkdir).mockResolvedValue(undefined);

      const downloadPromise = extractor.download(
        { url: 'https://youtu.be/demo', type: 'video' },
        '/tmp/test',
      ).catch((e: unknown) => e);

      await waitForSpawnViaTimers();

      await vi.advanceTimersByTimeAsync(900001);
      expect(child.kill).toHaveBeenCalledWith('SIGTERM');

      child.simulateClose(143);
      await vi.advanceTimersByTimeAsync(0);

      const result = await downloadPromise;
      expect(result).toMatchObject({ message: 'DOWNLOAD_TIMEOUT' });
    } finally {
      vi.useRealTimers();
    }
  });
});
