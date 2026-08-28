import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { AudioTrack } from '@social-downloader/contracts';

@Component({
  selector: 'app-audio-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="audio-panel">
      <section class="panel-section">
        <h3>Audio original</h3>
        <div class="audio-controls">
          <label class="toggle-label">
            <input type="checkbox" [checked]="keepOriginal()" (change)="toggleOriginal.emit()">
            <span class="toggle-switch"></span>
            <span>Audio original</span>
          </label>
          @if (keepOriginal()) {
            <div class="slider-row">
              <label>Volumen</label>
              <input type="range" [ngModel]="originalVolume()" (ngModelChange)="volumeChange.emit(+$event)" min="0" max="1" step="0.05" class="range-input">
              <span class="range-val">{{ (originalVolume() * 100) | number:'1.0-0' }}%</span>
            </div>
            <label class="toggle-label small">
              <input type="checkbox" [checked]="autoDuck()" (change)="autoDuckChange.emit()">
              <span class="toggle-switch small"></span>
              <span>Auto-duck con música</span>
            </label>
          }
        </div>
      </section>

      <section class="panel-section">
        <h3>Música</h3>
        @if (musicTracks().length === 0) {
          <div class="upload-zone" (click)="musicInput.click()">
            <span class="upload-icon">&#9835;</span>
            <p>Sube música de fondo</p>
            <p class="hint">MP3, WAV, M4A</p>
          </div>
        } @else {
          @for (track of musicTracks(); track track.id) {
            <div class="track-card">
              <div class="track-header">
                <span class="track-name">{{ track.fileName }}</span>
                <button class="remove-btn" (click)="removeTrack.emit(track.id)">&times;</button>
              </div>
              <div class="slider-row">
                <label>Volumen</label>
                <input type="range" [ngModel]="track.volume" (ngModelChange)="updateTrack.emit({ id: track.id, changes: { volume: +$event } })" min="0" max="1" step="0.05" class="range-input">
                <span class="range-val">{{ (track.volume * 100) | number:'1.0-0' }}%</span>
              </div>
              <div class="slider-row">
                <label>Inicio</label>
                <input type="range" [ngModel]="track.startTime" (ngModelChange)="updateTrack.emit({ id: track.id, changes: { startTime: +$event } })" [max]="duration()" step="0.5" class="range-input">
                <span class="range-val">{{ track.startTime | number:'1.1-1' }}s</span>
              </div>
              <div class="preset-row">
                <span class="label">Volumen preset:</span>
                @for (vp of volumePresets; track vp.label) {
                  <button class="preset-chip mini" (click)="updateTrack.emit({ id: track.id, changes: { volume: vp.value } })">{{ vp.label }}</button>
                }
              </div>
              <div class="slider-row">
                <label>Fade in</label>
                <input type="range" [ngModel]="track.fadeIn ?? 0" (ngModelChange)="updateTrack.emit({ id: track.id, changes: { fadeIn: +$event } })" min="0" max="5" step="0.5" class="range-input">
                <span class="range-val">{{ (track.fadeIn ?? 0) | number:'1.1-1' }}s</span>
              </div>
              <div class="slider-row">
                <label>Fade out</label>
                <input type="range" [ngModel]="track.fadeOut ?? 0" (ngModelChange)="updateTrack.emit({ id: track.id, changes: { fadeOut: +$event } })" min="0" max="5" step="0.5" class="range-input">
                <span class="range-val">{{ (track.fadeOut ?? 0) | number:'1.1-1' }}s</span>
              </div>
            </div>
          }
          <div class="upload-zone small" (click)="musicInput.click()">
            <span>+</span> Agregar otra música
          </div>
        }
        <input #musicInput type="file" accept="audio/*" (change)="onMusicUpload($event)" hidden>
      </section>

      <section class="panel-section">
        <h3>Efectos de sonido (SFX)</h3>
        @if (sfxTracks().length > 0) {
          @for (track of sfxTracks(); track track.id) {
            <div class="track-card sfx">
              <div class="track-header">
                <span class="track-name">{{ track.fileName }}</span>
                <button class="remove-btn" (click)="removeTrack.emit(track.id)">&times;</button>
              </div>
              <div class="slider-row">
                <label>Inicio</label>
                <input type="range" [ngModel]="track.startTime" (ngModelChange)="updateTrack.emit({ id: track.id, changes: { startTime: +$event } })" [max]="duration()" step="0.5" class="range-input">
                <span class="range-val">{{ track.startTime | number:'1.1-1' }}s</span>
              </div>
              <div class="slider-row">
                <label>Volumen</label>
                <input type="range" [ngModel]="track.volume" (ngModelChange)="updateTrack.emit({ id: track.id, changes: { volume: +$event } })" min="0" max="1" step="0.05" class="range-input">
                <span class="range-val">{{ (track.volume * 100) | number:'1.0-0' }}%</span>
              </div>
            </div>
          }
        }
        <div class="upload-zone small" (click)="sfxInput.click()">
          <span>+</span> Agregar efecto de sonido
        </div>
        <input #sfxInput type="file" accept="audio/*" (change)="onSfxUpload($event)" hidden>
      </section>
    </div>
  `,
  styles: [`
    .audio-panel { display: flex; flex-direction: column; gap: 12px; }
    .panel-section {
      background: var(--color-surface); border-radius: var(--radius-lg);
      padding: 20px; border: 1px solid var(--color-border-subtle);
    }
    .panel-section h3 {
      font-size: 11px; font-weight: 700; color: var(--color-text-muted);
      text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 14px;
    }
    .audio-controls { display: flex; flex-direction: column; gap: 12px; }
    .toggle-label {
      display: flex; align-items: center; gap: 10px;
      font-size: 13px; color: var(--color-text-primary); cursor: pointer;
    }
    .toggle-label.small { font-size: 12px; color: var(--color-text-secondary); }
    .toggle-label input { display: none; }
    .toggle-switch {
      width: 36px; height: 20px; background: var(--color-border);
      border-radius: 10px; position: relative; transition: background 0.2s;
    }
    .toggle-switch.small { width: 30px; height: 16px; border-radius: 8px; }
    .toggle-switch::after {
      content: ''; position: absolute; top: 2px; left: 2px;
      width: 16px; height: 16px; background: #fff; border-radius: 50%;
      transition: transform 0.2s;
    }
    .toggle-switch.small::after { width: 12px; height: 12px; }
    .toggle-label input:checked + .toggle-switch { background: var(--color-accent); }
    .toggle-label input:checked + .toggle-switch::after { transform: translateX(16px); }
    .toggle-label input:checked + .toggle-switch.small::after { transform: translateX(14px); }
    .slider-row {
      display: flex; align-items: center; gap: 10px;
      font-size: 12px; color: var(--color-text-secondary);
    }
    .slider-row label { min-width: 48px; }
    .range-input { flex: 1; accent-color: var(--color-accent); }
    .range-val { min-width: 40px; text-align: right; font-variant-numeric: tabular-nums; }
    .preset-row { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
    .preset-row .label { font-size: 11px; color: var(--color-text-muted); }
    .preset-chip.mini {
      padding: 3px 8px; border: 1px solid var(--color-border); border-radius: 9999px;
      background: var(--color-bg); color: var(--color-text-secondary);
      cursor: pointer; font-size: 10px; transition: all var(--transition-fast);
    }
    .preset-chip.mini:hover { border-color: var(--color-accent); }
    .upload-zone {
      text-align: center; padding: 24px; border: 2px dashed var(--color-border);
      border-radius: var(--radius-md); cursor: pointer; transition: all var(--transition-fast);
    }
    .upload-zone.small { padding: 12px; font-size: 12px; }
    .upload-zone:hover { border-color: var(--color-accent); background: var(--color-accent-glow); }
    .upload-icon { font-size: 28px; color: var(--color-text-muted); }
    .hint { font-size: 10px; color: var(--color-text-muted); margin-top: 4px; }
    .track-card {
      padding: 12px; background: var(--color-bg); border-radius: 8px;
      margin-bottom: 8px; display: flex; flex-direction: column; gap: 8px;
    }
    .track-card.sfx { border-left: 3px solid #ec4899; }
    .track-header { display: flex; justify-content: space-between; align-items: center; }
    .track-name { font-size: 12px; font-weight: 600; color: var(--color-text-primary); }
    .remove-btn {
      background: none; border: none; color: var(--color-text-muted);
      cursor: pointer; font-size: 16px; padding: 2px 6px; border-radius: 4px;
    }
    .remove-btn:hover { color: var(--color-danger); background: var(--color-danger-bg); }
  `],
})
export class AudioPanelComponent {
  readonly musicTracks = input<AudioTrack[]>([]);
  readonly sfxTracks = input<AudioTrack[]>([]);
  readonly keepOriginal = input<boolean>(true);
  readonly originalVolume = input<number>(1);
  readonly autoDuck = input<boolean>(false);
  readonly duration = input<number>(0);

  readonly toggleOriginal = output<void>();
  readonly volumeChange = output<number>();
  readonly autoDuckChange = output<void>();
  readonly uploadMusic = output<File>();
  readonly uploadSfx = output<File>();
  readonly removeTrack = output<string>();
  readonly updateTrack = output<{ id: string; changes: Partial<AudioTrack> }>();

  readonly volumePresets = [
    { label: 'Background', value: 0.2 },
    { label: 'Balanced', value: 0.35 },
    { label: 'Prominent', value: 0.6 },
  ];

  onMusicUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.uploadMusic.emit(input.files[0]);
      input.value = '';
    }
  }

  onSfxUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.uploadSfx.emit(input.files[0]);
      input.value = '';
    }
  }
}
