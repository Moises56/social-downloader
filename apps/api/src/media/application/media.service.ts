import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream, statSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import { detectPlatform, type DownloadRequest, type MediaMetadata } from '../domain/media-platform';
import { YtDlpMediaExtractor } from '../infrastructure/yt-dlp/yt-dlp-media-extractor';

export const analyzeSchema = z.object({
  url: z.string().trim().url('INVALID_URL'),
});

export const downloadSchema = z.object({
  url: z.string().trim().url('INVALID_URL'),
  type: z.enum(['video', 'audio']),
  quality: z.number().int().min(144).max(4320).optional(),
  audioFormat: z.enum(['mp3', 'm4a', 'opus']).optional(),
});

type PreparedDownload = {
  request: DownloadRequest;
  expiresAt: number;
};

const DOWNLOAD_TOKEN_TTL_MS = 2 * 60 * 1000;

@Injectable()
export class MediaService {
  private readonly preparedDownloads = new Map<string, PreparedDownload>();

  constructor(private readonly extractor: YtDlpMediaExtractor) {}

  async analyze(rawUrl: string): Promise<MediaMetadata> {
    const url = this.normalizeUrl(rawUrl);
    const platform = detectPlatform(url.href);
    const metadata = await this.extractor.analyze(url);

    if (platform !== metadata.platform) {
      throw new BadRequestException('UNSUPPORTED_PLATFORM');
    }

    return metadata;
  }

  async download(payload: DownloadRequest, res: Response): Promise<void> {
    await this.downloadWithStream(payload, res);
  }

  prepareDownload(payload: DownloadRequest): { downloadUrl: string } {
    const url = this.normalizeUrl(payload.url);
    detectPlatform(url.href);

    this.purgeExpiredDownloadTokens();
    const token = randomUUID().replace(/-/g, '');
    this.preparedDownloads.set(token, {
      request: { ...payload, url: url.href },
      expiresAt: Date.now() + DOWNLOAD_TOKEN_TTL_MS,
    });

    return {
      downloadUrl: `/api/media/download/${token}`,
    };
  }

  async downloadPrepared(token: string, res: Response): Promise<void> {
    const prepared = this.consumePreparedDownload(token);
    await this.downloadWithStream(prepared.request, res);
  }

  private async downloadWithStream(payload: DownloadRequest, res: Response): Promise<void> {
    const url = this.normalizeUrl(payload.url);
    const workDir = join(tmpdir(), 'social-downloader', randomUUID());

    try {
      const file = await this.extractor.download({ ...payload, url: url.href }, workDir);
      const size = statSync(file.filePath).size;
      const stream = createReadStream(file.filePath);
      let cleaned = false;

      const cleanupOnce = async (): Promise<void> => {
        if (cleaned) return;
        cleaned = true;
        await this.cleanup(workDir);
      };

      const cleanupAndIgnore = (): void => {
        void cleanupOnce();
      };

      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Content-Length', String(size));
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
      res.setHeader('Cache-Control', 'no-store');

      stream.once('error', () => {
        cleanupAndIgnore();
        if (!res.headersSent) {
          res.status(500).json({ code: 'DOWNLOAD_FAILED', message: 'No se pudo completar la descarga.' });
          return;
        }
        res.destroy();
      });

      stream.once('close', cleanupAndIgnore);

      res.once('close', () => {
        if (!stream.destroyed) {
          stream.destroy();
        }
        cleanupAndIgnore();
      });

      res.once('finish', cleanupAndIgnore);

      stream.pipe(res);
    } catch {
      await this.cleanup(workDir);
      throw new InternalServerErrorException('DOWNLOAD_FAILED');
    }
  }

  private consumePreparedDownload(token: string): PreparedDownload {
    this.purgeExpiredDownloadTokens();

    const prepared = this.preparedDownloads.get(token);
    if (!prepared) {
      throw new BadRequestException('INVALID_DOWNLOAD_TOKEN');
    }

    this.preparedDownloads.delete(token);
    if (prepared.expiresAt < Date.now()) {
      throw new BadRequestException('INVALID_DOWNLOAD_TOKEN');
    }

    return prepared;
  }

  private purgeExpiredDownloadTokens(now = Date.now()): void {
    for (const [token, prepared] of this.preparedDownloads.entries()) {
      if (prepared.expiresAt < now) {
        this.preparedDownloads.delete(token);
      }
    }
  }

  private async cleanup(dir: string): Promise<void> {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch {
      // noop
    }
  }

  private normalizeUrl(rawUrl: string): URL {
    try {
      const url = new URL(rawUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new BadRequestException('INVALID_URL');
      }
      return url;
    } catch {
      throw new BadRequestException('INVALID_URL');
    }
  }
}
