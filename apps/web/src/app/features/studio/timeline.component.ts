import { Component, computed, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { TextOverlay, BrandOverlay, AudioTrack } from '@social-downloader/contracts';

interface TimelineTrack {
  id: string;
  label: string;
  type: 'video' | 'text' | 'brand' | 'music' | 'sfx';
  segments: TimelineSegment[];
  color: string;
}

interface TimelineSegment {
  id: string;
  label: string;
  start: number;
  end: number;
  color: string;
}

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="timeline-container">
      <div class="timeline-header">
        <span class="timeline-title">Timeline</span>
        <span class="timeline-duration">{{ formatTime(duration()) }}</span>
      </div>

      <div class="timeline-body">
        @for (track of tracks(); track track.id) {
          <div class="timeline-row">
            <div class="track-label" [style.borderLeftColor]="track.color">
              {{ track.label }}
            </div>
            <div class="track-lanes" #trackLanes (click)="onTrackClick($event, trackLanes)">
              <div class="track-bg"></div>
              @for (seg of track.segments; track seg.id) {
                <div
                  class="track-segment"
                  [class.selected]="selectedSegmentId() === seg.id"
                  [style.left]="toPercent(seg.start)"
                  [style.width]="toPercent(seg.end - seg.start)"
                  [style.background]="seg.color"
                  (click)="$event.stopPropagation(); selectSegment(seg.id)">
                  <span class="seg-label">{{ seg.label }}</span>
                </div>
              }
            </div>
          </div>
        }

        <div class="playhead-row">
          <div class="track-label playhead-label"></div>
          <div class="track-lanes playhead-lanes">
            <div class="playhead" [style.left]="toPercent(currentTime())">
              <div class="playhead-handle"></div>
              <div class="playhead-line"></div>
            </div>
          </div>
        </div>
      </div>

      @if (selectedSegmentId(); as segId) {
        <div class="segment-editor">
          <div class="editor-row">
            <label>Inicio</label>
            <input type="number" [value]="selectedSegmentStart()" (change)="onStartChange($event)" step="0.1" min="0" class="time-input">
            <span class="time-suffix">s</span>
          </div>
          <div class="editor-row">
            <label>Fin</label>
            <input type="number" [value]="selectedSegmentEnd()" (change)="onEndChange($event)" step="0.1" min="0" class="time-input">
            <span class="time-suffix">s</span>
          </div>
          <button class="deselect-btn" (click)="selectSegment(null)">Cerrar</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .timeline-container {
      background: var(--color-surface);
      border: 1px solid var(--color-border-subtle);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }
    .timeline-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--color-border-subtle);
    }
    .timeline-title {
      font-size: 11px; font-weight: 700; color: var(--color-text-muted);
      text-transform: uppercase; letter-spacing: 0.1em;
    }
    .timeline-duration {
      font-size: 12px; color: var(--color-text-secondary);
      font-variant-numeric: tabular-nums;
    }
    .timeline-body { padding: 8px 0; }
    .timeline-row {
      display: flex; align-items: stretch; height: 32px;
    }
    .track-label {
      width: 80px; flex-shrink: 0;
      font-size: 10px; font-weight: 600; color: var(--color-text-muted);
      text-transform: uppercase; letter-spacing: 0.06em;
      display: flex; align-items: center; padding: 0 10px;
      border-left: 3px solid transparent;
    }
    .track-lanes {
      flex: 1; position: relative; cursor: pointer;
      border-bottom: 1px solid var(--color-border-subtle);
    }
    .track-bg {
      position: absolute; inset: 0;
      background: var(--color-bg);
      border-radius: 4px;
    }
    .track-segment {
      position: absolute; top: 4px; bottom: 4px;
      border-radius: 4px; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.15s ease;
      opacity: 0.85;
      min-width: 4px;
    }
    .track-segment:hover { opacity: 1; transform: scaleY(1.1); }
    .track-segment.selected {
      opacity: 1; outline: 2px solid var(--color-accent);
      outline-offset: 1px; transform: scaleY(1.1);
    }
    .seg-label {
      font-size: 9px; font-weight: 600; color: #fff;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      padding: 0 4px; text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    }
    .playhead-row { display: flex; align-items: stretch; height: 20px; }
    .playhead-label { border-left-color: transparent; }
    .playhead-lanes { position: relative; }
    .playhead {
      position: absolute; top: 0; bottom: 0; width: 2px;
      transform: translateX(-1px); z-index: 10;
    }
    .playhead-handle {
      width: 12px; height: 12px; background: var(--color-accent);
      border-radius: 50%; position: absolute; top: -2px; left: -5px;
      cursor: grab; box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    }
    .playhead-line {
      width: 2px; height: 100%;
      background: var(--color-accent);
    }
    .segment-editor {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 16px;
      background: var(--color-bg);
      border-top: 1px solid var(--color-border-subtle);
    }
    .editor-row {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: var(--color-text-secondary);
    }
    .editor-row label { font-weight: 500; min-width: 30px; }
    .time-input {
      width: 60px; padding: 4px 8px;
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: 4px; color: var(--color-text-primary);
      font-size: 12px; font-variant-numeric: tabular-nums;
    }
    .time-input:focus { border-color: var(--color-accent); outline: none; }
    .time-suffix { font-size: 11px; color: var(--color-text-muted); }
    .deselect-btn {
      margin-left: auto; padding: 4px 10px;
      background: none; border: 1px solid var(--color-border);
      border-radius: 4px; color: var(--color-text-secondary);
      font-size: 11px; cursor: pointer;
    }
    .deselect-btn:hover { border-color: var(--color-text-muted); }
  `],
})
export class TimelineComponent {
  readonly duration = input<number>(0);
  readonly currentTime = input<number>(0);
  readonly textOverlays = input<TextOverlay[]>([]);
  readonly brandOverlays = input<BrandOverlay[]>([]);
  readonly audioTracks = input<AudioTrack[]>([]);

  readonly seekTo = output<number>();
  readonly segmentUpdate = output<{ id: string; start: number; end: number }>();

  readonly selectedSegmentId = signal<string | null>(null);

  readonly tracks = computed<TimelineTrack[]>(() => {
    const duration = this.duration() || 1;
    const textOverlays = this.textOverlays();
    const brandOverlays = this.brandOverlays();
    const audioTracks = this.audioTracks();

    const result: TimelineTrack[] = [];

    // Video track (always full duration)
    result.push({
      id: 'video', label: 'Video', type: 'video',
      segments: [{ id: 'video-main', label: 'Source', start: 0, end: duration, color: 'rgba(59, 130, 246, 0.6)' }],
      color: '#3b82f6',
    });

    // Text tracks
    if (textOverlays.length) {
      result.push({
        id: 'text', label: 'Text', type: 'text',
        segments: textOverlays.map((t) => ({
          id: t.id, label: t.text.slice(0, 20),
          start: t.startTime, end: t.endTime,
          color: 'rgba(34, 197, 94, 0.65)',
        })),
        color: '#22c55e',
      });
    }

    // Brand track
    if (brandOverlays.length) {
      result.push({
        id: 'brand', label: 'Brand', type: 'brand',
        segments: brandOverlays.map((b) => ({
          id: b.id, label: b.text,
          start: b.startTime, end: b.endTime,
          color: 'rgba(168, 85, 247, 0.6)',
        })),
        color: '#a855f7',
      });
    }

    // Music track
    const musicTracks = audioTracks.filter((a) => !a.id.startsWith('sfx'));
    if (musicTracks.length) {
      result.push({
        id: 'music', label: 'Music', type: 'music',
        segments: musicTracks.map((a) => ({
          id: a.id, label: a.fileName,
          start: a.startTime, end: duration,
          color: 'rgba(249, 115, 22, 0.55)',
        })),
        color: '#f97316',
      });
    }

    // SFX track
    const sfxTracks = audioTracks.filter((a) => a.id.startsWith('sfx'));
    if (sfxTracks.length) {
      result.push({
        id: 'sfx', label: 'SFX', type: 'sfx',
        segments: sfxTracks.map((a) => ({
          id: a.id, label: a.fileName,
          start: a.startTime, end: Math.min(a.startTime + 5, duration),
          color: 'rgba(236, 72, 153, 0.55)',
        })),
        color: '#ec4899',
      });
    }

    return result;
  });

  readonly selectedSegmentStart = computed(() => {
    const id = this.selectedSegmentId();
    if (!id) return 0;
    for (const track of this.tracks()) {
      const seg = track.segments.find((s) => s.id === id);
      if (seg) return seg.start;
    }
    return 0;
  });

  readonly selectedSegmentEnd = computed(() => {
    const id = this.selectedSegmentId();
    if (!id) return 0;
    for (const track of this.tracks()) {
      const seg = track.segments.find((s) => s.id === id);
      if (seg) return seg.end;
    }
    return 0;
  });

  toPercent(time: number): string {
    const duration = this.duration() || 1;
    return `${(time / duration) * 100}%`;
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  onTrackClick(event: MouseEvent, lanes: HTMLElement): void {
    const rect = lanes.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const time = Math.max(0, Math.min(this.duration(), ratio * this.duration()));
    this.seekTo.emit(time);
  }

  selectSegment(id: string | null): void {
    this.selectedSegmentId.set(id);
  }

  onStartChange(event: Event): void {
    const id = this.selectedSegmentId();
    if (!id) return;
    const value = Number((event.target as HTMLInputElement).value);
    this.segmentUpdate.emit({ id, start: value, end: this.selectedSegmentEnd() });
  }

  onEndChange(event: Event): void {
    const id = this.selectedSegmentId();
    if (!id) return;
    const value = Number((event.target as HTMLInputElement).value);
    this.segmentUpdate.emit({ id, start: this.selectedSegmentStart(), end: value });
  }
}
