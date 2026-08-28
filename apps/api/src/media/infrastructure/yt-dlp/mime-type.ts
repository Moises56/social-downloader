const MIME_BY_EXTENSION: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  opus: 'audio/ogg',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

export function resolveMimeTypeFromFilename(filename: string): string {
  const ext = filename.split('.').at(-1)?.toLowerCase();
  if (!ext) {
    return 'application/octet-stream';
  }

  return MIME_BY_EXTENSION[ext] ?? 'application/octet-stream';
}
