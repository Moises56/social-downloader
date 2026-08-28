export type MediaPlatform = 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'x';
export type DownloadType = 'video' | 'audio';
export type AudioFormat = 'mp3' | 'm4a' | 'opus';

export interface MediaFormat {
  id: string;
  ext: string;
  resolution?: string;
  width?: number;
  height?: number;
  container?: string;
  videoCodec?: string | null;
  audioCodec?: string | null;
  filesize?: number;
  formatNote?: string;
}

export interface MediaMetadata {
  platform: MediaPlatform;
  title: string;
  thumbnail?: string;
  duration?: number;
  author?: string;
  sourceUrl: string;
  formats: MediaFormat[];
}

export interface AnalyzeMediaRequest {
  url: string;
}

export type AnalyzeMediaResponse = MediaMetadata;

export interface DownloadRequest {
  url: string;
  type: DownloadType;
  quality?: number;
  audioFormat?: AudioFormat;
}

export interface DownloadResult {
  filePath: string;
  fileName: string;
  contentType: string;
  size: number;
}

export interface PrepareDownloadRequest {
  url: string;
  type: DownloadType;
  quality?: number;
  audioFormat?: AudioFormat;
}

export interface PrepareDownloadResponse {
  downloadUrl: string;
}

export type ApiErrorCode =
  | 'INVALID_URL'
  | 'UNSUPPORTED_PLATFORM'
  | 'MEDIA_NOT_AVAILABLE'
  /** La publicacion existe pero no expone video: o no lo tiene, o no es visible sin sesion. */
  | 'NO_VIDEO_FOUND'
  | 'PRIVATE_MEDIA'
  | 'AUTH_REQUIRED'
  | 'GEO_RESTRICTED'
  | 'FORMAT_NOT_AVAILABLE'
  | 'DOWNLOAD_TOO_LARGE'
  | 'ANALYSIS_TIMEOUT'
  | 'DOWNLOAD_TIMEOUT'
  | 'DOWNLOAD_FAILED'
  | 'DOWNLOAD_CANCELLED'
  | 'YTDLP_NOT_AVAILABLE'
  /** La plataforma rechaza al cliente: hacen falta cookies de sesión o impersonation. */
  | 'PLATFORM_BLOCKED'
  | 'SSRF_BLOCKED'
  | 'INVALID_DOWNLOAD_TOKEN'
  | 'TOO_MANY_REQUESTS';

export interface ApiError {
  code: ApiErrorCode | string;
  message: string;
}

// ─── Studio Domain ───────────────────────────────────────────────

export interface SafeZones {
  top: number;
  bottom: number;
  right: number;
  left: number;
}

export const SOCIAL_SAFE_ZONES_9_16: SafeZones = {
  top: 0.10,
  bottom: 0.20,
  right: 0.05,
  left: 0.05,
};

export type OverlayPosition =
  | 'bottom-center'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-center'
  | 'top-left'
  | 'top-right'
  | 'center'
  | 'upper-center'
  | 'lower-center'
  | 'custom';

export type OverlayAnimation = 'fade-in' | 'fade-out' | 'slide-up' | 'soft-reveal' | 'none';

export interface TextPreset {
  id: string;
  name: string;
  type: TextOverlay['type'];
  defaultStyle: TextStyleConfig;
  defaultPosition: OverlayPosition;
  description: string;
}

export interface CompositionPresetSlot {
  textPresetId: string;
  label: string;
  position: OverlayPosition;
  relativeStart: number;
  relativeEnd: number;
  text?: string;
}

export interface CompositionPreset {
  id: string;
  name: string;
  brandPresetId?: string;
  brandMode?: 'ending' | 'persistent' | 'segmented';
  slots: CompositionPresetSlot[];
  description: string;
}

export interface TextStyleConfig {
  fontFamily: string;
  fontSize: number;
  fontWeight?: string;
  italic?: boolean;
  color: string;
  opacity: number;
  textShadow?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  backgroundColor?: string;
  padding?: number;
  borderRadius?: number;
  letterSpacing?: number;
  /** Renders a soft blurred halo (in `shadowColor`, sized by `shadowBlur`) behind the
   * crisp `color` core — the warm glow look used for devotional quote cards. */
  glow?: boolean;
}

export interface BrandSignatureConfig {
  text: string;
  defaultPosition: OverlayPosition;
  defaultMode: 'ending' | 'persistent' | 'segmented';
  style?: TextStyleConfig;
}

export interface BrandPreset {
  id: string;
  name: string;
  signature: BrandSignatureConfig;
  defaultTextStyle?: TextStyleConfig;
  defaultOutput?: OutputPreset;
}

export interface OutputPreset {
  width: number;
  height: number;
  fps: number;
  format: 'mp4';
  videoCodec: 'h264';
  audioCodec: 'aac';
  crf: number;
  preset: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow';
  audioBitrate: string;
  audioSampleRate: number;
  audioChannels: number;
  movflags: string;
}

export interface ExportPreset {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  fps: number;
  videoBitrate?: string;
  crf: number;
  preset: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow';
  audioBitrate: string;
  audioSampleRate: number;
  audioChannels: number;
  movflags: string;
  estimatedSizePerSecond: string;
  tags: string[];
}

export type VideoFitMode = 'crop' | 'fit-blur' | 'fit-background';

export interface VideoFitConfig {
  mode: VideoFitMode;
  backgroundColor?: string;
  backgroundGradient?: string;
}

/**
 * Recorte temporal dentro del material de origen, en segundos.
 * `end` es exclusivo; la duración resultante es `end - start`.
 * Los tiempos de overlays, máscaras y audio son relativos al material YA recortado,
 * es decir, empiezan en 0 en `trim.start`.
 */
export interface SourceTrim {
  start: number;
  end: number;
}

export interface VideoSource {
  assetId: string;
  fileName: string;
  duration?: number;
  width?: number;
  height?: number;
  mimeType?: string;
  /** Sin recorte se usa el material completo. */
  trim?: SourceTrim;
}

export interface TextOverlay {
  id: string;
  text: string;
  type: 'message' | 'verse' | 'reflection' | 'cta' | 'poem' | 'quote';
  startTime: number;
  endTime: number;
  position: OverlayPosition;
  customPosition?: { x: number; y: number };
  style: TextStyleConfig;
  animationIn?: OverlayAnimation;
  animationOut?: OverlayAnimation;
}

export interface BrandOverlay {
  id: string;
  presetId: string;
  text: string;
  startTime: number;
  endTime: number;
  position: OverlayPosition;
  customPosition?: { x: number; y: number };
  style: TextStyleConfig;
  animationIn?: OverlayAnimation;
  animationOut?: OverlayAnimation;
  opacity: number;
}

/** Cómo se oculta la región tapada. */
export type MaskMode = 'blur' | 'pixelate' | 'solid';

/**
 * Región rectangular que oculta parte del vídeo: logos de otras plataformas, marcas de
 * agua ajenas, nombres de usuario. Se aplica ANTES de textos e imágenes, para no tapar
 * lo que tú añades encima.
 */
export interface MaskLayer {
  id: string;
  mode: MaskMode;
  /** Normalizado 0..1 sobre el lienzo de salida; `x`/`y` son la esquina superior izquierda. */
  rect: { x: number; y: number; width: number; height: number };
  /** Fuerza del desenfoque o tamaño del pixelado. Ignorado en modo `solid`. */
  intensity: number;
  /** Solo en modo `solid`. */
  color?: string;
  startTime: number;
  endTime: number;
}

/** Logo, sticker o cualquier PNG/JPG superpuesto. */
export interface ImageLayer {
  id: string;
  assetId: string;
  fileName: string;
  /** Centro de la imagen, normalizado 0..1 sobre el lienzo. */
  position: { x: number; y: number };
  /** Ancho como fracción del lienzo (0..1). El alto se deriva del aspecto original. */
  scale: number;
  opacity: number;
  startTime: number;
  endTime: number;
}

export interface AudioTrack {
  id: string;
  assetId: string;
  fileName: string;
  startTime: number;
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
  loop?: boolean;
}

export interface VideoComposition {
  id: string;
  source: VideoSource;
  output: OutputPreset;
  brandPresetId?: string;
  exportPresetId?: string;
  videoFit?: VideoFitConfig;
  overlays: BrandOverlay[];
  textTracks: TextOverlay[];
  audioTracks: AudioTrack[];
  /** Regiones tapadas. Opcional por compatibilidad con composiciones anteriores. */
  masks?: MaskLayer[];
  /** Logos y stickers. Opcional por compatibilidad con composiciones anteriores. */
  images?: ImageLayer[];
  keepOriginalAudio: boolean;
  originalAudioVolume: number;
  createdAt: string;
  updatedAt: string;
}

export type RenderStatus = 'pending' | 'rendering' | 'completed' | 'failed' | 'cancelled';

export interface RenderedVideo {
  id: string;
  compositionId: string;
  status: RenderStatus;
  progress?: number;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface StudioAsset {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  duration?: number;
  width?: number;
  height?: number;
  createdAt: string;
}

// ─── Studio API Contracts ────────────────────────────────────────

export interface CreateCompositionRequest {
  sourceAssetId: string;
  brandPresetId?: string;
  exportPresetId?: string;
  videoFit?: VideoFitConfig;
  overlays?: BrandOverlay[];
  textTracks?: TextOverlay[];
  audioTracks?: AudioTrack[];
  masks?: MaskLayer[];
  images?: ImageLayer[];
  sourceTrim?: SourceTrim;
  keepOriginalAudio?: boolean;
  originalAudioVolume?: number;
  brandCustomPosition?: { x: number; y: number };
}

export interface CreateCompositionResponse {
  composition: VideoComposition;
}

export interface DuplicateCompositionRequest {
  compositionId: string;
}

export interface DuplicateCompositionResponse {
  composition: VideoComposition;
}

export interface StartRenderRequest {
  compositionId: string;
}

export interface StartRenderResponse {
  render: RenderedVideo;
}

export interface RenderStatusResponse {
  render: RenderedVideo;
}

export interface BrandPresetsResponse {
  presets: BrandPreset[];
}

export interface TextPresetsResponse {
  presets: TextPreset[];
}

export interface CompositionPresetsResponse {
  presets: CompositionPreset[];
}

export interface SavedCompositionPreset {
  id: string;
  name: string;
  brandPresetId?: string;
  textTracks: TextOverlay[];
  audioTracks: AudioTrack[];
  keepOriginalAudio: boolean;
  originalAudioVolume: number;
  createdAt: string;
}

export interface SaveCompositionPresetRequest {
  name: string;
  compositionId: string;
}

export interface SaveCompositionPresetResponse {
  preset: SavedCompositionPreset;
}

export interface SavedCompositionPresetsResponse {
  presets: SavedCompositionPreset[];
}

export interface DeleteCompositionPresetRequest {
  presetId: string;
}

export interface ValidationWarning {
  id: string;
  type: 'text' | 'timing' | 'safe-zone' | 'overlap' | 'audio';
  severity: 'info' | 'warning' | 'error';
  message: string;
  overlayId?: string;
  trackId?: string;
}

export interface ValidateCompositionRequest {
  composition: VideoComposition;
}

export interface ValidateCompositionResponse {
  warnings: ValidationWarning[];
}

export interface ExportPresetsResponse {
  presets: ExportPreset[];
}

// ─── Studio Error Codes ─────────────────────────────────────────

export type StudioErrorCode =
  | 'STUDIO_ASSET_NOT_FOUND'
  | 'STUDIO_ASSET_TOO_LARGE'
  | 'STUDIO_INVALID_COMPOSITION'
  | 'STUDIO_RENDER_FAILED'
  | 'STUDIO_RENDER_TIMEOUT'
  | 'STUDIO_RENDER_CANCELLED'
  | 'STUDIO_FFMPEG_NOT_AVAILABLE'
  | 'STUDIO_UNSUPPORTED_FORMAT'
  | 'STUDIO_INVALID_SOURCE'
  | 'STUDIO_COMPOSITION_NOT_FOUND'
  | 'STUDIO_RENDER_NOT_FOUND';
