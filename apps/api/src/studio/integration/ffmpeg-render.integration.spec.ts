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
});
