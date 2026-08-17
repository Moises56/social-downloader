import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  TextOverlay,
  TextStyleConfig,
  OverlayPosition,
  OverlayAnimation,
} from '../domain/video-composition';

export interface CreateTextOverlayInput {
  text: string;
  type: TextOverlay['type'];
  startTime: number;
  endTime: number;
  position?: OverlayPosition;
  customPosition?: { x: number; y: number };
  style?: Partial<TextStyleConfig>;
  animationIn?: OverlayAnimation;
  animationOut?: OverlayAnimation;
}

@Injectable()
export class TextOverlayService {
  createOverlay(input: CreateTextOverlayInput): TextOverlay {
    const style: TextStyleConfig = {
      fontFamily: 'Georgia, "Times New Roman", serif',
      fontSize: 56,
      fontWeight: 'bold',
      color: '#f6efe2',
      opacity: 1,
      textShadow: true,
      shadowColor: 'rgba(0, 0, 0, 0.8)',
      shadowBlur: 16,
      letterSpacing: 0.02,
      ...input.style,
    };

    return {
      id: randomUUID(),
      text: input.text,
      type: input.type,
      startTime: input.startTime,
      endTime: input.endTime,
      position: input.position ?? 'center',
      customPosition: input.customPosition,
      style,
      animationIn: input.animationIn ?? 'fade-in',
      animationOut: input.animationOut ?? 'fade-out',
    };
  }

  createVerseOverlay(
    text: string,
    reference: string,
    startTime: number,
    endTime: number,
  ): TextOverlay[] {
    return [
      this.createOverlay({
        text,
        type: 'verse',
        startTime,
        endTime: startTime + (endTime - startTime) * 0.7,
        position: 'center',
        style: { fontSize: 48, fontWeight: 'normal', italic: true },
      }),
      this.createOverlay({
        text: reference,
        type: 'quote',
        startTime: startTime + (endTime - startTime) * 0.5,
        endTime,
        position: 'bottom-center',
        style: { fontSize: 28, fontWeight: 'normal', italic: false, opacity: 0.8 },
      }),
    ];
  }

  createCtaOverlay(
    text: string,
    startTime: number,
    endTime: number,
  ): TextOverlay {
    return this.createOverlay({
      text,
      type: 'cta',
      startTime,
      endTime,
      position: 'bottom-center',
      style: {
        fontSize: 32,
        fontWeight: 'normal',
        italic: false,
        opacity: 0.9,
        letterSpacing: 0.04,
      },
    });
  }

  createMessageOverlay(
    text: string,
    startTime: number,
    endTime: number,
    position: OverlayPosition = 'center',
  ): TextOverlay {
    return this.createOverlay({
      text,
      type: 'message',
      startTime,
      endTime,
      position,
      style: { fontSize: 56, fontWeight: 'bold' },
    });
  }

  validateOverlay(overlay: TextOverlay, videoDuration: number): string[] {
    const errors: string[] = [];

    if (overlay.startTime < 0) {
      errors.push('startTime must be >= 0');
    }
    if (overlay.endTime <= overlay.startTime) {
      errors.push('endTime must be > startTime');
    }
    if (overlay.endTime > videoDuration) {
      errors.push('endTime exceeds video duration');
    }
    if (!overlay.text.trim()) {
      errors.push('text cannot be empty');
    }
    if (overlay.style.fontSize < 12 || overlay.style.fontSize > 200) {
      errors.push('fontSize must be between 12 and 200');
    }

    return errors;
  }
}
