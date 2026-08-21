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
  MaskLayer,
  ImageLayer,
  SourceTrim,
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
  masks: MaskLayer[];
  images: ImageLayer[];
  sourceTrim: SourceTrim | null;
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
  readonly masks = signal<MaskLayer[]>([]);
  readonly images = signal<ImageLayer[]>([]);
  /** Recorte del material fuente. `null` = se usa entero. */
  readonly sourceTrim = signal<SourceTrim | null>(null);
  /**
   * Vivían como señales de la página, así que el autosave los guardaba fijos a true/1.0
   * y no sobrevivían a recargar. Aquí sí se persisten.
   */
  readonly keepOriginalAudio = signal<boolean>(true);
  readonly originalAudioVolume = signal<number>(1.0);

  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  readonly hasSource = computed(() => this.sourceAsset() !== null);
  readonly canRender = computed(() => this.hasSource() && this.renderState() === 'idle');

  /** Duración del material tal cual se subió. */
  readonly sourceDuration = computed(() => this.sourceAsset()?.duration ?? 0);

  /**
   * Duración con la que trabaja el editor. Con recorte activo es la del trozo elegido,
   * porque todo lo temporal (textos, máscaras, marca, audio) es relativo al recorte,
   * igual que en el render.
   */
  readonly totalDuration = computed(() => {
    const trim = this.sourceTrim();
    if (trim && trim.end > trim.start) return trim.end - trim.start;
    return this.sourceDuration();
  });

  /** Desplazamiento a aplicar al <video> del preview para simular el recorte. */
  readonly trimOffset = computed(() => this.sourceTrim()?.start ?? 0);

  readonly isTrimmed = computed(() => {
    const trim = this.sourceTrim();
    return !!trim && (trim.start > 0 || trim.end < this.sourceDuration());
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

  addMask(mask: MaskLayer): void {
    this.masks.update((masks) => [...masks, mask]);
  }

  removeMask(id: string): void {
    this.masks.update((masks) => masks.filter((m) => m.id !== id));
  }

  updateMask(id: string, updates: Partial<MaskLayer>): void {
    this.masks.update((masks) => masks.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  }

  addImage(image: ImageLayer): void {
    this.images.update((images) => [...images, image]);
  }

  removeImage(id: string): void {
    this.images.update((images) => images.filter((i) => i.id !== id));
  }

  updateImage(id: string, updates: Partial<ImageLayer>): void {
    this.images.update((images) => images.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  }

  /**
   * Ajusta el recorte manteniéndolo dentro del material y con un mínimo de medio segundo,
   * para que no se pueda arrastrar un extremo por encima del otro.
   */
  setSourceTrim(trim: SourceTrim | null): void {
    if (!trim) {
      this.sourceTrim.set(null);
      return;
    }
    const duration = this.sourceDuration();
    const start = Math.max(0, Math.min(trim.start, Math.max(0, duration - 0.5)));
    const end = Math.min(duration || trim.end, Math.max(start + 0.5, trim.end));
    this.sourceTrim.set({ start, end });
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
      masks: this.masks(),
      images: this.images(),
      sourceTrim: this.sourceTrim(),
      keepOriginalAudio: this.keepOriginalAudio(),
      originalAudioVolume: this.originalAudioVolume(),
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
      // Guardados por versiones anteriores del autosave: pueden no existir.
      if (data.masks?.length) this.masks.set(data.masks);
      if (data.images?.length) this.images.set(data.images);
      if (data.sourceTrim) this.sourceTrim.set(data.sourceTrim);
      if (typeof data.keepOriginalAudio === 'boolean') this.keepOriginalAudio.set(data.keepOriginalAudio);
      if (typeof data.originalAudioVolume === 'number') this.originalAudioVolume.set(data.originalAudioVolume);
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
    this.masks.set([]);
    this.images.set([]);
    this.sourceTrim.set(null);
    this.brandCustomPosition.set(null);
    this.composition.set(null);
    this.renderState.set('idle');
    this.renderResult.set(null);
    this.renderProgress.set(0);
    this.clearAutosave();
  }
}
