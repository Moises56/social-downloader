import { Injectable } from '@nestjs/common';
import type { TextPreset } from '../domain/video-composition';

@Injectable()
export class TextPresetService {
  private readonly presets: TextPreset[] = [
    {
      id: 'hero-editorial',
      name: 'Hero Editorial',
      type: 'message',
      defaultStyle: {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 56,
        fontWeight: 'bold',
        color: '#f6efe2',
        opacity: 1,
        textShadow: true,
        shadowColor: 'rgba(0, 0, 0, 0.8)',
        letterSpacing: 0.02,
      },
      defaultPosition: 'center',
      description: 'Mensaje principal, alto contraste, serif elegante',
    },
    {
      id: 'scripture',
      name: 'Scripture',
      type: 'verse',
      defaultStyle: {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 44,
        fontWeight: 'normal',
        italic: true,
        color: '#f6efe2',
        opacity: 1,
        textShadow: true,
        shadowColor: 'rgba(0, 0, 0, 0.7)',
        letterSpacing: 0.01,
      },
      defaultPosition: 'center',
      description: 'Versículos, serif editorial, tamaño medio, elegante',
    },
    {
      id: 'reflection',
      name: 'Reflection',
      type: 'reflection',
      defaultStyle: {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 40,
        fontWeight: 'normal',
        color: '#f6efe2',
        opacity: 0.95,
        textShadow: true,
        shadowColor: 'rgba(0, 0, 0, 0.6)',
        letterSpacing: 0.01,
      },
      defaultPosition: 'center',
      description: 'Reflexiones, sobrio, fácil de leer',
    },
    {
      id: 'cta',
      name: 'CTA',
      type: 'cta',
      defaultStyle: {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 36,
        fontWeight: 'bold',
        color: '#f6efe2',
        opacity: 0.9,
        textShadow: true,
        shadowColor: 'rgba(0, 0, 0, 0.7)',
        letterSpacing: 0.03,
      },
      defaultPosition: 'lower-center',
      description: 'Compártelo, etiqueta, interacción',
    },
    {
      id: 'signature',
      name: 'Signature',
      type: 'message',
      defaultStyle: {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 32,
        fontWeight: 'normal',
        italic: true,
        color: '#f6efe2',
        opacity: 0.62,
        textShadow: true,
        shadowColor: 'rgba(0, 0, 0, 0.75)',
        letterSpacing: 0.06,
      },
      defaultPosition: 'bottom-center',
      description: '@Ilusiones&Colores, firma discreta',
    },
  ];

  listPresets(): TextPreset[] {
    return [...this.presets];
  }

  getPreset(id: string): TextPreset | undefined {
    return this.presets.find((p) => p.id === id);
  }
}
