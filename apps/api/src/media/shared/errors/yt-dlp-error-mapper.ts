import type { ApiErrorCode } from './error-codes';

type YtDlpPattern = {
  pattern: RegExp;
  code: ApiErrorCode;
};

/**
 * El orden IMPORTA: `mapYtDlpError` devuelve la primera coincidencia, así que lo específico
 * tiene que ir antes que lo genérico. Por ejemplo, el bot check de YouTube dice
 * "Sign in to confirm you're not a bot": si `/sign in/i` va primero, se clasifica como
 * AUTH_REQUIRED ("inicia sesión") en vez de como un bloqueo de la plataforma, y el usuario
 * recibe un consejo que no le sirve de nada.
 */
const YTDLP_PATTERNS: YtDlpPattern[] = [
  // ── Bloqueos de la plataforma (antes que los genéricos que los taparían) ──
  { pattern: /confirm you'?re not a bot|confirm you are not a bot|not a robot|captcha/i, code: 'PLATFORM_BLOCKED' },
  { pattern: /impersonat/i, code: 'PLATFORM_BLOCKED' },
  { pattern: /unable to extract universal data/i, code: 'PLATFORM_BLOCKED' },
  // Lo que TikTok devuelve cuando limita la IP o rechaza el reto JS. Es el mensaje que se
  // veia en produccion, y no lo cubria ningun patron: acababa en DOWNLOAD_FAILED.
  { pattern: /unexpected response from webpage/i, code: 'PLATFORM_BLOCKED' },
  { pattern: /unable to extract (?:webpage|initial state|sigi state|data)/i, code: 'PLATFORM_BLOCKED' },
  { pattern: /HTTP Error 429/i, code: 'TOO_MANY_REQUESTS' },
  { pattern: /rate.?limit/i, code: 'TOO_MANY_REQUESTS' },

  // ── Estado del contenido ──
  /**
   * X/Twitter. El mensaje es ambiguo a proposito: yt-dlp lo lanza tanto cuando el tweet
   * no lleva video como cuando X se lo oculta a un visitante sin sesion (devuelve un
   * TweetTombstone). Desde stderr no se pueden distinguir, asi que el mensaje cubre ambos.
   */
  { pattern: /no video could be found in this tweet|there'?s no video in this tweet/i, code: 'NO_VIDEO_FOUND' },
  { pattern: /no video formats? found|no media found/i, code: 'NO_VIDEO_FOUND' },
  { pattern: /nsfw tweet requires authentication|requires authentication/i, code: 'AUTH_REQUIRED' },
  { pattern: /age.?restricted/i, code: 'AUTH_REQUIRED' },
  { pattern: /Video unavailable/i, code: 'MEDIA_NOT_AVAILABLE' },
  { pattern: /tweet is unavailable|post is unavailable/i, code: 'MEDIA_NOT_AVAILABLE' },
  { pattern: /This video is private/i, code: 'PRIVATE_MEDIA' },
  { pattern: /Private video/i, code: 'PRIVATE_MEDIA' },
  { pattern: /account is private|private account/i, code: 'PRIVATE_MEDIA' },
  { pattern: /not available in your country/i, code: 'GEO_RESTRICTED' },
  { pattern: /geo.?restrict/i, code: 'GEO_RESTRICTED' },
  { pattern: /requested format is not available/i, code: 'FORMAT_NOT_AVAILABLE' },
  { pattern: /format not available/i, code: 'FORMAT_NOT_AVAILABLE' },

  // ── Sesión ──
  { pattern: /sign in/i, code: 'AUTH_REQUIRED' },
  { pattern: /login required/i, code: 'AUTH_REQUIRED' },

  // ── URL que yt-dlp no sabe manejar ──
  { pattern: /unsupported url/i, code: 'UNSUPPORTED_PLATFORM' },
  { pattern: /is not a valid url/i, code: 'INVALID_URL' },

  // ── Genéricos, al final ──
  { pattern: /HTTP Error 403/i, code: 'MEDIA_NOT_AVAILABLE' },
  { pattern: /HTTP Error 404/i, code: 'MEDIA_NOT_AVAILABLE' },
  { pattern: /HTTP Error 410/i, code: 'MEDIA_NOT_AVAILABLE' },
  { pattern: /unable to download/i, code: 'DOWNLOAD_FAILED' },
];

export function mapYtDlpError(stderr: string): ApiErrorCode {
  for (const { pattern, code } of YTDLP_PATTERNS) {
    if (pattern.test(stderr)) return code;
  }
  return 'DOWNLOAD_FAILED';
}
