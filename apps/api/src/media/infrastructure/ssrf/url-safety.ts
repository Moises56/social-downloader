import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export async function ensurePublicUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('INVALID_URL');
  }

  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new Error('SSRF_BLOCKED');
  }

  const results = await lookup(host, { all: true, verbatim: true }).catch(() => []);
  for (const address of results) {
    const family = address.family;
    if (family === 6 && (address.address === '::1' || address.address.startsWith('fc') || address.address.startsWith('fd'))) {
      throw new Error('SSRF_BLOCKED');
    }

    if (family === 4 && isPrivateIPv4(address.address)) {
      throw new Error('SSRF_BLOCKED');
    }
  }

  if (isIP(host) && isPrivateIPv4(host)) {
    throw new Error('SSRF_BLOCKED');
  }

  return url;
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;

  const [a, b] = parts;
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 127)
  );
}
