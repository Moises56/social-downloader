import type { MediaPlatform } from '@social-downloader/contracts';
export type { MediaPlatform, DownloadType, AudioFormat, MediaFormat, MediaMetadata, DownloadRequest, DownloadResult, ApiError } from '@social-downloader/contracts';

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
