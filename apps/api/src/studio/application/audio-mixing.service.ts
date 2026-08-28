import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AudioTrack } from '../domain/video-composition';

export interface CreateAudioTrackInput {
  assetId: string;
  fileName: string;
  startTime?: number;
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
  loop?: boolean;
}

@Injectable()
export class AudioMixingService {
  createTrack(input: CreateAudioTrackInput): AudioTrack {
    return {
      id: randomUUID(),
      assetId: input.assetId,
      fileName: input.fileName,
      startTime: input.startTime ?? 0,
      volume: input.volume ?? 1.0,
      fadeIn: input.fadeIn,
      fadeOut: input.fadeOut,
      loop: input.loop,
    };
  }

  adjustOriginalVolume(tracks: AudioTrack[], originalVolume: number): AudioTrack[] {
    return tracks.map((t) => ({
      ...t,
      volume: t.volume * originalVolume,
    }));
  }

  buildAudioFilterGraph(
    tracks: AudioTrack[],
    videoDuration: number,
    keepOriginalAudio: boolean,
    originalVolume: number,
  ): string[] {
    const filters: string[] = [];

    if (keepOriginalAudio) {
      filters.push(
        `[0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,` +
        `volume=${originalVolume}[aorig]`,
      );
    }

    tracks.forEach((track, i) => {
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

      if (track.fadeOut && track.fadeOut > 0) {
        const fadeOutStart = videoDuration - track.fadeOut;
        parts.push(`afade=t=out:st=${Math.max(0, fadeOutStart)}:d=${track.fadeOut},`);
      }

      const lastComma = parts.length - 1;
      if (parts[lastComma]?.endsWith(',')) {
        parts[lastComma] = parts[lastComma].slice(0, -1);
      }

      parts.push(`[${label}]`);
      filters.push(parts.join(''));
    });

    const inputLabels: string[] = [];
    if (keepOriginalAudio) {
      inputLabels.push('[aorig]');
    }
    tracks.forEach((_, i) => {
      inputLabels.push(`[atrack${i}]`);
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

  validateTrack(track: AudioTrack, videoDuration: number): string[] {
    const errors: string[] = [];

    if (track.startTime < 0) {
      errors.push('startTime must be >= 0');
    }
    if (track.volume < 0 || track.volume > 2.0) {
      errors.push('volume must be between 0 and 2.0');
    }
    if (track.fadeIn && track.fadeIn < 0) {
      errors.push('fadeIn must be >= 0');
    }
    if (track.fadeOut && track.fadeOut < 0) {
      errors.push('fadeOut must be >= 0');
    }
    if (track.fadeIn && track.fadeIn > videoDuration) {
      errors.push('fadeIn exceeds video duration');
    }
    if (track.fadeOut && track.fadeOut > videoDuration) {
      errors.push('fadeOut exceeds video duration');
    }

    return errors;
  }
}
