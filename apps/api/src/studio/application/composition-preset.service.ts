import { Injectable } from '@nestjs/common';
import type { CompositionPreset } from '../domain/video-composition';

@Injectable()
export class CompositionPresetService {
  private readonly presets: CompositionPreset[] = [
    {
      id: 'devotional-classic',
      name: 'Devotional Classic',
      brandPresetId: 'ilusiones-colores',
      brandMode: 'ending',
      description: 'Hero → Scripture → CTA → Signature',
      slots: [
        { textPresetId: 'hero-editorial', label: 'Mensaje principal', position: 'center', relativeStart: 0, relativeEnd: 0.33 },
        { textPresetId: 'scripture', label: 'Versículo', position: 'center', relativeStart: 0.33, relativeEnd: 0.66 },
        { textPresetId: 'cta', label: 'CTA', position: 'lower-center', relativeStart: 0.66, relativeEnd: 0.85 },
        { textPresetId: 'signature', label: 'Firma', position: 'bottom-center', relativeStart: 0.83, relativeEnd: 1.0 },
      ],
    },
    {
      id: 'reflection',
      name: 'Reflection',
      brandPresetId: 'ilusiones-colores',
      brandMode: 'ending',
      description: 'Reflection → Supporting line → Signature',
      slots: [
        { textPresetId: 'reflection', label: 'Reflexión', position: 'center', relativeStart: 0, relativeEnd: 0.6 },
        { textPresetId: 'hero-editorial', label: 'Línea de apoyo', position: 'lower-center', relativeStart: 0.55, relativeEnd: 0.85 },
        { textPresetId: 'signature', label: 'Firma', position: 'bottom-center', relativeStart: 0.83, relativeEnd: 1.0 },
      ],
    },
    {
      id: 'minimal-quote',
      name: 'Minimal Quote',
      brandPresetId: 'ilusiones-colores',
      brandMode: 'ending',
      description: 'Quote → Signature',
      slots: [
        { textPresetId: 'hero-editorial', label: 'Cita', position: 'center', relativeStart: 0, relativeEnd: 0.8 },
        { textPresetId: 'signature', label: 'Firma', position: 'bottom-center', relativeStart: 0.78, relativeEnd: 1.0 },
      ],
    },
    {
      id: 'scripture-focus',
      name: 'Scripture Focus',
      brandPresetId: 'ilusiones-colores',
      brandMode: 'ending',
      description: 'Verse → Bible reference → Signature',
      slots: [
        { textPresetId: 'scripture', label: 'Versículo', position: 'center', relativeStart: 0, relativeEnd: 0.65 },
        { textPresetId: 'reflection', label: 'Referencia', position: 'lower-center', relativeStart: 0.6, relativeEnd: 0.85 },
        { textPresetId: 'signature', label: 'Firma', position: 'bottom-center', relativeStart: 0.83, relativeEnd: 1.0 },
      ],
    },
    {
      id: 'ilusiones-devotional',
      name: 'Ilusiones & Colores — Devotional',
      brandPresetId: 'ilusiones-colores',
      brandMode: 'ending',
      description: 'Flujo completo devocional con marca',
      slots: [
        { textPresetId: 'hero-editorial', label: 'Mensaje', position: 'center', relativeStart: 0, relativeEnd: 0.35, text: 'SU FE NO EMPEZÓ\nCON CERTEZA' },
        { textPresetId: 'scripture', label: 'Versículo', position: 'center', relativeStart: 0.35, relativeEnd: 0.65, text: 'A donde tú vayas, iré;\ntu pueblo será mi pueblo.' },
        { textPresetId: 'reflection', label: 'Referencia', position: 'lower-center', relativeStart: 0.62, relativeEnd: 0.82, text: 'Rut 1:16' },
        { textPresetId: 'cta', label: 'CTA', position: 'lower-center', relativeStart: 0.78, relativeEnd: 0.92, text: 'Compártelo con quien no te soltó' },
        { textPresetId: 'signature', label: 'Firma', position: 'bottom-center', relativeStart: 0.90, relativeEnd: 1.0 },
      ],
    },
    {
      id: 'ilusiones-persistent',
      name: 'Ilusiones & Colores — Persistent Brand',
      brandPresetId: 'ilusiones-colores',
      brandMode: 'persistent',
      description: 'Insignia persistente durante todo el video',
      slots: [
        { textPresetId: 'hero-editorial', label: 'Mensaje', position: 'center', relativeStart: 0, relativeEnd: 0.5 },
        { textPresetId: 'scripture', label: 'Versículo', position: 'center', relativeStart: 0.45, relativeEnd: 0.85 },
        { textPresetId: 'cta', label: 'CTA', position: 'lower-center', relativeStart: 0.80, relativeEnd: 0.95 },
      ],
    },
  ];

  listPresets(): CompositionPreset[] {
    return [...this.presets];
  }

  getPreset(id: string): CompositionPreset | undefined {
    return this.presets.find((p) => p.id === id);
  }

  generateOverlays(
    presetId: string,
    duration: number,
    textPresetGetter: (id: string) => { defaultStyle: Record<string, unknown>; defaultPosition: string; type: string } | undefined,
  ): { textTracks: Array<Record<string, unknown>>; brandPresetId?: string; brandMode?: string } {
    const preset = this.getPreset(presetId);
    if (!preset) return { textTracks: [] };

    const textTracks = preset.slots.map((slot) => {
      const textPreset = textPresetGetter(slot.textPresetId);
      return {
        id: `text-${slot.textPresetId}-${Date.now()}`,
        text: slot.text ?? slot.label,
        type: textPreset?.type ?? 'message',
        startTime: slot.relativeStart * duration,
        endTime: slot.relativeEnd * duration,
        position: slot.position,
        style: textPreset?.defaultStyle ?? {
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 48,
          color: '#f6efe2',
          opacity: 1,
        },
      };
    });

    return {
      textTracks,
      brandPresetId: preset.brandPresetId,
      brandMode: preset.brandMode,
    };
  }
}
