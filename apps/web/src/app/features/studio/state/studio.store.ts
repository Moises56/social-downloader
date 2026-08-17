import { Injectable, signal, computed } from '@angular/core';
import type {
  BrandPreset,
  VideoComposition,
  TextOverlay,
  AudioTrack,
  RenderedVideo,
} from '@social-downloader/contracts';

export interface StudioAsset {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
}

@Injectable({ providedIn: 'root' })
export class StudioStore {
  readonly sourceAsset = signal<StudioAsset | null>(null);
  readonly sourceVideoUrl = signal<string | null>(null);
  readonly selectedPreset = signal<BrandPreset | null>(null);
  readonly textOverlays = signal<TextOverlay[]>([]);
  readonly audioTracks = signal<AudioTrack[]>([]);
  readonly composition = signal<VideoComposition | null>(null);
  readonly renderState = signal<'idle' | 'rendering' | 'success' | 'error'>('idle');
  readonly renderResult = signal<RenderedVideo | null>(null);
  readonly renderProgress = signal<number>(0);
  readonly currentTime = signal<number>(0);
  readonly showSafeZones = signal<boolean>(false);

  readonly hasSource = computed(() => this.sourceAsset() !== null);
  readonly canRender = computed(() => this.hasSource() && this.renderState() === 'idle');

  readonly totalDuration = computed(() => {
    const asset = this.sourceAsset();
    return asset?.duration ?? 0;
  });

  readonly watermarkMode = computed(() => {
    const preset = this.selectedPreset();
    return preset?.signature.defaultMode ?? 'ending';
  });

  readonly brandOverlays = computed(() => {
    const preset = this.selectedPreset();
    const duration = this.totalDuration();
    if (!preset || !duration) return [];

    const mode = preset.signature.defaultMode;
    const style = preset.signature.style ?? {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: 32,
      fontWeight: 'normal',
      italic: true,
      color: '#f6efe2',
      opacity: 0.62,
      textShadow: true,
      shadowColor: 'rgba(0, 0, 0, 0.75)',
    };

    if (mode === 'ending') {
      return [{
        id: 'brand-preview',
        presetId: preset.id,
        text: preset.signature.text,
        startTime: Math.max(0, duration - 2.5),
        endTime: duration,
        position: preset.signature.defaultPosition,
        style,
        opacity: style.opacity,
      }];
    }
    if (mode === 'persistent') {
      return [{
        id: 'brand-preview',
        presetId: preset.id,
        text: preset.signature.text,
        startTime: 0.5,
        endTime: duration - 0.5,
        position: preset.signature.defaultPosition,
        style,
        opacity: style.opacity,
      }];
    }
    return [];
  });

  setSource(asset: StudioAsset, videoUrl?: string): void {
    this.sourceAsset.set(asset);
    if (videoUrl) this.sourceVideoUrl.set(videoUrl);
    this.composition.set(null);
    this.renderResult.set(null);
    this.renderState.set('idle');
  }

  setPreset(preset: BrandPreset | null): void {
    this.selectedPreset.set(preset);
  }

  addTextOverlay(overlay: TextOverlay): void {
    this.textOverlays.update((overlays) => [...overlays, overlay]);
  }

  removeTextOverlay(id: string): void {
    this.textOverlays.update((overlays) => overlays.filter((o) => o.id !== id));
  }

  updateTextOverlay(id: string, updates: Partial<TextOverlay>): void {
    this.textOverlays.update((overlays) =>
      overlays.map((o) => (o.id === id ? { ...o, ...updates } : o)),
    );
  }

  addAudioTrack(track: AudioTrack): void {
    this.audioTracks.update((tracks) => [...tracks, track]);
  }

  removeAudioTrack(id: string): void {
    this.audioTracks.update((tracks) => tracks.filter((t) => t.id !== id));
  }

  setComposition(composition: VideoComposition): void {
    this.composition.set(composition);
  }

  setRenderState(state: 'idle' | 'rendering' | 'success' | 'error'): void {
    this.renderState.set(state);
  }

  setRenderResult(result: RenderedVideo): void {
    this.renderResult.set(result);
  }

  reset(): void {
    this.sourceAsset.set(null);
    this.selectedPreset.set(null);
    this.textOverlays.set([]);
    this.audioTracks.set([]);
    this.composition.set(null);
    this.renderState.set('idle');
    this.renderResult.set(null);
    this.renderProgress.set(0);
  }
}
