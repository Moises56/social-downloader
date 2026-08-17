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

  it('translates a custom normalized position into a centered drawtext expression', () => {
    const composition = {
      ...baseComposition,
      textTracks: [
        {
          id: 'txt-custom',
          text: 'Custom pos',
          type: 'message' as const,
          startTime: 0,
          endTime: 5,
          position: 'custom' as const,
          customPosition: { x: 0.9, y: 0.8 },
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
    const filterStr = args[args.indexOf('-filter_complex') + 1];
    // x/y represent the overlay center — FFmpeg must offset by half the text box.
    // width=1080, height=1920 (baseComposition.output): 0.9*1080=972, 0.8*1920=1536.
    expect(filterStr).toContain('x=972-text_w/2');
    expect(filterStr).toContain('y=1536-text_h/2');
  });

  it('applies a custom position to a brand overlay the same way as text overlays', () => {
    const composition = {
      ...baseComposition,
      overlays: [
        {
          id: 'brand-custom',
          presetId: 'ilusiones-colores',
          text: '@Ilusiones&Colores',
          startTime: 0,
          endTime: 5,
          position: 'custom' as const,
          customPosition: { x: 0.1, y: 0.5 },
          style: {
            fontFamily: 'Georgia',
            fontSize: 32,
            color: '#f6efe2',
            opacity: 0.62,
          },
          opacity: 0.62,
        },
      ],
    };
    const { args } = buildRenderCommand(composition, '/src/video.mp4', '/out/video.mp4');
    const filterStr = args[args.indexOf('-filter_complex') + 1];
    // width=1080, height=1920: 0.1*1080=108, 0.5*1920=960.
    expect(filterStr).toContain('x=108-text_w/2');
    expect(filterStr).toContain('y=960-text_h/2');
  });

  it('does not produce a NaN y-coordinate for slide-up animation on a custom position', () => {
    const composition = {
      ...baseComposition,
      textTracks: [
        {
          id: 'txt-slide',
          text: 'Sliding',
          type: 'message' as const,
          startTime: 0,
          endTime: 5,
          position: 'custom' as const,
          customPosition: { x: 0.5, y: 0.5 },
          style: {
            fontFamily: 'Arial',
            fontSize: 48,
            color: '#ffffff',
            opacity: 1,
          },
          animationIn: 'slide-up' as const,
          animationOut: 'fade-out' as const,
        },
      ],
    };
    const { args } = buildRenderCommand(composition, '/src/video.mp4', '/out/video.mp4');
    const filterStr = args[args.indexOf('-filter_complex') + 1];
    expect(filterStr).not.toContain('NaN');
    expect(filterStr).toContain('text_h/2');
  });
});
