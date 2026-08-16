import { describe, expect, it } from 'vitest';
import { resolveMimeTypeFromFilename } from './mime-type';

describe('resolveMimeTypeFromFilename', () => {
  it('mapea tipos de audio conocidos', () => {
    expect(resolveMimeTypeFromFilename('track.mp3')).toBe('audio/mpeg');
    expect(resolveMimeTypeFromFilename('track.m4a')).toBe('audio/mp4');
    expect(resolveMimeTypeFromFilename('track.opus')).toBe('audio/ogg');
  });

  it('mapea tipos de video conocidos', () => {
    expect(resolveMimeTypeFromFilename('video.mp4')).toBe('video/mp4');
    expect(resolveMimeTypeFromFilename('video.webm')).toBe('video/webm');
  });

  it('es tolerante a mayúsculas y extensión desconocida', () => {
    expect(resolveMimeTypeFromFilename('Video.MP4')).toBe('video/mp4');
    expect(resolveMimeTypeFromFilename('archive.bin')).toBe('application/octet-stream');
    expect(resolveMimeTypeFromFilename('noext')).toBe('application/octet-stream');
  });
});
