import { Injectable } from '@nestjs/common';
import type {
  VideoComposition,
  TextOverlay,
  BrandOverlay,
  AudioTrack,
} from '@social-downloader/contracts';

export interface ValidationWarning {
  id: string;
  type: 'text' | 'timing' | 'safe-zone' | 'overlap' | 'audio';
  severity: 'info' | 'warning' | 'error';
  message: string;
  overlayId?: string;
  trackId?: string;
}

@Injectable()
export class CompositionValidationService {
  validate(composition: VideoComposition): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];
    const duration = composition.source.duration ?? 0;

    for (const text of composition.textTracks) {
      warnings.push(...this.validateTextOverlay(text, duration));
    }

    for (const brand of composition.overlays) {
      warnings.push(...this.validateBrandOverlay(brand, duration));
    }

    warnings.push(...this.validateOverlaps(composition.textTracks, composition.overlays));
    warnings.push(...this.validateAudio(composition.audioTracks, duration, composition.keepOriginalAudio));

    return warnings;
  }

  private validateTextOverlay(text: TextOverlay, duration: number): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    if (text.endTime <= text.startTime) {
      warnings.push({
        id: `timing-${text.id}`,
        type: 'timing',
        severity: 'error',
        message: `"${this.truncate(text.text)}": el tiempo final debe ser mayor que el inicial`,
        overlayId: text.id,
      });
    }

    if (text.startTime < 0) {
      warnings.push({
        id: `negative-${text.id}`,
        type: 'timing',
        severity: 'error',
        message: `"${this.truncate(text.text)}": el tiempo inicial no puede ser negativo`,
        overlayId: text.id,
      });
    }

    if (duration > 0 && text.endTime > duration) {
      warnings.push({
        id: `overduration-${text.id}`,
        type: 'timing',
        severity: 'warning',
        message: `"${this.truncate(text.text)}": excede la duración del video (${duration.toFixed(1)}s)`,
        overlayId: text.id,
      });
    }

    const lines = text.text.split('\n').length;
    if (lines > 4) {
      warnings.push({
        id: `lines-${text.id}`,
        type: 'text',
        severity: 'warning',
        message: `"${this.truncate(text.text)}": ${lines} líneas pueden no caber en móvil`,
        overlayId: text.id,
      });
    }

    if (text.style.fontSize < 24) {
      warnings.push({
        id: `fontsize-${text.id}`,
        type: 'text',
        severity: 'info',
        message: `"${this.truncate(text.text)}": tamaño ${text.style.fontSize}px puede ser difícil de leer`,
        overlayId: text.id,
      });
    }

    if (text.position === 'bottom-center' || text.position === 'bottom-left' || text.position === 'bottom-right') {
      warnings.push({
        id: `safezone-${text.id}`,
        type: 'safe-zone',
        severity: 'info',
        message: `"${this.truncate(text.text)}": podría quedar bajo los controles de TikTok/Reels`,
        overlayId: text.id,
      });
    }

    return warnings;
  }

  private validateBrandOverlay(brand: BrandOverlay, duration: number): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    if (brand.endTime <= brand.startTime) {
      warnings.push({
        id: `brand-timing-${brand.id}`,
        type: 'timing',
        severity: 'error',
        message: `Marca "${brand.text}": tiempo inválido`,
        overlayId: brand.id,
      });
    }

    if (duration > 0 && brand.endTime > duration) {
      warnings.push({
        id: `brand-overduration-${brand.id}`,
        type: 'timing',
        severity: 'warning',
        message: `Marca "${brand.text}": excede duración del video`,
        overlayId: brand.id,
      });
    }

    return warnings;
  }

  private validateOverlaps(texts: TextOverlay[], brands: BrandOverlay[]): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    for (const text of texts) {
      for (const brand of brands) {
        if (text.id === brand.id) continue;
        if (!this.positionsOverlap(text.position, brand.position)) continue;
        if (!this.timesOverlap(text.startTime, text.endTime, brand.startTime, brand.endTime)) continue;

        warnings.push({
          id: `overlap-${text.id}-${brand.id}`,
          type: 'overlap',
          severity: 'warning',
          message: `"${this.truncate(text.text)}" y "${brand.text}" se superponen en zona y tiempo`,
          overlayId: text.id,
        });
      }
    }

    return warnings;
  }

  private validateAudio(tracks: AudioTrack[], duration: number, keepOriginal: boolean): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    for (const track of tracks) {
      if (duration > 0 && track.startTime > duration) {
        warnings.push({
          id: `audio-late-${track.id}`,
          type: 'audio',
          severity: 'warning',
          message: `Pista "${track.fileName}" empieza después del final del video`,
          trackId: track.id,
        });
      }

      if (track.volume > 0.8) {
        warnings.push({
          id: `audio-loud-${track.id}`,
          type: 'audio',
          severity: 'info',
          message: `Pista "${track.fileName}": volumen alto (${Math.round(track.volume * 100)}%)`,
          trackId: track.id,
        });
      }
    }

    if (keepOriginal && tracks.length > 0) {
      warnings.push({
        id: 'audio-competition',
        type: 'audio',
        severity: 'info',
        message: 'Audio original y música pueden competir entre sí',
      });
    }

    return warnings;
  }

  private positionsOverlap(a: string, b: string): boolean {
    const topZones = ['top-center', 'top-left', 'top-right'];
    const bottomZones = ['bottom-center', 'bottom-left', 'bottom-right'];
    const centerZones = ['center', 'upper-center', 'lower-center'];

    const getZone = (pos: string): string => {
      if (topZones.includes(pos)) return 'top';
      if (bottomZones.includes(pos)) return 'bottom';
      if (centerZones.includes(pos)) return 'center';
      return 'other';
    };

    return getZone(a) === getZone(b);
  }

  private timesOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
    return s1 < e2 && s2 < e1;
  }

  private truncate(text: string, max = 30): string {
    const first = text.split('\n')[0];
    return first.length > max ? first.slice(0, max) + '...' : first;
  }
}
