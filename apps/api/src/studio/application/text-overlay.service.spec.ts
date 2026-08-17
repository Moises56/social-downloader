import { describe, it, expect } from 'vitest';
import { TextOverlayService } from './text-overlay.service';

describe('TextOverlayService', () => {
  const service = new TextOverlayService();

  it('creates a text overlay with defaults', () => {
    const overlay = service.createOverlay({
      text: 'Hello World',
      type: 'message',
      startTime: 0,
      endTime: 5,
    });

    expect(overlay.id).toBeDefined();
    expect(overlay.text).toBe('Hello World');
    expect(overlay.type).toBe('message');
    expect(overlay.position).toBe('center');
    expect(overlay.style.fontSize).toBe(56);
  });

  it('creates a verse overlay pair', () => {
    const overlays = service.createVerseOverlay('For God so loved...', 'Juan 3:16', 0, 10);
    expect(overlays.length).toBe(2);
    expect(overlays[0].type).toBe('verse');
    expect(overlays[1].type).toBe('quote');
    expect(overlays[0].text).toBe('For God so loved...');
    expect(overlays[1].text).toBe('Juan 3:16');
  });

  it('creates a CTA overlay', () => {
    const overlay = service.createCtaOverlay('Compártelo', 8, 10);
    expect(overlay.type).toBe('cta');
    expect(overlay.position).toBe('bottom-center');
    expect(overlay.text).toBe('Compártelo');
  });

  it('creates a message overlay', () => {
    const overlay = service.createMessageOverlay('Test message', 0, 5);
    expect(overlay.type).toBe('message');
    expect(overlay.text).toBe('Test message');
  });

  it('validates overlay correctly', () => {
    const valid = service.createOverlay({
      text: 'Valid',
      type: 'message',
      startTime: 0,
      endTime: 5,
    });
    expect(service.validateOverlay(valid, 10)).toEqual([]);
  });

  it('rejects negative startTime', () => {
    const overlay = service.createOverlay({
      text: 'Text',
      type: 'message',
      startTime: -1,
      endTime: 5,
    });
    const errors = service.validateOverlay(overlay, 10);
    expect(errors).toContain('startTime must be >= 0');
  });

  it('rejects endTime <= startTime', () => {
    const overlay = service.createOverlay({
      text: 'Text',
      type: 'message',
      startTime: 5,
      endTime: 5,
    });
    const errors = service.validateOverlay(overlay, 10);
    expect(errors).toContain('endTime must be > startTime');
  });

  it('rejects endTime beyond video duration', () => {
    const overlay = service.createOverlay({
      text: 'Text',
      type: 'message',
      startTime: 0,
      endTime: 15,
    });
    const errors = service.validateOverlay(overlay, 10);
    expect(errors).toContain('endTime exceeds video duration');
  });

  it('rejects empty text', () => {
    const overlay = service.createOverlay({
      text: '   ',
      type: 'message',
      startTime: 0,
      endTime: 5,
    });
    const errors = service.validateOverlay(overlay, 10);
    expect(errors).toContain('text cannot be empty');
  });

  it('rejects invalid fontSize', () => {
    const overlay = service.createOverlay({
      text: 'Text',
      type: 'message',
      startTime: 0,
      endTime: 5,
      style: { fontSize: 10 },
    });
    const errors = service.validateOverlay(overlay, 10);
    expect(errors).toContain('fontSize must be between 12 and 200');
  });
});
