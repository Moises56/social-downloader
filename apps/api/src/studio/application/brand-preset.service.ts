import { Injectable } from '@nestjs/common';
import type {
  BrandPreset,
  BrandOverlay,
  TextStyleConfig,
} from '../domain/video-composition';
import { DEFAULT_BRAND_PRESET } from '../domain/video-composition';

@Injectable()
export class BrandPresetService {
  private readonly presets: BrandPreset[] = [DEFAULT_BRAND_PRESET];

  listPresets(): BrandPreset[] {
    return [...this.presets];
  }

  getPreset(id: string): BrandPreset | undefined {
    return this.presets.find((p) => p.id === id);
  }

  createBrandOverlay(
    presetId: string,
    videoDuration: number,
    mode?: 'ending' | 'persistent' | 'segmented',
    segmentTimes?: Array<{ start: number; end: number }>,
  ): BrandOverlay[] {
    const preset = this.getPreset(presetId);
    if (!preset) return [];

    const resolvedMode = mode ?? preset.signature.defaultMode;
    const style = preset.signature.style ?? this.defaultSignatureStyle();

    switch (resolvedMode) {
      case 'ending':
        return this.createEndingOverlay(preset, style, videoDuration);
      case 'persistent':
        return this.createPersistentOverlay(preset, style, videoDuration);
      case 'segmented':
        return this.createSegmentedOverlay(preset, style, segmentTimes ?? []);
      default:
        return this.createEndingOverlay(preset, style, videoDuration);
    }
  }

  private createEndingOverlay(
    preset: BrandPreset,
    style: TextStyleConfig,
    videoDuration: number,
  ): BrandOverlay[] {
    const startSec = Math.max(0, videoDuration - 2.5);
    return [
      {
        id: `brand-${preset.id}-ending`,
        presetId: preset.id,
        text: preset.signature.text,
        startTime: startSec,
        endTime: videoDuration,
        position: preset.signature.defaultPosition,
        style,
        animationIn: 'fade-in',
        animationOut: 'none',
        opacity: style.opacity,
      },
    ];
  }

  private createPersistentOverlay(
    preset: BrandPreset,
    style: TextStyleConfig,
    videoDuration: number,
  ): BrandOverlay[] {
    return [
      {
        id: `brand-${preset.id}-persistent`,
        presetId: preset.id,
        text: preset.signature.text,
        startTime: 0.5,
        endTime: videoDuration - 0.5,
        position: preset.signature.defaultPosition,
        style,
        animationIn: 'fade-in',
        animationOut: 'fade-out',
        opacity: style.opacity,
      },
    ];
  }

  private createSegmentedOverlay(
    preset: BrandPreset,
    style: TextStyleConfig,
    segmentTimes: Array<{ start: number; end: number }>,
  ): BrandOverlay[] {
    return segmentTimes.map((seg, i) => ({
      id: `brand-${preset.id}-seg-${i}`,
      presetId: preset.id,
      text: preset.signature.text,
      startTime: seg.start,
      endTime: seg.end,
      position: preset.signature.defaultPosition,
      style,
      animationIn: 'fade-in',
      animationOut: 'fade-out',
      opacity: style.opacity,
    }));
  }

  private defaultSignatureStyle(): TextStyleConfig {
    return {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: 32,
      fontWeight: 'normal',
      italic: true,
      color: '#f6efe2',
      opacity: 0.62,
      textShadow: true,
      shadowColor: 'rgba(0, 0, 0, 0.75)',
      shadowBlur: 12,
      letterSpacing: 0.06,
    };
  }
}
