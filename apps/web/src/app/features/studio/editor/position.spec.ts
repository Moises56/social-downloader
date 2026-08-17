import { describe, it, expect } from 'vitest';
import {
  clamp,
  clampPosition,
  pixelsToNormalized,
  normalizedToPixels,
  snapAxis,
  getSnapResult,
  computeSnapPoints,
  SNAP_THRESHOLD,
  SAFE_ZONES,
} from './position';

describe('editor/position', () => {
  describe('clamp', () => {
    it('keeps values within range untouched', () => {
      expect(clamp(0.5, 0, 1)).toBe(0.5);
    });

    it('clamps values below the minimum', () => {
      expect(clamp(-0.2, 0, 1)).toBe(0);
    });

    it('clamps values above the maximum', () => {
      expect(clamp(1.5, 0, 1)).toBe(1);
    });
  });

  describe('clampPosition', () => {
    it('keeps a center position untouched', () => {
      expect(clampPosition({ x: 0.5, y: 0.5 })).toEqual({ x: 0.5, y: 0.5 });
    });

    it('does not let the overlay center go fully off-canvas', () => {
      expect(clampPosition({ x: -0.5, y: 2 })).toEqual({ x: 0.05, y: 0.95 });
    });
  });

  describe('pixelsToNormalized / normalizedToPixels round-trip', () => {
    it('round-trips a coordinate through both conversions', () => {
      const viewport = { width: 706, height: 1255 };
      const original = { x: 0.9, y: 0.82 };
      const { px, py } = normalizedToPixels(original, viewport.width, viewport.height);
      const back = pixelsToNormalized(px, py, viewport.width, viewport.height);
      expect(back.x).toBeCloseTo(original.x, 5);
      expect(back.y).toBeCloseTo(original.y, 5);
    });

    it('clamps pixel positions outside the viewport to 0..1', () => {
      const result = pixelsToNormalized(-50, 2000, 706, 1255);
      expect(result.x).toBe(0);
      expect(result.y).toBe(1);
    });
  });

  describe('snapAxis', () => {
    it('snaps to a candidate within the threshold', () => {
      const result = snapAxis(0.5 + SNAP_THRESHOLD / 2, [0.5]);
      expect(result.snapped).toBe(true);
      expect(result.value).toBe(0.5);
    });

    it('does not snap outside the threshold', () => {
      const result = snapAxis(0.5 + SNAP_THRESHOLD * 3, [0.5]);
      expect(result.snapped).toBe(false);
      expect(result.value).toBe(0.5 + SNAP_THRESHOLD * 3);
    });

    it('snaps to safe-zone edges', () => {
      const result = snapAxis(SAFE_ZONES.left + 0.001, [SAFE_ZONES.left, SAFE_ZONES.right]);
      expect(result.snapped).toBe(true);
      expect(result.value).toBe(SAFE_ZONES.left);
    });
  });

  describe('getSnapResult', () => {
    it('snaps both axes independently against the same candidate list', () => {
      const result = getSnapResult({ x: 0.501, y: 0.9 }, [0.5]);
      expect(result.snappedX).toBe(true);
      expect(result.snappedY).toBe(false);
      expect(result.position.x).toBe(0.5);
      expect(result.position.y).toBe(0.9);
    });
  });

  describe('computeSnapPoints', () => {
    it('splits candidates per axis: vertical for X, horizontal for Y', () => {
      const points = computeSnapPoints();
      expect(points.vertical).toEqual([0.5, SAFE_ZONES.left, SAFE_ZONES.right]);
      expect(points.horizontal).toEqual([0.5, SAFE_ZONES.top, SAFE_ZONES.bottom]);
    });

    it('does not let a Y-axis safe zone value leak into the X-axis candidates', () => {
      const points = computeSnapPoints();
      expect(points.vertical).not.toContain(SAFE_ZONES.top);
      expect(points.vertical).not.toContain(SAFE_ZONES.bottom);
      expect(points.horizontal).not.toContain(SAFE_ZONES.left);
      expect(points.horizontal).not.toContain(SAFE_ZONES.right);
    });
  });
});
