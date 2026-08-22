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

  // Salidas reales de yt-dlp con TikTok. Antes caían todas en DOWNLOAD_FAILED, que se
  // traduce a "No se pudo completar la descarga" y no dice qué hacer.
  it('mapea el aviso de impersonation a PLATFORM_BLOCKED', () => {
    expect(mapYtDlpError(
      'WARNING: [TikTok] The extractor is attempting impersonation, but no impersonate target is available.',
    )).toBe('PLATFORM_BLOCKED');
  });

  it('mapea el fallo de rehidratación de TikTok a PLATFORM_BLOCKED', () => {
    expect(mapYtDlpError(
      'ERROR: [TikTok] 7000000000000000000: Unable to extract universal data for rehydration',
    )).toBe('PLATFORM_BLOCKED');
  });

  it('mapea el bot check a PLATFORM_BLOCKED', () => {
    expect(mapYtDlpError(
      'ERROR: Sign in to confirm you are not a bot',
    )).toBe('PLATFORM_BLOCKED');
  });

  it('mapea el 429 a TOO_MANY_REQUESTS', () => {
    expect(mapYtDlpError('ERROR: unable to download video data: HTTP Error 429: Too Many Requests'))
      .toBe('TOO_MANY_REQUESTS');
  });

  it('sigue devolviendo DOWNLOAD_FAILED para lo que no reconoce', () => {
    expect(mapYtDlpError('ERROR: something entirely unexpected happened')).toBe('DOWNLOAD_FAILED');
  });
});
