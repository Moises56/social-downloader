import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../shared/errors';

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

  // Hacen falta dos a la vez en cuanto se usa el proyecto de verdad: YouTube necesita
  // `player_client` para los videos con restriccion de edad y TikTok su `api_hostname`.
  it('descarta los storyboards de la lista de formatos', async () => {
    const child = new FakeChildProcess();
    vi.mocked(spawn).mockReturnValue(child as never);

    const pending = new YtDlpMediaExtractor().analyze(new URL('https://youtu.be/demo'));
    await waitForSpawn();

    child.stdout.emit('data', Buffer.from(JSON.stringify({
      title: 'demo',
      formats: [
        { format_id: 'sb0', ext: 'mhtml', format_note: 'storyboard' },
        { format_id: 'sb1', ext: 'mhtml', format_note: 'storyboard' },
        { format_id: '96', ext: 'mp4', height: 1080, vcodec: 'avc1', acodec: 'mp4a' },
      ],
    })));
    child.simulateClose(0);

    const meta = await pending;
    expect(meta.formats.map((f) => f.id)).toEqual(['96']);
  });

  it('pasa un --extractor-args por cada grupo separado con |', async () => {
    process.env.YTDLP_EXTRACTOR_ARGS =
      'youtube:player_client=default,web_safari | tiktok:api_hostname=api22.example.com';
    const child = new FakeChildProcess();
    vi.mocked(spawn).mockReturnValue(child as never);

    const pending = new YtDlpMediaExtractor()
      .analyze(new URL('https://youtu.be/demo'))
      .catch((e: unknown) => e);
    await waitForSpawn();

    const args = vi.mocked(spawn).mock.calls[0]?.[1] as string[];
    const groups = args.filter((_, i) => args[i - 1] === '--extractor-args');

    expect(groups).toEqual([
      'youtube:player_client=default,web_safari',
      'tiktok:api_hostname=api22.example.com',
    ]);

    child.simulateClose(1);
    await pending;
    delete process.env.YTDLP_EXTRACTOR_ARGS;
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
    expect(result).toBeInstanceOf(ApiError);
    expect((result as ApiError).code).toBe('DOWNLOAD_CANCELLED');
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
      expect(result).toBeInstanceOf(ApiError);
      expect((result as ApiError).code).toBe('DOWNLOAD_CANCELLED');
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
      expect(result).toBeInstanceOf(ApiError);
      expect((result as ApiError).code).toBe('DOWNLOAD_TIMEOUT');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('relevantStderr', () => {
  // Caso real: los warnings de YouTube sobre el solver de retos JS pasan de 400 caracteres
  // cada uno, asi que el log truncado a los primeros 500 no llegaba nunca a la linea ERROR.
  const youtubeStderr = [
    'WARNING: [youtube] [jsc] Remote components challenge solver script (deno) and NPM package (deno) were skipped. These may be required to solve JS challenges. You can enable these downloads with  --remote-components ejs:github  (recommended) or  --remote-components ejs:npm , respectively. For more information and alternatives, refer to  https://github.com/yt-dlp/yt-dlp/wiki/EJS',
    'WARNING: [youtube] abc: Signature solving failed: Some formats may be missing. Ensure you have a supported JavaScript runtime and challenge solver script distribution installed. Review any warnings presented before this message. For more details, refer to  https://github.com/yt-dlp/yt-dlp/wiki/EJS',
    'ERROR: [youtube] abc: Sign in to confirm your age. This video may be inappropriate for some users.',
  ].join('\n');

  it('extrae la linea ERROR aunque vaya detras de warnings largos', async () => {
    const { relevantStderr } = await import('./yt-dlp-media-extractor');
    const out = relevantStderr(youtubeStderr);

    expect(out).toContain('Sign in to confirm your age');
    expect(out).not.toContain('WARNING');
  });

  it('cae a la COLA de stderr cuando no hay ninguna linea ERROR', async () => {
    const { relevantStderr } = await import('./yt-dlp-media-extractor');
    const noError = `${'x'.repeat(600)}\nlo ultimo que dijo`;

    expect(relevantStderr(noError)).toContain('lo ultimo que dijo');
  });
});
