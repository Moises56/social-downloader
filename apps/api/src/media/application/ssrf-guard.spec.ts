import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { validateUrlNoSsrf } from './ssrf-guard';

vi.mock('node:dns', () => ({
  promises: {
    resolve4: vi.fn().mockResolvedValue(['93.184.216.34']),
  },
}));

describe('validateUrlNoSsrf', () => {
  it('acepta URLs públicas válidas', async () => {
    const url = await validateUrlNoSsrf('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(url.hostname).toBe('www.youtube.com');
  });

  it('rechaza protocolo file://', async () => {
    await expect(validateUrlNoSsrf('file:///etc/passwd')).rejects.toThrow(BadRequestException);
  });

  it('rechaza protocolo ftp://', async () => {
    await expect(validateUrlNoSsrf('ftp://example.com')).rejects.toThrow(BadRequestException);
  });

  it('rechaza URL inválida', async () => {
    await expect(validateUrlNoSsrf('not-a-url')).rejects.toThrow(BadRequestException);
  });

  it('rechaza localhost', async () => {
    await expect(validateUrlNoSsrf('http://localhost:3000')).rejects.toThrow(BadRequestException);
  });

  it('rechaza 127.0.0.1', async () => {
    await expect(validateUrlNoSsrf('http://127.0.0.1:3000')).rejects.toThrow(BadRequestException);
  });

  it('rechaza IP privada 10.x.x.x', async () => {
    await expect(validateUrlNoSsrf('http://10.0.0.1/admin')).rejects.toThrow(BadRequestException);
  });

  it('rechaza IP privada 172.16.x.x', async () => {
    await expect(validateUrlNoSsrf('http://172.16.0.1')).rejects.toThrow(BadRequestException);
  });

  it('rechaza IP privada 192.168.x.x', async () => {
    await expect(validateUrlNoSsrf('http://192.168.1.1')).rejects.toThrow(BadRequestException);
  });

  it('rechaza IPv6 loopback', async () => {
    await expect(validateUrlNoSsrf('http://[::1]')).rejects.toThrow(BadRequestException);
  });

  it('rechaza metadata endpoint de cloud', async () => {
    await expect(validateUrlNoSsrf('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(BadRequestException);
  });
});
