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

export interface AnalyzeMediaResponse extends MediaMetadata {}

export interface DownloadMediaRequest {
  url: string;
  type: DownloadType;
  quality?: number;
  audioFormat?: AudioFormat;
}

export interface ApiError {
  code: string;
  message: string;
}
