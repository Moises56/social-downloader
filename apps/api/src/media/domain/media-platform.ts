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

export interface ApiErrorShape {
  code: string;
  message: string;
}

export function detectPlatform(rawUrl: string): MediaPlatform {
  const url = normalizeUrl(rawUrl);
  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  if (['youtube.com', 'youtu.be', 'm.youtube.com'].includes(host)) return 'youtube';
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok';
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
  if (['facebook.com', 'fb.watch'].includes(host) || host.endsWith('.facebook.com')) return 'facebook';
  if (['x.com', 'twitter.com'].includes(host) || host.endsWith('.x.com') || host.endsWith('.twitter.com')) return 'x';

  throw new Error('UNSUPPORTED_PLATFORM');
}

function normalizeUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('INVALID_URL');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('INVALID_URL');
  }

  return url;
}
