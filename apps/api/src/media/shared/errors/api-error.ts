import { HttpException } from '@nestjs/common';
import type { ApiErrorCode } from './error-codes';
import { ERROR_MESSAGES } from './error-codes';

export class ApiError extends HttpException {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, detail?: string) {
    super(
      {
        code,
        message: detail ?? ERROR_MESSAGES[code],
      },
      ApiError.codeToStatus(code),
    );
    this.code = code;
  }

  private static codeToStatus(code: ApiErrorCode): number {
    switch (code) {
      case 'INVALID_URL':
      case 'UNSUPPORTED_PLATFORM':
      case 'FORMAT_NOT_AVAILABLE':
      case 'DOWNLOAD_TOO_LARGE':
      case 'INVALID_DOWNLOAD_TOKEN':
        return 400;
      case 'PRIVATE_MEDIA':
      case 'AUTH_REQUIRED':
      case 'GEO_RESTRICTED':
      case 'SSRF_BLOCKED':
        return 403;
      case 'MEDIA_NOT_AVAILABLE':
        return 404;
      case 'TOO_MANY_REQUESTS':
        return 429;
      case 'ANALYSIS_TIMEOUT':
      case 'DOWNLOAD_TIMEOUT':
      case 'DOWNLOAD_FAILED':
      case 'DOWNLOAD_CANCELLED':
      case 'YTDLP_NOT_AVAILABLE':
        return 502;
      default:
        return 500;
    }
  }
}
