import { BadRequestException } from '@nestjs/common';
import * as dns from 'node:dns';

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^localhost$/i,
];

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '0.0.0.0',
  '127.0.0.1',
  '::1',
  '[::1]',
  'metadata.google.internal',
  '169.254.169.254',
]);

export async function validateUrlNoSsrf(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BadRequestException('INVALID_URL');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new BadRequestException('INVALID_URL');
  }

  const hostname = url.hostname;

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new BadRequestException('SSRF_BLOCKED');
  }

  if (PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname))) {
    throw new BadRequestException('SSRF_BLOCKED');
  }

  try {
    const addresses = await dns.promises.resolve4(hostname);
    for (const addr of addresses) {
      if (PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(addr))) {
        throw new BadRequestException('SSRF_BLOCKED');
      }
    }
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    // DNS resolution failed — still block (could be intentional obfuscation)
    throw new BadRequestException('INVALID_URL');
  }

  return url;
}
