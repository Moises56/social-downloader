import { Component, ElementRef, inject, input, OnDestroy, output, signal, viewChild, afterNextRender, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { TextOverlay, BrandOverlay, MaskLayer, ImageLayer } from '@social-downloader/contracts';
import {
  NormalizedPosition,
  POSITION_PRESETS,
  clampPosition,
  normalizedToPixels,
  snapAxis,
  computeSnapPoints,
} from './editor/position';

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

/**
 * Arrastre de máscaras e imágenes. Va aparte de `DragState` a propósito: ese camino lleva
 * el imán a centro y safe zones de textos y marca, con sus tests, y una máscara necesita
 * colocarse exactamente sobre un logo — sin que nada la desvíe.
 */
interface LayerDragState {
  kind: 'mask-move' | 'mask-resize' | 'image-move';
  id: string;
  handle?: ResizeHandle;
  startRect: { x: number; y: number; width: number; height: number };
  startPointerX: number;
  startPointerY: number;
}

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
          <!-- Máscaras primero: tapan el material original, nunca lo que se añade encima
               (mismo orden que el render). -->
          @for (mask of visibleMasks(); track mask.id) {
            <div
              class="mask-layer"
              [class.selected]="selectedOverlayId() === mask.id"
              [attr.data-mask-id]="mask.id"
              [style]="getMaskStyle(mask)"
              (pointerdown)="onMaskPointerDown($event, mask.id)">
              <span class="mask-tag">{{ maskLabel(mask) }}</span>
              @if (selectedOverlayId() === mask.id) {
                @for (handle of resizeHandles; track handle) {
                  <span
                    class="mask-handle"
                    [class]="'mask-handle handle-' + handle"
                    (pointerdown)="onMaskResizeStart($event, mask.id, handle)"></span>
                }
              }
            </div>
          }

          @for (image of visibleImages(); track image.id) {
            <img
              class="image-layer"
              [class.selected]="selectedOverlayId() === image.id"
              [attr.data-image-id]="image.id"
              [src]="imageSources()[image.assetId] ?? ''"
              [style]="getImageStyle(image)"
              alt=""
              draggable="false"
              (pointerdown)="onImagePointerDown($event, image.id)">
          }

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

    /* ── Máscaras ──────────────────────────────────────────────────────────
       Se dibujan sobre el vídeo pero por debajo de textos y marca, igual que en el
       render. El borde punteado marca que es una zona de edición, no algo que se vea
       en el vídeo final: lo que se exporta es el desenfoque, no el contorno. */
    .mask-layer {
      position: absolute;
      z-index: 20;
      cursor: move;
      border: 1px dashed rgba(241, 245, 249, 0.45);
      border-radius: 2px;
      touch-action: none;
    }
    .mask-layer:hover { border-color: rgba(241, 245, 249, 0.8); }
    .mask-layer.selected {
      border: 1.5px solid var(--color-accent, #3b82f6);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
    }

    .mask-tag {
      /* Centrada: en la esquina se solapaba con el asa de redimensionar. */
      position: absolute; top: -2px; left: 50%;
      transform: translate(-50%, -100%);
      padding: 2px 6px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.02em;
      line-height: 1.4;
      color: #f1f5f9;
      background: rgba(10, 14, 26, 0.85);
      border-radius: 3px;
      white-space: nowrap;
      pointer-events: none;
    }

    .mask-handle {
      position: absolute;
      width: 10px; height: 10px;
      background: var(--color-accent, #3b82f6);
      border: 1.5px solid #f1f5f9;
      border-radius: 2px;
      /* El asa visible es pequeña para no tapar el logo que se está encuadrando; el área
         real de agarre se amplía con el ::after, que es lo que hace usable el redimensionado. */
      touch-action: none;
    }
    .mask-handle::after {
      content: ''; position: absolute; inset: -8px;
    }
    .handle-nw { top: -5px; left: -5px; cursor: nwse-resize; }
    .handle-ne { top: -5px; right: -5px; cursor: nesw-resize; }
    .handle-sw { bottom: -5px; left: -5px; cursor: nesw-resize; }
    .handle-se { bottom: -5px; right: -5px; cursor: nwse-resize; }

    /* ── Capas de imagen ──────────────────────────────────────────────────── */
    .image-layer {
      position: absolute;
      z-index: 30;
      cursor: move;
      height: auto;
      user-select: none;
      -webkit-user-drag: none;
      touch-action: none;
    }
    .image-layer.selected {
      outline: 1.5px solid var(--color-accent, #3b82f6);
      outline-offset: 2px;
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
  readonly masks = input<MaskLayer[]>([]);
  readonly images = input<ImageLayer[]>([]);
  /** assetId -> object URL local, para poder previsualizar sin pedir el fichero al servidor. */
  readonly imageSources = input<Record<string, string>>({});
  /**
   * Segundo del material donde empieza el recorte. El editor trabaja en tiempo del
   * recorte (0 = primer fotograma que se exporta) y el <video> en tiempo del fichero,
   * así que hay que trasladar en ambos sentidos o el preview enseña el trozo equivocado.
   */
  readonly trimOffset = input<number>(0);

  readonly timeChange = output<number>();
  readonly overlaySelect = output<string | null>();
  readonly overlayPositionChange = output<{ id: string; type: 'text' | 'brand'; position: NormalizedPosition }>();
  readonly maskRectChange = output<{ id: string; rect: { x: number; y: number; width: number; height: number } }>();
  readonly imagePositionChange = output<{ id: string; position: NormalizedPosition }>();

  readonly videoEl = viewChild.required<ElementRef<HTMLVideoElement>>('videoEl');
  readonly viewport = viewChild.required<ElementRef<HTMLDivElement>>('viewport');

  readonly playing = signal(false);
  readonly currentTime = signal(0);
  readonly dragging = signal<DragState | null>(null);
  readonly layerDragging = signal<LayerDragState | null>(null);
  readonly resizeHandles: ResizeHandle[] = ['nw', 'ne', 'sw', 'se'];
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
    if (this.handleLayerPointerMove(event)) return;

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

  /** @returns true si el evento correspondía a una máscara o imagen y ya se ha atendido. */
  private handleLayerPointerMove(event: PointerEvent): boolean {
    const drag = this.layerDragging();
    if (!drag) return false;

    const vp = this.viewport()?.nativeElement;
    if (!vp) return true;

    const rect = vp.getBoundingClientRect();
    // Desplazamiento en unidades normalizadas del lienzo, no en píxeles de pantalla:
    // así el arrastre se comporta igual con el preview a cualquier tamaño.
    const dx = (event.clientX - drag.startPointerX) / rect.width;
    const dy = (event.clientY - drag.startPointerY) / rect.height;
    const base = drag.startRect;

    if (drag.kind === 'image-move') {
      this.imagePositionChange.emit({
        id: drag.id,
        position: {
          x: Math.min(1, Math.max(0, base.x + dx)),
          y: Math.min(1, Math.max(0, base.y + dy)),
        },
      });
      return true;
    }

    if (drag.kind === 'mask-move') {
      this.maskRectChange.emit({
        id: drag.id,
        rect: {
          ...base,
          // Se frena en el borde para que la máscara no pueda salirse del lienzo.
          x: Math.min(1 - base.width, Math.max(0, base.x + dx)),
          y: Math.min(1 - base.height, Math.max(0, base.y + dy)),
        },
      });
      return true;
    }

    // Redimensionar: cada asa mueve su esquina y deja fija la opuesta.
    const MIN = 0.02;
    let { x, y, width, height } = base;
    const handle = drag.handle ?? 'se';

    if (handle === 'nw' || handle === 'sw') {
      const nx = Math.min(base.x + base.width - MIN, Math.max(0, base.x + dx));
      width = base.x + base.width - nx;
      x = nx;
    } else {
      width = Math.min(1 - base.x, Math.max(MIN, base.width + dx));
    }

    if (handle === 'nw' || handle === 'ne') {
      const ny = Math.min(base.y + base.height - MIN, Math.max(0, base.y + dy));
      height = base.y + base.height - ny;
      y = ny;
    } else {
      height = Math.min(1 - base.y, Math.max(MIN, base.height + dy));
    }

    this.maskRectChange.emit({ id: drag.id, rect: { x, y, width, height } });
    return true;
  }

  onMaskPointerDown(event: PointerEvent, maskId: string): void {
    // Sin esto, empezar a arrastrar desde un asa movería además toda la máscara.
    if ((event.target as HTMLElement).classList.contains('mask-handle')) return;
    event.stopPropagation();
    event.preventDefault();
    this.overlaySelect.emit(maskId);

    const mask = this.masks().find((m) => m.id === maskId);
    if (!mask) return;

    this.layerDragging.set({
      kind: 'mask-move',
      id: maskId,
      startRect: { ...mask.rect },
      startPointerX: event.clientX,
      startPointerY: event.clientY,
    });
  }

  onMaskResizeStart(event: PointerEvent, maskId: string, handle: ResizeHandle): void {
    event.stopPropagation();
    event.preventDefault();

    const mask = this.masks().find((m) => m.id === maskId);
    if (!mask) return;

    this.layerDragging.set({
      kind: 'mask-resize',
      id: maskId,
      handle,
      startRect: { ...mask.rect },
      startPointerX: event.clientX,
      startPointerY: event.clientY,
    });
  }

  onImagePointerDown(event: PointerEvent, imageId: string): void {
    event.stopPropagation();
    event.preventDefault();
    this.overlaySelect.emit(imageId);

    const image = this.images().find((i) => i.id === imageId);
    if (!image) return;

    this.layerDragging.set({
      kind: 'image-move',
      id: imageId,
      startRect: { x: image.position.x, y: image.position.y, width: 0, height: 0 },
      startPointerX: event.clientX,
      startPointerY: event.clientY,
    });
  }

  visibleMasks(): MaskLayer[] {
    const t = this.currentTime();
    return this.masks().filter((m) => t >= m.startTime && t <= m.endTime);
  }

  visibleImages(): ImageLayer[] {
    const t = this.currentTime();
    return this.images().filter((i) => t >= i.startTime && t <= i.endTime);
  }

  maskLabel(mask: MaskLayer): string {
    if (mask.mode === 'solid') return 'Color';
    return mask.mode === 'pixelate' ? 'Pixelado' : 'Desenfoque';
  }

  getMaskStyle(mask: MaskLayer): Record<string, string> {
    const base: Record<string, string> = {
      left: `${mask.rect.x * 100}%`,
      top: `${mask.rect.y * 100}%`,
      width: `${mask.rect.width * 100}%`,
      height: `${mask.rect.height * 100}%`,
    };

    if (mask.mode === 'solid') {
      return { ...base, background: mask.color ?? '#000000' };
    }

    // Aproximación: el navegador no puede reproducir boxblur/pixelize de FFmpeg. El
    // pixelado se sugiere con un desenfoque más duro y contraste; el fotograma exacto
    // se comprueba con la previsualización real antes de exportar.
    const radius = mask.mode === 'pixelate'
      ? Math.max(2, mask.intensity * 0.5)
      : Math.max(1, mask.intensity * 0.35);
    return {
      ...base,
      'backdrop-filter': `blur(${radius}px)`,
      '-webkit-backdrop-filter': `blur(${radius}px)`,
    };
  }

  getImageStyle(image: ImageLayer): Record<string, string> {
    return {
      left: `${image.position.x * 100}%`,
      top: `${image.position.y * 100}%`,
      width: `${image.scale * 100}%`,
      transform: 'translate(-50%, -50%)',
      opacity: String(image.opacity),
    };
  }

  @HostListener('window:pointerup')
  onPointerUp(): void {
    this.layerDragging.set(null);
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
    // Sin esto, una máscara o imagen interrumpida se quedaba pegada al puntero.
    this.layerDragging.set(null);
    this.activeGuides.set([]);
  }

  onTimeUpdate(event: Event): void {
    const video = event.target as HTMLVideoElement;
    const editorTime = video.currentTime - this.trimOffset();

    // Al llegar al final del recorte se para: reproducir más allá mostraría material
    // que no va a salir en el vídeo exportado.
    if (editorTime >= this.duration()) {
      video.pause();
      this.currentTime.set(this.duration());
      this.timeChange.emit(this.duration());
      return;
    }

    const clamped = Math.max(0, editorTime);
    this.currentTime.set(clamped);
    this.timeChange.emit(clamped);
  }

  onMetadataLoaded(_event: Event): void {
    this.updateScale();
  }

  onSeek(event: Event): void {
    const input = event.target as HTMLInputElement;
    const time = Number(input.value);
    this.videoEl().nativeElement.currentTime = this.trimOffset() + time;
    this.currentTime.set(time);
  }

  togglePlay(): void {
    const video = this.videoEl().nativeElement;
    if (!video.paused) {
      video.pause();
      return;
    }

    // Si el cabezal quedó fuera del recorte (al terminar, o tras mover el recorte),
    // se vuelve al principio del trozo en vez de reproducir desde donde no toca.
    const offset = this.trimOffset();
    const editorTime = video.currentTime - offset;
    if (editorTime < 0 || editorTime >= this.duration()) {
      video.currentTime = offset;
      this.currentTime.set(0);
    }
    video.play();
  }

  onViewportPointerDown(event: PointerEvent): void {
    if ((event.target as HTMLElement).closest('.text-overlay, .brand-overlay, .mask-layer, .image-layer')) return;
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
