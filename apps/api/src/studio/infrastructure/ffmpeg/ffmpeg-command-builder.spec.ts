import { describe, it, expect } from 'vitest';
import { buildRenderCommand, buildProbeCommand } from './ffmpeg-command-builder';
import type { VideoComposition } from '../../domain/video-composition';

describe('ffmpeg-command-builder', () => {
  const baseComposition: VideoComposition = {
    id: 'test-composition',
    source: { assetId: 'src-1', fileName: 'source.mp4', duration: 10 },
    output: { width: 1080, height: 1920, fps: 24, format: 'mp4', videoCodec: 'h264', audioCodec: 'aac' },
    overlays: [],
    textTracks: [],
    audioTracks: [],
    keepOriginalAudio: false,
    originalAudioVolume: 1.0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('builds basic render command', () => {
    const { args } = buildRenderCommand(baseComposition, '/src/video.mp4', '/out/video.mp4');
    expect(args).toContain('-i');
    expect(args).toContain('/src/video.mp4');
    expect(args).toContain('/out/video.mp4');
    expect(args).toContain('-c:v');
    expect(args).toContain('libx264');
    expect(args).toContain('-map');
    expect(args).toContain('[vout]');
  });

  it('includes audio codec when keepOriginalAudio is true', () => {
    const composition = { ...baseComposition, keepOriginalAudio: true };
    const { args } = buildRenderCommand(composition, '/src/video.mp4', '/out/video.mp4');
    expect(args).toContain('-c:a');
    expect(args).toContain('aac');
    expect(args).not.toContain('-an');
  });

  it('includes audio inputs for audio tracks', () => {
    const composition = {
      ...baseComposition,
      audioTracks: [
        { id: 't1', assetId: 'a1', fileName: 'music.mp3', startTime: 0, volume: 0.8 },
      ],
    };
    const { args } = buildRenderCommand(composition, '/src/video.mp4', '/out/video.mp4', ['/audio/music.mp3']);
    expect(args).toContain('/audio/music.mp3');
  });

  it('builds probe command', () => {
    const { args } = buildProbeCommand('/src/video.mp4');
    expect(args).toContain('-print_format');
    expect(args).toContain('json');
    expect(args).toContain('/src/video.mp4');
  });

  it('includes text overlay filters', () => {
    const composition = {
      ...baseComposition,
      textTracks: [
        {
          id: 'txt1',
          text: 'Hello',
          type: 'message' as const,
          startTime: 0,
          endTime: 5,
          position: 'center' as const,
          style: {
            fontFamily: 'Arial',
            fontSize: 48,
            color: '#ffffff',
            opacity: 1,
          },
        },
      ],
    };
    const { args } = buildRenderCommand(composition, '/src/video.mp4', '/out/video.mp4');
    const filterIdx = args.indexOf('-filter_complex');
    expect(filterIdx).toBeGreaterThan(-1);
    const filterStr = args[filterIdx + 1];
    expect(filterStr).toContain('drawtext');
    expect(filterStr).toContain('Hello');
  });

  it('includes brand overlay filters', () => {
    const composition = {
      ...baseComposition,
      overlays: [
        {
          id: 'brand1',
          presetId: 'ilusiones-colores',
          text: '@Ilusiones&Colores',
          startTime: 8,
          endTime: 10,
          position: 'bottom-center' as const,
          style: {
            fontFamily: 'Georgia',
            fontSize: 32,
            color: '#f6efe2',
            opacity: 0.62,
            textShadow: true,
            shadowColor: 'rgba(0,0,0,0.75)',
          },
          opacity: 0.62,
        },
      ],
    };
    const { args } = buildRenderCommand(composition, '/src/video.mp4', '/out/video.mp4');
    const filterIdx = args.indexOf('-filter_complex');
    expect(filterIdx).toBeGreaterThan(-1);
    const filterStr = args[filterIdx + 1];
    expect(filterStr).toContain('@Ilusiones&Colores');
  });
});
