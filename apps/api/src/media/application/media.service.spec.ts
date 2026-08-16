import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DownloadRequest, DownloadResult, MediaMetadata } from '../domain/media-platform';
import { ApiError } from '../shared/errors';

vi.mock('node:fs', () => ({
  createReadStream: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  rm: vi.fn(),
}));

vi.mock('./ssrf-guard', () => {
  return {
    validateUrlNoSsrf: (rawUrl: string) => Promise.resolve(new URL(rawUrl)),
  };
});

import { createReadStream, statSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { MediaService } from './media.service';

class FakeStream extends EventEmitter {
  destroyed = false;

  pipe = vi.fn();

  destroy = vi.fn(() => {
    this.destroyed = true;
    this.emit('close');
    return this;
  });
}

class FakeResponse extends EventEmitter {
  headersSent = false;

  setHeader = vi.fn();

  status = vi.fn(() => this);

  json = vi.fn(() => this);

  destroy = vi.fn();
}

type ExtractorLike = {
  analyze(url: URL): Promise<MediaMetadata>;
  download(request: DownloadRequest, workDir?: string): Promise<DownloadResult>;
};

describe('MediaService download cleanup', () => {
  let extractor: ExtractorLike;
  let service: MediaService;

  beforeEach(() => {
    vi.clearAllMocks();
    extractor = {
      analyze: vi.fn(),
      download: vi.fn(),
    };
    service = new MediaService(extractor as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('limpia temporales al cerrar stream exitosamente', async () => {
    const stream = new FakeStream();
    vi.mocked(createReadStream).mockReturnValue(stream as never);
    vi.mocked(statSync).mockReturnValue({ size: 1234 } as never);
    vi.mocked(extractor.download).mockResolvedValue({
      filePath: '/tmp/social-downloader/file.mp4',
      fileName: 'file.mp4',
      contentType: 'video/mp4',
      size: 1234,
    });

    const res = new FakeResponse();

    await service.download({ url: 'https://youtu.be/demo', type: 'video' }, res as never);
    stream.emit('close');
    await Promise.resolve();

    expect(rm).toHaveBeenCalledTimes(1);
    expect(vi.mocked(rm).mock.calls[0]?.[0]).toContain('social-downloader');
  });

  it('limpia una sola vez cuando el cliente cierra la conexión', async () => {
    const stream = new FakeStream();
    vi.mocked(createReadStream).mockReturnValue(stream as never);
    vi.mocked(statSync).mockReturnValue({ size: 1234 } as never);
    vi.mocked(extractor.download).mockResolvedValue({
      filePath: '/tmp/social-downloader/file.mp4',
      fileName: 'file.mp4',
      contentType: 'video/mp4',
      size: 1234,
    });

    const res = new FakeResponse();

    await service.download({ url: 'https://youtu.be/demo', type: 'video' }, res as never);

    res.emit('close');
    res.emit('close');
    stream.emit('close');
    await Promise.resolve();

    expect(stream.destroy).toHaveBeenCalledTimes(1);
    expect(rm).toHaveBeenCalledTimes(1);
  });

  it('limpia y responde error si falla lectura del stream sin headers enviados', async () => {
    const stream = new FakeStream();
    vi.mocked(createReadStream).mockReturnValue(stream as never);
    vi.mocked(statSync).mockReturnValue({ size: 1234 } as never);
    vi.mocked(extractor.download).mockResolvedValue({
      filePath: '/tmp/social-downloader/file.mp4',
      fileName: 'file.mp4',
      contentType: 'video/mp4',
      size: 1234,
    });

    const res = new FakeResponse();

    await service.download({ url: 'https://youtu.be/demo', type: 'video' }, res as never);
    stream.emit('error', new Error('read failed'));
    await Promise.resolve();

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ code: 'DOWNLOAD_FAILED', message: 'No se pudo completar la descarga.' });
    expect(rm).toHaveBeenCalledTimes(1);
  });

  it('limpia temporales cuando falla antes de iniciar stream', async () => {
    vi.mocked(extractor.download).mockRejectedValue(new Error('boom'));
    const res = new FakeResponse();

    await expect(service.download({ url: 'https://youtu.be/demo', type: 'video' }, res as never)).rejects.toBeInstanceOf(ApiError);

    expect(rm).toHaveBeenCalledTimes(1);
  });

  it('prepara token temporal y lo consume una sola vez', async () => {
    const stream = new FakeStream();
    vi.mocked(createReadStream).mockReturnValue(stream as never);
    vi.mocked(statSync).mockReturnValue({ size: 1234 } as never);
    vi.mocked(extractor.download).mockResolvedValue({
      filePath: '/tmp/social-downloader/file.mp4',
      fileName: 'file.mp4',
      contentType: 'video/mp4',
      size: 1234,
    });

    const prepared = await service.prepareDownload({
      url: 'https://youtube.com/shorts/demo',
      type: 'video',
      quality: 720,
    });

    const token = prepared.downloadUrl.split('/').at(-1);
    expect(token).toBeTruthy();

    const res = new FakeResponse();
    await service.downloadPrepared(token!, res as never);

    await expect(service.downloadPrepared(token!, new FakeResponse() as never)).rejects.toBeInstanceOf(ApiError);
  });
});
