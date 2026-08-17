import { Component, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudioStore } from './state/studio.store';
import { StudioApiService } from './services/studio-api.service';
import { VideoPreviewComponent } from './video-preview.component';
import { TimelineComponent } from './timeline.component';
import { OverlayEditorComponent } from './overlay-editor.component';
import { AudioPanelComponent } from './audio-panel.component';
import type { BrandPreset, TextPreset, CompositionPreset, TextOverlay, AudioTrack, SavedCompositionPreset, ExportPreset, VideoFitMode } from '@social-downloader/contracts';
import type { NormalizedPosition } from './editor/position';

@Component({
  selector: 'app-studio-page',
  standalone: true,
  imports: [CommonModule, FormsModule, VideoPreviewComponent, TimelineComponent, OverlayEditorComponent, AudioPanelComponent],
  template: `
    <div class="studio">
      <header class="studio-topbar">
        <div class="topbar-left">
          <h1 class="topbar-logo">Studio</h1>
          <span class="topbar-tagline">Contenido visual para redes sociales</span>
        </div>
        <div class="topbar-center">
          @if (store.sourceVideoUrl()) {
            <div class="preset-selector">
              @for (preset of compositionPresets(); track preset.id) {
                <button class="topbar-chip" [class.active]="activeCompPresetId() === preset.id" (click)="applyCompositionPreset(preset)">
                  {{ preset.name }}
                </button>
              }
            </div>
          }
        </div>
        <div class="topbar-right">
          @if (store.sourceVideoUrl()) {
            <button class="btn-ghost btn-sm" (click)="showSavePreset.set(true)">Guardar preset</button>
          }
          <button class="render-btn-top" [disabled]="!store.canRender()" (click)="startRender()">
            @if (store.renderState() === 'rendering') {
              <span class="render-spinner"></span>
            }
            Renderizar
          </button>
        </div>
      </header>

      <main class="studio-workspace">
        @if (showRecoveredBanner()) {
          <div class="recovery-banner">
            <span>Se recuper&oacute; tu composici&oacute;n anterior</span>
            <button class="banner-close" (click)="showRecoveredBanner.set(false)">&times;</button>
          </div>
        }

        @if (warningCount() > 0) {
          <div class="warnings-bar">
            <span class="warnings-icon">!</span>
            <span>{{ warningCount() }} advertencia{{ warningCount() > 1 ? 's' : '' }}{{ errorCount() > 0 ? ' (' + errorCount() + ' error' + (errorCount() > 1 ? 'es' : '') + ')' : '' }}</span>
            <div class="warnings-list">
              @for (w of store.validationWarnings(); track w.id) {
                <div class="warning-item" [class]="'severity-' + w.severity">
                  <span class="warning-type">{{ w.type }}</span>
                  <span class="warning-msg">{{ w.message }}</span>
                </div>
              }
            </div>
          </div>
        }

        <div class="workspace-grid">
          <aside class="elements-panel">
            <div class="panel-header">
              <h3 class="panel-title">Elementos</h3>
            </div>
            <div class="panel-body">
              @if (store.sourceVideoUrl()) {
                <div class="layer-item" [class.active]="selectedLayerType() === 'source'" (click)="selectLayer('source')">
                  <span class="layer-icon">&#9654;</span>
                  <span class="layer-name">Video Source</span>
                </div>
              }
              @for (overlay of store.textOverlays(); track overlay.id) {
                <div class="layer-item" [class.active]="selectedOverlayId() === overlay.id" (click)="selectedOverlayId.set(overlay.id); selectedLayerType.set(null)">
                  <span class="layer-icon">T</span>
                  <span class="layer-name">{{ overlay.text | slice:0:20 }}{{ overlay.text.length > 20 ? '...' : '' }}</span>
                  <button class="layer-remove" (click)="$event.stopPropagation(); onOverlayRemove(overlay.id)">&times;</button>
                </div>
              }
              @if (store.sourceVideoUrl()) {
                <div class="layer-item" [class.active]="selectedLayerType() === 'brand'" (click)="selectLayer('brand')">
                  <span class="layer-icon">@</span>
                  <span class="layer-name">{{ store.selectedPreset() ? '@Ilusiones&Colores' : 'Marca' }}</span>
                </div>
              }
              @if (!store.sourceVideoUrl()) {
                <div class="empty-hint">Sube un video para comenzar</div>
              }
            </div>
          </aside>

          <section class="canvas-area">
            <div class="preview-wrapper">
              @if (store.sourceVideoUrl(); as videoUrl) {
                <app-video-preview
                  [src]="videoUrl"
                  [textOverlays]="store.textOverlays()"
                  [brandOverlays]="store.brandOverlays()"
                  [duration]="store.totalDuration()"
                  [showSafeZones]="store.showSafeZones()"
                  [selectedOverlayId]="selectedOverlayId()"
                  (timeChange)="store.currentTime.set($event)"
                  (overlaySelect)="onOverlaySelect($event)"
                  (overlayPositionChange)="onOverlayPositionChange($event)">
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
          </section>

          <aside class="properties-panel">
            <div class="panel-header">
              <h3 class="panel-title">{{ propertiesTitle() }}</h3>
            </div>
            <div class="panel-body">
              @if (selectedLayerType() === 'source' && store.sourceVideoUrl()) {
                <div class="prop-section">
                  <h4 class="prop-label">Ajuste de video</h4>
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
                </div>
                <div class="prop-section">
                  <h4 class="prop-label">Audio original</h4>
                  <label class="check-label">
                    <input type="checkbox" [checked]="keepOriginalAudio()" (change)="keepOriginalAudio.set(!keepOriginalAudio())">
                    <span>Activar audio original</span>
                  </label>
                  @if (keepOriginalAudio()) {
                    <div class="volume-row">
                      <span class="volume-label">Volumen</span>
                      <input type="range" class="volume-slider" min="0" max="1" step="0.05" [value]="originalVolume()" (input)="originalVolume.set(+$any($event.target).value)">
                      <span class="volume-value">{{ (originalVolume() * 100) | number:'1.0-0' }}%</span>
                    </div>
                  }
                </div>
              } @else if (selectedOverlay()) {
                <app-overlay-editor
                  [overlay]="selectedOverlay()!"
                  (overlayUpdate)="onOverlayUpdate($event)"
                  (duplicate)="onOverlayDuplicate($event)"
                  (remove)="onOverlayRemove($event)">
                </app-overlay-editor>
              } @else if (selectedLayerType() === 'brand') {
                <div class="prop-section">
                  <h4 class="prop-label">Marca</h4>
                  <div class="brand-preview">
                    <span class="brand-signature">@Ilusiones&Colores</span>
                    <span class="brand-badge">{{ store.selectedPreset()?.signature?.defaultMode }}</span>
                  </div>
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
                </div>
                <div class="prop-section">
                  <h4 class="prop-label">M&uacute;sica</h4>
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
                </div>
              } @else if (!store.sourceVideoUrl()) {
                <div class="empty-hint">Selecciona un elemento para editar</div>
              } @else {
                <div class="prop-section">
                  <h4 class="prop-label">Exportar</h4>
                  <div class="export-list">
                    @for (preset of exportPresets(); track preset.id) {
                      <button
                        class="export-btn"
                        [class.active]="store.selectedExportPreset()?.id === preset.id"
                        (click)="store.setExportPreset(preset)">
                        <div class="export-top">
                          <span class="export-name">{{ preset.name }}</span>
                          <span class="export-specs">{{ preset.width }}&times;{{ preset.height }} &bull; {{ preset.fps }}fps</span>
                        </div>
                        <span class="export-desc">{{ preset.description }}</span>
                      </button>
                    }
                  </div>
                  <label class="check-label">
                    <input type="checkbox" [checked]="store.showSafeZones()" (change)="store.showSafeZones.set(!store.showSafeZones())">
                    <span>Mostrar zonas seguras</span>
                  </label>
                </div>
                <div class="prop-section">
                  <h4 class="prop-label">Agregar texto</h4>
                  <div class="text-chips">
                    @for (preset of textPresets(); track preset.id) {
                      <button class="text-chip" [class.active]="selectedTextPreset()?.id === preset.id" (click)="selectedTextPreset.set(selectedTextPreset()?.id === preset.id ? null : preset)">
                        {{ preset.name }}
                      </button>
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
                </div>
                @if (store.savedPresets().length > 0) {
                  <div class="prop-section">
                    <h4 class="prop-label">Presets guardados</h4>
                    <div class="saved-list">
                      @for (preset of store.savedPresets(); track preset.id) {
                        <div class="saved-item">
                          <button class="saved-btn" (click)="applySavedPreset(preset)">{{ preset.name }}</button>
                          <button class="saved-remove" (click)="deleteSavedPreset(preset.id)">&times;</button>
                        </div>
                      }
                    </div>
                  </div>
                }
              }

              @if (store.renderState() !== 'idle') {
                <div class="render-section">
                  @if (store.renderState() === 'rendering') {
                    <div class="progress-track">
                      <div class="progress-fill" [style.width]="store.renderProgress() + '%'"></div>
                    </div>
                    <span class="progress-label">{{ store.renderProgress() }}%</span>
                    <button class="btn-danger" (click)="cancelRender()">Cancelar</button>
                  }
                  @if (store.renderState() === 'success') {
                    <div class="render-result">
                      <p class="result-success">Completado</p>
                      <div class="result-actions">
                        <a class="btn-primary btn-sm download-btn" [href]="downloadUrl()" target="_blank">Descargar</a>
                        <button class="btn-ghost btn-sm" (click)="reRender()">Renderizar de nuevo</button>
                      </div>
                    </div>
                  }
                  @if (store.renderState() === 'error') {
                    <div class="render-result">
                      <p class="result-error">{{ store.renderResult()?.error ?? 'Error desconocido' }}</p>
                      <button class="btn-ghost btn-sm" (click)="store.setRenderState('idle')">Reintentar</button>
                    </div>
                  }
                  @if (store.renderState() === 'cancelled') {
                    <div class="render-result">
                      <p class="result-cancelled">Renderizado cancelado</p>
                      <button class="btn-ghost btn-sm" (click)="store.setRenderState('idle')">Cerrar</button>
                    </div>
                  }
                </div>
              }
            </div>
          </aside>
        </div>
      </main>

      @if (showSavePreset()) {
        <div class="modal-backdrop" (click)="showSavePreset.set(false)">
          <div class="save-form" (click)="$event.stopPropagation()">
            <h4 class="save-form-title">Guardar preset de composici&oacute;n</h4>
            <input
              [(ngModel)]="presetName"
              placeholder="Nombre del preset"
              class="text-field"
              (keydown.enter)="saveCompositionPreset()">
            <div class="save-form-actions">
              <button class="btn-ghost btn-sm" (click)="showSavePreset.set(false)">Cancelar</button>
              <button class="btn-primary btn-sm" (click)="saveCompositionPreset()" [disabled]="!presetName()">Guardar</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; height: 100vh; background: var(--color-bg); overflow: hidden; }

    .studio {
      display: flex; flex-direction: column; height: 100vh;
    }

    .studio-topbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 20px; height: 56px; flex-shrink: 0;
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-border-subtle);
    }
    .topbar-left { display: flex; align-items: baseline; gap: 12px; }
    .topbar-logo {
      font-size: 18px; font-weight: 700; color: var(--color-text-primary);
      margin: 0; letter-spacing: -0.03em;
    }
    .topbar-tagline { font-size: 12px; color: var(--color-text-muted); }
    .topbar-center { flex: 1; display: flex; justify-content: center; }
    .preset-selector { display: flex; gap: 4px; }
    .topbar-chip {
      padding: 5px 12px; font-size: 11px; font-weight: 500;
      background: var(--color-bg); border: 1px solid var(--color-border);
      border-radius: 6px; color: var(--color-text-secondary); cursor: pointer;
      transition: all 0.15s;
    }
    .topbar-chip:hover { border-color: var(--color-accent); color: var(--color-text-primary); }
    .topbar-chip.active {
      background: var(--color-accent); color: #fff; border-color: var(--color-accent);
    }
    .topbar-right { display: flex; align-items: center; gap: 8px; }
    .render-btn-top {
      padding: 7px 16px; font-size: 12px; font-weight: 600;
      background: linear-gradient(135deg, var(--color-accent), #2563eb);
      border: none; border-radius: 6px; color: #fff;
      cursor: pointer; transition: all 0.15s;
      display: flex; align-items: center; gap: 6px;
    }
    .render-btn-top:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 2px 12px var(--color-accent-glow); }
    .render-btn-top:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

    .studio-workspace {
      flex: 1; display: flex; flex-direction: column; min-height: 0;
      overflow: hidden;
    }

    .recovery-banner {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 16px; margin: 0 20px;
      background: var(--color-accent-glow); border: 1px solid var(--color-accent);
      border-radius: 8px; font-size: 12px; color: var(--color-text-primary);
      animation: fadeSlideIn 0.3s ease; flex-shrink: 0;
    }
    @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
    .banner-close {
      background: none; border: none; font-size: 18px;
      color: var(--color-text-muted); cursor: pointer; padding: 0 4px;
    }

    .warnings-bar {
      position: relative;
      display: flex; align-items: center; gap: 8px;
      padding: 8px 14px; margin: 8px 20px 0;
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: 8px; font-size: 11px; color: var(--color-text-secondary);
      cursor: pointer; flex-shrink: 0;
    }
    .warnings-bar:hover .warnings-list { display: block; }
    .warnings-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 18px; height: 18px; border-radius: 50%;
      background: #f59e0b; color: #fff; font-size: 10px; font-weight: 700;
    }
    .warnings-list {
      display: none; position: absolute; top: 100%; left: 0; right: 0;
      z-index: 10; background: var(--color-surface);
      border: 1px solid var(--color-border); border-radius: 8px;
      padding: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      max-height: 240px; overflow-y: auto;
    }
    .warning-item {
      display: flex; gap: 8px; padding: 6px 8px;
      border-radius: 4px; font-size: 11px; line-height: 1.4;
    }
    .warning-item.severity-error { background: rgba(239,68,68,0.08); }
    .warning-item.severity-warning { background: rgba(245,158,11,0.08); }
    .warning-item.severity-info { background: rgba(59,130,246,0.06); }
    .warning-type {
      font-size: 9px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.05em; min-width: 50px; padding-top: 1px;
    }
    .severity-error .warning-type { color: var(--color-danger); }
    .severity-warning .warning-type { color: #f59e0b; }
    .severity-info .warning-type { color: #3b82f6; }
    .warning-msg { color: var(--color-text-secondary); }

    .workspace-grid {
      flex: 1; display: grid;
      grid-template-columns: 220px 1fr 320px;
      min-height: 0; overflow: hidden;
    }

    .elements-panel, .properties-panel {
      display: flex; flex-direction: column;
      border-right: 1px solid var(--color-border-subtle);
      background: var(--color-surface);
      min-height: 0; overflow: hidden;
    }
    .properties-panel {
      border-right: none;
      border-left: 1px solid var(--color-border-subtle);
    }
    .panel-header {
      padding: 14px 16px 10px;
      border-bottom: 1px solid var(--color-border-subtle);
      flex-shrink: 0;
    }
    .panel-title {
      font-size: 10px; font-weight: 700; color: var(--color-text-muted);
      text-transform: uppercase; letter-spacing: 0.08em;
      margin: 0;
    }
    .panel-body {
      flex: 1; overflow-y: auto; padding: 12px 16px;
      scrollbar-width: thin;
    }
    .panel-body::-webkit-scrollbar { width: 4px; }
    .panel-body::-webkit-scrollbar-track { background: transparent; }
    .panel-body::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 2px; }

    .layer-item {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px; border-radius: 6px;
      cursor: pointer; transition: all 0.15s;
      margin-bottom: 2px;
    }
    .layer-item:hover { background: var(--color-bg); }
    .layer-item.active { background: var(--color-accent-glow); border: 1px solid var(--color-accent); }
    .layer-icon {
      width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; color: var(--color-text-muted);
      background: var(--color-bg); border-radius: 4px; flex-shrink: 0;
    }
    .layer-item.active .layer-icon { background: var(--color-accent); color: #fff; }
    .layer-name {
      flex: 1; font-size: 12px; color: var(--color-text-primary);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .layer-remove {
      background: none; border: none; color: var(--color-text-muted);
      font-size: 14px; padding: 2px 4px; border-radius: 4px;
      cursor: pointer; line-height: 1; opacity: 0; transition: all 0.15s;
    }
    .layer-item:hover .layer-remove { opacity: 1; }
    .layer-remove:hover { color: var(--color-danger); }

    .canvas-area {
      display: flex; flex-direction: column; gap: 12px;
      padding: 16px; min-height: 0; overflow: hidden;
      background: var(--color-bg);
    }
    .preview-wrapper {
      flex: 1; border-radius: 12px; overflow: hidden;
      border: 1px solid var(--color-border-subtle);
      background: var(--color-surface);
      min-height: 0;
    }
    .timeline-wrapper {
      border-radius: 12px; overflow: hidden;
      border: 1px solid var(--color-border-subtle);
      background: var(--color-surface);
      padding: 12px; flex-shrink: 0;
    }

    .upload-zone {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 100%; min-height: 400px; cursor: pointer;
      border: 2px dashed var(--color-border); border-radius: 12px;
      background: var(--color-surface);
      transition: all 0.2s ease;
    }
    .upload-zone:hover { border-color: var(--color-accent); background: var(--color-accent-glow); }
    .upload-icon { color: var(--color-text-muted); margin-bottom: 16px; transition: color 0.2s; }
    .upload-zone:hover .upload-icon { color: var(--color-accent); }
    .upload-title { font-size: 16px; font-weight: 600; color: var(--color-text-primary); margin: 0; }
    .upload-sub { font-size: 13px; color: var(--color-text-muted); margin: 4px 0 0; }

    .prop-section { margin-bottom: 16px; }
    .prop-section:last-child { margin-bottom: 0; }
    .prop-label {
      font-size: 10px; font-weight: 700; color: var(--color-text-muted);
      text-transform: uppercase; letter-spacing: 0.06em;
      margin: 0 0 8px;
    }

    .brand-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
    .brand-btn {
      padding: 6px 12px; font-size: 11px; font-weight: 500;
      background: var(--color-bg); border: 1px solid var(--color-border);
      border-radius: 6px; color: var(--color-text-secondary); cursor: pointer;
      transition: all 0.15s;
    }
    .brand-btn:hover { border-color: var(--color-accent); color: var(--color-text-primary); }
    .brand-btn.active {
      background: var(--color-accent); color: #fff; border-color: var(--color-accent);
    }
    .brand-preview {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 12px; background: var(--color-bg);
      border-radius: 8px;
    }
    .brand-signature { font-family: Georgia, serif; font-style: italic; font-size: 14px; color: var(--color-text-primary); }
    .brand-badge {
      font-size: 10px; font-weight: 600; color: var(--color-text-muted);
      background: var(--color-surface); padding: 2px 6px; border-radius: 9999px;
    }

    .text-chips { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 10px; }
    .text-chip {
      padding: 4px 10px; font-size: 10px; font-weight: 500;
      background: var(--color-bg); border: 1px solid var(--color-border);
      border-radius: 9999px; color: var(--color-text-secondary); cursor: pointer;
      transition: all 0.15s;
    }
    .text-chip:hover { border-color: var(--color-accent); color: var(--color-text-primary); }
    .text-chip.active { background: var(--color-accent); color: #fff; border-color: var(--color-accent); }

    .text-add { display: flex; gap: 6px; }

    .text-field {
      flex: 1; padding: 8px 10px; font-size: 12px;
      background: var(--color-bg); border: 1px solid var(--color-border);
      border-radius: 6px; color: var(--color-text-primary);
      transition: border-color 0.15s;
    }
    .text-field:focus { border-color: var(--color-accent); outline: none; box-shadow: 0 0 0 2px var(--color-accent-glow); }

    .btn-primary {
      padding: 8px 14px; font-size: 12px; font-weight: 600;
      background: var(--color-accent); border: none; border-radius: 6px;
      color: #fff; cursor: pointer; transition: all 0.15s;
      text-decoration: none; display: inline-flex; align-items: center; justify-content: center;
    }
    .btn-primary:hover { background: var(--color-accent-hover); }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-sm { padding: 6px 12px; font-size: 11px; }

    .btn-ghost {
      padding: 6px 12px; font-size: 11px; font-weight: 500;
      background: var(--color-bg); border: 1px solid var(--color-border);
      border-radius: 6px; color: var(--color-text-secondary); cursor: pointer;
      transition: all 0.15s;
    }
    .btn-ghost:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-text-primary); }
    .btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

    .btn-danger {
      width: 100%; padding: 7px; font-size: 11px; font-weight: 500;
      background: none; border: 1px solid var(--color-danger);
      border-radius: 6px; color: var(--color-danger); cursor: pointer;
      transition: all 0.15s; margin-top: 6px;
    }
    .btn-danger:hover { background: var(--color-danger-bg); }

    .fit-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .fit-btn {
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      padding: 10px 6px; background: var(--color-bg);
      border: 1px solid var(--color-border); border-radius: 8px;
      cursor: pointer; transition: all 0.15s;
    }
    .fit-btn:hover { border-color: var(--color-accent); }
    .fit-btn.active { border-color: var(--color-accent); background: var(--color-accent-glow); }
    .fit-icon { width: 20px; height: 20px; color: var(--color-text-secondary); }
    .fit-btn.active .fit-icon { color: var(--color-accent); }
    .fit-label { font-size: 10px; font-weight: 600; color: var(--color-text-primary); }
    .fit-sub { font-size: 8px; color: var(--color-text-muted); }

    .color-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
    .color-label { font-size: 11px; color: var(--color-text-secondary); }
    .color-input { width: 28px; height: 24px; border: 1px solid var(--color-border); border-radius: 4px; cursor: pointer; background: none; padding: 0; }

    .volume-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
    .volume-label { font-size: 11px; color: var(--color-text-secondary); }
    .volume-slider { flex: 1; accent-color: var(--color-accent); }
    .volume-value { font-size: 11px; color: var(--color-text-muted); font-variant-numeric: tabular-nums; min-width: 32px; }

    .export-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
    .export-btn {
      display: flex; flex-direction: column; gap: 2px;
      padding: 10px 12px; background: var(--color-bg);
      border: 1px solid var(--color-border); border-radius: 8px;
      cursor: pointer; text-align: left; transition: all 0.15s;
    }
    .export-btn:hover { border-color: var(--color-accent); }
    .export-btn.active { border-color: var(--color-accent); background: var(--color-accent-glow); }
    .export-top { display: flex; justify-content: space-between; align-items: baseline; }
    .export-name { font-size: 12px; font-weight: 600; color: var(--color-text-primary); }
    .export-specs { font-size: 10px; color: var(--color-text-muted); font-variant-numeric: tabular-nums; }
    .export-desc { font-size: 10px; color: var(--color-text-muted); }

    .check-label {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; color: var(--color-text-secondary); cursor: pointer;
      margin-bottom: 10px;
    }
    .check-label input[type="checkbox"] { accent-color: var(--color-accent); width: 14px; height: 14px; }

    .render-section { margin-top: 12px; }
    .progress-track {
      width: 100%; height: 4px; background: var(--color-bg);
      border-radius: 2px; overflow: hidden;
    }
    .progress-fill {
      height: 100%; background: linear-gradient(90deg, var(--color-accent), #2563eb);
      border-radius: 2px; transition: width 0.3s ease;
    }
    .progress-label {
      display: block; text-align: center; font-size: 10px;
      color: var(--color-text-muted); margin-top: 4px;
      font-variant-numeric: tabular-nums;
    }

    .render-result { margin-top: 10px; text-align: center; }
    .result-success { color: var(--color-success); font-weight: 600; font-size: 12px; }
    .result-error { color: var(--color-danger); font-size: 11px; }
    .result-cancelled { color: var(--color-text-muted); font-size: 11px; }
    .result-actions { display: flex; gap: 6px; margin-top: 8px; }
    .result-actions .btn-primary, .result-actions .btn-ghost { flex: 1; text-align: center; }

    .saved-list { display: flex; flex-direction: column; gap: 4px; }
    .saved-item { display: flex; gap: 4px; }
    .saved-btn {
      flex: 1; padding: 6px 10px; text-align: left;
      background: var(--color-bg); border: 1px solid var(--color-border);
      border-radius: 6px; font-size: 11px; font-weight: 500;
      color: var(--color-text-secondary); cursor: pointer;
      transition: all 0.15s;
    }
    .saved-btn:hover { border-color: var(--color-accent); color: var(--color-text-primary); }
    .saved-remove {
      padding: 4px 8px; background: none;
      border: 1px solid var(--color-border); border-radius: 6px;
      color: var(--color-text-muted); font-size: 12px;
      cursor: pointer; line-height: 1; transition: all 0.15s;
    }
    .saved-remove:hover { border-color: var(--color-danger); color: var(--color-danger); }

    .empty-hint { font-size: 11px; color: var(--color-text-muted); text-align: center; padding: 20px 8px; }

    .render-spinner {
      width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff; border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 1024px) {
      .workspace-grid { grid-template-columns: 1fr; }
      .elements-panel, .properties-panel { display: none; }
      .topbar-center { display: none; }
    }

    @media (min-width: 1025px) and (max-width: 1280px) {
      .workspace-grid { grid-template-columns: 180px 1fr 280px; }
    }

    .modal-backdrop {
      position: fixed; inset: 0; z-index: 300;
      background: rgba(0, 0, 0, 0.5);
      display: flex; align-items: center; justify-content: center;
      animation: fade-in 0.15s ease;
    }
    .save-form {
      width: 320px; padding: 20px;
      background: var(--color-surface); border: 1px solid var(--color-border-subtle);
      border-radius: var(--radius-lg); box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
      display: flex; flex-direction: column; gap: 12px;
    }
    .save-form-title { margin: 0; font-size: 13px; font-weight: 700; color: var(--color-text-primary); }
    .save-form-actions { display: flex; justify-content: flex-end; gap: 8px; }
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
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
  readonly showRecoveredBanner = signal(false);
  readonly selectedLayerType = signal<'source' | 'brand' | null>(null);

  readonly selectedOverlay = computed(() => {
    const id = this.selectedOverlayId();
    if (!id) return null;
    return this.store.textOverlays().find((o) => o.id === id) ?? null;
  });

  readonly warningCount = computed(() => this.store.validationWarnings().length);
  readonly errorCount = computed(() => this.store.validationWarnings().filter((w) => w.severity === 'error').length);

  readonly activeCompPresetId = computed(() => {
    const brandId = this.store.selectedPreset()?.id;
    return brandId ?? null;
  });

  readonly propertiesTitle = computed(() => {
    if (this.selectedLayerType() === 'source') return 'Video Source';
    if (this.selectedLayerType() === 'brand') return 'Marca';
    if (this.selectedOverlay()) return 'Editar texto';
    return 'Propiedades';
  });

  readonly downloadUrl = computed(() => {
    const result = this.store.renderResult();
    if (!result?.id) return '';
    return this.api.getDownloadUrl(result.id);
  });

  private validateTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const _overlays = this.store.textOverlays();
      const _audio = this.store.audioTracks();
      const _duration = this.store.totalDuration();
      const _brand = this.store.selectedPreset();

      if (this.validateTimer) clearTimeout(this.validateTimer);
      this.validateTimer = setTimeout(() => this.runValidation(), 500);
    });

    const autosaveData = this.store.loadFromLocalStorage();
    if (autosaveData && (autosaveData.textOverlays.length > 0 || autosaveData.audioTracks.length > 0)) {
      this.showRecoveredBanner.set(true);
      setTimeout(() => this.showRecoveredBanner.set(false), 5000);
    }

    this.api.getBrandPresets().subscribe({
      next: (res) => {
        this.presets.set(res.presets);
        if (autosaveData?.brandPresetId) {
          const brand = res.presets.find((p) => p.id === autosaveData.brandPresetId);
          if (brand) this.store.setPreset(brand);
        }
      },
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

  selectLayer(type: 'source' | 'brand'): void {
    this.selectedOverlayId.set(null);
    this.selectedLayerType.set(type);
  }

  onOverlaySelect(overlayId: string | null): void {
    this.selectedOverlayId.set(overlayId);
    const isBrand = overlayId !== null && this.store.brandOverlays().some((b) => b.id === overlayId);
    this.selectedLayerType.set(isBrand ? 'brand' : null);
  }

  onOverlayPositionChange(event: { id: string; type: 'text' | 'brand'; position: NormalizedPosition }): void {
    if (event.type === 'text') {
      this.store.updateTextOverlay(event.id, {
        position: 'custom',
        customPosition: event.position,
      });
    } else {
      this.store.updateBrandOverlayPosition(event.position);
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
      brandCustomPosition: this.store.brandCustomPosition() ?? undefined,
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
        this.store.setRenderState('cancelled');
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

  private runValidation(): void {
    const duration = this.store.totalDuration();
    if (!duration) {
      this.store.setValidationWarnings([]);
      return;
    }

    const composition = {
      id: 'temp-validation',
      source: { assetId: 'temp', fileName: 'temp', duration },
      output: { width: 1080, height: 1920, fps: 30, format: 'mp4' as const, videoCodec: 'h264' as const, audioCodec: 'aac' as const, crf: 23, preset: 'fast' as const, audioBitrate: '128k', audioSampleRate: 48000, audioChannels: 2, movflags: '+faststart' },
      overlays: this.store.brandOverlays(),
      textTracks: this.store.textOverlays(),
      audioTracks: this.store.audioTracks(),
      keepOriginalAudio: true,
      originalAudioVolume: 1.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.api.validateComposition(composition).subscribe({
      next: (res) => this.store.setValidationWarnings(res.warnings),
      error: () => this.store.setValidationWarnings([]),
    });
  }
}
