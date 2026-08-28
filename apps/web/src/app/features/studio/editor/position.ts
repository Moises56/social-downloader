/**
 * Coordinate helpers for overlay positioning.
 *
 * Coordinate model:
 * - x/y represent the CENTER of the overlay bounding box
 * - Range: 0..1 (normalized to canvas dimensions)
 * - x=0.5, y=0.5 = center of canvas
 * - x=0, y=0 = top-left corner
 * - x=1, y=1 = bottom-right corner
 *
 * Conversion to FFmpeg drawtext:
 *   renderX = x * W - text_w / 2
 *   renderY = y * H - text_h / 2
 */

export interface NormalizedPosition {
  x: number;
  y: number;
}

export const SNAP_THRESHOLD = 0.015;

/** Safe zone boundaries (9:16 aspect ratio) */
export const SAFE_ZONES = {
  top: 0.10,
  bottom: 0.80,
  left: 0.05,
  right: 0.95,
} as const;

/** Preset position to normalized coordinate mapping */
export const POSITION_PRESETS: Record<string, NormalizedPosition> = {
  'center':         { x: 0.50, y: 0.50 },
  'upper-center':   { x: 0.50, y: 0.30 },
  'lower-center':   { x: 0.50, y: 0.65 },
  'top-center':     { x: 0.50, y: 0.12 },
  'top-left':       { x: 0.10, y: 0.12 },
  'top-right':      { x: 0.90, y: 0.12 },
  'bottom-center':  { x: 0.50, y: 0.82 },
  'bottom-left':    { x: 0.10, y: 0.82 },
  'bottom-right':   { x: 0.90, y: 0.82 },
};

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Clamp a normalized position to keep the overlay partially visible.
 * Uses a margin to prevent the center from going fully off-canvas.
 */
export function clampPosition(pos: NormalizedPosition): NormalizedPosition {
  return {
    x: clamp(pos.x, 0.05, 0.95),
    y: clamp(pos.y, 0.05, 0.95),
  };
}

/**
 * Convert pixel coordinates (relative to viewport) to normalized coordinates.
 */
export function pixelsToNormalized(
  px: number,
  py: number,
  viewportWidth: number,
  viewportHeight: number,
): NormalizedPosition {
  return {
    x: clamp(px / viewportWidth, 0, 1),
    y: clamp(py / viewportHeight, 0, 1),
  };
}

/**
 * Convert normalized coordinates to pixel coordinates (relative to viewport).
 */
export function normalizedToPixels(
  pos: NormalizedPosition,
  viewportWidth: number,
  viewportHeight: number,
): { px: number; py: number } {
  return {
    px: pos.x * viewportWidth,
    py: pos.y * viewportHeight,
  };
}

/**
 * Convert normalized position to FFmpeg drawtext coordinates.
 * x/y represent center, so we offset by half text dimensions.
 */
export function normalizedToFFmpeg(
  pos: NormalizedPosition,
  outputWidth: number,
  outputHeight: number,
): { x: string; y: string } {
  return {
    x: `${pos.x * outputWidth}-text_w/2`,
    y: `${pos.y * outputHeight}-text_h/2`,
  };
}

/**
 * Snap a single normalized value to the nearest candidate within SNAP_THRESHOLD.
 * This is the single low-level primitive for snapping — reuse it instead of
 * re-implementing the threshold check elsewhere.
 */
export function snapAxis(value: number, candidates: number[]): { value: number; snapped: boolean } {
  for (const candidate of candidates) {
    if (Math.abs(value - candidate) < SNAP_THRESHOLD) {
      return { value: candidate, snapped: true };
    }
  }
  return { value, snapped: false };
}

/**
 * Find the nearest snap point for a position, checking both axes against the same
 * candidate list. Returns the snapped position and which axes snapped.
 *
 * For axis-specific candidates (e.g. left/right safe-zone edges should only ever
 * snap the X axis, top/bottom only the Y axis), call `snapAxis` directly per axis
 * with `computeSnapPoints()`'s `vertical`/`horizontal` arrays instead.
 */
export function getSnapResult(
  pos: NormalizedPosition,
  snapPoints: number[] = [0.5],
): { position: NormalizedPosition; snappedX: boolean; snappedY: boolean } {
  const x = snapAxis(pos.x, snapPoints);
  const y = snapAxis(pos.y, snapPoints);
  return { position: { x: x.value, y: y.value }, snappedX: x.snapped, snappedY: y.snapped };
}

/**
 * Compute snap candidates per axis, including safe zone edges.
 *
 * Named by the guide line they produce (matching the preview's guide rendering):
 * - `vertical`: candidate X values — snapping here draws a vertical guide line.
 * - `horizontal`: candidate Y values — snapping here draws a horizontal guide line.
 */
export function computeSnapPoints(): { horizontal: number[]; vertical: number[] } {
  return {
    vertical: [0.5, SAFE_ZONES.left, SAFE_ZONES.right],
    horizontal: [0.5, SAFE_ZONES.top, SAFE_ZONES.bottom],
  };
}
