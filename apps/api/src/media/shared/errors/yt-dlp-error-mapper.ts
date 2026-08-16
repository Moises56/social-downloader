import type { ApiErrorCode } from './error-codes';

type YtDlpPattern = {
  pattern: RegExp;
  code: ApiErrorCode;
};

const YTDLP_PATTERNS: YtDlpPattern[] = [
  { pattern: /Video unavailable/i, code: 'MEDIA_NOT_AVAILABLE' },
  { pattern: /This video is private/i, code: 'PRIVATE_MEDIA' },
  { pattern: /Private video/i, code: 'PRIVATE_MEDIA' },
  { pattern: /sign in/i, code: 'AUTH_REQUIRED' },
  { pattern: /login required/i, code: 'AUTH_REQUIRED' },
  { pattern: /not available in your country/i, code: 'GEO_RESTRICTED' },
  { pattern: /geo.?restrict/i, code: 'GEO_RESTRICTED' },
  { pattern: /requested format is not available/i, code: 'FORMAT_NOT_AVAILABLE' },
  { pattern: /format not available/i, code: 'FORMAT_NOT_AVAILABLE' },
  { pattern: /no video formats found/i, code: 'MEDIA_NOT_AVAILABLE' },
  { pattern: /unable to download/i, code: 'DOWNLOAD_FAILED' },
  { pattern: /HTTP Error 403/i, code: 'MEDIA_NOT_AVAILABLE' },
  { pattern: /HTTP Error 404/i, code: 'MEDIA_NOT_AVAILABLE' },
  { pattern: /HTTP Error 410/i, code: 'MEDIA_NOT_AVAILABLE' },
];

export function mapYtDlpError(stderr: string): ApiErrorCode {
  for (const { pattern, code } of YTDLP_PATTERNS) {
    if (pattern.test(stderr)) return code;
  }
  return 'DOWNLOAD_FAILED';
}
