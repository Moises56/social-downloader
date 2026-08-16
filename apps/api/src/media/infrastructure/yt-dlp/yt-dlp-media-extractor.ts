import { BadGatewayException, Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { access, mkdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { detectPlatform, type DownloadRequest, type DownloadResult, type MediaMetadata } from '../../domain/media-platform';
import { ensurePublicUrl } from '../ssrf/url-safety';

type YtDlpCommand = {
  command: string;
  baseArgs: string[];
};

@Injectable()
export class YtDlpMediaExtractor {
  private readonly commandCandidates: YtDlpCommand[];

  constructor() {
    this.commandCandidates = this.resolveCandidates();
  }

  async analyze(url: URL): Promise<MediaMetadata> {
    const safe = await ensurePublicUrl(url.href);
    const args = ['--dump-single-json', '--skip-download', '--no-playlist', safe.href];
    const stdout = await this.runYtDlp(args, Number(process.env.ANALYSIS_TIMEOUT_MS ?? 30000), 'analysis');
    const parsed = JSON.parse(stdout) as Record<string, unknown>;

    return {
      platform: detectPlatform(safe.href),
      title: String(parsed.title ?? 'Untitled'),
      thumbnail: typeof parsed.thumbnail === 'string' ? parsed.thumbnail : undefined,
      duration: typeof parsed.duration === 'number' ? parsed.duration : undefined,
      author: typeof parsed.uploader === 'string' ? parsed.uploader : undefined,
      sourceUrl: safe.href,
      formats: this.normalizeFormats(Array.isArray(parsed.formats) ? parsed.formats as Array<Record<string, unknown>> : undefined),
    };
  }

  async download(request: DownloadRequest, workDir?: string): Promise<DownloadResult> {
    const safeUrl = await ensurePublicUrl(request.url);
    const baseDir = workDir ?? join(process.cwd(), 'temp', randomUUID());
    await mkdir(baseDir, { recursive: true });

    const outputTemplate = join(baseDir, '%(title).180B-%(id)s.%(ext)s');
    const args = ['--no-playlist', '--restrict-filenames', '-o', outputTemplate];

    if (request.type === 'audio') {
      const audioFormat = request.audioFormat ?? 'mp3';
      args.push('-x', '--audio-format', audioFormat, '--audio-quality', '0');
    } else {
      const maxHeight = request.quality ?? 1080;
      args.push('-f', `bestvideo[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]`, '--merge-output-format', 'mp4');
    }

    args.push('--print', 'after_move:filepath', safeUrl.href);

    const stdout = await this.runYtDlp(args, Number(process.env.DOWNLOAD_TIMEOUT_MS ?? 900000), 'download');
    const filepath = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
    if (!filepath) {
      throw new BadGatewayException('DOWNLOAD_FAILED');
    }

    try {
      await access(filepath);
      const filename = filepath.split('/').at(-1) ?? 'download';
      const contentType = request.type === 'audio' ? 'audio/mpeg' : 'video/mp4';
      const { size } = await stat(filepath);
      return { filePath: filepath, fileName: filename, contentType, size };
    } catch {
      await rm(baseDir, { recursive: true, force: true });
      throw new BadGatewayException('DOWNLOAD_FAILED');
    }
  }

  private normalizeFormats(formats: Array<Record<string, unknown>> | undefined): Array<{
    id: string;
    ext: string;
    resolution?: string;
    width?: number;
    height?: number;
    container?: string;
    videoCodec?: string | null;
    audioCodec?: string | null;
    filesize?: number;
    formatNote?: string;
  }> {
    if (!formats) return [];

    return formats
      .filter((format) => typeof format.id === 'string' || typeof format.format_id === 'string')
      .map((format) => ({
        id: String(format.id ?? format.format_id ?? 'unknown'),
        ext: String(format.ext ?? 'unknown'),
        resolution: typeof format.resolution === 'string' ? format.resolution : undefined,
        width: typeof format.width === 'number' ? format.width : undefined,
        height: typeof format.height === 'number' ? format.height : undefined,
        container: typeof format.container === 'string' ? format.container : undefined,
        videoCodec: typeof format.vcodec === 'string' ? format.vcodec : null,
        audioCodec: typeof format.acodec === 'string' ? format.acodec : null,
        filesize: typeof format.filesize === 'number' ? format.filesize : undefined,
        formatNote: typeof format.format_note === 'string' ? format.format_note : undefined,
      }))
      .slice(0, 30);
  }

  private runYtDlp(args: string[], timeoutMs: number, operation: 'analysis' | 'download'): Promise<string> {
    const candidates = this.commandCandidates.length > 0 ? this.commandCandidates : this.resolveCandidates();

    return new Promise((resolve, reject) => {
      const executeCandidate = (index: number): void => {
        const candidate = candidates[index];
        if (!candidate) {
          reject(
            new BadGatewayException('YTDLP_ERROR: yt-dlp no disponible. Instala yt-dlp o define YTDLP_BINARY.'),
          );
          return;
        }

        const child = spawn(candidate.command, [...candidate.baseArgs, ...args], {
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';

        const timer = setTimeout(() => {
          child.kill('SIGTERM');
          reject(new BadGatewayException(operation === 'analysis' ? 'ANALYSIS_TIMEOUT' : 'DOWNLOAD_TIMEOUT'));
        }, timeoutMs);

        child.stdout.on('data', (chunk: Buffer) => {
          stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString();
        });
        child.once('error', (error) => {
          clearTimeout(timer);
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            executeCandidate(index + 1);
            return;
          }
          reject(new BadGatewayException(`YTDLP_ERROR: ${String(error.message)}`));
        });
        child.once('close', (code) => {
          clearTimeout(timer);
          if (code === 0) {
            resolve(stdout);
            return;
          }
          reject(new BadGatewayException(stderr || 'MEDIA_NOT_AVAILABLE'));
        });
      };

      executeCandidate(0);
    });
  }

  private resolveCandidates(): YtDlpCommand[] {
    const candidates: YtDlpCommand[] = [];

    if (process.env.YTDLP_BINARY?.trim()) {
      candidates.push({ command: process.env.YTDLP_BINARY.trim(), baseArgs: [] });
    }

    candidates.push(
      { command: 'yt-dlp', baseArgs: [] },
      { command: 'python3', baseArgs: ['-m', 'yt_dlp'] },
      { command: 'python', baseArgs: ['-m', 'yt_dlp'] },
    );

    return candidates;
  }
}
