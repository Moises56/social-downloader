import { execFileSync } from 'node:child_process';
import type {
  VideoComposition,
  TextOverlay,
  BrandOverlay,
  TextStyleConfig,
  MaskLayer,
  ImageLayer,
} from '../../domain/video-composition';

export interface FfmpegCommand {
  args: string[];
}

/**
 * Escape text for FFmpeg drawtext filter.
 * Since we use spawn() with shell: false, only FFmpeg filter escaping is needed.
 *
 * Newlines are deliberately left as real `\n` bytes, NOT escaped to the two-character
 * `\n` sequence: that sequence is a convenience the ffmpeg CLI's command-line string
 * parser offers when you can't type a literal newline into a shell command. We pass
 * args as an array via spawn() with no shell involved, so drawtext's own filtergraph
 * parser sees the raw text bytes directly — a literal newline already renders as a
 * line break, and escaping it to `\n` instead makes drawtext print a literal "n" and
 * silently drop the line break (confirmed by rendering both ways).
 */
function escapeDrawText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "'\\\\''")
    .replace(/:/g, '\\:')
    .replace(/%/g, '%%');
}

/**
 * Convert CSS rgba() color to FFmpeg-compatible hex color (0xRRGGBBAA).
 * FFmpeg drawtext does not support rgba() in filter expressions (parentheses break parsing).
 */
function sanitizeColorForFfmpeg(color: string): string {
  const rgbaMatch = color.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i);
  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch;
    const alpha = Math.round(parseFloat(a) * 255).toString(16).padStart(2, '0');
    const hex = [r, g, b].map((v) => parseInt(v, 10).toString(16).padStart(2, '0')).join('');
    return `0x${hex}${alpha}`;
  }
  return color;
}

/**
 * Extract the primary font name from a CSS font-family string.
 * Example: 'Georgia, "Times New Roman", serif' → 'Georgia'
 */
function resolveFontName(fontFamily: string): string {
  const first = fontFamily.split(',')[0]?.trim() ?? 'Sans';
  return first.replace(/^["']|["']$/g, '');
}

const fontFileCache = new Map<string, string | null>();

/**
 * Resolve a CSS font-family + weight/style to an actual font FILE path via fontconfig,
 * so bold/italic are genuinely rendered (drawtext's `font=<name>` parameter only does a
 * family-name lookup — it silently ignores style, always rendering the regular cut).
 * `fontfile=<path>` is unambiguous and sidesteps quoting a `:style=...` fontconfig
 * pattern through drawtext's own `:`-delimited option syntax.
 *
 * Returns null (falls back to `font=<name>`, i.e. the old behavior) if `fc-match` isn't
 * available on the host — keeps rendering working in environments without fontconfig's
 * CLI tools instead of failing the render.
 */
function resolveFontFile(fontFamily: string, bold: boolean, italic: boolean): string | null {
  const family = resolveFontName(fontFamily);
  const styleParts: string[] = [];
  if (bold) styleParts.push('Bold');
  if (italic) styleParts.push('Italic');
  const pattern = styleParts.length > 0 ? `${family}:style=${styleParts.join(' ')}` : family;

  if (fontFileCache.has(pattern)) return fontFileCache.get(pattern) ?? null;

  try {
    const out = execFileSync('fc-match', ['-f', '%{file}', pattern], {
      encoding: 'utf8',
      timeout: 3000,
    }).trim();
    fontFileCache.set(pattern, out || null);
    return out || null;
  } catch {
    fontFileCache.set(pattern, null);
    return null;
  }
}

/** Escapes a filesystem path for use inside a single-quoted FFmpeg filter option value. */
function escapeFontFilePath(path: string): string {
  return path.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Builds the `fontfile='...'` (preferred) or `font=Name` (fallback) drawtext clause for
 * a given style, so every drawtext call site renders bold/italic consistently instead of
 * each duplicating the resolution logic inline.
 */
function fontClause(fontFamily: string, fontWeight: string | undefined, italic: boolean | undefined): string {
  const bold = fontWeight === 'bold';
  const file = resolveFontFile(fontFamily, bold, italic ?? false);
  return file ? `fontfile='${escapeFontFilePath(file)}'` : `font=${resolveFontName(fontFamily)}`;
}

/**
 * Recorta un valor normalizado 0..1 y lo lleva a píxeles del lienzo, forzando un mínimo
 * de 2px: FFmpeg rechaza `crop` con ancho o alto 0.
 */
function toPixels(normalized: number, total: number, min = 0): number {
  return Math.max(min, Math.min(total, Math.round(normalized * total)));
}

/**
 * Cadenas que ocultan regiones del vídeo (logos ajenos, marcas de agua, usuarios).
 *
 * Se aplican ANTES de textos e imágenes para que tapen el material original y no lo que
 * el usuario añade encima. `blur` y `pixelate` recortan la región, la degradan y la vuelven
 * a superponer; `solid` es un `drawbox` relleno y no necesita recorte.
 */
function buildMaskFilters(
  masks: MaskLayer[],
  width: number,
  height: number,
  inputLabel: string,
): { chains: string[]; outputLabel: string } {
  const chains: string[] = [];
  let current = inputLabel;

  masks.forEach((mask, i) => {
    const x = toPixels(mask.rect.x, width);
    const y = toPixels(mask.rect.y, height);
    // El ancho se limita a lo que queda de lienzo: un rect que se sale rompe `crop`.
    const w = Math.max(2, Math.min(width - x, toPixels(mask.rect.width, width, 2)));
    const h = Math.max(2, Math.min(height - y, toPixels(mask.rect.height, height, 2)));
    if (w < 2 || h < 2) return;

    const enable = `enable='between(t\\,${mask.startTime}\\,${mask.endTime})'`;
    const out = `mask${i}`;

    if (mask.mode === 'solid') {
      const color = sanitizeColorForFfmpeg(mask.color ?? '#000000');
      chains.push(`${current}drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${color}:t=fill:${enable}[${out}]`);
    } else {
      const base = `maskbase${i}`;
      const region = `maskreg${i}`;
      const done = `maskdone${i}`;
      const degrade = mask.mode === 'pixelate'
        // El bloque no puede exceder la región recortada.
        ? `pixelize=w=${Math.max(2, Math.min(w, Math.round(mask.intensity)))}:h=${Math.max(2, Math.min(h, Math.round(mask.intensity)))}`
        : `boxblur=${Math.max(1, Math.round(mask.intensity))}:2`;

      chains.push(`${current}split=2[${base}][${region}]`);
      chains.push(`[${region}]crop=${w}:${h}:${x}:${y},${degrade}[${done}]`);
      chains.push(`[${base}][${done}]overlay=${x}:${y}:${enable}[${out}]`);
    }

    current = `[${out}]`;
  });

  return { chains, outputLabel: current };
}

/**
 * Cadenas de logos y stickers. `firstInputIndex` es el índice de entrada de la primera
 * imagen, que va después de la fuente y de todas las pistas de audio.
 */
function buildImageFilters(
  images: ImageLayer[],
  width: number,
  height: number,
  inputLabel: string,
  firstInputIndex: number,
): { chains: string[]; outputLabel: string } {
  const chains: string[] = [];
  let current = inputLabel;

  images.forEach((image, i) => {
    const targetWidth = Math.max(2, toPixels(image.scale, width, 2));
    const scaled = `img${i}`;
    const out = `imgout${i}`;

    // `-1` mantiene el aspecto original de la imagen.
    const prepare = [`[${firstInputIndex + i}:v]scale=${targetWidth}:-1`];
    if (image.opacity < 1) {
      // colorchannelmixer sobre rgba es la vía fiable para opacidad parcial:
      // `overlay` por sí solo no acepta un factor de opacidad.
      prepare.push(`format=rgba`, `colorchannelmixer=aa=${image.opacity}`);
    }
    chains.push(`${prepare.join(',')}[${scaled}]`);

    // `position` es el CENTRO, así que se descuenta media imagen. w/h los resuelve
    // FFmpeg en tiempo de ejecución con las dimensiones reales ya escaladas.
    const cx = toPixels(image.position.x, width);
    const cy = toPixels(image.position.y, height);
    const enable = `enable='between(t\\,${image.startTime}\\,${image.endTime})'`;
    chains.push(`${current}[${scaled}]overlay=x=${cx}-w/2:y=${cy}-h/2:${enable}[${out}]`);

    current = `[${out}]`;
  });

  return { chains, outputLabel: current };
}

export function buildRenderCommand(
  composition: VideoComposition,
  sourcePath: string,
  outputPath: string,
  audioInputPaths: string[] = [],
  imageInputPaths: string[] = [],
): FfmpegCommand {
  const args: string[] = [];

  // Recorte del material: `-ss`/`-t` como opciones de ENTRADA (antes de `-i`) para que
  // FFmpeg busque y descarte sin decodificar de más, y para que los timestamps de salida
  // arranquen en 0. Por eso los tiempos de overlays y audio son relativos al recorte.
  const trim = composition.source.trim;
  const trimDuration =
    trim && trim.end > trim.start ? trim.end - trim.start : null;
  if (trim && trimDuration !== null) {
    args.push('-ss', String(trim.start), '-t', String(trimDuration));
  }
  args.push('-i', sourcePath);

  for (const audioPath of audioInputPaths) {
    args.push('-i', audioPath);
  }
  for (const imagePath of imageInputPaths) {
    args.push('-i', imagePath);
  }

  /**
   * Cada elemento es una CADENA completa del filtergraph y se unen con `;`.
   * Antes se unía todo con `,`, que solo es correcto dentro de una misma cadena: las ramas
   * con labels propios (fit-blur, overlays) funcionaban de milagro y no sobrevivían a
   * añadir más capas.
   */
  const chains: string[] = [];
  const { output } = composition;

  const fitMode = composition.videoFit?.mode ?? 'crop';
  const textOverlays = composition.textTracks.filter((t) => t.startTime < t.endTime);
  const brandOverlays = composition.overlays.filter((o) => o.startTime < o.endTime);
  const masks = (composition.masks ?? []).filter((m) => m.startTime < m.endTime);
  const images = (composition.images ?? []).filter((i) => i.startTime < i.endTime);

  if (fitMode === 'fit-blur') {
    chains.push(
      `[0:v]split=2[bg][fg]`,
      `[bg]scale=${output.width}:${output.height}:force_original_aspect_ratio=increase,crop=${output.width}:${output.height},boxblur=20:5,eq=brightness=-0.1[blurred]`,
      `[fg]scale=${output.width}:${output.height}:force_original_aspect_ratio=decrease[scaled]`,
      `[blurred][scaled]overlay=(W-w)/2:(H-h)/2,fps=${output.fps},format=yuv420p[composed]`,
    );
  } else if (fitMode === 'fit-background') {
    const bgColor = composition.videoFit?.backgroundColor ?? '#000000';
    chains.push(
      `color=c=${bgColor}:s=${output.width}x${output.height}:d=999[canvas]`,
      `[0:v]scale=${output.width}:${output.height}:force_original_aspect_ratio=decrease[scaled]`,
      `[canvas][scaled]overlay=(W-w)/2:(H-h)/2:shortest=1,fps=${output.fps},format=yuv420p[composed]`,
    );
  } else {
    // crop (por defecto): una sola cadena, con sus filtros separados por comas.
    chains.push(
      `[0:v]scale=${output.width}:${output.height}:force_original_aspect_ratio=increase,` +
      `crop=${output.width}:${output.height},` +
      `fps=${output.fps},` +
      `format=yuv420p[composed]`,
    );
  }

  let currentInputLabel = '[composed]';

  // Orden de composición: máscaras -> imágenes -> textos -> marca.
  // Las máscaras van primero para que tapen el material original, no lo que se añade.
  const maskResult = buildMaskFilters(masks, output.width, output.height, currentInputLabel);
  chains.push(...maskResult.chains);
  currentInputLabel = maskResult.outputLabel;

  const imageResult = buildImageFilters(
    images,
    output.width,
    output.height,
    currentInputLabel,
    1 + audioInputPaths.length,
  );
  chains.push(...imageResult.chains);
  currentInputLabel = imageResult.outputLabel;

  let overlayIndex = 0;

  for (const text of textOverlays) {
    const filters = buildTextOverlayFilters(text, output.width, output.height, currentInputLabel, overlayIndex);
    if (filters.length > 0) {
      chains.push(...filters);
      const lastFilter = filters[filters.length - 1];
      const outputMatch = lastFilter.match(/\[(\w+)\]\s*$/);
      if (outputMatch) {
        currentInputLabel = `[${outputMatch[1]}]`;
      }
      overlayIndex++;
    }
  }

  for (const brand of brandOverlays) {
    const filters = buildBrandOverlayFilters(brand, output.width, output.height, currentInputLabel, overlayIndex);
    if (filters.length > 0) {
      chains.push(...filters);
      const lastFilter = filters[filters.length - 1];
      const outputMatch = lastFilter.match(/\[(\w+)\]\s*$/);
      if (outputMatch) {
        currentInputLabel = `[${outputMatch[1]}]`;
      }
      overlayIndex++;
    }
  }

  chains.push(`${currentInputLabel}null[vout]`);

  const hasAudioTracks = composition.audioTracks.length > 0;
  const hasOriginalAudio = composition.keepOriginalAudio;
  const hasAudio = hasAudioTracks || hasOriginalAudio;

  const allChains = hasAudio ? [...chains, ...buildAudioFilters(composition)] : chains;
  args.push('-filter_complex', allChains.join(';'));
  args.push('-map', '[vout]');
  if (hasAudio) {
    args.push('-map', '[aout]');
  }

  args.push(
    '-c:v', 'libx264',
    '-preset', output.preset ?? 'fast',
    '-crf', String(output.crf ?? 23),
    '-pix_fmt', 'yuv420p',
    '-r', String(output.fps),
  );

  if (hasAudio) {
    args.push(
      '-c:a', 'aac',
      '-b:a', output.audioBitrate ?? '192k',
      '-ar', String(output.audioSampleRate ?? 48000),
      '-ac', String(output.audioChannels ?? 2),
    );
  }

  args.push('-movflags', output.movflags || '+faststart');
  args.push(outputPath);

  return { args };
}

function buildAudioFilters(
  composition: VideoComposition,
): string[] {
  const filters: string[] = [];
  const inputLabels: string[] = [];

  if (composition.keepOriginalAudio) {
    filters.push(
      `[0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,` +
      `volume=${composition.originalAudioVolume}[aorig]`,
    );
    inputLabels.push('[aorig]');
  }

  composition.audioTracks.forEach((track, i) => {
    const inputIdx = i + 1;
    const label = `atrack${i}`;

    const parts: string[] = [
      `[${inputIdx}:a]`,
      'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,',
    ];

    if (track.volume !== 1.0) {
      parts.push(`volume=${track.volume},`);
    }

    if (track.startTime > 0) {
      parts.push(`adelay=${Math.round(track.startTime * 1000)}|${Math.round(track.startTime * 1000)},`);
    }

    if (track.fadeIn && track.fadeIn > 0) {
      parts.push(`afade=t=in:st=0:d=${track.fadeIn},`);
    }

    const lastComma = parts.length - 1;
    if (parts[lastComma]?.endsWith(',')) {
      parts[lastComma] = parts[lastComma].slice(0, -1);
    }

    parts.push(`[${label}]`);
    filters.push(parts.join(''));
    inputLabels.push(`[${label}]`);
  });

  if (inputLabels.length > 1) {
    filters.push(
      `${inputLabels.join('')}amix=inputs=${inputLabels.length}:duration=longest:normalize=0[aout]`,
    );
  } else if (inputLabels.length === 1) {
    filters.push(`${inputLabels[0]}acopy[aout]`);
  }

  return filters;
}

function buildTextOverlayFilters(
  text: TextOverlay,
  width: number,
  height: number,
  inputLabel: string,
  overlayIndex: number,
): string[] {
  const filters: string[] = [];
  const basePos = computePosition(text.position, text.customPosition, width, height, text.style.fontSize);
  const escaped = escapeDrawText(text.text);
  const animation = text.animationIn ?? 'none';
  const fadeOut = text.animationOut ?? 'none';
  const fadeInDuration = animation !== 'none' ? 0.4 : 0;
  const fadeOutDuration = fadeOut !== 'none' ? 0.4 : 0;

  if (text.style.glow && animation === 'none' && fadeOut === 'none') {
    return buildGlowTextFilters(text.text, text.style, basePos, width, height, inputLabel, `t${overlayIndex}`, text.startTime, text.endTime);
  }

  if (animation === 'none' && fadeOut === 'none') {
    filters.push(`${inputLabel}drawtext=text='${escaped}':${fontClause(text.style.fontFamily, text.style.fontWeight, text.style.italic)}:fontsize=${text.style.fontSize}:fontcolor=${sanitizeColorForFfmpeg(text.style.color)}@${text.style.opacity}:x=${basePos.x}:y=${basePos.y}${text.style.textShadow ? `:shadowcolor=${sanitizeColorForFfmpeg(text.style.shadowColor ?? 'black@0.8')}:shadowx=2:shadowy=2` : ''}:enable='between(t\\,${text.startTime}\\,${text.endTime})'[t${overlayIndex}]`);
  } else {
    const phases = buildTextPhases(text.startTime, text.endTime, text.style.opacity, fadeInDuration, fadeOutDuration);
    let currentLabel = inputLabel;
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      // basePos.y may be a plain number ("960", preset positions) or an FFmpeg
      // expression ("960-text_h/2", custom positions). Append the slide-up offset as
      // an arithmetic term instead of coercing with Number(), which would produce NaN
      // for expression strings.
      const pos = animation === 'slide-up' && phase.opacity < text.style.opacity
        ? { x: basePos.x, y: `${basePos.y}+${Math.round((1 - phase.opacity / text.style.opacity) * 30)}` }
        : basePos;
      const isLast = i === phases.length - 1;
      const outLabel = isLast ? `[t${overlayIndex}]` : `[tp${overlayIndex}_${i}]`;
      filters.push(`${currentLabel}drawtext=text='${escaped}':${fontClause(text.style.fontFamily, text.style.fontWeight, text.style.italic)}:fontsize=${text.style.fontSize}:fontcolor=${sanitizeColorForFfmpeg(text.style.color)}@${phase.opacity}:x=${pos.x}:y=${pos.y}${text.style.textShadow ? `:shadowcolor=${sanitizeColorForFfmpeg(text.style.shadowColor ?? 'black@0.8')}:shadowx=2:shadowy=2` : ''}:enable='between(t\\,${phase.start}\\,${phase.end})'${outLabel}`);
      currentLabel = outLabel;
    }
  }

  return filters;
}

/**
 * Renders text with a soft blurred glow halo behind a crisp core — the warm
 * amber-on-serif look used for devotional quote cards. Drawtext alone can't blur
 * (its `shadowx/shadowy` are solid offsets, not gaussian blur), so this composes it
 * from primitives instead:
 *   1. draw the text (opaque, `shadowColor`) onto a fully transparent canvas
 *   2. gblur that layer — only the text silhouette blurs, not the video underneath
 *   3. overlay the blurred glow onto the video
 *   4. draw the crisp core text on top, in `color`, for definition
 * Only used for the simple (non-animated) case — see the `glow` guard at the call site.
 */
function buildGlowTextFilters(
  text: string,
  style: TextStyleConfig,
  pos: { x: string; y: string },
  width: number,
  height: number,
  inputLabel: string,
  outputLabel: string,
  startTime: number,
  endTime: number,
): string[] {
  const escaped = escapeDrawText(text);
  const clause = fontClause(style.fontFamily, style.fontWeight, style.italic);
  const glowColor = sanitizeColorForFfmpeg(style.shadowColor ?? style.color);
  const blurSigma = style.shadowBlur && style.shadowBlur > 0 ? style.shadowBlur : 8;
  const enable = `enable='between(t\\,${startTime}\\,${endTime})'`;

  const canvasLabel = `${outputLabel}_glowcanvas`;
  const glowTextLabel = `${outputLabel}_glowtext`;
  const glowBlurLabel = `${outputLabel}_glowblur`;
  const stepLabel = `${outputLabel}_step`;

  return [
    `color=c=black@0.0:s=${width}x${height}:d=999,format=rgba[${canvasLabel}]`,
    `[${canvasLabel}]drawtext=text='${escaped}':${clause}:fontsize=${style.fontSize}:fontcolor=${glowColor}@1.0:x=${pos.x}:y=${pos.y}:${enable}[${glowTextLabel}]`,
    `[${glowTextLabel}]gblur=sigma=${blurSigma}[${glowBlurLabel}]`,
    // shortest=1: the glow canvas is a d=999 generator (no natural end, like the
    // existing fit-background canvas above) — without this the whole graph runs to
    // the generator's length instead of the real video's, duplicating its last frame.
    `${inputLabel}[${glowBlurLabel}]overlay=0:0:shortest=1[${stepLabel}]`,
    `[${stepLabel}]drawtext=text='${escaped}':${clause}:fontsize=${style.fontSize}:fontcolor=${sanitizeColorForFfmpeg(style.color)}@${style.opacity}:x=${pos.x}:y=${pos.y}:shadowcolor=black@0.6:shadowx=2:shadowy=2:${enable}[${outputLabel}]`,
  ];
}

function buildTextPhases(
  start: number,
  end: number,
  baseOpacity: number,
  fadeInSec: number,
  fadeOutSec: number,
): Array<{ start: number; end: number; opacity: number }> {
  if (fadeInSec === 0 && fadeOutSec === 0) {
    return [{ start, end, opacity: baseOpacity }];
  }

  const phases: Array<{ start: number; end: number; opacity: number }> = [];
  const fadeInEnd = start + fadeInSec;
  const fadeOutStart = end - fadeOutSec;

  if (fadeInSec > 0) {
    const steps = 4;
    const stepDuration = fadeInSec / steps;
    for (let i = 0; i < steps; i++) {
      const t = (i + 1) / steps;
      phases.push({
        start: start + i * stepDuration,
        end: start + (i + 1) * stepDuration,
        opacity: Math.round(baseOpacity * t * 100) / 100,
      });
    }
  }

  const stableStart = fadeInSec > 0 ? fadeInEnd : start;
  const stableEnd = fadeOutSec > 0 ? fadeOutStart : end;
  if (stableStart < stableEnd) {
    phases.push({ start: stableStart, end: stableEnd, opacity: baseOpacity });
  }

  if (fadeOutSec > 0) {
    const steps = 4;
    const stepDuration = fadeOutSec / steps;
    for (let i = 0; i < steps; i++) {
      const t = 1 - (i + 1) / steps;
      phases.push({
        start: fadeOutStart + i * stepDuration,
        end: fadeOutStart + (i + 1) * stepDuration,
        opacity: Math.round(baseOpacity * t * 100) / 100,
      });
    }
  }

  return phases;
}

function buildBrandOverlayFilters(
  brand: BrandOverlay,
  width: number,
  height: number,
  inputLabel: string,
  overlayIndex: number,
): string[] {
  const filters: string[] = [];
  const pos = computePosition(brand.position, brand.customPosition, width, height, brand.style.fontSize);

  const escaped = escapeDrawText(brand.text);

  const fadeInDuration = brand.animationIn === 'fade-in' ? 0.5 : 0;
  const fadeOutDuration = brand.animationOut === 'fade-out' ? 0.5 : 0;

  if (brand.style.glow && fadeInDuration === 0 && fadeOutDuration === 0) {
    return buildGlowTextFilters(brand.text, brand.style, pos, width, height, inputLabel, `b${overlayIndex}`, brand.startTime, brand.endTime);
  }

  const phases = buildBrandPhases(brand.startTime, brand.endTime, brand.opacity, fadeInDuration, fadeOutDuration);

  let currentLabel = inputLabel;
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const isLast = i === phases.length - 1;
    const outLabel = isLast ? `[b${overlayIndex}]` : `[bp${overlayIndex}_${i}]`;
    const drawtext = [
      `${currentLabel}drawtext=text='${escaped}'`,
      fontClause(brand.style.fontFamily, brand.style.fontWeight, brand.style.italic),
      `fontsize=${brand.style.fontSize}`,
      `fontcolor=${sanitizeColorForFfmpeg(brand.style.color)}@${phase.opacity}`,
      `x=${pos.x}`,
      `y=${pos.y}`,
    ];

    if (brand.style.textShadow) {
      drawtext.push(`shadowcolor=${sanitizeColorForFfmpeg(brand.style.shadowColor ?? 'black@0.75')}`);
      drawtext.push(`shadowx=0`);
      drawtext.push(`shadowy=2`);
    }

    drawtext.push(`enable='between(t\\,${phase.start}\\,${phase.end})'`);
    drawtext.push(outLabel);

    filters.push(drawtext.join(':'));
    currentLabel = outLabel;
  }

  return filters;
}

interface BrandPhase {
  start: number;
  end: number;
  opacity: number;
}

function buildBrandPhases(
  start: number,
  end: number,
  baseOpacity: number,
  fadeInSec: number,
  fadeOutSec: number,
): BrandPhase[] {
  if (fadeInSec === 0 && fadeOutSec === 0) {
    return [{ start, end, opacity: baseOpacity }];
  }

  const phases: BrandPhase[] = [];
  const fadeInEnd = start + fadeInSec;
  const fadeOutStart = end - fadeOutSec;

  if (fadeInSec > 0) {
    // Split fade-in into 5 steps
    const steps = 5;
    const stepDuration = fadeInSec / steps;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const opacity = baseOpacity * (t + 1 / steps);
      phases.push({
        start: start + i * stepDuration,
        end: start + (i + 1) * stepDuration,
        opacity: Math.round(opacity * 100) / 100,
      });
    }
  }

  // Stable phase
  const stableStart = fadeInSec > 0 ? fadeInEnd : start;
  const stableEnd = fadeOutSec > 0 ? fadeOutStart : end;
  if (stableStart < stableEnd) {
    phases.push({ start: stableStart, end: stableEnd, opacity: baseOpacity });
  }

  if (fadeOutSec > 0) {
    // Split fade-out into 5 steps
    const steps = 5;
    const stepDuration = fadeOutSec / steps;
    for (let i = 0; i < steps; i++) {
      const t = 1 - (i + 1) / steps;
      const opacity = baseOpacity * t;
      phases.push({
        start: fadeOutStart + i * stepDuration,
        end: fadeOutStart + (i + 1) * stepDuration,
        opacity: Math.round(opacity * 100) / 100,
      });
    }
  }

  return phases;
}

function computePosition(
  position: string,
  customPosition: { x: number; y: number } | undefined,
  width: number,
  height: number,
  fontSize: number,
): { x: string; y: string } {
  if (position === 'custom' && customPosition) {
    // Custom position uses normalized coordinates (0..1) where x/y represent center.
    // Convert to FFmpeg drawtext coordinates: center the text at the normalized point.
    return {
      x: `${customPosition.x * width}-text_w/2`,
      y: `${customPosition.y * height}-text_h/2`,
    };
  }

  const topSafe = Math.round(height * 0.10);
  const bottomSafe = Math.round(height * 0.80);
  const leftSafe = Math.round(width * 0.05);

  switch (position) {
    case 'bottom-center':
      return {
        x: `(w-text_w)/2`,
        y: String(bottomSafe - fontSize),
      };
    case 'bottom-right':
      return {
        x: `w-text_w-${leftSafe}`,
        y: String(bottomSafe - fontSize),
      };
    case 'bottom-left':
      return { x: String(leftSafe), y: String(bottomSafe - fontSize) };
    case 'top-center':
      return { x: `(w-text_w)/2`, y: String(topSafe + fontSize) };
    case 'top-left':
      return { x: String(leftSafe), y: String(topSafe + fontSize) };
    case 'top-right':
      return { x: `w-text_w-${leftSafe}`, y: String(topSafe + fontSize) };
    case 'upper-center':
      return { x: `(w-text_w)/2`, y: String(Math.round(height * 0.30)) };
    case 'lower-center':
      return { x: `(w-text_w)/2`, y: String(Math.round(height * 0.65)) };
    case 'center':
      return {
        x: `(w-text_w)/2`,
        y: `(h-text_h)/2`,
      };
    default:
      return {
        x: `(w-text_w)/2`,
        y: String(bottomSafe - fontSize),
      };
  }
}

export function buildProbeCommand(filePath: string): FfmpegCommand {
  return {
    args: [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath,
    ],
  };
}


