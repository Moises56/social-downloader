import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { TextOverlay, OverlayPosition } from '@social-downloader/contracts';

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
            <label>Ancho máximo</label>
            <select [ngModel]="maxWidthOption" (ngModelChange)="onMaxWidthChange($event)" class="select-input">
              <option value="70">Estrecho (70%)</option>
              <option value="85">Medio (85%)</option>
              <option value="95">Amplio (95%)</option>
            </select>
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
    .select-input {
      width: 100%; padding: 6px 8px;
      background: var(--color-bg); border: 1px solid var(--color-border);
      border-radius: 6px; color: var(--color-text-primary); font-size: 13px;
    }
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
}
