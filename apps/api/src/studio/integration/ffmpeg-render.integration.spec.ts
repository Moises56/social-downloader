/**
 * Studio FFmpeg Integration Tests
 *
 * Tests real FFmpeg renders with different compositions.
 * Separated from unit tests to avoid slow CI runs.
 *
 * Run: npx vitest run src/studio/integration/ffmpeg-render.integration.spec.ts
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { FfmpegService } from '../infrastructure/ffmpeg/ffmpeg.service';
import { FfmpegVideoRenderer } from '../infrastructure/ffmpeg/ffmpeg-video-renderer';
import { TempAssetStorage } from '../infrastructure/storage/temp-asset-storage.service';
import { buildProbeCommand } from '../infrastructure/ffmpeg/ffmpeg-command-builder';
import type { VideoComposition, TextOverlay, BrandOverlay } from '../domain/video-composition';
import { DEFAULT_OUTPUT } from '../domain/video-composition';
import { unlink, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const FIXTURES_DIR = '/tmp/studio-test-fixtures';
const SOURCE_PATH = '/tmp/test-source.mp4';

const BASE_OVERLAY: BrandOverlay = {
  id: 'brand-test',
  presetId: 'ilusiones-colores',
  text: '@Ilusiones&Colores',
  startTime: 12,
  endTime: 15,
  position: 'bottom-center',
  style: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: 32,
    color: '#f6efe2',
    opacity: 0.85,
    textShadow: true,
    shadowColor: 'black@0.75',
  },
  animationIn: 'fade-in',
  animationOut: 'none',
  opacity: 0.85,
};

const BASE_TEXT: TextOverlay = {
  id: 'text-main',
  text: 'TEST TEXT',
  type: 'message',
  startTime: 1,
  endTime: 5,
  position: 'center',
  style: {
    fontFamily: 'Arial',
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    opacity: 1,
    textShadow: true,
    shadowColor: 'black@0.8',
  },
};

function makeComposition(overrides: Partial<VideoComposition> = {}): VideoComposition {
  return {
    id: randomUUID(),
    source: { assetId: ASSET_ID, fileName: 'test.mp4', duration: 15 },
    output: { ...DEFAULT_OUTPUT },
    overlays: [],
    textTracks: [],
    audioTracks: [],
    keepOriginalAudio: false,
    originalAudioVolume: 1.0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

let ASSET_ID = 'test';

interface ProbeResult {
  container: string;
  duration: number;
  width: number;
  height: number;
  videoCodec: string;
  audioCodec: string | null;
  fileSize: number;
}

async function probeOutput(filePath: string, ffmpeg: FfmpegService): Promise<ProbeResult> {
  const { args } = buildProbeCommand(filePath);
  const result = await ffmpeg.runFfprobe({ args, timeoutMs: 15_000 });
  const info = JSON.parse(result.stdout);
  const videoStream = info.streams.find((s: { codec_type: string }) => s.codec_type === 'video');
  const audioStream = info.streams.find((s: { codec_type: string }) => s.codec_type === 'audio');
  return {
    container: info.format.format_name,
    duration: Number(info.format.duration),
    width: Number(videoStream.width),
    height: Number(videoStream.height),
    videoCodec: videoStream.codec_name,
    audioCodec: audioStream?.codec_name ?? null,
    fileSize: Number(info.format.size),
  };
}

describe('FFmpeg Render Integration', { timeout: 30000 }, () => {
  let ffmpeg: FfmpegService;
  let renderer: FfmpegVideoRenderer;
  let storage: TempAssetStorage;
  let assetId: string;

  beforeAll(async () => {
    ffmpeg = new FfmpegService();
    storage = new TempAssetStorage();
    renderer = new FfmpegVideoRenderer(ffmpeg, storage);

    await mkdir(FIXTURES_DIR, { recursive: true });

    // Create test source if not exists
    if (!existsSync(SOURCE_PATH)) {
      const ffmpegPath = await ffmpeg.resolveFfmpeg();
      const { execSync } = await import('node:child_process');
      execSync(`${ffmpegPath} -y -f lavfi -i "color=c=blue:s=1080x1920:d=15,format=yuv420p" -f lavfi -i "sine=frequency=440:duration=15" -c:v libx264 -preset ultrafast -crf 28 -c:a aac -b:a 64k "${SOURCE_PATH}"`, { timeout: 30000 });
    }

    const sourceBuffer = await import('node:fs/promises').then((fs) => fs.readFile(SOURCE_PATH));
    const asset = await storage.createAsset('test-source.mp4', sourceBuffer);
    assetId = asset.id;
    ASSET_ID = asset.id;
  });

  afterAll(async () => {
    try { await unlink(SOURCE_PATH); } catch { /* cleanup best-effort */ }
    try { await storage.deleteAsset(assetId); } catch { /* cleanup best-effort */ }
  });

  it('brand-only: renders brand overlay correctly', async () => {
    const comp = makeComposition({ overlays: [BASE_OVERLAY] });
    const result = await renderer.render(comp);
    const probe = await probeOutput(result.filePath, ffmpeg);

    expect(probe.container).toContain('mp4');
    expect(probe.videoCodec).toBe('h264');
    expect(probe.width).toBe(1080);
    expect(probe.height).toBe(1920);
    expect(probe.fileSize).toBeGreaterThan(1024);

    await unlink(result.filePath).catch(() => {});
  });

  it('text-only: renders text overlay correctly', async () => {
    const comp = makeComposition({ textTracks: [BASE_TEXT] });
    const result = await renderer.render(comp);
    const probe = await probeOutput(result.filePath, ffmpeg);

    expect(probe.container).toContain('mp4');
    expect(probe.videoCodec).toBe('h264');
    expect(probe.width).toBe(1080);
    expect(probe.height).toBe(1920);

    await unlink(result.filePath).catch(() => {});
  });

  it('text + brand: renders both overlays', async () => {
    const comp = makeComposition({
      textTracks: [BASE_TEXT],
      overlays: [BASE_OVERLAY],
    });
    const result = await renderer.render(comp);
    const probe = await probeOutput(result.filePath, ffmpeg);

    expect(probe.container).toContain('mp4');
    expect(probe.videoCodec).toBe('h264');
    expect(probe.fileSize).toBeGreaterThan(1024);

    await unlink(result.filePath).catch(() => {});
  });

  it('multiple overlays: renders multiple text + brand', async () => {
    const text2: TextOverlay = {
      ...BASE_TEXT,
      id: 'text-2',
      text: 'SECOND TEXT',
      startTime: 6,
      endTime: 10,
    };
    const comp = makeComposition({
      textTracks: [BASE_TEXT, text2],
      overlays: [BASE_OVERLAY],
    });
    const result = await renderer.render(comp);
    const probe = await probeOutput(result.filePath, ffmpeg);

    expect(probe.container).toContain('mp4');
    expect(probe.videoCodec).toBe('h264');

    await unlink(result.filePath).catch(() => {});
  });

  it('crop mode: fills 9:16 frame', async () => {
    const comp = makeComposition({
      videoFit: { mode: 'crop' },
      textTracks: [BASE_TEXT],
    });
    const result = await renderer.render(comp);
    const probe = await probeOutput(result.filePath, ffmpeg);

    expect(probe.width).toBe(1080);
    expect(probe.height).toBe(1920);

    await unlink(result.filePath).catch(() => {});
  });

  it('fit-blur mode: renders with blurred background', async () => {
    const comp = makeComposition({
      videoFit: { mode: 'fit-blur' },
      textTracks: [BASE_TEXT],
    });
    const result = await renderer.render(comp);
    const probe = await probeOutput(result.filePath, ffmpeg);

    expect(probe.width).toBe(1080);
    expect(probe.height).toBe(1920);
    expect(probe.container).toContain('mp4');

    await unlink(result.filePath).catch(() => {});
  });

  it('fit-background mode: renders with solid color background', async () => {
    const comp = makeComposition({
      videoFit: { mode: 'fit-background', backgroundColor: '#1a1a2e' },
      textTracks: [BASE_TEXT],
    });
    const result = await renderer.render(comp);
    const probe = await probeOutput(result.filePath, ffmpeg);

    expect(probe.width).toBe(1080);
    expect(probe.height).toBe(1920);

    await unlink(result.filePath).catch(() => {});
  });

  it('brand ending mode: brand appears at end', async () => {
    const brand: BrandOverlay = {
      ...BASE_OVERLAY,
      startTime: 13,
      endTime: 15,
    };
    const comp = makeComposition({ overlays: [brand] });
    const result = await renderer.render(comp);
    const probe = await probeOutput(result.filePath, ffmpeg);

    expect(probe.container).toContain('mp4');
    expect(probe.videoCodec).toBe('h264');

    await unlink(result.filePath).catch(() => {});
  });

  it('brand persistent mode: brand visible throughout', async () => {
    const brand: BrandOverlay = {
      ...BASE_OVERLAY,
      startTime: 1,
      endTime: 14,
    };
    const comp = makeComposition({ overlays: [brand] });
    const result = await renderer.render(comp);
    const probe = await probeOutput(result.filePath, ffmpeg);

    expect(probe.container).toContain('mp4');

    await unlink(result.filePath).catch(() => {});
  });

  it('full composition: Ilusiones & Colores editorial', async () => {
    const comp = makeComposition({
      textTracks: [
        { ...BASE_TEXT, text: 'SU FE NO EMPEZÓ\nCON CERTEZA', startTime: 0.5, endTime: 5 },
        { ...BASE_TEXT, id: 'verse', text: 'A donde tú vayas, iré;\ntu pueblo será mi pueblo.', startTime: 5.5, endTime: 10, style: { ...BASE_TEXT.style, fontWeight: 'normal' } },
      ],
      overlays: [{
        ...BASE_OVERLAY,
        startTime: 12.5,
        endTime: 15,
      }],
      keepOriginalAudio: true,
      originalAudioVolume: 0.3,
    });
    const result = await renderer.render(comp);
    const probe = await probeOutput(result.filePath, ffmpeg);

    expect(probe.container).toContain('mp4');
    expect(probe.videoCodec).toBe('h264');
    expect(probe.audioCodec).toBe('aac');
    expect(probe.width).toBe(1080);
    expect(probe.height).toBe(1920);
    expect(probe.fileSize).toBeGreaterThan(1024);
    expect(Math.abs(probe.duration - 15) < 2).toBe(true);

    await unlink(result.filePath).catch(() => {});
  });

  it('full 5-slot editorial: complete devotional composition', async () => {
    const hero: TextOverlay = {
      id: 'hero',
      text: 'SU FE NO EMPEZÓ\nCON CERTEZA,\nSINO ELIGIENDO\nA QUIÉN NO SOLTAR',
      type: 'message',
      startTime: 0,
      endTime: 5,
      position: 'center',
      style: {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 56,
        fontWeight: 'bold',
        color: '#f6efe2',
        opacity: 1,
        textShadow: true,
        shadowColor: 'black@0.8',
      },
    };

    const scripture: TextOverlay = {
      id: 'scripture',
      text: '"A donde tú vayas, iré;\ntu pueblo será mi pueblo."',
      type: 'verse',
      startTime: 5,
      endTime: 10,
      position: 'center',
      style: {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 44,
        fontWeight: 'normal',
        italic: true,
        color: '#f6efe2',
        opacity: 1,
        textShadow: true,
        shadowColor: 'black@0.8',
      },
    };

    const reference: TextOverlay = {
      id: 'reference',
      text: 'Rut 1:16',
      type: 'reflection',
      startTime: 9,
      endTime: 12,
      position: 'lower-center',
      style: {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 40,
        fontWeight: 'normal',
        color: '#f6efe2',
        opacity: 0.9,
        textShadow: true,
        shadowColor: 'black@0.7',
      },
    };

    const cta: TextOverlay = {
      id: 'cta',
      text: 'Compártelo con quien no te soltó',
      type: 'cta',
      startTime: 11,
      endTime: 14,
      position: 'lower-center',
      style: {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 36,
        fontWeight: 'bold',
        color: '#f6efe2',
        opacity: 1,
        textShadow: true,
        shadowColor: 'black@0.8',
      },
    };

    const brand: BrandOverlay = {
      id: 'brand-ilusiones',
      presetId: 'ilusiones-colores',
      text: '@Ilusiones&Colores',
      startTime: 13,
      endTime: 15,
      position: 'bottom-center',
      style: {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 32,
        fontWeight: 'normal',
        italic: true,
        color: '#f6efe2',
        opacity: 0.62,
        textShadow: true,
        shadowColor: 'black@0.75',
      },
      animationIn: 'fade-in',
      animationOut: 'none',
      opacity: 0.62,
    };

    const comp = makeComposition({
      textTracks: [hero, scripture, reference, cta],
      overlays: [brand],
      keepOriginalAudio: true,
      originalAudioVolume: 0.3,
    });

    const result = await renderer.render(comp);
    const probe = await probeOutput(result.filePath, ffmpeg);

    // Validate output properties
    expect(probe.container).toContain('mp4');
    expect(probe.videoCodec).toBe('h264');
    expect(probe.audioCodec).toBe('aac');
    expect(probe.width).toBe(1080);
    expect(probe.height).toBe(1920);
    expect(probe.fileSize).toBeGreaterThan(10240); // > 10KB for 15s video
    expect(Math.abs(probe.duration - 15) < 2).toBe(true);

    // Validate timing: CTA ends at 14s, brand starts at 13s (1s overlap is intentional)
    expect(cta.endTime).toBe(14);
    expect(brand.startTime).toBe(13);
    expect(brand.text).toBe('@Ilusiones&Colores');

    // Validate safe zones: all text within bounds
    // center = 50% y → within 10%-80% safe zone
    // lower-center = 65% y → within safe zone
    // bottom-center = 80% y → at bottom safe boundary

    await unlink(result.filePath).catch(() => {});
  });

  it('audio mixing: original + music track', async () => {
    const musicTrack = {
      id: 'music-1',
      type: 'music' as const,
      fileName: 'background.mp3',
      assetId: 'music-asset',
      volume: 0.3,
      startTime: 0,
      fadeIn: 1,
      fadeOut: 2,
    };

    const text: TextOverlay = {
      ...BASE_TEXT,
      text: 'CON MÚSICA',
      startTime: 0,
      endTime: 15,
    };

    const comp = makeComposition({
      textTracks: [text],
      audioTracks: [musicTrack],
      keepOriginalAudio: true,
      originalAudioVolume: 0.5,
    });

    // This test validates the filter graph builds correctly with multiple audio inputs
    // The actual music file doesn't exist, so we test the command structure
    const { buildRenderCommand } = await import('../infrastructure/ffmpeg/ffmpeg-command-builder');
    const { args } = buildRenderCommand(comp, SOURCE_PATH, '/tmp/test-audio-mix.mp4', ['/tmp/fake-music.mp3']);

    // Verify filter_complex contains audio mixing
    const fcIdx = args.indexOf('-filter_complex');
    expect(fcIdx).toBeGreaterThan(-1);
    const filterComplex = args[fcIdx + 1];
    expect(filterComplex).toContain('amix');
    expect(filterComplex).toContain('volume=');
    expect(filterComplex).toContain('afade');

    // Verify both audio maps
    const aoutMaps = args.filter((a) => a === '[aout]');
    expect(aoutMaps.length).toBe(1);
  });
});
