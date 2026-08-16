import { BadGatewayException, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PlatformDetector } from './platform-detector';

@Injectable()
export class MediaService {
  constructor(private readonly detector: PlatformDetector) {}

  async analyze(url: string): Promise<unknown> {
    const platform = this.detector.detect(url);
    const output = await this.execYtDlp(['--dump-single-json', '--skip-download', '--no-playlist', url]);
    const data = JSON.parse(output) as Record<string, unknown>;
    return { platform, ...data };
  }

  async download(request: { url: string; kind: 'video' | 'audio'; quality?: number; audioFormat?: 'mp3' | 'm4a' | 'opus' }, res: Response): Promise<void> {
    this.detector.detect(request.url);
    const dir = await mkdtemp(join(tmpdir(), 'social-downloader-'));
    const outputTemplate = join(dir, '%(title).180B-%(id)s.%(ext)s');
    const args = ['--no-playlist', '--restrict-filenames', '-o', outputTemplate];

    if (request.kind === 'audio') {
      args.push('-x', '--audio-format', request.audioFormat ?? 'mp3', '--audio-quality', '0');
    } else {
      const maxHeight = request.quality ?? 1080;
      args.push('-f', `bestvideo[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]`, '--merge-output-format', 'mp4');
    }

    args.push('--print', 'after_move:filepath', request.url);
    try {
      const stdout = await this.execYtDlp(args);
      const filepath = stdout.trim().split('\n').at(-1);
      if (!filepath) throw new BadGatewayException('No se pudo determinar el archivo descargado');
      const filename = filepath.split('/').at(-1) ?? 'download';
      res.download(filepath, filename, async () => { await rm(dir, { recursive: true, force: true }); });
    } catch (error) {
      await rm(dir, { recursive: true, force: true });
      throw error;
    }
  }

  private execYtDlp(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(process.env.YTDLP_BIN ?? 'yt-dlp', args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
      child.once('error', reject);
      child.once('close', (code) => code === 0 ? resolve(stdout) : reject(new BadGatewayException(stderr || `yt-dlp terminó con código ${code}`)));
    });
  }
}
