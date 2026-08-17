import { Component, ElementRef, inject, input, OnDestroy, output, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { TextOverlay, BrandOverlay } from '@social-downloader/contracts';

@Component({
  selector: 'app-video-preview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="preview-wrapper">
      <div class="preview-viewport" #viewport>
        <video
          #videoEl
          [src]="src()"
          (timeupdate)="onTimeUpdate($event)"
          (loadedmetadata)="onMetadataLoaded($event)"
          (play)="playing.set(true)"
          (pause)="playing.set(false)"
          (ended)="playing.set(false)"
          class="preview-video"
          preload="metadata"
          playsinline>
        </video>

        <div class="overlays-layer">
          @for (overlay of visibleTextOverlays(); track overlay.id) {
            <div
              class="text-overlay"
              [class]="'pos-' + overlay.position"
              [style.fontFamily]="overlay.style.fontFamily"
              [style.fontSize.px]="scaleFontSize(overlay.style.fontSize)"
              [style.fontWeight]="overlay.style.fontWeight"
              [style.fontStyle]="overlay.style.italic ? 'italic' : 'normal'"
              [style.color]="overlay.style.color"
              [style.opacity]="overlay.style.opacity"
              [style.textShadow]="overlay.style.textShadow ? '2px 2px 8px ' + (overlay.style.shadowColor ?? 'rgba(0,0,0,0.8)') : 'none'"
              [style.letterSpacing.rem]="overlay.style.letterSpacing ?? 0"
              [style.maxWidth.%]="85"
              [style.textAlign]="'center'"
              [style.whiteSpace]="'pre-line'"
              [style.lineHeight]="1.3">
              {{ overlay.text }}
            </div>
          }

          @for (brand of visibleBrandOverlays(); track brand.id) {
            <div
              class="brand-overlay"
              [class]="'pos-' + brand.position"
              [style.fontFamily]="brand.style.fontFamily"
              [style.fontSize.px]="scaleFontSize(brand.style.fontSize)"
              [style.fontWeight]="brand.style.fontWeight"
              [style.fontStyle]="brand.style.italic ? 'italic' : 'normal'"
              [style.color]="brand.style.color"
              [style.opacity]="brand.style.opacity"
              [style.textShadow]="brand.style.textShadow ? '0 2px 8px ' + (brand.style.shadowColor ?? 'rgba(0,0,0,0.75)') : 'none'"
              [style.letterSpacing.rem]="brand.style.letterSpacing ?? 0"
              [style.whiteSpace]="'nowrap'">
              {{ brand.text }}
            </div>
          }

          @if (showSafeZones()) {
            <div class="safe-zone safe-zone-top"></div>
            <div class="safe-zone safe-zone-bottom"></div>
            <div class="safe-zone safe-zone-right"></div>
          }
        </div>
      </div>

      <div class="preview-controls">
        <button class="control-btn" (click)="togglePlay()">
          {{ playing() ? '&#9646;&#9646;' : '&#9654;' }}
        </button>
        <span class="time-display">{{ formatTime(currentTime()) }} / {{ formatTime(duration()) }}</span>
        <input
          type="range"
          class="seek-bar"
          [min]="0"
          [max]="duration()"
          [step]="0.1"
          [value]="currentTime()"
          (input)="onSeek($event)">
      </div>
    </div>
  `,
  styles: [`
    .preview-wrapper { display: flex; flex-direction: column; gap: 0; }
    .preview-viewport {
      position: relative; width: 100%; aspect-ratio: 9/16;
      background: #000; border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      overflow: hidden;
    }
    .preview-video { width: 100%; height: 100%; object-fit: contain; display: block; }
    .overlays-layer {
      position: absolute; inset: 0; pointer-events: none;
      display: flex; flex-direction: column; justify-content: center; align-items: center;
    }
    .text-overlay, .brand-overlay {
      position: absolute; padding: 0 24px; transition: opacity 0.15s ease;
    }
    .pos-top-center { top: 10%; left: 50%; transform: translateX(-50%); }
    .pos-top-left { top: 10%; left: 8%; }
    .pos-top-right { top: 10%; right: 8%; }
    .pos-center { top: 50%; left: 50%; transform: translate(-50%, -50%); }
    .pos-upper-center { top: 30%; left: 50%; transform: translateX(-50%); }
    .pos-lower-center { top: 65%; left: 50%; transform: translateX(-50%); }
    .pos-bottom-center { bottom: 12%; left: 50%; transform: translateX(-50%); }
    .pos-bottom-left { bottom: 12%; left: 8%; }
    .pos-bottom-right { bottom: 12%; right: 8%; }

    .safe-zone {
      position: absolute; left: 0; right: 0;
      border: 1px dashed rgba(255, 255, 0, 0.35);
    }
    .safe-zone-top { top: 10%; height: 0; }
    .safe-zone-bottom { bottom: 20%; height: 0; }
    .safe-zone-right { right: 5%; top: 10%; bottom: 20%; width: 0; border-left: 1px dashed rgba(255, 255, 0, 0.35); border-top: none; border-right: none; border-bottom: none; }

    .preview-controls {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px;
      background: var(--color-surface);
      border-radius: 0 0 var(--radius-lg) var(--radius-lg);
      border: 1px solid var(--color-border-subtle);
      border-top: none;
    }
    .control-btn {
      width: 36px; height: 36px; border-radius: 50%;
      background: var(--color-accent); color: #fff; border: none;
      font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: all var(--transition-fast); flex-shrink: 0;
    }
    .control-btn:hover { background: var(--color-accent-hover); transform: scale(1.05); }
    .time-display {
      font-size: 12px; color: var(--color-text-muted);
      font-variant-numeric: tabular-nums; white-space: nowrap;
    }
    .seek-bar { flex: 1; accent-color: var(--color-accent); height: 4px; }
  `],
})
export class VideoPreviewComponent implements OnDestroy {
  readonly src = input<string>('');
  readonly textOverlays = input<TextOverlay[]>([]);
  readonly brandOverlays = input<BrandOverlay[]>([]);
  readonly duration = input<number>(0);
  readonly showSafeZones = input<boolean>(false);

  readonly timeChange = output<number>();

  readonly videoEl = viewChild.required<ElementRef<HTMLVideoElement>>('videoEl');
  readonly viewport = viewChild.required<ElementRef<HTMLDivElement>>('viewport');

  readonly playing = signal(false);
  readonly currentTime = signal(0);

  private previewScale = 1;

  onTimeUpdate(event: Event): void {
    const video = event.target as HTMLVideoElement;
    this.currentTime.set(video.currentTime);
    this.timeChange.emit(video.currentTime);
  }

  onMetadataLoaded(event: Event): void {
    const video = event.target as HTMLVideoElement;
    this.updateScale();
  }

  onSeek(event: Event): void {
    const input = event.target as HTMLInputElement;
    const time = Number(input.value);
    this.videoEl().nativeElement.currentTime = time;
    this.currentTime.set(time);
  }

  togglePlay(): void {
    const video = this.videoEl().nativeElement;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }

  visibleTextOverlays(): TextOverlay[] {
    const t = this.currentTime();
    return this.textOverlays().filter((o) => t >= o.startTime && t <= o.endTime);
  }

  visibleBrandOverlays(): BrandOverlay[] {
    const t = this.currentTime();
    return this.brandOverlays().filter((o) => t >= o.startTime && t <= o.endTime);
  }

  scaleFontSize(fontSize: number): number {
    return Math.round(fontSize * this.previewScale);
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  private updateScale(): void {
    const el = this.viewport()?.nativeElement;
    if (!el) return;
    this.previewScale = el.clientWidth / 1080;
  }

  ngOnDestroy(): void {
    const video = this.videoEl()?.nativeElement;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  }
}
