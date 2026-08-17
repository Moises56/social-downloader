import type {
  VideoComposition as IVideoComposition,
  VideoSource as IVideoSource,
  BrandPreset as IBrandPreset,
  TextOverlay as ITextOverlay,
  BrandOverlay as IBrandOverlay,
  AudioTrack as IAudioTrack,
  RenderedVideo as IRenderedVideo,
  OutputPreset as IOutputPreset,
  StudioAsset as IStudioAsset,
  TextStyleConfig as ITextStyleConfig,
  OverlayPosition as IOverlayPosition,
  OverlayAnimation as IOverlayAnimation,
  TextPreset as ITextPreset,
  CompositionPreset as ICompositionPreset,
} from '@social-downloader/contracts';

export type VideoComposition = IVideoComposition;
export type VideoSource = IVideoSource;
export type BrandPreset = IBrandPreset;
export type TextOverlay = ITextOverlay;
export type BrandOverlay = IBrandOverlay;
export type AudioTrack = IAudioTrack;
export type RenderedVideo = IRenderedVideo;
export type OutputPreset = IOutputPreset;
export type StudioAsset = IStudioAsset;
export type TextStyleConfig = ITextStyleConfig;
export type OverlayPosition = IOverlayPosition;
export type OverlayAnimation = IOverlayAnimation;
export type TextPreset = ITextPreset;
export type CompositionPreset = ICompositionPreset;

export const DEFAULT_OUTPUT: OutputPreset = {
  width: 1080,
  height: 1920,
  fps: 30,
  format: 'mp4',
  videoCodec: 'h264',
  audioCodec: 'aac',
  crf: 23,
  preset: 'fast',
  audioBitrate: '128k',
  audioSampleRate: 48000,
  audioChannels: 2,
  movflags: '+faststart',
};

export const DEFAULT_BRAND_PRESET: BrandPreset = {
  id: 'ilusiones-colores',
  name: 'Ilusiones & Colores',
  signature: {
    text: '@Ilusiones&Colores',
    defaultPosition: 'bottom-center',
    defaultMode: 'ending',
    style: {
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
    },
  },
  defaultTextStyle: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: 56,
    fontWeight: 'bold',
    color: '#f6efe2',
    opacity: 1,
    textShadow: true,
    shadowColor: 'rgba(0, 0, 0, 0.8)',
    shadowBlur: 16,
    letterSpacing: 0.02,
  },
  defaultOutput: DEFAULT_OUTPUT,
};
