import type { VideoComposition, TextOverlay, BrandOverlay } from '../../domain/video-composition';

export interface FfmpegCommand {
  args: string[];
}

/**
 * Escape text for FFmpeg drawtext filter.
 * Since we use spawn() with shell: false, only FFmpeg filter escaping is needed.
 */
function escapeDrawText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "'\\\\''")
    .replace(/:/g, '\\:')
    .replace(/%/g, '%%')
    .replace(/\n/g, '\\n');
}

export function buildRenderCommand(
  composition: VideoComposition,
  sourcePath: string,
  outputPath: string,
  audioInputPaths: string[] = [],
): FfmpegCommand {
  const args: string[] = [];

  args.push('-i', sourcePath);

  for (const audioPath of audioInputPaths) {
    args.push('-i', audioPath);
  }

  const videoFilters: string[] = [];
  const { output } = composition;

  videoFilters.push(
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
    videoFilters.push(...buildTextOverlayFilters(text, output.width, output.height));
  }

  for (const brand of brandOverlays) {
    videoFilters.push(...buildBrandOverlayFilters(brand, output.width, output.height));
  }

  const hasAudioTracks = composition.audioTracks.length > 0;
  const hasOriginalAudio = composition.keepOriginalAudio;

  if (hasAudioTracks || hasOriginalAudio) {
    const audioFilters = buildAudioFilters(composition);
    const videoChain = `[0:v]${videoFilters.join(',')}[vout]`;
    const allFilters = [videoChain, ...audioFilters];
    args.push('-filter_complex', allFilters.join(';'));
    args.push('-map', '[vout]');
    args.push('-map', '[aout]');
  } else {
    const videoChain = `[0:v]${videoFilters.join(',')}[vout]`;
    args.push('-filter_complex', videoChain);
    args.push('-map', '[vout]');
  }

  args.push(
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-r', String(output.fps),
  );

  if (hasAudioTracks || hasOriginalAudio) {
    args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2');
  }

  args.push('-movflags', '+faststart');
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
): string[] {
  const filters: string[] = [];
  const pos = computePosition(text.position, text.customPosition, width, height, text.style.fontSize);

  const escaped = escapeDrawText(text.text);

  const drawtext = [
    `drawtext=text='${escaped}'`,
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

  const startFilter = `enable='between(t\\,${text.startTime}\\,${text.endTime})'`;
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

  const escaped = escapeDrawText(brand.text);

  const fadeInDuration = brand.animationIn === 'fade-in' ? 0.5 : 0;
  const fadeOutDuration = brand.animationOut === 'fade-out' ? 0.5 : 0;

  const phases = buildBrandPhases(brand.startTime, brand.endTime, brand.opacity, fadeInDuration, fadeOutDuration);

  for (const phase of phases) {
    const drawtext = [
      `drawtext=text='${escaped}'`,
      `fontsize=${brand.style.fontSize}`,
      `fontcolor=${brand.style.color}@${phase.opacity}`,
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

    drawtext.push(`enable='between(t\\,${phase.start}\\,${phase.end})'`);

    filters.push(drawtext.join(':'));
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


