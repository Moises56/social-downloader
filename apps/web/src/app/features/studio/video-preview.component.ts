import { Component, ElementRef, inject, input, OnDestroy, output, signal, viewChild, afterNextRender, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { TextOverlay, BrandOverlay } from '@social-downloader/contracts';
import {
  NormalizedPosition,
  POSITION_PRESETS,
  clampPosition,
  normalizedToPixels,
  snapAxis,
  computeSnapPoints,
} from './editor/position';

interface DragState {
  overlayId: string;
  overlayType: 'text' | 'brand';
  startNormalized: NormalizedPosition;
  startPointerX: number;
  startPointerY: number;
}

@Component({
  selector: 'app-video-preview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="preview-wrapper">
      <div class="viewport-stage">
        <div class="preview-viewport" #viewport
          (pointerdown)="onViewportPointerDown($event)">
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
              [class.draggable]="true"
              [class.selected]="selectedOverlayId() === overlay.id"
              [class.dragging]="dragging() && dragging()!.overlayId === overlay.id"
              [style]="getOverlayStyle(overlay)"
              [attr.data-overlay-id]="overlay.id"
              (pointerdown)="onOverlayPointerDown($event, overlay.id, 'text')"
              (dblclick)="onOverlayDoubleClick($event, overlay.id)">
              <span class="overlay-text">{{ overlay.text }}</span>
              @if (selectedOverlayId() === overlay.id) {
                <div class="selection-border"></div>
              }
            </div>
          }

          @for (brand of visibleBrandOverlays(); track brand.id) {
            <div
              class="brand-overlay"
              [class.draggable]="true"
              [class.selected]="selectedOverlayId() === brand.id"
              [class.dragging]="dragging() && dragging()!.overlayId === brand.id"
              [style]="getBrandOverlayStyle(brand)"
              [attr.data-overlay-id]="brand.id"
              (pointerdown)="onOverlayPointerDown($event, brand.id, 'brand')"
              (dblclick)="onOverlayDoubleClick($event, brand.id)">
              <span class="overlay-text">{{ brand.text }}</span>
              @if (selectedOverlayId() === brand.id) {
                <div class="selection-border"></div>
              }
            </div>
          }

          @if (showSafeZones()) {
            <div class="safe-zone safe-zone-top"></div>
            <div class="safe-zone safe-zone-bottom"></div>
            <div class="safe-zone safe-zone-right"></div>
            <div class="safe-zone safe-zone-left"></div>
          }

          @if (dragging()) {
            @for (guide of activeGuides(); track guide) {
              <div class="snap-guide" [class.guide-h]="guide.axis === 'horizontal'" [class.guide-v]="guide.axis === 'vertical'" [style]="guide.style"></div>
            }
          }
        </div>
      </div>
      </div>

      <div class="preview-controls">
        <button class="control-btn" (click)="togglePlay(); $event.stopPropagation()">
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
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .preview-wrapper { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 0; }
    /* Centers the 9:16 canvas and lets it shrink to whichever dimension the
       surrounding panel actually constrains — on a wide desktop screen that's the
       available HEIGHT, not the width. Without this, "width: 100%; aspect-ratio: 9/16"
       computes a height far taller than the panel and gets clipped by its overflow,
       making the preview look cropped/cut off. */
    .viewport-stage {
      flex: 1; min-height: 0; min-width: 0;
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
    }
    .preview-viewport {
      position: relative; aspect-ratio: 9/16; height: 100%; max-width: 100%;
      background: #000; border-radius: var(--radius-lg);
      overflow: hidden; touch-action: none;
    }
    .preview-video { width: 100%; height: 100%; object-fit: contain; display: block; pointer-events: none; }
    .overlays-layer {
      position: absolute; inset: 0; pointer-events: none;
    }

    .text-overlay, .brand-overlay {
      position: absolute; padding: 4px 8px;
      transition: opacity 0.15s ease;
      pointer-events: auto;
      cursor: grab;
      user-select: none;
      max-width: 85%;
      text-align: center;
      white-space: pre-line;
      line-height: 1.3;
    }
    .text-overlay.dragging, .brand-overlay.dragging {
      cursor: grabbing;
      z-index: 100;
    }
    .text-overlay.selected, .brand-overlay.selected {
      z-index: 50;
    }

    .selection-border {
      position: absolute; inset: -3px;
      border: 1.5px solid var(--color-accent, #6366f1);
      border-radius: 4px;
      pointer-events: none;
      opacity: 0.8;
    }

    .overlay-text {
      position: relative;
      z-index: 1;
    }

    .safe-zone {
      position: absolute; left: 0; right: 0;
      border: 1px dashed rgba(255, 255, 0, 0.35);
      pointer-events: none;
    }
    .safe-zone-top { top: 10%; height: 0; }
    .safe-zone-bottom { bottom: 20%; height: 0; }
    .safe-zone-right { right: 5%; top: 10%; bottom: 20%; width: 0; border-left: 1px dashed rgba(255, 255, 0, 0.35); border-top: none; border-right: none; border-bottom: none; }
    .safe-zone-left { left: 5%; top: 10%; bottom: 20%; width: 0; border-left: 1px dashed rgba(255, 255, 0, 0.35); border-top: none; border-right: none; border-bottom: none; }

    .snap-guide {
      position: absolute; pointer-events: none; z-index: 200;
      background: var(--color-accent, #6366f1);
      box-shadow: 0 0 4px 0 var(--color-accent-glow, rgba(99, 102, 241, 0.5));
      opacity: 0;
      animation: guide-in 0.12s ease-out forwards;
    }
    .snap-guide.guide-h {
      left: 0; right: 0; height: 1px;
    }
    .snap-guide.guide-v {
      top: 0; bottom: 0; width: 1px;
    }
    @keyframes guide-in {
      from { opacity: 0; }
      to { opacity: 0.7; }
    }

    .preview-controls {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; margin-top: 10px; flex-shrink: 0;
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-border-subtle);
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
  readonly selectedOverlayId = input<string | null>(null);

  readonly timeChange = output<number>();
  readonly overlaySelect = output<string | null>();
  readonly overlayPositionChange = output<{ id: string; type: 'text' | 'brand'; position: NormalizedPosition }>();

  readonly videoEl = viewChild.required<ElementRef<HTMLVideoElement>>('videoEl');
  readonly viewport = viewChild.required<ElementRef<HTMLDivElement>>('viewport');

  readonly playing = signal(false);
  readonly currentTime = signal(0);
  readonly dragging = signal<DragState | null>(null);
  readonly activeGuides = signal<Array<{ axis: 'horizontal' | 'vertical'; style: string }>>([]);

  // Tracked reactively (not read imperatively per-call) so overlay pixel positions and
  // font scaling stay correct whenever the 9:16 canvas resizes for a reason unrelated to
  // any signal this component reads — e.g. a warnings banner or the recovery bar in the
  // parent page changing the available height, which now also changes this canvas's
  // width since it derives its size from height (see .viewport-stage/.preview-viewport).
  readonly previewSize = signal<{ width: number; height: number }>({ width: 300, height: 533 });
  private resizeObserver?: ResizeObserver;
  private dragCurrent = signal<NormalizedPosition>({ x: 0, y: 0 });
  private snapPoints = computeSnapPoints();

  constructor() {
    afterNextRender(() => {
      this.updateScale();
      const el = this.viewport()?.nativeElement;
      if (!el || typeof ResizeObserver === 'undefined') return;
      this.resizeObserver = new ResizeObserver(() => this.updateScale());
      this.resizeObserver.observe(el);
    });
  }

  @HostListener('window:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    const state = this.dragging();
    if (!state) return;

    const vp = this.viewport()?.nativeElement;
    if (!vp) return;

    const rect = vp.getBoundingClientRect();
    const dx = (event.clientX - state.startPointerX) / rect.width;
    const dy = (event.clientY - state.startPointerY) / rect.height;

    let newPos: NormalizedPosition = {
      x: state.startNormalized.x + dx,
      y: state.startNormalized.y + dy,
    };

    newPos = clampPosition(newPos);

    // Skip snapping while Option/Alt is held, so users can fine-tune a position
    // without the guides pulling it back.
    const snapX = event.altKey ? { value: newPos.x, snapped: false } : snapAxis(newPos.x, this.snapPoints.vertical);
    const snapY = event.altKey ? { value: newPos.y, snapped: false } : snapAxis(newPos.y, this.snapPoints.horizontal);
    newPos = { x: snapX.value, y: snapY.value };

    this.dragCurrent.set(newPos);

    const guides: Array<{ axis: 'horizontal' | 'vertical'; style: string }> = [];
    if (snapX.snapped) {
      guides.push({
        axis: 'vertical',
        style: `left: ${newPos.x * 100}%; top: 0; bottom: 0;`,
      });
    }
    if (snapY.snapped) {
      guides.push({
        axis: 'horizontal',
        style: `top: ${newPos.y * 100}%; left: 0; right: 0;`,
      });
    }
    this.activeGuides.set(guides);
  }

  @HostListener('window:pointerup')
  onPointerUp(): void {
    const state = this.dragging();
    if (!state) return;

    const finalPos = this.dragCurrent();
    this.overlayPositionChange.emit({
      id: state.overlayId,
      type: state.overlayType,
      position: finalPos,
    });

    this.dragging.set(null);
    this.activeGuides.set([]);
  }

  @HostListener('window:pointercancel')
  onPointerCancel(): void {
    // Drag was interrupted (e.g. an OS/browser gesture took over the pointer) — discard
    // it without committing a position, so the overlay reverts to where it started.
    this.dragging.set(null);
    this.activeGuides.set([]);
  }

  onTimeUpdate(event: Event): void {
    const video = event.target as HTMLVideoElement;
    this.currentTime.set(video.currentTime);
    this.timeChange.emit(video.currentTime);
  }

  onMetadataLoaded(_event: Event): void {
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

  onViewportPointerDown(event: PointerEvent): void {
    if ((event.target as HTMLElement).closest('.text-overlay, .brand-overlay')) return;
    this.overlaySelect.emit(null);
  }

  onOverlayPointerDown(event: PointerEvent, overlayId: string, type: 'text' | 'brand'): void {
    event.stopPropagation();
    event.preventDefault();

    this.overlaySelect.emit(overlayId);

    const vp = this.viewport()?.nativeElement;
    if (!vp) return;

    const overlay = type === 'text'
      ? this.textOverlays().find(o => o.id === overlayId)
      : this.brandOverlays().find(o => o.id === overlayId);

    let startNormalized: NormalizedPosition;
    if (overlay && 'customPosition' in overlay && overlay.customPosition) {
      startNormalized = overlay.customPosition;
    } else if (overlay && 'position' in overlay) {
      const posStr = overlay.position as string;
      startNormalized = POSITION_PRESETS[posStr] ?? { x: 0.5, y: 0.5 };
    } else {
      startNormalized = { x: 0.5, y: 0.5 };
    }

    this.dragging.set({
      overlayId,
      overlayType: type,
      startNormalized,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
    });
    this.dragCurrent.set(startNormalized);

    (event.target as HTMLElement)?.setPointerCapture?.(event.pointerId);
  }

  onOverlayDoubleClick(event: Event, overlayId: string): void {
    event.stopPropagation();
  }

  visibleTextOverlays(): TextOverlay[] {
    const t = this.currentTime();
    return this.textOverlays().filter((o) => t >= o.startTime && t <= o.endTime);
  }

  visibleBrandOverlays(): BrandOverlay[] {
    const t = this.currentTime();
    return this.brandOverlays().filter((o) => t >= o.startTime && t <= o.endTime);
  }

  getOverlayStyle(overlay: TextOverlay): Record<string, string> {
    const isDragging = this.dragging()?.overlayId === overlay.id;
    const pos = isDragging ? this.dragCurrent() : this.getOverlayPosition(overlay);

    const { width: vpWidth, height: vpHeight } = this.previewSize();
    const pixels = normalizedToPixels(pos, vpWidth, vpHeight);

    return {
      'left': `${pixels.px}px`,
      'top': `${pixels.py}px`,
      'transform': 'translate(-50%, -50%)',
      'fontFamily': overlay.style.fontFamily,
      'fontSize': `${this.scaleFontSize(overlay.style.fontSize)}px`,
      'fontWeight': overlay.style.fontWeight ?? 'normal',
      'fontStyle': overlay.style.italic ? 'italic' : 'normal',
      'color': overlay.style.color,
      'opacity': String(overlay.style.opacity),
      'textShadow': this.textShadowFor(overlay.style),
      'letterSpacing': `${overlay.style.letterSpacing ?? 0}rem`,
      'whiteSpace': 'pre-line',
    };
  }

  /**
   * Mirrors the render's glow technique (blurred halo behind a crisp core) using CSS
   * text-shadow's native blur radius, so the preview stays WYSIWYG with the FFmpeg
   * output instead of only ever showing a flat drop shadow.
   */
  private textShadowFor(style: TextOverlay['style'] | BrandOverlay['style']): string {
    if (style.glow) {
      const glowColor = style.shadowColor ?? '#FFB240';
      const blur = style.shadowBlur && style.shadowBlur > 0 ? style.shadowBlur : 8;
      return `0 0 ${blur}px ${glowColor}, 0 0 ${blur * 2}px ${glowColor}, 1px 1px 3px rgba(0,0,0,0.5)`;
    }
    return style.textShadow
      ? `2px 2px 8px ${style.shadowColor ?? 'rgba(0,0,0,0.8)'}`
      : 'none';
  }

  getBrandOverlayStyle(brand: BrandOverlay): Record<string, string> {
    const isDragging = this.dragging()?.overlayId === brand.id;
    const pos = isDragging ? this.dragCurrent() : this.getBrandPosition(brand);

    const { width: vpWidth, height: vpHeight } = this.previewSize();
    const pixels = normalizedToPixels(pos, vpWidth, vpHeight);

    return {
      'left': `${pixels.px}px`,
      'top': `${pixels.py}px`,
      'transform': 'translate(-50%, -50%)',
      'fontFamily': brand.style.fontFamily,
      'fontSize': `${this.scaleFontSize(brand.style.fontSize)}px`,
      'fontWeight': brand.style.fontWeight ?? 'normal',
      'fontStyle': brand.style.italic ? 'italic' : 'normal',
      'color': brand.style.color,
      'opacity': String(brand.style.opacity),
      'textShadow': this.textShadowFor(brand.style),
      'letterSpacing': `${brand.style.letterSpacing ?? 0}rem`,
      'whiteSpace': 'nowrap',
    };
  }

  private getOverlayPosition(overlay: TextOverlay): NormalizedPosition {
    if (overlay.position === 'custom' && overlay.customPosition) {
      return overlay.customPosition;
    }
    return POSITION_PRESETS[overlay.position] ?? { x: 0.5, y: 0.5 };
  }

  private getBrandPosition(brand: BrandOverlay): NormalizedPosition {
    if (brand.position === 'custom' && brand.customPosition) {
      return brand.customPosition;
    }
    return POSITION_PRESETS[brand.position] ?? { x: 0.5, y: 0.82 };
  }

  scaleFontSize(fontSize: number): number {
    return Math.round(fontSize * (this.previewSize().width / 1080));
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  private updateScale(): void {
    const el = this.viewport()?.nativeElement;
    if (!el) return;
    this.previewSize.set({ width: el.clientWidth, height: el.clientHeight });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    const video = this.videoEl()?.nativeElement;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  }
}
