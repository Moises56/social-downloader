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
  readonly selectedPreset = signal<BrandPreset | null>(null);
  readonly textOverlays = signal<TextOverlay[]>([]);
  readonly audioTracks = signal<AudioTrack[]>([]);
  readonly composition = signal<VideoComposition | null>(null);
  readonly renderState = signal<'idle' | 'rendering' | 'success' | 'error'>('idle');
  readonly renderResult = signal<RenderedVideo | null>(null);
  readonly renderProgress = signal<number>(0);

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

  setSource(asset: StudioAsset): void {
    this.sourceAsset.set(asset);
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
