import { Injectable } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { access, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { detectPlatform, type DownloadRequest, type DownloadResult, type MediaMetadata } from '../../domain/media-platform';
import { ensurePublicUrl } from '../ssrf/url-safety';
import { resolveMimeTypeFromFilename } from './mime-type';
import { ApiError, mapYtDlpError } from '../../shared/errors';

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

  /**
   * Argumentos que deciden CÓMO se presenta yt-dlp ante la plataforma. Van tanto en el
   * análisis como en la descarga: si solo fueran en uno de los dos, un vídeo se analizaría
   * bien y luego fallaría al descargarlo, que es el peor modo de fallo posible.
   *
   * - `--cookies-from-browser`: Instagram, Facebook y TikTok devuelven poco o nada sin una
   *   sesión. La variable YTDLP_COOKIES_FROM_BROWSER ya existía en .env pero no se leía en
   *   ninguna parte, así que prometía algo que no ocurría.
   * - `--impersonate`: TikTok exige que el cliente se haga pasar por un navegador real.
   *   Requiere curl_cffi instalado junto a yt-dlp; sin él no hay ningún objetivo disponible
   *   y la descarga falla.
   */
  private clientArgs(): string[] {
    const args: string[] = [];

    /**
     * Un fichero de cookies exportado gana sobre leerlas del navegador, y no por gusto:
     * en macOS `--cookies-from-browser chrome` tiene que descifrar la base de datos con la
     * clave "Chrome Safe Storage" del llavero, y eso abre un diálogo. Un proceso servidor
     * no tiene a nadie que lo conteste, así que el llavero deniega y yt-dlp continúa con
     * CERO cookies ("cannot decrypt v10 cookies: no key found") — sólo un warning, y la
     * descarga falla luego por un motivo que no tiene nada que ver. Con el fichero se
     * paga ese diálogo una vez, a mano, y el servidor ya no depende del llavero.
     */
    const cookiesFile = process.env.YTDLP_COOKIES_FILE?.trim();
    const cookiesFrom = process.env.YTDLP_COOKIES_FROM_BROWSER?.trim();
    if (cookiesFile) {
      args.push('--cookies', cookiesFile);
    } else if (cookiesFrom) {
      args.push('--cookies-from-browser', cookiesFrom);
    }

    const impersonate = process.env.YTDLP_IMPERSONATE?.trim();
    if (impersonate) {
      args.push('--impersonate', impersonate);
    }

    /**
     * TikTok limita por IP de forma agresiva: desde una única conexión doméstica bastan
     * unas diez peticiones para quedarse fuera durante un buen rato. Los servicios web que
     * sí descargan TikTok de forma sostenida no usan una técnica distinta, usan MUCHAS IPs.
     * Este es el interruptor para hacer lo mismo cuando haga falta volumen.
     */
    const proxy = process.env.YTDLP_PROXY?.trim();
    if (proxy) {
      args.push('--proxy', proxy);
    }

    /**
     * Ruta de extracción alternativa: la API de la app móvil en vez de la página web.
     * Es la que devuelve el vídeo sin marca de agua, y no comparte los límites del scraping
     * web. Ejemplo: "tiktok:api_hostname=api22-normal-c-useast2a.tiktokv.com".
     */
    /**
     * Se separan con `|` porque hace falta uno por extractor y las descargas reales ya piden
     * dos a la vez: YouTube necesita `player_client` para los videos con restriccion de edad
     * y TikTok su `api_hostname`. Ni `,` ni `;` sirven de separador, que son la sintaxis
     * interna de yt-dlp (`youtube:player_client=default,web_safari;formats=incomplete`).
     */
    const extractorArgs = process.env.YTDLP_EXTRACTOR_ARGS?.trim();
    if (extractorArgs) {
      for (const group of extractorArgs.split('|')) {
        const trimmed = group.trim();
        if (trimmed) args.push('--extractor-args', trimmed);
      }
    }

    /**
     * YouTube firma las URLs de sus formatos con un reto JS. Sin resolverlo, yt-dlp avisa
     * ("Signature solving failed", "n challenge solving failed") y sigue adelante con lo que
     * puede. Medido en este repo sobre un vídeo público: la lista de formatos y la velocidad
     * salen IGUAL con solver y sin él, así que esto no arregla por sí solo una descarga que
     * falla — pero es lo que yt-dlp recomienda, y es lo que cubre los vídeos en los que la
     * firma sí condiciona los formatos. Su efecto seguro es callar los warnings, que ademas
     * eran los que tapaban la linea ERROR en el log.
     * El solver es un componente que yt-dlp descarga aparte y sólo si se le pide.
     * Requiere un runtime de JS en el sistema (Deno, o Node con `ejs:npm`).
     * No se activa por defecto a propósito: `--remote-components` es una opción reciente y
     * un yt-dlp viejo aborta con "no such option", que rompería TODAS las descargas en vez
     * de degradar sólo YouTube. Va explícito en .env, que es donde ya se fija la versión.
     */
    const remoteComponents = process.env.YTDLP_REMOTE_COMPONENTS?.trim();
    if (remoteComponents) {
      args.push('--remote-components', remoteComponents);
    }

    return args;
  }

  async analyze(url: URL, signal?: AbortSignal): Promise<MediaMetadata> {
    const safe = await ensurePublicUrl(url.href);
    const args = ['--dump-single-json', '--skip-download', '--no-playlist', ...this.clientArgs(), safe.href];
    const stdout = await this.runYtDlp(args, Number(process.env.ANALYSIS_TIMEOUT_MS ?? 30000), 'analysis', signal);
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

  async download(request: DownloadRequest, workDir?: string, signal?: AbortSignal): Promise<DownloadResult> {
    const safeUrl = await ensurePublicUrl(request.url);
    const baseDir = workDir ?? join(process.cwd(), 'temp', randomUUID());
    await mkdir(baseDir, { recursive: true });

    const outputTemplate = join(baseDir, '%(title).180B-%(id)s.%(ext)s');
    const args = ['--no-playlist', '--restrict-filenames', '-o', outputTemplate, ...this.clientArgs()];

    if (request.type === 'audio') {
      const audioFormat = request.audioFormat ?? 'mp3';
      args.push('-x', '--audio-format', audioFormat, '--audio-quality', '0');
    } else {
      const maxHeight = request.quality ?? 1080;
      args.push('-f', `bestvideo[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]`, '--merge-output-format', 'mp4');
    }

    args.push('--print', 'after_move:filepath', safeUrl.href);

    const stdout = await this.runYtDlp(args, Number(process.env.DOWNLOAD_TIMEOUT_MS ?? 900000), 'download', signal);
    let filepath = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);

    if (!filepath) {
      throw new ApiError('DOWNLOAD_FAILED');
    }

    // Fallback: if the printed path doesn't exist, try to find the file in workDir
    try {
      await access(filepath);
    } catch {
      const files = await readdir(baseDir).catch(() => []);
      const mediaFile = files.find((f) => /\.(mp4|mp3|m4a|opus|webm|mkv|avi)$/i.test(f));
      if (mediaFile) {
        filepath = join(baseDir, mediaFile);
      } else {
        throw new ApiError('DOWNLOAD_FAILED');
      }
    }

    try {
      await access(filepath);
      const filename = filepath.split('/').at(-1) ?? 'download';
      const contentType = resolveMimeTypeFromFilename(filename);
      const { size } = await stat(filepath);
      return { filePath: filepath, fileName: filename, contentType, size };
    } catch {
      await rm(baseDir, { recursive: true, force: true });
      throw new ApiError('DOWNLOAD_FAILED');
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

  private runYtDlp(args: string[], timeoutMs: number, operation: 'analysis' | 'download', signal?: AbortSignal): Promise<string> {
    const candidates = this.commandCandidates.length > 0 ? this.commandCandidates : this.resolveCandidates();
    const GRACE_MS = 3000;

    return new Promise((resolve, reject) => {
      let rejected = false;
      const safeReject = (error: unknown): void => {
        if (rejected) return;
        rejected = true;
        reject(error);
      };

      const executeCandidate = (index: number): void => {
        const candidate = candidates[index];
        if (!candidate) {
          safeReject(
            new ApiError('YTDLP_NOT_AVAILABLE'),
          );
          return;
        }

        const child = spawn(candidate.command, [...candidate.baseArgs, ...args], {
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';

        let termSent = false;

        const killWithGrace = (): void => {
          if (child.exitCode !== null) return;
          if (!termSent) {
            termSent = true;
            child.kill('SIGTERM');
            setTimeout(() => {
              if (child.exitCode !== null) return;
              child.kill('SIGKILL');
            }, GRACE_MS);
          }
        };

        const timer = setTimeout(() => {
          killWithGrace();
          safeReject(new ApiError(operation === 'analysis' ? 'ANALYSIS_TIMEOUT' : 'DOWNLOAD_TIMEOUT'));
        }, timeoutMs);

        const onAbort = (): void => {
          clearTimeout(timer);
          killWithGrace();
          safeReject(new ApiError('DOWNLOAD_CANCELLED'));
        };

        if (signal) {
          if (signal.aborted) {
            clearTimeout(timer);
            killWithGrace();
            safeReject(new ApiError('DOWNLOAD_CANCELLED'));
            return;
          }
          signal.addEventListener('abort', onAbort, { once: true });
        }

        child.stdout.on('data', (chunk: Buffer) => {
          stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString();
        });
        child.once('error', (error) => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            executeCandidate(index + 1);
            return;
          }
          safeReject(new ApiError('YTDLP_NOT_AVAILABLE', String(error.message)));
        });
        child.once('close', (code) => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
          if (code === 0) {
            resolve(stdout);
            return;
          }
          const mapped = mapYtDlpError(stderr);
          console.error(
            `[YtDlp] ${operation} falló (exit ${code}) → ${mapped}\n${relevantStderr(stderr)}`,
          );
          safeReject(new ApiError(mapped));
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

/**
 * Los primeros 500 caracteres de stderr son casi siempre warnings — los de YouTube sobre el
 * solver de retos JS pasan de 400 cada uno — así que el log truncado desde el principio no
 * llegaba a mostrar nunca la línea ERROR, que es la única que dice qué pasó. Se prefieren
 * las líneas ERROR y, si no hay ninguna, la COLA de stderr en vez de la cabeza.
 */
export function relevantStderr(stderr: string): string {
  const errorLines = stderr
    .split('\n')
    .filter((line) => /^\s*ERROR:/.test(line));
  if (errorLines.length > 0) return errorLines.join('\n').slice(0, 1000);
  return stderr.slice(-500).trimStart();
}
