import { Injectable, signal, computed, effect } from '@angular/core';
import type {
  BrandPreset,
  VideoComposition,
  TextOverlay,
  AudioTrack,
  RenderedVideo,
  SavedCompositionPreset,
  ExportPreset,
  VideoFitMode,
  VideoFitConfig,
  ValidationWarning,
} from '@social-downloader/contracts';
import type { NormalizedPosition } from '../editor/position';

export interface StudioAsset {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
}

interface AutosaveData {
  compositionId: string | null;
  sourceAssetId: string | null;
  sourceFileName: string | null;
  brandPresetId: string | null;
  exportPresetId: string | null;
  videoFitMode: VideoFitMode;
  videoFitBackgroundColor: string;
  textOverlays: TextOverlay[];
  audioTracks: AudioTrack[];
  keepOriginalAudio: boolean;
  originalAudioVolume: number;
  showSafeZones: boolean;
  brandCustomPosition: NormalizedPosition | null;
  savedAt: number;
}

const AUTOSAVE_KEY = 'studio-autosave';
const AUTOSAVE_TTL = 30 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class StudioStore {
  readonly sourceAsset = signal<StudioAsset | null>(null);
  readonly sourceVideoUrl = signal<string | null>(null);
  readonly selectedPreset = signal<BrandPreset | null>(null);
  readonly textOverlays = signal<TextOverlay[]>([]);
  readonly audioTracks = signal<AudioTrack[]>([]);
  readonly composition = signal<VideoComposition | null>(null);
  readonly renderState = signal<'idle' | 'rendering' | 'success' | 'error' | 'cancelled'>('idle');
  readonly renderResult = signal<RenderedVideo | null>(null);
  readonly renderProgress = signal<number>(0);
  readonly currentTime = signal<number>(0);
  readonly showSafeZones = signal<boolean>(false);
  readonly brandCustomPosition = signal<NormalizedPosition | null>(null);
  readonly savedPresets = signal<SavedCompositionPreset[]>([]);
  readonly brandPresetId = signal<string | null>(null);
  readonly selectedExportPreset = signal<ExportPreset | null>(null);
  readonly videoFitMode = signal<VideoFitMode>('crop');
  readonly videoFitBackgroundColor = signal<string>('#000000');
  readonly validationWarnings = signal<ValidationWarning[]>([]);

  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;

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

  readonly musicTracks = computed(() =>
    this.audioTracks().filter((t) => !t.id.startsWith('sfx')),
  );

  readonly sfxTracks = computed(() =>
    this.audioTracks().filter((t) => t.id.startsWith('sfx')),
  );

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
    const customPosition = this.brandCustomPosition();
    const position = customPosition ? ('custom' as const) : preset.signature.defaultPosition;

    if (mode === 'ending') {
      return [{
        id: 'brand-preview',
        presetId: preset.id,
        text: preset.signature.text,
        startTime: Math.max(0, duration - 2.5),
        endTime: duration,
        position,
        customPosition: customPosition ?? undefined,
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
        position,
        customPosition: customPosition ?? undefined,
        style,
        opacity: style.opacity,
      }];
    }
    return [];
  });

  readonly videoFit = computed<VideoFitConfig>(() => ({
    mode: this.videoFitMode(),
    backgroundColor: this.videoFitBackgroundColor(),
  }));

  constructor() {
    effect(() => {
      const _source = this.sourceAsset();
      const _overlays = this.textOverlays();
      const _audio = this.audioTracks();
      const _composition = this.composition();
      const _brandPosition = this.brandCustomPosition();

      if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
      this.autosaveTimer = setTimeout(() => {
        this.saveToLocalStorage();
      }, 1000);
    });
  }

  setSource(asset: StudioAsset, videoUrl?: string): void {
    this.sourceAsset.set(asset);
    if (videoUrl) this.sourceVideoUrl.set(videoUrl);
    this.composition.set(null);
    this.renderResult.set(null);
    this.renderState.set('idle');
  }

  setPreset(preset: BrandPreset | null): void {
    this.selectedPreset.set(preset);
    this.brandCustomPosition.set(null);
  }

  setExportPreset(preset: ExportPreset | null): void {
    this.selectedExportPreset.set(preset);
  }

  addTextOverlay(overlay: TextOverlay): void {
    this.textOverlays.update((overlays) => [...overlays, overlay]);
  }

  setTextOverlays(overlays: TextOverlay[]): void {
    this.textOverlays.set(overlays);
  }

  removeTextOverlay(id: string): void {
    this.textOverlays.update((overlays) => overlays.filter((o) => o.id !== id));
  }

  updateTextOverlay(id: string, updates: Partial<TextOverlay>): void {
    this.textOverlays.update((overlays) =>
      overlays.map((o) => (o.id === id ? { ...o, ...updates } : o)),
    );
  }

  updateBrandOverlayPosition(position: NormalizedPosition): void {
    this.brandCustomPosition.set(position);
  }

  addAudioTrack(track: AudioTrack): void {
    this.audioTracks.update((tracks) => [...tracks, track]);
  }

  removeAudioTrack(id: string): void {
    this.audioTracks.update((tracks) => tracks.filter((t) => t.id !== id));
  }

  updateAudioTrack(id: string, updates: Partial<AudioTrack>): void {
    this.audioTracks.update((tracks) =>
      tracks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    );
  }

  setComposition(composition: VideoComposition): void {
    this.composition.set(composition);
  }

  setRenderState(state: 'idle' | 'rendering' | 'success' | 'error' | 'cancelled'): void {
    this.renderState.set(state);
  }

  setRenderResult(result: RenderedVideo): void {
    this.renderResult.set(result);
  }

  setSavedPresets(presets: SavedCompositionPreset[]): void {
    this.savedPresets.set(presets);
  }

  addSavedPreset(preset: SavedCompositionPreset): void {
    this.savedPresets.update((presets) => [...presets, preset]);
  }

  removeSavedPreset(id: string): void {
    this.savedPresets.update((presets) => presets.filter((p) => p.id !== id));
  }

  applySavedPreset(preset: SavedCompositionPreset): void {
    this.brandPresetId.set(preset.brandPresetId ?? null);
    this.textOverlays.set(preset.textTracks.map((t) => ({ ...t })));
    this.audioTracks.set(preset.audioTracks.map((a) => ({ ...a })));
  }

  private saveToLocalStorage(): void {
    const data: AutosaveData = {
      compositionId: this.composition()?.id ?? null,
      sourceAssetId: this.sourceAsset()?.id ?? null,
      sourceFileName: this.sourceAsset()?.fileName ?? null,
      brandPresetId: this.selectedPreset()?.id ?? null,
      exportPresetId: this.selectedExportPreset()?.id ?? null,
      videoFitMode: this.videoFitMode(),
      videoFitBackgroundColor: this.videoFitBackgroundColor(),
      textOverlays: this.textOverlays(),
      audioTracks: this.audioTracks(),
      keepOriginalAudio: true,
      originalAudioVolume: 1.0,
      showSafeZones: this.showSafeZones(),
      brandCustomPosition: this.brandCustomPosition(),
      savedAt: Date.now(),
    };

    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
    } catch {
      // localStorage full or unavailable
    }
  }

  loadFromLocalStorage(): AutosaveData | null {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return null;

      const data: AutosaveData = JSON.parse(raw);
      const age = Date.now() - data.savedAt;

      if (age > AUTOSAVE_TTL) {
        localStorage.removeItem(AUTOSAVE_KEY);
        return null;
      }

      if (data.textOverlays.length) this.textOverlays.set(data.textOverlays);
      if (data.audioTracks.length) this.audioTracks.set(data.audioTracks);
      if (data.brandPresetId) this.brandPresetId.set(data.brandPresetId);
      this.videoFitMode.set(data.videoFitMode);
      this.videoFitBackgroundColor.set(data.videoFitBackgroundColor);
      this.showSafeZones.set(data.showSafeZones);
      if (data.brandCustomPosition) this.brandCustomPosition.set(data.brandCustomPosition);

      return data;
    } catch {
      return null;
    }
  }

  clearAutosave(): void {
    localStorage.removeItem(AUTOSAVE_KEY);
  }

  setValidationWarnings(warnings: ValidationWarning[]): void {
    this.validationWarnings.set(warnings);
  }

  reset(): void {
    this.sourceAsset.set(null);
    this.sourceVideoUrl.set(null);
    this.selectedPreset.set(null);
    this.textOverlays.set([]);
    this.audioTracks.set([]);
    this.brandCustomPosition.set(null);
    this.composition.set(null);
    this.renderState.set('idle');
    this.renderResult.set(null);
    this.renderProgress.set(0);
    this.clearAutosave();
  }
}
