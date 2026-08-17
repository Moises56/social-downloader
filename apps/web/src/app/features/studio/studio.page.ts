import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudioStore } from './state/studio.store';
import { StudioApiService } from './services/studio-api.service';
import { VideoPreviewComponent } from './video-preview.component';
import { TimelineComponent } from './timeline.component';
import { OverlayEditorComponent } from './overlay-editor.component';
import { AudioPanelComponent } from './audio-panel.component';
import type { BrandPreset, TextPreset, CompositionPreset, TextOverlay, AudioTrack, SavedCompositionPreset, ExportPreset, VideoFitMode } from '@social-downloader/contracts';

@Component({
  selector: 'app-studio-page',
  standalone: true,
  imports: [CommonModule, FormsModule, VideoPreviewComponent, TimelineComponent, OverlayEditorComponent, AudioPanelComponent],
  template: `
    <div class="studio">
      <header class="studio-header">
        <div class="header-inner">
          <h1>Studio</h1>
          <p class="tagline">Crea contenido visual para redes sociales</p>
        </div>
      </header>

      <main class="studio-main">
        <div class="studio-grid">
          <div class="preview-column">
            <div class="preview-wrapper">
              @if (store.sourceVideoUrl(); as videoUrl) {
                <app-video-preview
                  [src]="videoUrl"
                  [textOverlays]="store.textOverlays()"
                  [brandOverlays]="store.brandOverlays()"
                  [duration]="store.totalDuration()"
                  [showSafeZones]="store.showSafeZones()"
                  (timeChange)="store.currentTime.set($event)">
                </app-video-preview>
              } @else {
                <div class="upload-zone" (click)="fileInput.click()" (dragover)="$event.preventDefault()" (drop)="onDrop($event)">
                  <div class="upload-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                  </div>
                  <p class="upload-title">Sube un video</p>
                  <p class="upload-sub">arrastra o haz clic &middot; MP4, MOV, WebM</p>
                </div>
              }
            </div>

            @if (store.sourceVideoUrl()) {
              <div class="timeline-wrapper">
                <app-timeline
                  [duration]="store.totalDuration()"
                  [currentTime]="store.currentTime()"
                  [textOverlays]="store.textOverlays()"
                  [brandOverlays]="store.brandOverlays()"
                  [audioTracks]="store.audioTracks()"
                  (seekTo)="onSeekTimeline($event)"
                  (segmentUpdate)="onSegmentUpdate($event)">
                </app-timeline>
              </div>
            }

            <input #fileInput type="file" accept="video/*" (change)="onFileSelected($event)" hidden>
          </div>

          <div class="editor-column">
            <div class="editor-scroll">
              <section class="card">
                <h3 class="card-title">Composici&oacute;n</h3>
                <div class="preset-row">
                  @for (preset of compositionPresets(); track preset.id) {
                    <button class="chip-btn" (click)="applyCompositionPreset(preset)">
                      <span class="chip-label">{{ preset.name }}</span>
                      <span class="chip-desc">{{ preset.description }}</span>
                    </button>
                  }
                </div>
              </section>

              <section class="card">
                <h3 class="card-title">Marca</h3>
                <div class="brand-row">
                  @for (preset of presets(); track preset.id) {
                    <button
                      class="brand-btn"
                      [class.active]="store.selectedPreset()?.id === preset.id"
                      (click)="store.setPreset(preset)">
                      {{ preset.name }}
                    </button>
                  }
                </div>
                <div class="brand-preview">
                  @if (store.selectedPreset(); as preset) {
                    <span class="brand-signature">{{ preset.signature.text }}</span>
                    <span class="brand-badge">{{ preset.signature.defaultMode }}</span>
                  } @else {
                    <span class="brand-empty">Selecciona una marca</span>
                  }
                </div>
              </section>

              <section class="card">
                <h3 class="card-title">Textos</h3>
                <div class="text-chips">
                  @for (preset of textPresets(); track preset.id) {
                    <button
                      class="text-chip"
                      [class.active]="selectedTextPreset()?.id === preset.id"
                      (click)="selectedTextPreset.set(selectedTextPreset()?.id === preset.id ? null : preset)">
                      {{ preset.name }}
                    </button>
                  }
                </div>
                <div class="text-list">
                  @for (overlay of store.textOverlays(); track overlay.id) {
                    <div
                      class="text-item"
                      [class.active]="selectedOverlayId() === overlay.id"
                      (click)="selectedOverlayId.set(overlay.id)">
                      <div class="text-item-content">
                        <span class="text-item-label">{{ overlay.text }}</span>
                        <span class="text-item-time">{{ overlay.startTime | number:'1.1-1' }}s &ndash; {{ overlay.endTime | number:'1.1-1' }}s</span>
                      </div>
                      <button class="text-item-remove" (click)="$event.stopPropagation(); onOverlayRemove(overlay.id)">&times;</button>
                    </div>
                  }
                  @if (store.textOverlays().length === 0) {
                    <p class="empty-hint">Agrega textos usando los presets de arriba</p>
                  }
                </div>
                <div class="text-add">
                  <input
                    [(ngModel)]="newText"
                    [placeholder]="selectedTextPreset()?.description ?? 'Escribe tu texto...'"
                    class="text-field"
                    (keydown.enter)="addText()">
                  <button class="btn-primary btn-sm" (click)="addText()" [disabled]="!newText()">Agregar</button>
                </div>
              </section>

              @if (selectedOverlay(); as ov) {
                <app-overlay-editor
                  [overlay]="ov"
                  (overlayUpdate)="onOverlayUpdate($event)"
                  (duplicate)="onOverlayDuplicate($event)"
                  (remove)="onOverlayRemove($event)">
                </app-overlay-editor>
              }

              <section class="card">
                <h3 class="card-title">Audio</h3>
                <app-audio-panel
                  [musicTracks]="store.musicTracks()"
                  [sfxTracks]="store.sfxTracks()"
                  [keepOriginal]="keepOriginalAudio()"
                  [originalVolume]="originalVolume()"
                  [autoDuck]="autoDuck()"
                  [duration]="store.totalDuration()"
                  (toggleOriginal)="keepOriginalAudio.set(!keepOriginalAudio())"
                  (volumeChange)="originalVolume.set($event)"
                  (autoDuckChange)="autoDuck.set(!autoDuck())"
                  (uploadMusic)="onUploadMusic($event)"
                  (uploadSfx)="onUploadSfx($event)"
                  (removeTrack)="store.removeAudioTrack($event)"
                  (updateTrack)="onUpdateAudioTrack($event)">
                </app-audio-panel>
              </section>

              <section class="card">
                <h3 class="card-title">Ajuste de video</h3>
                <div class="fit-grid">
                  <button class="fit-btn" [class.active]="store.videoFitMode() === 'crop'" (click)="store.videoFitMode.set('crop')">
                    <svg class="fit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                    <span class="fit-label">Crop</span>
                    <span class="fit-sub">Llena 9:16</span>
                  </button>
                  <button class="fit-btn" [class.active]="store.videoFitMode() === 'fit-blur'" (click)="store.videoFitMode.set('fit-blur')">
                    <svg class="fit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2" opacity="0.3"/><rect x="5" y="5" width="14" height="14" rx="1"/></svg>
                    <span class="fit-label">Fit + Blur</span>
                    <span class="fit-sub">Fondo borroso</span>
                  </button>
                  <button class="fit-btn" [class.active]="store.videoFitMode() === 'fit-background'" (click)="store.videoFitMode.set('fit-background')">
                    <svg class="fit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2"/><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
                    <span class="fit-label">Fit + Color</span>
                    <span class="fit-sub">Color s&oacute;lido</span>
                  </button>
                </div>
                @if (store.videoFitMode() === 'fit-background') {
                  <div class="color-row">
                    <label class="color-label">Color de fondo</label>
                    <input type="color" [value]="store.videoFitBackgroundColor()" (input)="store.videoFitBackgroundColor.set($any($event.target).value)" class="color-input">
                  </div>
                }
              </section>

              <section class="card">
                <h3 class="card-title">Exportar</h3>
                <div class="export-list">
                  @for (preset of exportPresets(); track preset.id) {
                    <button
                      class="export-btn"
                      [class.active]="store.selectedExportPreset()?.id === preset.id"
                      (click)="store.setExportPreset(preset)">
                      <div class="export-top">
                        <span class="export-name">{{ preset.name }}</span>
                        <span class="export-specs">{{ preset.width }}&times;{{ preset.height }} &bull; {{ preset.fps }}fps &bull; CRF {{ preset.crf }}</span>
                      </div>
                      <span class="export-desc">{{ preset.description }}</span>
                      <span class="export-est">~{{ preset.estimatedSizePerSecond }}</span>
                    </button>
                  }
                </div>

                <label class="check-label">
                  <input type="checkbox" [checked]="store.showSafeZones()" (change)="store.showSafeZones.set(!store.showSafeZones())">
                  <span>Mostrar zonas seguras</span>
                </label>

                <div class="action-row">
                  <button class="btn-ghost" (click)="duplicateComposition()" [disabled]="!store.composition()">Duplicar</button>
                  <button class="btn-ghost" (click)="showSavePreset.set(true)" [disabled]="!store.composition()">Guardar preset</button>
                </div>

                @if (showSavePreset()) {
                  <div class="save-form">
                    <input [(ngModel)]="presetName" placeholder="Nombre del preset" class="text-field" (keydown.enter)="saveCompositionPreset()">
                    <div class="save-actions">
                      <button class="btn-primary btn-sm" (click)="saveCompositionPreset()" [disabled]="!presetName()">Guardar</button>
                      <button class="btn-ghost btn-sm" (click)="showSavePreset.set(false)">Cancelar</button>
                    </div>
                  </div>
                }

                <button
                  class="render-btn"
                  [disabled]="!store.canRender()"
                  (click)="startRender()">
                  @if (store.renderState() === 'rendering') {
                    <span class="render-spinner"></span>
                    Renderizando...
                  } @else {
                    Renderizar video
                  }
                </button>

                @if (store.renderState() === 'rendering') {
                  <div class="progress-track">
                    <div class="progress-fill" [style.width]="store.renderProgress() + '%'"></div>
                  </div>
                  <span class="progress-label">{{ store.renderProgress() }}%</span>
                  <button class="btn-danger" (click)="cancelRender()">Cancelar</button>
                }

                @if (store.renderResult(); as result) {
                  <div class="render-result">
                    @if (result.status === 'completed') {
                      <span class="result-success">Completado</span>
                      <div class="result-actions">
                        <a class="btn-primary" [href]="getDownloadUrl(result.id)" target="_blank">Descargar</a>
                        <button class="btn-ghost" (click)="reRender()">Renderizar de nuevo</button>
                      </div>
                    }
                    @if (result.status === 'failed') {
                      <span class="result-error">{{ result.error }}</span>
                    }
                    @if (result.status === 'cancelled') {
                      <span class="result-cancelled">Cancelado</span>
                    }
                  </div>
                }
              </section>

              @if (store.savedPresets().length > 0) {
                <section class="card">
                  <h3 class="card-title">Presets guardados</h3>
                  <div class="saved-list">
                    @for (preset of store.savedPresets(); track preset.id) {
                      <div class="saved-item">
                        <button class="saved-btn" (click)="applySavedPreset(preset)">{{ preset.name }}</button>
                        <button class="saved-remove" (click)="deleteSavedPreset(preset.id)">&times;</button>
                      </div>
                    }
                  </div>
                </section>
              }
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: var(--color-bg); }

    .studio { max-width: 1280px; margin: 0 auto; padding: 0 20px 80px; }

    .studio-header {
      padding: 40px 0 32px;
      border-bottom: 1px solid var(--color-border-subtle);
      margin-bottom: 32px;
    }
    .header-inner { max-width: 600px; }
    .studio-header h1 {
      font-size: 28px; font-weight: 700; color: var(--color-text-primary);
      margin: 0; letter-spacing: -0.03em; line-height: 1.1;
    }
    .tagline { font-size: 14px; color: var(--color-text-muted); margin: 6px 0 0; }

    .studio-grid {
      display: grid;
      grid-template-columns: 1fr 400px;
      gap: 28px;
      align-items: start;
    }

    .preview-column {
      position: sticky; top: 20px;
      display: flex; flex-direction: column; gap: 16px;
    }
    .preview-wrapper {
      border-radius: 12px; overflow: hidden;
      border: 1px solid var(--color-border-subtle);
      background: var(--color-surface);
    }
    .timeline-wrapper {
      border-radius: 12px; overflow: hidden;
      border: 1px solid var(--color-border-subtle);
      background: var(--color-surface);
      padding: 12px;
    }

    .upload-zone {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 480px; cursor: pointer;
      border: 2px dashed var(--color-border); border-radius: 12px;
      background: var(--color-surface);
      transition: all 0.2s ease;
    }
    .upload-zone:hover { border-color: var(--color-accent); background: var(--color-accent-glow); }
    .upload-icon { color: var(--color-text-muted); margin-bottom: 16px; transition: color 0.2s; }
    .upload-zone:hover .upload-icon { color: var(--color-accent); }
    .upload-title { font-size: 16px; font-weight: 600; color: var(--color-text-primary); margin: 0; }
    .upload-sub { font-size: 13px; color: var(--color-text-muted); margin: 4px 0 0; }

    .editor-column { min-width: 0; }
    .editor-scroll {
      display: flex; flex-direction: column; gap: 16px;
    }

    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border-subtle);
      border-radius: 12px;
      padding: 20px;
      transition: border-color 0.15s;
    }
    .card:hover { border-color: var(--color-border); }

    .card-title {
      font-size: 11px; font-weight: 700; color: var(--color-text-muted);
      text-transform: uppercase; letter-spacing: 0.08em;
      margin: 0 0 14px;
    }

    .preset-row { display: flex; flex-direction: column; gap: 8px; }
    .chip-btn {
      display: flex; flex-direction: column; align-items: flex-start;
      padding: 10px 14px; width: 100%;
      background: var(--color-bg); border: 1px solid var(--color-border);
      border-radius: 8px; cursor: pointer; text-align: left;
      transition: all 0.15s;
    }
    .chip-btn:hover { border-color: var(--color-accent); }
    .chip-label { font-size: 12px; font-weight: 600; color: var(--color-text-primary); }
    .chip-desc { font-size: 10px; color: var(--color-text-muted); margin-top: 2px; }

    .brand-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
    .brand-btn {
      padding: 8px 14px; font-size: 12px; font-weight: 500;
      background: var(--color-bg); border: 1px solid var(--color-border);
      border-radius: 6px; color: var(--color-text-secondary); cursor: pointer;
      transition: all 0.15s;
    }
    .brand-btn:hover { border-color: var(--color-accent); color: var(--color-text-primary); }
    .brand-btn.active {
      background: var(--color-accent); color: #fff; border-color: var(--color-accent);
      box-shadow: 0 0 16px var(--color-accent-glow);
    }
    .brand-preview {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; background: var(--color-bg);
      border-radius: 8px;
    }
    .brand-signature { font-family: Georgia, serif; font-style: italic; font-size: 15px; color: var(--color-text-primary); }
    .brand-badge {
      font-size: 10px; font-weight: 600; color: var(--color-text-muted);
      background: var(--color-surface); padding: 3px 8px; border-radius: 9999px;
    }
    .brand-empty { font-size: 13px; color: var(--color-text-muted); }

    .text-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
    .text-chip {
      padding: 5px 12px; font-size: 11px; font-weight: 500;
      background: var(--color-bg); border: 1px solid var(--color-border);
      border-radius: 9999px; color: var(--color-text-secondary); cursor: pointer;
      transition: all 0.15s;
    }
    .text-chip:hover { border-color: var(--color-accent); color: var(--color-text-primary); }
    .text-chip.active { background: var(--color-accent); color: #fff; border-color: var(--color-accent); }

    .text-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
    .text-item {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px; background: var(--color-bg);
      border: 1px solid transparent; border-radius: 6px;
      cursor: pointer; transition: all 0.15s;
    }
    .text-item:hover { border-color: var(--color-border); }
    .text-item.active { border-color: var(--color-accent); background: var(--color-accent-glow); }
    .text-item-content { flex: 1; min-width: 0; }
    .text-item-label {
      display: block; font-size: 12px; color: var(--color-text-primary);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .text-item-time { font-size: 10px; color: var(--color-text-muted); font-variant-numeric: tabular-nums; }
    .text-item-remove {
      background: none; border: none; color: var(--color-text-muted);
      font-size: 16px; padding: 2px 4px; border-radius: 4px; cursor: pointer;
      line-height: 1; transition: all 0.15s;
    }
    .text-item-remove:hover { color: var(--color-danger); background: var(--color-danger-bg); }

    .empty-hint { font-size: 12px; color: var(--color-text-muted); text-align: center; padding: 12px; }

    .text-add { display: flex; gap: 8px; }

    .text-field {
      flex: 1; padding: 9px 12px; font-size: 13px;
      background: var(--color-bg); border: 1px solid var(--color-border);
      border-radius: 6px; color: var(--color-text-primary);
      transition: border-color 0.15s;
    }
    .text-field:focus { border-color: var(--color-accent); outline: none; box-shadow: 0 0 0 3px var(--color-accent-glow); }

    .btn-primary {
      padding: 10px 18px; font-size: 13px; font-weight: 600;
      background: var(--color-accent); border: none; border-radius: 6px;
      color: #fff; cursor: pointer; transition: all 0.15s;
      text-decoration: none; display: inline-flex; align-items: center; justify-content: center;
    }
    .btn-primary:hover { background: var(--color-accent-hover); }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-sm { padding: 8px 14px; font-size: 12px; }

    .btn-ghost {
      padding: 8px 14px; font-size: 12px; font-weight: 500;
      background: var(--color-bg); border: 1px solid var(--color-border);
      border-radius: 6px; color: var(--color-text-secondary); cursor: pointer;
      transition: all 0.15s;
    }
    .btn-ghost:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-text-primary); }
    .btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

    .btn-danger {
      width: 100%; padding: 8px; font-size: 12px; font-weight: 500;
      background: none; border: 1px solid var(--color-danger);
      border-radius: 6px; color: var(--color-danger); cursor: pointer;
      transition: all 0.15s; margin-top: 8px;
    }
    .btn-danger:hover { background: var(--color-danger-bg); }

    .fit-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .fit-btn {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 12px 8px; background: var(--color-bg);
      border: 1px solid var(--color-border); border-radius: 8px;
      cursor: pointer; transition: all 0.15s;
    }
    .fit-btn:hover { border-color: var(--color-accent); }
    .fit-btn.active { border-color: var(--color-accent); background: var(--color-accent-glow); }
    .fit-icon { width: 24px; height: 24px; color: var(--color-text-secondary); }
    .fit-btn.active .fit-icon { color: var(--color-accent); }
    .fit-label { font-size: 11px; font-weight: 600; color: var(--color-text-primary); }
    .fit-sub { font-size: 9px; color: var(--color-text-muted); }

    .color-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
    .color-label { font-size: 12px; color: var(--color-text-secondary); }
    .color-input { width: 32px; height: 28px; border: 1px solid var(--color-border); border-radius: 4px; cursor: pointer; background: none; padding: 0; }

    .export-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
    .export-btn {
      display: flex; flex-direction: column; gap: 2px;
      padding: 12px 14px; background: var(--color-bg);
      border: 1px solid var(--color-border); border-radius: 8px;
      cursor: pointer; text-align: left; transition: all 0.15s;
    }
    .export-btn:hover { border-color: var(--color-accent); }
    .export-btn.active { border-color: var(--color-accent); background: var(--color-accent-glow); }
    .export-top { display: flex; justify-content: space-between; align-items: baseline; }
    .export-name { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
    .export-specs { font-size: 10px; color: var(--color-text-muted); font-variant-numeric: tabular-nums; }
    .export-desc { font-size: 11px; color: var(--color-text-muted); }
    .export-est { font-size: 10px; color: var(--color-text-muted); font-style: italic; }

    .check-label {
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; color: var(--color-text-secondary); cursor: pointer;
      margin-bottom: 12px;
    }
    .check-label input[type="checkbox"] { accent-color: var(--color-accent); width: 15px; height: 15px; }

    .action-row { display: flex; gap: 8px; margin-bottom: 14px; }
    .action-row .btn-ghost { flex: 1; }

    .save-form { margin-bottom: 14px; }
    .save-actions { display: flex; gap: 8px; margin-top: 8px; }

    .render-btn {
      width: 100%; padding: 14px; font-size: 14px; font-weight: 700;
      background: linear-gradient(135deg, var(--color-accent), #2563eb);
      border: none; border-radius: 8px; color: #fff;
      cursor: pointer; transition: all 0.2s;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      letter-spacing: 0.01em;
    }
    .render-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 20px var(--color-accent-glow); }
    .render-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
    .render-spinner {
      width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff; border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .progress-track {
      width: 100%; height: 4px; background: var(--color-bg);
      border-radius: 2px; margin-top: 12px; overflow: hidden;
    }
    .progress-fill {
      height: 100%; background: linear-gradient(90deg, var(--color-accent), #2563eb);
      border-radius: 2px; transition: width 0.3s ease;
    }
    .progress-label {
      display: block; text-align: center; font-size: 11px;
      color: var(--color-text-muted); margin-top: 4px;
      font-variant-numeric: tabular-nums;
    }

    .render-result { margin-top: 12px; text-align: center; }
    .result-success { color: var(--color-success); font-weight: 600; font-size: 13px; }
    .result-error { color: var(--color-danger); font-size: 12px; }
    .result-cancelled { color: var(--color-text-muted); font-size: 12px; }
    .result-actions { display: flex; gap: 8px; margin-top: 10px; }
    .result-actions .btn-primary, .result-actions .btn-ghost { flex: 1; text-align: center; }

    .saved-list { display: flex; flex-direction: column; gap: 6px; }
    .saved-item { display: flex; gap: 6px; }
    .saved-btn {
      flex: 1; padding: 8px 12px; text-align: left;
      background: var(--color-bg); border: 1px solid var(--color-border);
      border-radius: 6px; font-size: 12px; font-weight: 500;
      color: var(--color-text-secondary); cursor: pointer;
      transition: all 0.15s;
    }
    .saved-btn:hover { border-color: var(--color-accent); color: var(--color-text-primary); }
    .saved-remove {
      padding: 6px 10px; background: none;
      border: 1px solid var(--color-border); border-radius: 6px;
      color: var(--color-text-muted); font-size: 14px;
      cursor: pointer; line-height: 1; transition: all 0.15s;
    }
    .saved-remove:hover { border-color: var(--color-danger); color: var(--color-danger); }

    @media (max-width: 860px) {
      .studio-grid { grid-template-columns: 1fr; }
      .preview-column { position: static; }
      .upload-zone { min-height: 280px; }
      .editor-column { order: 2; }
    }

    @media (min-width: 861px) and (max-width: 1100px) {
      .studio-grid { grid-template-columns: 1fr 340px; gap: 20px; }
    }
  `],
})
export class StudioPageComponent {
  readonly store = inject(StudioStore);
  private readonly api = inject(StudioApiService);

  readonly presets = signal<BrandPreset[]>([]);
  readonly textPresets = signal<TextPreset[]>([]);
  readonly compositionPresets = signal<CompositionPreset[]>([]);
  readonly exportPresets = signal<ExportPreset[]>([]);
  readonly newText = signal('');
  readonly selectedTextPreset = signal<TextPreset | null>(null);
  readonly selectedOverlayId = signal<string | null>(null);
  readonly keepOriginalAudio = signal(true);
  readonly originalVolume = signal(1.0);
  readonly autoDuck = signal(false);
  readonly showSavePreset = signal(false);
  readonly presetName = signal('');

  readonly selectedOverlay = computed(() => {
    const id = this.selectedOverlayId();
    if (!id) return null;
    return this.store.textOverlays().find((o) => o.id === id) ?? null;
  });

  constructor() {
    this.api.getBrandPresets().subscribe({
      next: (res) => this.presets.set(res.presets),
    });
    this.api.getTextPresets().subscribe({
      next: (res) => this.textPresets.set(res.presets),
    });
    this.api.getCompositionPresets().subscribe({
      next: (res) => this.compositionPresets.set(res.presets),
    });
    this.api.getExportPresets().subscribe({
      next: (res) => {
        this.exportPresets.set(res.presets);
        const tiktok = res.presets.find((p) => p.id === 'tiktok-reels-shorts');
        if (tiktok) this.store.setExportPreset(tiktok);
      },
    });
    this.api.getSavedPresets().subscribe({
      next: (res) => this.store.setSavedPresets(res.presets),
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.uploadFile(input.files[0]);
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files.length) {
      this.uploadFile(event.dataTransfer.files[0]);
    }
  }

  uploadFile(file: File): void {
    const videoUrl = URL.createObjectURL(file);
    this.api.uploadSource(file).subscribe({
      next: (res) => this.store.setSource(res.asset, videoUrl),
    });
  }

  addText(): void {
    const text = this.newText();
    if (!text) return;

    const preset = this.selectedTextPreset();
    const duration = this.store.totalDuration();
    const overlay: TextOverlay = {
      id: crypto.randomUUID(),
      text,
      type: preset?.type ?? 'message',
      startTime: 0,
      endTime: Math.max(duration, 5),
      position: preset?.defaultPosition ?? 'center',
      style: preset?.defaultStyle ?? {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 48,
        fontWeight: 'bold',
        color: '#f6efe2',
        opacity: 1,
        textShadow: true,
        shadowColor: 'rgba(0, 0, 0, 0.8)',
      },
    };

    this.store.addTextOverlay(overlay);
    this.newText.set('');
    this.selectedTextPreset.set(null);
  }

  startRender(): void {
    const asset = this.store.sourceAsset();
    if (!asset) return;

    this.store.setRenderState('rendering');
    this.store.renderProgress.set(0);

    this.api.createComposition({
      sourceAssetId: asset.id,
      brandPresetId: this.store.selectedPreset()?.id,
      exportPresetId: this.store.selectedExportPreset()?.id,
      videoFit: this.store.videoFit(),
      textTracks: this.store.textOverlays(),
      audioTracks: this.store.audioTracks(),
      keepOriginalAudio: this.keepOriginalAudio(),
      originalAudioVolume: this.originalVolume(),
    }).subscribe({
      next: (res) => {
        this.store.setComposition(res.composition);
        this.api.startRender(res.composition.id).subscribe({
          next: (renderRes) => {
            this.store.setRenderResult(renderRes.render);
            this.subscribeToProgress(renderRes.render.id);
          },
          error: () => this.store.setRenderState('error'),
        });
      },
      error: () => this.store.setRenderState('error'),
    });
  }

  cancelRender(): void {
    const result = this.store.renderResult();
    if (!result?.id) return;
    this.api.cancelRender(result.id).subscribe({
      next: () => {
        this.store.setRenderResult({ ...result, status: 'cancelled' });
        this.store.setRenderState('idle');
      },
    });
  }

  reRender(): void {
    this.store.setRenderState('idle');
    this.store.renderResult.set(null);
    this.startRender();
  }

  private subscribeToProgress(renderId: string): void {
    const eventSource = new EventSource(this.api.getProgressUrl(renderId));
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.percent !== undefined) {
          this.store.renderProgress.set(data.percent);
        }
        if (data.phase === 'completed') {
          this.store.setRenderState('success');
          eventSource.close();
          this.pollRender(renderId);
        } else if (data.phase === 'failed') {
          this.store.setRenderState('error');
          eventSource.close();
        }
      } catch {
        // ignore parse errors
      }
    };
    eventSource.onerror = () => {
      eventSource.close();
      this.pollRender(renderId);
    };
  }

  private pollRender(renderId: string): void {
    const poll = setInterval(() => {
      this.api.getRenderStatus(renderId).subscribe({
        next: (res) => {
          if (res.render.status === 'completed' || res.render.status === 'failed') {
            clearInterval(poll);
            this.store.setRenderResult(res.render);
            this.store.setRenderState(res.render.status === 'completed' ? 'success' : 'error');
          }
        },
      });
    }, 2000);
  }

  getDownloadUrl(renderId: string): string {
    return this.api.getDownloadUrl(renderId);
  }

  onSeekTimeline(time: number): void {
    this.store.currentTime.set(time);
  }

  onSegmentUpdate(event: { id: string; start: number; end: number }): void {
    this.store.updateTextOverlay(event.id, { startTime: event.start, endTime: event.end });
  }

  applyCompositionPreset(preset: CompositionPreset): void {
    const duration = this.store.totalDuration();
    if (!duration) return;

    const overlays: TextOverlay[] = preset.slots.map((slot) => {
      const textPreset = this.textPresets().find((p) => p.id === slot.textPresetId);
      return {
        id: crypto.randomUUID(),
        text: slot.text ?? slot.label,
        type: (textPreset?.type ?? 'message') as TextOverlay['type'],
        startTime: slot.relativeStart * duration,
        endTime: slot.relativeEnd * duration,
        position: slot.position,
        style: textPreset?.defaultStyle ?? {
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: 48,
          color: '#f6efe2',
          opacity: 1,
        },
      };
    });

    this.store.setTextOverlays(overlays);
    this.selectedOverlayId.set(null);

    if (preset.brandPresetId) {
      const brand = this.presets().find((p) => p.id === preset.brandPresetId);
      if (brand) this.store.setPreset(brand);
    }
  }

  onOverlayUpdate(event: { id: string; changes: Partial<TextOverlay> }): void {
    this.store.updateTextOverlay(event.id, event.changes);
  }

  onOverlayDuplicate(id: string): void {
    const ov = this.store.textOverlays().find((o) => o.id === id);
    if (!ov) return;
    const duplicate: TextOverlay = {
      ...ov,
      id: crypto.randomUUID(),
      text: ov.text + ' (copia)',
    };
    this.store.addTextOverlay(duplicate);
  }

  onOverlayRemove(id: string): void {
    this.store.removeTextOverlay(id);
    if (this.selectedOverlayId() === id) this.selectedOverlayId.set(null);
  }

  onUploadMusic(file: File): void {
    const formData = new FormData();
    formData.append('file', file);
    this.api.uploadAudio(formData).subscribe({
      next: (res) => {
        this.store.addAudioTrack({
          id: crypto.randomUUID(),
          assetId: res.asset.id,
          fileName: file.name,
          startTime: 0,
          volume: 0.35,
        });
      },
    });
  }

  onUploadSfx(file: File): void {
    const formData = new FormData();
    formData.append('file', file);
    this.api.uploadAudio(formData).subscribe({
      next: (res) => {
        this.store.addAudioTrack({
          id: `sfx-${crypto.randomUUID()}`,
          assetId: res.asset.id,
          fileName: file.name,
          startTime: 0,
          volume: 0.5,
        });
      },
    });
  }

  onUpdateAudioTrack(event: { id: string; changes: Partial<AudioTrack> }): void {
    this.store.updateAudioTrack(event.id, event.changes);
  }

  duplicateComposition(): void {
    const composition = this.store.composition();
    if (!composition) return;

    this.api.duplicateComposition(composition.id).subscribe({
      next: (res) => {
        this.store.setComposition(res.composition);
      },
    });
  }

  saveCompositionPreset(): void {
    const composition = this.store.composition();
    const name = this.presetName();
    if (!composition || !name) return;

    this.api.saveCompositionPreset(name, composition.id).subscribe({
      next: (res) => {
        this.store.addSavedPreset(res.preset);
        this.showSavePreset.set(false);
        this.presetName.set('');
      },
    });
  }

  applySavedPreset(preset: SavedCompositionPreset): void {
    this.store.applySavedPreset(preset);
  }

  deleteSavedPreset(presetId: string): void {
    this.api.deleteSavedPreset(presetId).subscribe({
      next: () => this.store.removeSavedPreset(presetId),
    });
  }
}
