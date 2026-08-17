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
  | 'SSRF_BLOCKED'
  | 'INVALID_DOWNLOAD_TOKEN'
  | 'TOO_MANY_REQUESTS';

export interface ApiError {
  code: ApiErrorCode | string;
  message: string;
}

// ─── Studio Domain ───────────────────────────────────────────────

export type OverlayPosition =
  | 'bottom-center'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-center'
  | 'top-left'
  | 'top-right'
  | 'center'
  | 'custom';

export type OverlayAnimation = 'fade-in' | 'fade-out' | 'slide-up' | 'soft-reveal' | 'none';

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
}

export interface VideoSource {
  assetId: string;
  fileName: string;
  duration?: number;
  width?: number;
  height?: number;
  mimeType?: string;
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
  style: TextStyleConfig;
  animationIn?: OverlayAnimation;
  animationOut?: OverlayAnimation;
  opacity: number;
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
  overlays: BrandOverlay[];
  textTracks: TextOverlay[];
  audioTracks: AudioTrack[];
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
  overlays?: BrandOverlay[];
  textTracks?: TextOverlay[];
  audioTracks?: AudioTrack[];
  keepOriginalAudio?: boolean;
  originalAudioVolume?: number;
}

export interface CreateCompositionResponse {
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
