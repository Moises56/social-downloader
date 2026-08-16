import { BadRequestException, Injectable } from '@nestjs/common';

type Platform = 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'x';

@Injectable()
export class PlatformDetector {
  detect(rawUrl: string): Platform {
    let url: URL;
    try { url = new URL(rawUrl); } catch { throw new BadRequestException('URL inválida'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new BadRequestException('Protocolo no permitido');

    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (['youtube.com', 'youtu.be', 'm.youtube.com'].includes(host)) return 'youtube';
    if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok';
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
    if (['facebook.com', 'fb.watch'].includes(host) || host.endsWith('.facebook.com')) return 'facebook';
    if (['x.com', 'twitter.com'].includes(host) || host.endsWith('.x.com') || host.endsWith('.twitter.com')) return 'x';
    throw new BadRequestException('Plataforma no soportada');
  }
}
