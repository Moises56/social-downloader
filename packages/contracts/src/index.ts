export type MediaPlatform = 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'x';
export type DownloadType = 'video' | 'audio';
export type AudioFormat = 'mp3' | 'm4a' | 'opus';

export interface MediaFormat {
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
}

export interface MediaMetadata {
  platform: MediaPlatform;
  title: string;
  thumbnail?: string;
  duration?: number;
  author?: string;
  sourceUrl: string;
  formats: MediaFormat[];
}

export interface AnalyzeMediaRequest {
  url: string;
}

export type AnalyzeMediaResponse = MediaMetadata;

export interface DownloadRequest {
  url: string;
  type: DownloadType;
  quality?: number;
  audioFormat?: AudioFormat;
}

export interface DownloadResult {
  filePath: string;
  fileName: string;
  contentType: string;
  size: number;
}

export interface PrepareDownloadRequest {
  url: string;
  type: DownloadType;
  quality?: number;
  audioFormat?: AudioFormat;
}

export interface PrepareDownloadResponse {
  downloadUrl: string;
}

export type ApiErrorCode =
  | 'INVALID_URL'
  | 'UNSUPPORTED_PLATFORM'
  | 'MEDIA_NOT_AVAILABLE'
  | 'PRIVATE_MEDIA'
  | 'AUTH_REQUIRED'
  | 'GEO_RESTRICTED'
  | 'FORMAT_NOT_AVAILABLE'
  | 'DOWNLOAD_TOO_LARGE'
  | 'ANALYSIS_TIMEOUT'
  | 'DOWNLOAD_TIMEOUT'
  | 'DOWNLOAD_FAILED'
  | 'YTDLP_NOT_AVAILABLE'
  | 'SSRF_BLOCKED'
  | 'INVALID_DOWNLOAD_TOKEN'
  | 'TOO_MANY_REQUESTS';

export interface ApiError {
  code: ApiErrorCode | string;
  message: string;
}
