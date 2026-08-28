import { describe, expect, it } from 'vitest';
import { detectPlatform } from './media-platform';

describe('detectPlatform', () => {
  it('detecta YouTube y Shorts', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBe('youtube');
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube');
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube');
  });

  it('detecta otras plataformas', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
    expect(detectPlatform('https://www.instagram.com/reel/abc123')).toBe('instagram');
    expect(detectPlatform('https://www.facebook.com/watch?v=abc123')).toBe('facebook');
    expect(detectPlatform('https://x.com/user/status/123')).toBe('x');
  });

  it('rechaza URL no soportada', () => {
    expect(() => detectPlatform('https://example.com/video')).toThrow('UNSUPPORTED_PLATFORM');
  });
});
