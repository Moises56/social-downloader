import type { VideoComposition, TextOverlay, BrandOverlay } from '../../domain/video-composition';

export interface FfmpegCommand {
  args: string[];
}

export function buildRenderCommand(
  composition: VideoComposition,
  sourcePath: string,
  outputPath: string,
): FfmpegCommand {
  const args: string[] = [];

  args.push('-i', sourcePath);

  for (const track of composition.audioTracks) {
    args.push('-i', track.assetId);
  }

  const filters: string[] = [];
  const { output } = composition;

  filters.push(
    `scale=${output.width}:${output.height}:force_original_aspect_ratio=decrease`,
    `pad=${output.width}:${output.height}:(ow-iw)/2:(oh-ih)/2:color=black`,
    `fps=${output.fps}`,
    'format=yuv420p',
  );

  const textOverlays = composition.textTracks.filter(
    (t) => t.startTime < t.endTime,
  );
  const brandOverlays = composition.overlays.filter(
    (o) => o.startTime < o.endTime,
  );

  for (const text of textOverlays) {
    filters.push(...buildTextOverlayFilters(text, output.width, output.height));
  }

  for (const brand of brandOverlays) {
    filters.push(...buildBrandOverlayFilters(brand, output.width, output.height));
  }

  args.push('-filter_complex', filters.join(','));

  args.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-r', String(output.fps),
  );

  if (composition.audioTracks.length > 0 || composition.keepOriginalAudio) {
    args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2');
  } else {
    args.push('-an');
  }

  args.push('-movflags', '+faststart');
  args.push(outputPath);

  return { args };
}

function buildTextOverlayFilters(
  text: TextOverlay,
  width: number,
  height: number,
): string[] {
  const filters: string[] = [];
  const pos = computePosition(text.position, text.customPosition, width, height, text.style.fontSize);

  const escaped = text.text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:');

  const drawtext = [
    `drawtext=text='${escaped}'`,
    `fontfile=`,
    `fontsize=${text.style.fontSize}`,
    `fontcolor=${text.style.color}@${text.style.opacity}`,
    `x=${pos.x}`,
    `y=${pos.y}`,
  ];

  if (text.style.textShadow) {
    drawtext.push(`shadowcolor=${text.style.shadowColor ?? 'black@0.8'}`);
    drawtext.push(`shadowx=2`);
    drawtext.push(`shadowy=2`);
  }

  if (text.style.letterSpacing) {
    drawtext.push(`spacing=${text.style.letterSpacing}`);
  }

  const startFilter = `enable='between(t,${text.startTime},${text.endTime})'`;
  drawtext.push(startFilter);

  filters.push(drawtext.join(':'));

  return filters;
}

function buildBrandOverlayFilters(
  brand: BrandOverlay,
  width: number,
  height: number,
): string[] {
  const filters: string[] = [];
  const pos = computePosition(brand.position, undefined, width, height, brand.style.fontSize);

  const escaped = brand.text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:');

  const fadeInDuration = brand.animationIn === 'fade-in' ? 0.5 : 0;
  const fadeOutDuration = brand.animationOut === 'fade-out' ? 0.5 : 0;

  const alphaExpr = buildAlphaExpression(
    brand.startTime,
    brand.endTime,
    brand.opacity,
    fadeInDuration,
    fadeOutDuration,
  );

  const drawtext = [
    `drawtext=text='${escaped}'`,
    `fontfile=`,
    `fontsize=${brand.style.fontSize}`,
    `fontcolor=${brand.style.color}@${alphaExpr}`,
    `x=${pos.x}`,
    `y=${pos.y}`,
  ];

  if (brand.style.textShadow) {
    drawtext.push(`shadowcolor=${brand.style.shadowColor ?? 'black@0.75'}`);
    drawtext.push(`shadowx=0`);
    drawtext.push(`shadowy=2`);
  }

  if (brand.style.letterSpacing) {
    drawtext.push(`spacing=${Math.round(brand.style.letterSpacing * 100)}`);
  }

  const startFilter = `enable='between(t,${brand.startTime},${brand.endTime})'`;
  drawtext.push(startFilter);

  filters.push(drawtext.join(':'));

  return filters;
}

function computePosition(
  position: string,
  customPosition: { x: number; y: number } | undefined,
  width: number,
  height: number,
  fontSize: number,
): { x: string; y: string } {
  if (position === 'custom' && customPosition) {
    return { x: String(customPosition.x), y: String(customPosition.y) };
  }

  const margin = 40;
  const bottomSafe = height - 200;

  switch (position) {
    case 'bottom-center':
      return {
        x: `(w-text_w)/2`,
        y: String(bottomSafe - fontSize),
      };
    case 'bottom-right':
      return {
        x: `w-text_w-${margin}`,
        y: String(bottomSafe - fontSize),
      };
    case 'bottom-left':
      return { x: String(margin), y: String(bottomSafe - fontSize) };
    case 'top-center':
      return { x: `(w-text_w)/2`, y: String(margin + fontSize) };
    case 'top-left':
      return { x: String(margin), y: String(margin + fontSize) };
    case 'top-right':
      return { x: `w-text_w-${margin}`, y: String(margin + fontSize) };
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

function buildAlphaExpression(
  start: number,
  end: number,
  baseOpacity: number,
  fadeInSec: number,
  fadeOutSec: number,
): string {
  if (fadeInSec === 0 && fadeOutSec === 0) {
    return String(baseOpacity);
  }

  const fadeInEnd = start + fadeInSec;
  const fadeOutStart = end - fadeOutSec;
  const parts: string[] = [];

  if (fadeInSec > 0) {
    parts.push(`if(between(t,${start},${fadeInEnd}),${baseOpacity}*((t-${start})/${fadeInSec}),0)`);
  }

  if (fadeOutSec > 0) {
    if (fadeInSec > 0) {
      parts.push(`+if(between(t,${fadeInEnd},${fadeOutStart}),${baseOpacity},0)`);
      parts.push(`+if(between(t,${fadeOutStart},${end}),${baseOpacity}*(1-(t-${fadeOutStart})/${fadeOutSec}),0)`);
    } else {
      parts.push(`if(between(t,${start},${fadeOutStart}),${baseOpacity},0)`);
      parts.push(`+if(between(t,${fadeOutStart},${end}),${baseOpacity}*(1-(t-${fadeOutStart})/${fadeOutSec}),0)`);
    }
  } else if (fadeInSec > 0) {
    parts.push(`+if(between(t,${fadeInEnd},${end}),${baseOpacity},0)`);
  }

  return parts.join('');
}
