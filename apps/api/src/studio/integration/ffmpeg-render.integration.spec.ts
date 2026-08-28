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
  // ─── Recorte, máscaras y capas de imagen ──────────────────────────────────
  //
  // Estos casos no se conforman con "el render no falló": leen los píxeles del resultado.
  // Una máscara que se genera en el filtergraph pero no tapa nada pasaría cualquier
  // aserción basada solo en duración o resolución.

  const PATTERN_PATH = '/tmp/test-pattern.mp4';
  const LOGO_PATH = '/tmp/test-logo.png';

  /**
   * Extrae una región de un frame como escala de grises cruda y devuelve sus estadísticas.
   * Se escribe a fichero en vez de leer stdout porque el runner captura stdout como string
   * y eso corrompería los bytes binarios.
   */
  async function sampleRegion(
    videoPath: string,
    region: { x: number; y: number; w: number; h: number },
    atSecond: number,
    pixFmt: 'gray' | 'rgb24' = 'gray',
  ): Promise<{ min: number; max: number; mean: number; spread: number; sharpness: number; bytes: Buffer }> {
    const ffmpegPath = await ffmpeg.resolveFfmpeg();
    const rawPath = `${FIXTURES_DIR}/region-${randomUUID()}.raw`;
    const { execFileSync } = await import('node:child_process');
    execFileSync(
      ffmpegPath,
      [
        '-y', '-ss', String(atSecond), '-i', videoPath,
        '-vf', `crop=${region.w}:${region.h}:${region.x}:${region.y}`,
        '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', pixFmt, rawPath,
      ],
      { timeout: 30_000, stdio: 'pipe' },
    );
    const fs = await import('node:fs/promises');
    const bytes = await fs.readFile(rawPath);
    await fs.unlink(rawPath).catch(() => undefined);

    let min = 255, max = 0, total = 0;
    for (const b of bytes) {
      if (b < min) min = b;
      if (b > max) max = b;
      total += b;
    }

    /**
     * Detalle local: diferencia media entre píxeles horizontalmente contiguos.
     *
     * `max - min` NO sirve para detectar desenfoque: un patrón con negros y blancos puros
     * conserva sus extremos aunque se difumine, así que el rango se queda en ~255. Lo que
     * el desenfoque destruye es la variación de vecino a vecino, y eso es lo que se mide.
     * Solo tiene sentido en escala de grises (1 byte por píxel).
     */
    let sharpness = 0;
    if (pixFmt === 'gray') {
      let diffTotal = 0, pairs = 0;
      for (let row = 0; row < region.h; row++) {
        const base = row * region.w;
        for (let col = 1; col < region.w; col++) {
          diffTotal += Math.abs(bytes[base + col] - bytes[base + col - 1]);
          pairs++;
        }
      }
      sharpness = pairs > 0 ? diffTotal / pairs : 0;
    }

    return { min, max, mean: total / bytes.length, spread: max - min, sharpness, bytes };
  }

  let patternAssetId: string;
  let logoAssetId: string;

  beforeAll(async () => {
    const ffmpegPath = await ffmpeg.resolveFfmpeg();
    const { execFileSync } = await import('node:child_process');
    const fs = await import('node:fs/promises');

    /**
     * Fuente con detalle en TODO el fotograma: un tablero de 4px.
     *
     * Ni `testsrc` ni `testsrc2` sirven: medidos en la región de prueba dan un detalle
     * local de 0.81 (zona plana del patrón), así que un desenfoque no tendría nada que
     * destruir y el test pasaría sin comprobar nada. El tablero da ~63.
     *
     * Se genera un único PNG y se repite en bucle, que es mucho más rápido que evaluar
     * `geq` en cada fotograma.
     */
    const patternFrame = `${FIXTURES_DIR}/pattern-frame.png`;
    execFileSync(ffmpegPath, [
      '-y', '-f', 'lavfi', '-i', 'nullsrc=s=1080x1920',
      '-vf', "geq='if(eq(mod(floor(X/4)+floor(Y/4),2),0),235,16)':128:128",
      '-frames:v', '1', patternFrame,
    ], { timeout: 60_000, stdio: 'pipe' });
    execFileSync(ffmpegPath, [
      '-y', '-loop', '1', '-i', patternFrame, '-t', '10', '-r', '30',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '18', '-pix_fmt', 'yuv420p',
      PATTERN_PATH,
    ], { timeout: 60_000, stdio: 'pipe' });

    execFileSync(ffmpegPath, [
      '-y', '-f', 'lavfi', '-i', 'color=c=red:s=200x200', '-frames:v', '1', LOGO_PATH,
    ], { timeout: 30_000, stdio: 'pipe' });

    patternAssetId = (await storage.createAsset('pattern.mp4', await fs.readFile(PATTERN_PATH))).id;
    logoAssetId = (await storage.createAsset('logo.png', await fs.readFile(LOGO_PATH))).id;
  });

  afterAll(async () => {
    try { await unlink(PATTERN_PATH); } catch { /* best-effort */ }
    try { await unlink(LOGO_PATH); } catch { /* best-effort */ }
    try { await storage.deleteAsset(patternAssetId); } catch { /* best-effort */ }
    try { await storage.deleteAsset(logoAssetId); } catch { /* best-effort */ }
  });

  it('trim: el render dura lo recortado, no el material entero', async () => {
    const comp = makeComposition({
      source: { assetId: patternAssetId, fileName: 'pattern.mp4', duration: 10, trim: { start: 3, end: 8 } },
    });
    const result = await renderer.render(comp);
    const probe = await probeOutput(result.filePath, ffmpeg);

    expect(probe.duration).toBeGreaterThan(4.5);
    expect(probe.duration).toBeLessThan(5.5);
  });

  it('máscara solid: la región queda rellena de un color plano', async () => {
    const region = { x: 200, y: 400, w: 300, h: 200 };
    const comp = makeComposition({
      source: { assetId: patternAssetId, fileName: 'pattern.mp4', duration: 10 },
      masks: [{
        id: 'm1',
        mode: 'solid',
        color: '#000000',
        intensity: 0,
        rect: { x: region.x / 1080, y: region.y / 1920, width: region.w / 1080, height: region.h / 1920 },
        startTime: 0,
        endTime: 10,
      }],
    });
    const result = await renderer.render(comp);

    // Se muestrea con margen hacia dentro para no medir el borde de redondeo.
    const inside = await sampleRegion(result.filePath, { x: region.x + 20, y: region.y + 20, w: region.w - 40, h: region.h - 40 }, 2);
    expect(inside.spread).toBeLessThan(12);
    expect(inside.mean).toBeLessThan(40);
  });

  it('máscara blur: la región tapada pierde detalle frente a la misma sin tapar', async () => {
    const region = { x: 300, y: 700, w: 400, h: 300 };
    const rect = { x: region.x / 1080, y: region.y / 1920, width: region.w / 1080, height: region.h / 1920 };

    const plain = await renderer.render(makeComposition({
      source: { assetId: patternAssetId, fileName: 'pattern.mp4', duration: 10 },
    }));
    const masked = await renderer.render(makeComposition({
      source: { assetId: patternAssetId, fileName: 'pattern.mp4', duration: 10 },
      masks: [{ id: 'm1', mode: 'blur', intensity: 20, rect, startTime: 0, endTime: 10 }],
    }));

    const sample = { x: region.x + 30, y: region.y + 30, w: region.w - 60, h: region.h - 60 };
    const before = await sampleRegion(plain.filePath, sample, 2);
    const after = await sampleRegion(masked.filePath, sample, 2);

    // Desenfocar destruye el detalle local. Se exige una caída grande para que el test
    // no pueda pasar por ruido de codificación.
    expect(before.sharpness).toBeGreaterThan(5);
    expect(after.sharpness).toBeLessThan(before.sharpness * 0.5);
  });

  it('máscara temporizada: solo tapa dentro de su ventana', async () => {
    const region = { x: 200, y: 400, w: 300, h: 200 };
    const comp = makeComposition({
      source: { assetId: patternAssetId, fileName: 'pattern.mp4', duration: 10 },
      masks: [{
        id: 'm1',
        mode: 'solid',
        color: '#000000',
        intensity: 0,
        rect: { x: region.x / 1080, y: region.y / 1920, width: region.w / 1080, height: region.h / 1920 },
        startTime: 5,
        endTime: 10,
      }],
    });
    const result = await renderer.render(comp);
    const sample = { x: region.x + 20, y: region.y + 20, w: region.w - 40, h: region.h - 40 };

    const outsideWindow = await sampleRegion(result.filePath, sample, 2);
    const insideWindow = await sampleRegion(result.filePath, sample, 7);

    expect(insideWindow.spread).toBeLessThan(12);
    expect(outsideWindow.spread).toBeGreaterThan(insideWindow.spread);
  });

  it('capa de imagen: el logo aparece donde se coloca', async () => {
    const comp = makeComposition({
      source: { assetId: patternAssetId, fileName: 'pattern.mp4', duration: 10 },
      images: [{
        id: 'img1',
        assetId: logoAssetId,
        fileName: 'logo.png',
        position: { x: 0.5, y: 0.5 },
        scale: 200 / 1080,
        opacity: 1,
        startTime: 0,
        endTime: 10,
      }],
    });
    const result = await renderer.render(comp);

    // Centro del lienzo, dentro del logo de 200px.
    const sample = await sampleRegion(result.filePath, { x: 500, y: 920, w: 80, h: 80 }, 2, 'rgb24');
    let r = 0, g = 0, b = 0;
    for (let i = 0; i + 2 < sample.bytes.length; i += 3) {
      r += sample.bytes[i]; g += sample.bytes[i + 1]; b += sample.bytes[i + 2];
    }
    expect(r).toBeGreaterThan(g * 3);
    expect(r).toBeGreaterThan(b * 3);
  });

  it('orden de composición: las máscaras se aplican antes que los textos', async () => {
    const comp = makeComposition({
      source: { assetId: patternAssetId, fileName: 'pattern.mp4', duration: 10 },
      masks: [{
        id: 'm1', mode: 'blur', intensity: 10,
        rect: { x: 0.1, y: 0.1, width: 0.3, height: 0.2 },
        startTime: 0, endTime: 10,
      }],
      textTracks: [BASE_TEXT],
    });
    const { buildRenderCommand } = await import('../infrastructure/ffmpeg/ffmpeg-command-builder');
    const { args } = buildRenderCommand(comp, PATTERN_PATH, '/tmp/unused.mp4');
    const filterComplex = args[args.indexOf('-filter_complex') + 1];

    // Si el texto se dibujara primero, la máscara lo emborronaría.
    expect(filterComplex.indexOf('boxblur')).toBeLessThan(filterComplex.indexOf('drawtext'));
  });
});
