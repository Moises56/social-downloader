import { Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { join } from 'node:path';

export interface RunMediaToolOptions {
  args: string[];
  timeoutMs?: number;
  signal?: AbortSignal;
  maxOutputBytes?: number;
  onStderr?: (chunk: string) => void;
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

  private drawtextAvailable: boolean | null = null;

  /**
   * Localiza un candidato. Un candidato con `/` es una ruta y se comprueba tal cual;
   * uno sin `/` (p. ej. `FFMPEG_BINARY=ffmpeg`) es un nombre que hay que buscar en el PATH.
   *
   * Antes todo pasaba por `access()`, que resuelve rutas relativas contra el cwd, nunca
   * contra el PATH: un nombre suelto siempre fallaba y se descartaba en silencio. Es decir,
   * `FFMPEG_BINARY=ffmpeg` no seleccionaba nada y el último fallback `'ffmpeg'` era código
   * muerto — se acababa usando la primera ruta absoluta que existiera, por casualidad.
   */
  private async locate(candidate: string): Promise<string | null> {
    if (candidate.includes('/')) {
      try {
        await access(candidate, constants.X_OK);
        return candidate;
      } catch {
        return null;
      }
    }
    for (const dir of (process.env.PATH ?? '').split(':').filter(Boolean)) {
      const full = join(dir, candidate);
      try {
        await access(full, constants.X_OK);
        return full;
      } catch {
        continue;
      }
    }
    return null;
  }

  /** ¿Este build trae `drawtext`? Homebrew ya no enlaza libfreetype, así que no se puede dar
   *  por hecho: sin él, cualquier render con texto muere con "No such filter: 'drawtext'". */
  private async probeDrawtext(binary: string): Promise<boolean> {
    try {
      const { stdout } = await this.run(binary, { args: ['-hide_banner', '-filters'], timeoutMs: 10_000 });
      return /^\s*\S+\s+drawtext\s/m.test(stdout);
    } catch {
      return false;
    }
  }

  async resolveFfmpeg(): Promise<string> {
    if (this.ffmpegPath) return this.ffmpegPath;

    const explicit = process.env.FFMPEG_BINARY;
    if (explicit) {
      // Un binario indicado a mano manda siempre, aunque le falten filtros: es una decisión
      // del operador. Solo se avisa de lo que va a romperse.
      const located = await this.locate(explicit);
      if (located) {
        this.ffmpegPath = located;
        this.drawtextAvailable = await this.probeDrawtext(located);
        if (!this.drawtextAvailable) {
          console.warn(
            `[Ffmpeg] FFMPEG_BINARY=${explicit} no soporta drawtext: los renders con texto fallarán.`,
          );
        }
        return located;
      }
      console.warn(`[Ffmpeg] FFMPEG_BINARY=${explicit} no se encontró; usando la detección automática.`);
    }

    // Sin override: se prefiere un build capaz de dibujar texto sobre uno que solo exista.
    let firstFound: string | null = null;
    for (const candidate of FFMPEG_CANDIDATES) {
      if (candidate === explicit) continue;
      const located = await this.locate(candidate);
      if (!located) continue;
      firstFound ??= located;
      if (await this.probeDrawtext(located)) {
        this.ffmpegPath = located;
        this.drawtextAvailable = true;
        return located;
      }
    }

    if (firstFound) {
      this.ffmpegPath = firstFound;
      this.drawtextAvailable = false;
      console.warn(
        `[Ffmpeg] Ningún FFmpeg disponible soporta drawtext (usando ${firstFound}). ` +
          'Instala un build con libfreetype para renderizar texto.',
      );
      return firstFound;
    }

    throw new Error('FFmpeg not found. Install ffmpeg or set FFMPEG_BINARY.');
  }

  /** Para que el renderer pueda fallar con un mensaje claro antes de lanzar el proceso. */
  async supportsDrawtext(): Promise<boolean> {
    await this.resolveFfmpeg();
    return this.drawtextAvailable ?? false;
  }

  async resolveFfprobe(): Promise<string> {
    if (this.ffprobePath) return this.ffprobePath;
    for (const candidate of FFPROBE_CANDIDATES) {
      const located = await this.locate(candidate);
      if (located) {
        this.ffprobePath = located;
        return located;
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
    { args, timeoutMs = 120_000, signal, maxOutputBytes = 50 * 1024 * 1024, onStderr }: RunMediaToolOptions,
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
        const str = chunk.toString();
        stderr += str;
        onStderr?.(str);
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
