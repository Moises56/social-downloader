import { Injectable } from '@nestjs/common';
import type { ExportPreset } from '@social-downloader/contracts';

@Injectable()
export class ExportPresetService {
  private readonly presets: ExportPreset[] = [
    {
      id: 'tiktok-reels-shorts',
      name: 'TikTok / Reels / Shorts',
      description: 'Optimizado para redes sociales verticales. Calidad estándar, archivo ligero.',
      width: 1080,
      height: 1920,
      fps: 30,
      crf: 23,
      preset: 'fast',
      audioBitrate: '128k',
      audioSampleRate: 48000,
      audioChannels: 2,
      movflags: '+faststart',
      estimatedSizePerSecond: '~1.5 MB/s',
      tags: ['9:16', 'social', 'vertical'],
    },
    {
      id: 'social-hq',
      name: 'Social High Quality',
      description: 'Calidad alta para publicaciones importantes. Archivo más grande pero nítido.',
      width: 1080,
      height: 1920,
      fps: 30,
      crf: 18,
      preset: 'medium',
      audioBitrate: '192k',
      audioSampleRate: 48000,
      audioChannels: 2,
      movflags: '+faststart',
      estimatedSizePerSecond: '~3 MB/s',
      tags: ['9:16', 'social', 'premium'],
    },
    {
      id: 'social-compact',
      name: 'Social Compact',
      description: 'Archivo liviano para carga rápida. Ideal para stories y mensajes.',
      width: 1080,
      height: 1920,
      fps: 24,
      crf: 28,
      preset: 'veryfast',
      audioBitrate: '96k',
      audioSampleRate: 44100,
      audioChannels: 2,
      movflags: '+faststart',
      estimatedSizePerSecond: '~0.8 MB/s',
      tags: ['9:16', 'social', 'light'],
    },
  ];

  listPresets(): ExportPreset[] {
    return this.presets;
  }

  getPreset(id: string): ExportPreset | undefined {
    return this.presets.find((p) => p.id === id);
  }
}
