import { Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';

export interface RunMediaToolOptions {
  args: string[];
  timeoutMs?: number;
  signal?: AbortSignal;
  maxOutputBytes?: number;
}

export interface RunMediaToolResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

const FFMPEG_CANDIDATES = [
  process.env.FFMPEG_BINARY,
  '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg',
  '/opt/homebrew/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  '/usr/bin/ffmpeg',
  'ffmpeg',
].filter(Boolean) as string[];

const FFPROBE_CANDIDATES = [
  process.env.FFPROBE_BINARY,
  '/opt/homebrew/opt/ffmpeg-full/bin/ffprobe',
  '/opt/homebrew/bin/ffprobe',
  '/usr/local/bin/ffprobe',
  '/usr/bin/ffprobe',
  'ffprobe',
].filter(Boolean) as string[];

@Injectable()
export class FfmpegService {
  private ffmpegPath: string | null = null;
  private ffprobePath: string | null = null;

  async resolveFfmpeg(): Promise<string> {
    if (this.ffmpegPath) return this.ffmpegPath;
    for (const candidate of FFMPEG_CANDIDATES) {
      try {
        await access(candidate);
        this.ffmpegPath = candidate;
        return candidate;
      } catch {
        continue;
      }
    }
    throw new Error('FFmpeg not found. Install ffmpeg or set FFMPEG_BINARY.');
  }

  async resolveFfprobe(): Promise<string> {
    if (this.ffprobePath) return this.ffprobePath;
    for (const candidate of FFPROBE_CANDIDATES) {
      try {
        await access(candidate);
        this.ffprobePath = candidate;
        return candidate;
      } catch {
        continue;
      }
    }
    throw new Error('FFprobe not found. Install ffmpeg or set FFPROBE_BINARY.');
  }

  async runFfmpeg(options: RunMediaToolOptions): Promise<RunMediaToolResult> {
    const binary = await this.resolveFfmpeg();
    return this.run(binary, options);
  }

  async runFfprobe(options: RunMediaToolOptions): Promise<RunMediaToolResult> {
    const binary = await this.resolveFfprobe();
    return this.run(binary, options);
  }

  private run(
    binary: string,
    { args, timeoutMs = 120_000, signal, maxOutputBytes = 50 * 1024 * 1024 }: RunMediaToolOptions,
  ): Promise<RunMediaToolResult> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let killed = false;

      const child = spawn(binary, args, {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        killed = true;
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL');
        }, 3000);
      }, timeoutMs);

      const onAbort = (): void => {
        clearTimeout(timer);
        killed = true;
        child.kill('SIGTERM');
        reject(new Error('CANCELLED'));
      };

      if (signal) {
        if (signal.aborted) {
          clearTimeout(timer);
          child.kill('SIGTERM');
          reject(new Error('CANCELLED'));
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
        if (stdout.length > maxOutputBytes) {
          killed = true;
          child.kill('SIGTERM');
        }
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.once('error', (error) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(error);
      });

      child.once('close', (code) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        if (killed && !stderr) {
          reject(new Error('TIMEOUT'));
          return;
        }
        resolve({ stdout, stderr, exitCode: code });
      });
    });
  }

  parseProgressTime(stderr: string): number | null {
    const match = stderr.match(/time=\s*(\d+):(\d+):(\d+)\.(\d+)/);
    if (!match) return null;
    const [, h, m, s] = match;
    return Number(h) * 3600 + Number(m) * 60 + Number(s);
  }
}
