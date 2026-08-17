import { describe, it, expect } from 'vitest';
import { BrandPresetService } from './brand-preset.service';

describe('BrandPresetService', () => {
  const service = new BrandPresetService();

  it('returns default presets', () => {
    const presets = service.listPresets();
    expect(presets.length).toBeGreaterThan(0);
    expect(presets[0].id).toBe('ilusiones-colores');
  });

  it('gets preset by id', () => {
    const preset = service.getPreset('ilusiones-colores');
    expect(preset).toBeDefined();
    expect(preset!.name).toBe('Ilusiones & Colores');
    expect(preset!.signature.text).toBe('@Ilusiones&Colores');
  });

  it('returns undefined for unknown preset', () => {
    expect(service.getPreset('unknown')).toBeUndefined();
  });

  it('creates ending overlay', () => {
    const overlays = service.createBrandOverlay('ilusiones-colores', 10, 'ending');
    expect(overlays.length).toBe(1);
    expect(overlays[0].startTime).toBeGreaterThan(7);
    expect(overlays[0].endTime).toBe(10);
    expect(overlays[0].text).toBe('@Ilusiones&Colores');
  });

  it('creates persistent overlay', () => {
    const overlays = service.createBrandOverlay('ilusiones-colores', 10, 'persistent');
    expect(overlays.length).toBe(1);
    expect(overlays[0].startTime).toBe(0.5);
    expect(overlays[0].endTime).toBe(9.5);
  });

  it('creates segmented overlays', () => {
    const segments = [
      { start: 1, end: 3 },
      { start: 5, end: 7 },
    ];
    const overlays = service.createBrandOverlay('ilusiones-colores', 10, 'segmented', segments);
    expect(overlays.length).toBe(2);
    expect(overlays[0].startTime).toBe(1);
    expect(overlays[0].endTime).toBe(3);
    expect(overlays[1].startTime).toBe(5);
    expect(overlays[1].endTime).toBe(7);
  });

  it('returns empty for unknown preset', () => {
    const overlays = service.createBrandOverlay('unknown', 10);
    expect(overlays).toEqual([]);
  });

  it('overrides the position with a custom normalized coordinate when provided', () => {
    const overlays = service.createBrandOverlay(
      'ilusiones-colores',
      10,
      'ending',
      undefined,
      { x: 0.9, y: 0.82 },
    );
    expect(overlays.length).toBe(1);
    expect(overlays[0].position).toBe('custom');
    expect(overlays[0].customPosition).toEqual({ x: 0.9, y: 0.82 });
  });

  it('keeps the preset default position when no custom position is given', () => {
    const overlays = service.createBrandOverlay('ilusiones-colores', 10, 'ending');
    expect(overlays[0].position).not.toBe('custom');
    expect(overlays[0].customPosition).toBeUndefined();
  });
});
