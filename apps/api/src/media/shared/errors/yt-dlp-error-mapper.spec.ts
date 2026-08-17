import { mapYtDlpError } from './yt-dlp-error-mapper';

describe('mapYtDlpError', () => {
  it('maps Video unavailable to MEDIA_NOT_AVAILABLE', () => {
    expect(mapYtDlpError('ERROR: Video unavailable')).toBe('MEDIA_NOT_AVAILABLE');
  });

  it('maps private video to PRIVATE_MEDIA', () => {
    expect(mapYtDlpError('ERROR: This video is private')).toBe('PRIVATE_MEDIA');
  });

  it('maps Private video to PRIVATE_MEDIA', () => {
    expect(mapYtDlpError('ERROR: Private video')).toBe('PRIVATE_MEDIA');
  });

  it('maps sign in to AUTH_REQUIRED', () => {
    expect(mapYtDlpError('ERROR: sign in to confirm')).toBe('AUTH_REQUIRED');
  });

  it('maps login required to AUTH_REQUIRED', () => {
    expect(mapYtDlpError('ERROR: login required')).toBe('AUTH_REQUIRED');
  });

  it('maps geo restriction to GEO_RESTRICTED', () => {
    expect(mapYtDlpError('ERROR: not available in your country')).toBe('GEO_RESTRICTED');
  });

  it('maps geo restrict pattern to GEO_RESTRICTED', () => {
    expect(mapYtDlpError('ERROR: geo-restricted content')).toBe('GEO_RESTRICTED');
  });

  it('maps format not available to FORMAT_NOT_AVAILABLE', () => {
    expect(mapYtDlpError('ERROR: requested format is not available')).toBe('FORMAT_NOT_AVAILABLE');
  });

  it('maps no video formats to MEDIA_NOT_AVAILABLE', () => {
    expect(mapYtDlpError('ERROR: no video formats found')).toBe('MEDIA_NOT_AVAILABLE');
  });

  it('maps unable to download to DOWNLOAD_FAILED', () => {
    expect(mapYtDlpError('ERROR: unable to download')).toBe('DOWNLOAD_FAILED');
  });

  it('maps HTTP Error 403 to MEDIA_NOT_AVAILABLE', () => {
    expect(mapYtDlpError('ERROR: HTTP Error 403: Forbidden')).toBe('MEDIA_NOT_AVAILABLE');
  });

  it('maps HTTP Error 404 to MEDIA_NOT_AVAILABLE', () => {
    expect(mapYtDlpError('ERROR: HTTP Error 404: Not Found')).toBe('MEDIA_NOT_AVAILABLE');
  });

  it('maps HTTP Error 410 to MEDIA_NOT_AVAILABLE', () => {
    expect(mapYtDlpError('ERROR: HTTP Error 410: Gone')).toBe('MEDIA_NOT_AVAILABLE');
  });

  it('returns DOWNLOAD_FAILED for unknown errors', () => {
    expect(mapYtDlpError('ERROR: something completely unknown')).toBe('DOWNLOAD_FAILED');
  });

  it('returns DOWNLOAD_FAILED for empty string', () => {
    expect(mapYtDlpError('')).toBe('DOWNLOAD_FAILED');
  });

  it('matches patterns case-insensitively', () => {
    expect(mapYtDlpError('ERROR: VIDEO UNAVAILABLE')).toBe('MEDIA_NOT_AVAILABLE');
  });
});
