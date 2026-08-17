import { describe, it, expect } from 'vitest';
import { AudioMixingService } from './audio-mixing.service';

describe('AudioMixingService', () => {
  const service = new AudioMixingService();

  it('creates an audio track with defaults', () => {
    const track = service.createTrack({
      assetId: 'asset-1',
      fileName: 'music.mp3',
    });

    expect(track.id).toBeDefined();
    expect(track.assetId).toBe('asset-1');
    expect(track.fileName).toBe('music.mp3');
    expect(track.startTime).toBe(0);
    expect(track.volume).toBe(1.0);
  });

  it('creates a track with custom settings', () => {
    const track = service.createTrack({
      assetId: 'asset-1',
      fileName: 'music.mp3',
      startTime: 2,
      volume: 0.5,
      fadeIn: 1,
      fadeOut: 2,
      loop: true,
    });

    expect(track.startTime).toBe(2);
    expect(track.volume).toBe(0.5);
    expect(track.fadeIn).toBe(1);
    expect(track.fadeOut).toBe(2);
    expect(track.loop).toBe(true);
  });

  it('adjusts original volume', () => {
    const tracks = [
      service.createTrack({ assetId: 'a', fileName: 'a.mp3', volume: 1.0 }),
      service.createTrack({ assetId: 'b', fileName: 'b.mp3', volume: 0.8 }),
    ];
    const adjusted = service.adjustOriginalVolume(tracks, 0.5);
    expect(adjusted[0].volume).toBe(0.5);
    expect(adjusted[1].volume).toBe(0.4);
  });

  it('validates track correctly', () => {
    const track = service.createTrack({
      assetId: 'a',
      fileName: 'a.mp3',
      startTime: 0,
      volume: 1.0,
    });
    expect(service.validateTrack(track, 10)).toEqual([]);
  });

  it('rejects negative startTime', () => {
    const track = service.createTrack({
      assetId: 'a',
      fileName: 'a.mp3',
      startTime: -1,
    });
    const errors = service.validateTrack(track, 10);
    expect(errors).toContain('startTime must be >= 0');
  });

  it('rejects volume > 2.0', () => {
    const track = service.createTrack({
      assetId: 'a',
      fileName: 'a.mp3',
      volume: 3.0,
    });
    const errors = service.validateTrack(track, 10);
    expect(errors).toContain('volume must be between 0 and 2.0');
  });

  it('rejects fadeIn > video duration', () => {
    const track = service.createTrack({
      assetId: 'a',
      fileName: 'a.mp3',
      fadeIn: 15,
    });
    const errors = service.validateTrack(track, 10);
    expect(errors).toContain('fadeIn exceeds video duration');
  });

  it('builds audio filter graph for original audio only', () => {
    const filters = service.buildAudioFilterGraph([], 10, true, 1.0);
    expect(filters.length).toBeGreaterThan(0);
    expect(filters.some((f) => f.includes('aorig'))).toBe(true);
  });

  it('builds audio filter graph for additional tracks', () => {
    const tracks = [
      service.createTrack({ assetId: 'a', fileName: 'a.mp3', volume: 0.6 }),
      service.createTrack({ assetId: 'b', fileName: 'b.mp3', volume: 0.4 }),
    ];
    const filters = service.buildAudioFilterGraph(tracks, 10, false, 1.0);
    expect(filters.some((f) => f.includes('amix'))).toBe(true);
  });
});
