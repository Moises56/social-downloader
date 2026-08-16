export type MediaPlatform = 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'x';

export interface MediaFormat {
  id: string;
  extension: string;
  resolution?: string;
  height?: number;
  width?: number;
  filesize?: number;
  videoCodec?: string;
  audioCodec?: string;
}

export interface MediaMetadata {
  platform: MediaPlatform;
  title: string;
  author?: string;
  duration?: number;
  thumbnail?: string;
  formats: MediaFormat[];
}

export interface AnalyzeMediaRequest { url: string; }
export interface DownloadMediaRequest {
  url: string;
  kind: 'video' | 'audio';
  quality?: number;
  audioFormat?: 'mp3' | 'm4a' | 'opus';
}
