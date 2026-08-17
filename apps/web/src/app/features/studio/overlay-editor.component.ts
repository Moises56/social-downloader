import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { TextOverlay, OverlayPosition } from '@social-downloader/contracts';
import { POSITION_PRESETS, type NormalizedPosition } from './editor/position';

@Component({
  selector: 'app-overlay-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (overlay(); as ov) {
      <div class="editor-panel">
        <div class="editor-header">
          <h4>Editar overlay</h4>
          <div class="header-actions">
            <button class="icon-btn" title="Duplicar" (click)="duplicate.emit(ov.id)">&#9112;</button>
            <button class="icon-btn danger" title="Eliminar" (click)="remove.emit(ov.id)">&times;</button>
          </div>
        </div>

        <div class="editor-body">
          <div class="field">
            <label>Texto</label>
            <textarea [ngModel]="ov.text" (ngModelChange)="updateField('text', $event)" rows="3" class="text-area"></textarea>
            <span class="char-count">{{ ov.text.length }} caracteres</span>
          </div>

          <div class="field-row">
            <div class="field">
              <label>Inicio</label>
              <input type="number" [ngModel]="ov.startTime" (ngModelChange)="updateField('startTime', +$event)" step="0.1" min="0" class="num-input">
              <span class="unit">s</span>
            </div>
            <div class="field">
              <label>Fin</label>
              <input type="number" [ngModel]="ov.endTime" (ngModelChange)="updateField('endTime', +$event)" step="0.1" min="0" class="num-input">
              <span class="unit">s</span>
            </div>
          </div>

          <div class="field">
            <label>Posición</label>
            <div class="position-grid">
              @for (pos of positions; track pos.value) {
                <button
                  class="pos-btn"
                  [class.active]="ov.position === pos.value"
                  (click)="updateField('position', pos.value)"
                  [title]="pos.label">
                  {{ pos.icon }}
                </button>
              }
            </div>
            <div class="align-row">
              <button class="align-btn" title="Centrar horizontal" (click)="centerHorizontal()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="2" x2="12" y2="22" stroke-dasharray="2.5 2.5"/><rect x="7" y="9" width="10" height="6" rx="1.5"/></svg>
              </button>
              <button class="align-btn" title="Centrar vertical" (click)="centerVertical()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="2" y1="12" x2="22" y2="12" stroke-dasharray="2.5 2.5"/><rect x="9" y="7" width="6" height="10" rx="1.5"/></svg>
              </button>
              <button class="align-btn" title="Centrar ambos" (click)="centerBoth()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="2" x2="12" y2="22" stroke-dasharray="2.5 2.5"/><line x1="2" y1="12" x2="22" y2="12" stroke-dasharray="2.5 2.5"/><circle cx="12" cy="12" r="3.5"/></svg>
              </button>
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label>Tamaño</label>
              <input type="range" [ngModel]="ov.style.fontSize" (ngModelChange)="updateStyle('fontSize', +$event)" min="20" max="80" step="2" class="range-input">
              <span class="range-val">{{ ov.style.fontSize }}px</span>
            </div>
            <div class="field">
              <label>Opacidad</label>
              <input type="range" [ngModel]="ov.style.opacity" (ngModelChange)="updateStyle('opacity', +$event)" min="0" max="1" step="0.05" class="range-input">
              <span class="range-val">{{ (ov.style.opacity * 100) | number:'1.0-0' }}%</span>
            </div>
          </div>

          <div class="field">
            <label>Color</label>
            <div class="color-row">
              @for (c of colorOptions; track c) {
                <button class="color-swatch" [style.background]="c" [class.active]="ov.style.color === c" (click)="updateStyle('color', c)"></button>
              }
            </div>
          </div>

          <div class="field">
            <label>Efecto</label>
            <div class="effect-row">
              <button class="effect-btn" [class.active]="!ov.style.glow" (click)="setGlow(false)">Ninguno</button>
              <button class="effect-btn glow-preview" [class.active]="ov.style.glow" (click)="setGlow(true)">Glow ámbar</button>
            </div>
          </div>

          <div class="field">
            <label>Ancho máximo</label>
            <select [ngModel]="maxWidthOption" (ngModelChange)="onMaxWidthChange($event)" class="select-input">
              <option value="70">Estrecho (70%)</option>
              <option value="85">Medio (85%)</option>
              <option value="95">Amplio (95%)</option>
            </select>
          </div>

          <div class="field">
            <label>Animación</label>
            <div class="animation-row">
              @for (anim of animations; track anim.value) {
                <button
                  class="anim-btn"
                  [class.active]="(ov.animationIn ?? 'none') === anim.value"
                  (click)="updateField('animationIn', anim.value); updateField('animationOut', anim.value === 'none' ? 'none' : 'fade-out')">
                  {{ anim.label }}
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .editor-panel {
      background: var(--color-surface);
      border: 1px solid var(--color-border-subtle);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }
    .editor-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--color-border-subtle);
    }
    .editor-header h4 {
      font-size: 12px; font-weight: 700; color: var(--color-text-muted);
      text-transform: uppercase; letter-spacing: 0.08em; margin: 0;
    }
    .header-actions { display: flex; gap: 4px; }
    .icon-btn {
      width: 28px; height: 28px; border-radius: 6px;
      background: none; border: 1px solid var(--color-border);
      color: var(--color-text-secondary); cursor: pointer;
      font-size: 14px; display: flex; align-items: center; justify-content: center;
      transition: all var(--transition-fast);
    }
    .icon-btn:hover { border-color: var(--color-text-muted); color: var(--color-text-primary); }
    .icon-btn.danger:hover { border-color: var(--color-danger); color: var(--color-danger); background: var(--color-danger-bg); }
    .editor-body { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field label {
      font-size: 11px; font-weight: 600; color: var(--color-text-muted);
      text-transform: uppercase; letter-spacing: 0.06em;
    }
    .field-row { display: flex; gap: 12px; }
    .field-row .field { flex: 1; }
    .text-area {
      width: 100%; padding: 8px 10px;
      background: var(--color-bg); border: 1px solid var(--color-border);
      border-radius: 6px; color: var(--color-text-primary);
      font-size: 13px; resize: vertical; font-family: inherit;
    }
    .text-area:focus { border-color: var(--color-accent); outline: none; }
    .char-count { font-size: 10px; color: var(--color-text-muted); text-align: right; }
    .num-input {
      width: 100%; padding: 6px 8px;
      background: var(--color-bg); border: 1px solid var(--color-border);
      border-radius: 6px; color: var(--color-text-primary);
      font-size: 13px; font-variant-numeric: tabular-nums;
    }
    .num-input:focus { border-color: var(--color-accent); outline: none; }
    .unit { font-size: 11px; color: var(--color-text-muted); }
    .position-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;
    }
    .pos-btn {
      padding: 6px; border: 1px solid var(--color-border); border-radius: 6px;
      background: var(--color-bg); color: var(--color-text-secondary);
      cursor: pointer; font-size: 12px; transition: all var(--transition-fast);
    }
    .pos-btn:hover { border-color: var(--color-accent); }
    .pos-btn.active { background: var(--color-accent); color: #fff; border-color: var(--color-accent); }
    .align-row { display: flex; gap: 4px; margin-top: 6px; }
    .align-btn {
      flex: 1; padding: 6px; border: 1px solid var(--color-border); border-radius: 6px;
      background: var(--color-bg); color: var(--color-text-secondary);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: all var(--transition-fast);
    }
    .align-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }
    .align-btn svg { width: 16px; height: 16px; }
    .range-input { width: 100%; accent-color: var(--color-accent); }
    .range-val { font-size: 11px; color: var(--color-text-muted); text-align: right; font-variant-numeric: tabular-nums; }
    .color-row { display: flex; gap: 6px; flex-wrap: wrap; }
    .color-swatch {
      width: 24px; height: 24px; border-radius: 50%;
      border: 2px solid transparent; cursor: pointer;
      transition: all var(--transition-fast);
    }
    .color-swatch:hover { transform: scale(1.15); }
    .color-swatch.active { border-color: var(--color-text-primary); box-shadow: 0 0 0 2px var(--color-bg); }
    .effect-row { display: flex; gap: 6px; }
    .effect-btn {
      flex: 1; padding: 7px 4px; border: 1px solid var(--color-border); border-radius: 6px;
      background: var(--color-bg); color: var(--color-text-secondary);
      cursor: pointer; font-size: 11px; font-weight: 500; transition: all var(--transition-fast);
    }
    .effect-btn:hover { border-color: var(--color-accent); }
    .effect-btn.active { border-color: var(--color-accent); background: var(--color-accent-glow); color: var(--color-text-primary); }
    .effect-btn.glow-preview.active {
      color: #FFF4E0; text-shadow: 0 0 6px #FFB240, 0 0 12px #FFB240;
      border-color: #FFB240; background: rgba(255, 178, 64, 0.12);
    }
    .select-input {
      width: 100%; padding: 6px 8px;
      background: var(--color-bg); border: 1px solid var(--color-border);
      border-radius: 6px; color: var(--color-text-primary); font-size: 13px;
    }
    .animation-row { display: flex; gap: 4px; }
    .anim-btn {
      flex: 1; padding: 6px 4px; border: 1px solid var(--color-border); border-radius: 6px;
      background: var(--color-bg); color: var(--color-text-secondary);
      cursor: pointer; font-size: 10px; font-weight: 500; transition: all var(--transition-fast);
    }
    .anim-btn:hover { border-color: var(--color-accent); }
    .anim-btn.active { background: var(--color-accent); color: #fff; border-color: var(--color-accent); }
  `],
})
export class OverlayEditorComponent {
  readonly overlay = input<TextOverlay | null>(null);
  readonly overlayUpdate = output<{ id: string; changes: Partial<TextOverlay> }>();
  readonly duplicate = output<string>();
  readonly remove = output<string>();

  readonly positions: Array<{ value: OverlayPosition; label: string; icon: string }> = [
    { value: 'top-center', label: 'Arriba', icon: '\u2191' },
    { value: 'top-left', label: 'Arriba izq.', icon: '\u2196' },
    { value: 'top-right', label: 'Arriba der.', icon: '\u2197' },
    { value: 'center', label: 'Centro', icon: '\u25C9' },
    { value: 'lower-center', label: 'Medio', icon: '\u2193' },
    { value: 'bottom-center', label: 'Abajo', icon: '\u2193' },
    { value: 'bottom-left', label: 'Abajo izq.', icon: '\u2199' },
    { value: 'bottom-right', label: 'Abajo der.', icon: '\u2198' },
  ];

  readonly colorOptions = ['#f6efe2', '#ffffff', '#fef3c7', '#dbeafe', '#fce7f3', '#d1fae5'];

  readonly animations = [
    { value: 'none', label: 'Ninguna' },
    { value: 'fade-in', label: 'Fade' },
    { value: 'slide-up', label: 'Fade Up' },
    { value: 'soft-reveal', label: 'Soft Zoom' },
  ];

  readonly maxWidthOption = signal('85');

  updateField(field: string, value: unknown): void {
    const ov = this.overlay();
    if (!ov) return;
    this.overlayUpdate.emit({ id: ov.id, changes: { [field]: value } });
  }

  updateStyle(field: string, value: unknown): void {
    const ov = this.overlay();
    if (!ov) return;
    this.overlayUpdate.emit({
      id: ov.id,
      changes: { style: { ...ov.style, [field]: value } },
    });
  }

  onMaxWidthChange(value: string): void {
    this.maxWidthOption.set(value);
  }

  setGlow(enabled: boolean): void {
    const ov = this.overlay();
    if (!ov) return;
    // shadowColor doubles as "glow color" when glow is on, but most presets already
    // carry a dark drop-shadow color (e.g. rgba(0,0,0,0.8)) for the non-glow look —
    // that's not a fallback-worthy null, so `??` never kicks in. Turning "Glow ámbar"
    // on always sets the amber halo the button promises; turning it off leaves
    // shadowColor untouched so the regular drop shadow (if any) still works.
    this.overlayUpdate.emit({
      id: ov.id,
      changes: {
        style: {
          ...ov.style,
          glow: enabled,
          ...(enabled ? { shadowColor: '#FFB240', shadowBlur: ov.style.shadowBlur ?? 8 } : {}),
        },
      },
    });
  }

  private currentPosition(ov: TextOverlay): NormalizedPosition {
    return ov.customPosition ?? POSITION_PRESETS[ov.position] ?? { x: 0.5, y: 0.5 };
  }

  centerHorizontal(): void {
    const ov = this.overlay();
    if (!ov) return;
    const { y } = this.currentPosition(ov);
    this.overlayUpdate.emit({ id: ov.id, changes: { position: 'custom', customPosition: { x: 0.5, y } } });
  }

  centerVertical(): void {
    const ov = this.overlay();
    if (!ov) return;
    const { x } = this.currentPosition(ov);
    this.overlayUpdate.emit({ id: ov.id, changes: { position: 'custom', customPosition: { x, y: 0.5 } } });
  }

  centerBoth(): void {
    const ov = this.overlay();
    if (!ov) return;
    this.overlayUpdate.emit({ id: ov.id, changes: { position: 'custom', customPosition: { x: 0.5, y: 0.5 } } });
  }
}
