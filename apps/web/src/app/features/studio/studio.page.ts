import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudioStore } from './state/studio.store';
import { StudioApiService } from './services/studio-api.service';
import { VideoPreviewComponent } from './video-preview.component';
import { TimelineComponent } from './timeline.component';
import { OverlayEditorComponent } from './overlay-editor.component';
import { AudioPanelComponent } from './audio-panel.component';
import type { BrandPreset, TextPreset, CompositionPreset, TextOverlay, AudioTrack, SavedCompositionPreset } from '@social-downloader/contracts';

@Component({
  selector: 'app-studio-page',
  standalone: true,
  imports: [CommonModule, FormsModule, VideoPreviewComponent, TimelineComponent, OverlayEditorComponent, AudioPanelComponent],
  template: `
    <div class="studio-container">
      <header class="studio-header">
        <h1>Video Studio</h1>
        <p class="subtitle">Crea videos listos para redes sociales</p>
      </header>

      <div class="studio-layout">
        <div class="preview-panel">
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
            <div class="upload-area" (click)="fileInput.click()" (dragover)="$event.preventDefault()" (drop)="onDrop($event)">
              <div class="upload-icon">&#43;</div>
              <p>Sube un video o arrastra aquí</p>
              <p class="upload-hint">MP4, MOV, WebM</p>
            </div>
          }

          @if (store.sourceVideoUrl()) {
            <app-timeline
              [duration]="store.totalDuration()"
              [currentTime]="store.currentTime()"
              [textOverlays]="store.textOverlays()"
              [brandOverlays]="store.brandOverlays()"
              [audioTracks]="store.audioTracks()"
              (seekTo)="onSeekTimeline($event)"
              (segmentUpdate)="onSegmentUpdate($event)">
            </app-timeline>
          }
          <input #fileInput type="file" accept="video/*" (change)="onFileSelected($event)" hidden>
        </div>

        <div class="config-panel">
          <section class="panel-section">
            <h3>Flujo de composición</h3>
            <div class="preset-grid">
              @for (preset of compositionPresets(); track preset.id) {
                <button class="preset-btn composition-preset" (click)="applyCompositionPreset(preset)">
                  <span class="preset-name">{{ preset.name }}</span>
                  <span class="preset-desc">{{ preset.description }}</span>
                </button>
              }
            </div>
          </section>

          <section class="panel-section">
            <h3>Presets de marca</h3>
            <div class="preset-grid">
              <button
                *ngFor="let preset of presets()"
                class="preset-btn"
                [class.active]="store.selectedPreset()?.id === preset.id"
                (click)="store.setPreset(preset)">
                {{ preset.name }}
              </button>
            </div>
          </section>

          <section class="panel-section">
            <h3>Insignia</h3>
            <div class="brand-info" *ngIf="store.selectedPreset() as preset">
              <span class="brand-text">{{ preset.signature.text }}</span>
              <span class="brand-mode">Modo: {{ preset.signature.defaultMode }}</span>
            </div>
            <div class="brand-info" *ngIf="!store.selectedPreset()">
              <span class="brand-text placeholder">Selecciona un preset</span>
            </div>
          </section>

          <section class="panel-section">
            <h3>Textos</h3>
            <div class="preset-chips">
              @for (preset of textPresets(); track preset.id) {
                <button
                  class="preset-chip"
                  [class.active]="selectedTextPreset()?.id === preset.id"
                  (click)="selectedTextPreset.set(selectedTextPreset()?.id === preset.id ? null : preset)">
                  {{ preset.name }}
                </button>
              }
            </div>
            <div class="overlay-list">
              @for (overlay of store.textOverlays(); track overlay.id) {
                <div class="overlay-item" [class.active]="selectedOverlayId() === overlay.id" (click)="selectedOverlayId.set(overlay.id)">
                  <span class="overlay-text">{{ overlay.text }}</span>
                  <span class="overlay-time">{{ overlay.startTime | number:'1.1-1' }}s - {{ overlay.endTime | number:'1.1-1' }}s</span>
                </div>
              }
            </div>
            <div class="add-text-form">
              <input [(ngModel)]="newText" [placeholder]="selectedTextPreset()?.description ?? 'Escribe tu texto...'" class="text-input">
              <button class="add-btn" (click)="addText()" [disabled]="!newText()">Agregar</button>
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

          <section class="panel-section">
            <h3>Exportar</h3>
            <div class="export-info">
              <span>1080x1920 &bull; 9:16 &bull; MP4 &bull; H.264</span>
            </div>
            <label class="checkbox-label" style="margin-bottom: 14px;">
              <input type="checkbox" [checked]="store.showSafeZones()" (change)="store.showSafeZones.set(!store.showSafeZones())">
              Mostrar zonas seguras
            </label>
            <div class="export-actions">
              <button class="action-btn-sm" (click)="duplicateComposition()" [disabled]="!store.composition()">
                Duplicar
              </button>
              <button class="action-btn-sm" (click)="showSavePreset.set(true)" [disabled]="!store.composition()">
                Guardar como preset
              </button>
            </div>
            @if (showSavePreset()) {
              <div class="save-preset-form">
                <input [(ngModel)]="presetName" placeholder="Nombre del preset" class="text-input">
                <div class="save-preset-actions">
                  <button class="add-btn" (click)="saveCompositionPreset()" [disabled]="!presetName()">Guardar</button>
                  <button class="cancel-save-btn" (click)="showSavePreset.set(false)">Cancelar</button>
                </div>
              </div>
            }
            <button
              class="render-btn"
              [disabled]="!store.canRender()"
              (click)="startRender()">
              {{ store.renderState() === 'rendering' ? 'Renderizando...' : 'Renderizar video' }}
            </button>
            @if (store.renderState() === 'rendering') {
              <div class="progress-bar">
                <div class="progress-fill" [style.width]="store.renderProgress() + '%'"></div>
              </div>
              <span class="progress-text">{{ store.renderProgress() }}%</span>
              <button class="cancel-btn" (click)="cancelRender()">Cancelar render</button>
            }
            <div class="render-status" *ngIf="store.renderResult() as result">
              <span *ngIf="result.status === 'completed'" class="status-success">Completado</span>
              <span *ngIf="result.status === 'failed'" class="status-error">{{ result.error }}</span>
              <span *ngIf="result.status === 'cancelled'" class="status-cancelled">Cancelado</span>
              <div class="render-actions" *ngIf="result.status === 'completed' && result.id">
                <a class="download-btn" [href]="getDownloadUrl(result.id)" target="_blank">Descargar</a>
                <button class="action-btn" (click)="reRender()">Renderizar de nuevo</button>
              </div>
            </div>
          </section>

          @if (store.savedPresets().length > 0) {
            <section class="panel-section">
              <h3>Presets guardados</h3>
              <div class="saved-presets-list">
                @for (preset of store.savedPresets(); track preset.id) {
                  <div class="saved-preset-item">
                    <button class="saved-preset-btn" (click)="applySavedPreset(preset)">
                      {{ preset.name }}
                    </button>
                    <button class="delete-preset-btn" (click)="deleteSavedPreset(preset.id)">&times;</button>
                  </div>
                }
              </div>
            </section>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .studio-container { max-width: 1200px; margin: 0 auto; padding: 32px 20px 60px; }
    .studio-header { text-align: center; margin-bottom: 40px; }
    .studio-header h1 { font-size: 32px; font-weight: 700; color: var(--color-text-primary); margin: 0 0 8px; letter-spacing: -0.02em; }
    .subtitle { color: var(--color-text-secondary); font-size: 15px; margin: 0; }
    .studio-layout { display: grid; grid-template-columns: 1fr 380px; gap: 24px; align-items: start; }
    .preview-panel { border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--color-border-subtle); }
    .upload-area { text-align: center; padding: 120px 32px; cursor: pointer; border: 2px dashed var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface); transition: all var(--transition-normal); }
    .upload-area:hover { border-color: var(--color-accent); background: var(--color-accent-glow); }
    .upload-icon { font-size: 52px; color: var(--color-text-muted); margin-bottom: 16px; transition: color var(--transition-fast); }
    .upload-area:hover .upload-icon { color: var(--color-accent); }
    .upload-hint { color: var(--color-text-muted); font-size: 12px; margin-top: 10px; letter-spacing: 0.02em; }
    .preset-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
    .preset-chip {
      padding: 6px 12px; border: 1px solid var(--color-border); border-radius: 9999px;
      background: var(--color-bg); color: var(--color-text-secondary); cursor: pointer;
      font-size: 11px; font-weight: 500; transition: all var(--transition-fast);
    }
    .preset-chip:hover { border-color: var(--color-accent); color: var(--color-text-primary); }
    .preset-chip.active { background: var(--color-accent); color: #fff; border-color: var(--color-accent); }
    .composition-preset {
      display: flex; flex-direction: column; align-items: flex-start;
      padding: 10px 14px; text-align: left; width: 100%;
    }
    .preset-name { font-size: 12px; font-weight: 600; }
    .preset-desc { font-size: 10px; color: var(--color-text-muted); margin-top: 2px; }
    .overlay-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
    .overlay-item {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px; background: var(--color-bg); border-radius: 6px;
      cursor: pointer; border: 1px solid transparent;
      transition: all var(--transition-fast);
    }
    .overlay-item:hover { border-color: var(--color-border); }
    .overlay-item.active { border-color: var(--color-accent); background: var(--color-accent-glow); }
    .overlay-text { flex: 1; font-size: 12px; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .overlay-time { font-size: 10px; color: var(--color-text-muted); font-variant-numeric: tabular-nums; }
    .config-panel { display: flex; flex-direction: column; gap: 16px; }
    .panel-section { background: var(--color-surface); border-radius: var(--radius-lg); padding: 24px; border: 1px solid var(--color-border-subtle); transition: border-color var(--transition-fast); }
    .panel-section:hover { border-color: var(--color-border); }
    .panel-section h3 { font-size: 11px; font-weight: 700; color: var(--color-text-muted); margin: 0 0 14px; text-transform: uppercase; letter-spacing: 0.1em; }
    .preset-grid { display: flex; gap: 8px; flex-wrap: wrap; }
    .preset-btn { padding: 10px 18px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-bg); color: var(--color-text-secondary); cursor: pointer; font-size: 13px; font-weight: 500; transition: all var(--transition-fast); }
    .preset-btn:hover { border-color: var(--color-accent); color: var(--color-text-primary); }
    .preset-btn.active { background: var(--color-accent); color: #fff; border-color: var(--color-accent); box-shadow: 0 0 20px var(--color-accent-glow); }
    .brand-info { display: flex; align-items: center; gap: 12px; }
    .brand-text { font-family: Georgia, serif; font-style: italic; font-size: 17px; color: var(--color-text-primary); letter-spacing: 0.02em; }
    .brand-text.placeholder { color: var(--color-text-muted); font-style: normal; font-family: inherit; }
    .brand-mode { font-size: 11px; color: var(--color-text-muted); background: var(--color-bg); padding: 4px 10px; border-radius: 9999px; font-weight: 500; letter-spacing: 0.02em; }
    .overlay-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--color-bg); border-radius: var(--radius-sm); margin-bottom: 6px; border: 1px solid transparent; transition: border-color var(--transition-fast); }
    .overlay-item:hover { border-color: var(--color-border); }
    .overlay-text { flex: 1; font-size: 13px; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .overlay-time { font-size: 11px; color: var(--color-text-muted); font-variant-numeric: tabular-nums; }
    .remove-btn { background: none; border: none; color: var(--color-text-muted); cursor: pointer; font-size: 18px; padding: 2px 6px; border-radius: 4px; transition: all var(--transition-fast); line-height: 1; }
    .remove-btn:hover { color: var(--color-danger); background: var(--color-danger-bg); }
    .add-text-form { display: flex; gap: 8px; margin-top: 12px; }
    .text-input { flex: 1; padding: 10px 14px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-sm); color: var(--color-text-primary); font-size: 13px; transition: border-color var(--transition-fast); }
    .text-input:focus { border-color: var(--color-accent); outline: none; box-shadow: 0 0 0 3px var(--color-accent-glow); }
    .type-select { padding: 10px 12px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius-sm); color: var(--color-text-primary); font-size: 13px; cursor: pointer; }
    .add-btn { padding: 10px 18px; background: var(--color-accent); border: none; border-radius: var(--radius-sm); color: #fff; font-weight: 600; cursor: pointer; font-size: 13px; transition: all var(--transition-fast); }
    .add-btn:hover { background: var(--color-accent-hover); }
    .add-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .audio-controls { display: flex; flex-direction: column; gap: 14px; }
    .checkbox-label { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--color-text-primary); cursor: pointer; }
    .checkbox-label input[type="checkbox"] { accent-color: var(--color-accent); width: 16px; height: 16px; }
    .volume-control { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--color-text-secondary); }
    .volume-control input[type="range"] { flex: 1; accent-color: var(--color-accent); }
    .volume-control span { min-width: 36px; text-align: right; font-variant-numeric: tabular-nums; }
    .export-info { font-size: 12px; color: var(--color-text-muted); margin-bottom: 14px; text-align: center; letter-spacing: 0.03em; }
    .render-btn { width: 100%; padding: 16px; background: linear-gradient(135deg, var(--color-accent), #2563eb); border: none; border-radius: var(--radius-md); color: #fff; font-weight: 700; font-size: 15px; cursor: pointer; transition: all var(--transition-fast); letter-spacing: 0.01em; }
    .render-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 20px var(--color-accent-glow); }
    .render-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
    .render-status { margin-top: 14px; text-align: center; }
    .status-success { color: var(--color-success); font-weight: 600; font-size: 14px; }
    .status-error { color: var(--color-danger); font-size: 13px; }
    .download-btn { display: inline-block; margin-top: 10px; padding: 12px 28px; background: var(--color-accent); color: #fff; text-decoration: none; border-radius: var(--radius-sm); font-weight: 600; font-size: 14px; transition: all var(--transition-fast); }
    .download-btn:hover { background: var(--color-accent-hover); transform: translateY(-1px); }
    .progress-bar { width: 100%; height: 6px; background: var(--color-bg); border-radius: 3px; margin-top: 12px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, var(--color-accent), #2563eb); border-radius: 3px; transition: width 0.3s ease; }
    .progress-text { font-size: 12px; color: var(--color-text-muted); text-align: center; display: block; margin-top: 4px; font-variant-numeric: tabular-nums; }
    .cancel-btn {
      width: 100%; margin-top: 8px; padding: 8px;
      background: none; border: 1px solid var(--color-danger);
      border-radius: var(--radius-sm); color: var(--color-danger);
      font-size: 12px; font-weight: 500; cursor: pointer;
      transition: all var(--transition-fast);
    }
    .cancel-btn:hover { background: var(--color-danger-bg); }
    .status-cancelled { color: var(--color-text-muted); font-weight: 500; font-size: 13px; }
    .render-actions { display: flex; gap: 8px; margin-top: 10px; }
    .render-actions .download-btn { flex: 1; text-align: center; margin-top: 0; }
    .action-btn {
      padding: 10px 16px; background: var(--color-bg); border: 1px solid var(--color-border);
      border-radius: var(--radius-sm); color: var(--color-text-secondary);
      font-size: 12px; font-weight: 500; cursor: pointer;
      transition: all var(--transition-fast);
    }
    .action-btn:hover { border-color: var(--color-text-muted); }
    .export-actions { display: flex; gap: 8px; margin-bottom: 14px; }
    .action-btn-sm {
      flex: 1; padding: 8px 12px; background: var(--color-bg); border: 1px solid var(--color-border);
      border-radius: var(--radius-sm); color: var(--color-text-secondary);
      font-size: 12px; font-weight: 500; cursor: pointer;
      transition: all var(--transition-fast);
    }
    .action-btn-sm:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-text-primary); }
    .action-btn-sm:disabled { opacity: 0.4; cursor: not-allowed; }
    .save-preset-form { margin-bottom: 14px; }
    .save-preset-actions { display: flex; gap: 8px; margin-top: 8px; }
    .cancel-save-btn {
      padding: 10px 18px; background: none; border: 1px solid var(--color-border);
      border-radius: var(--radius-sm); color: var(--color-text-secondary);
      font-size: 13px; cursor: pointer; transition: all var(--transition-fast);
    }
    .cancel-save-btn:hover { border-color: var(--color-text-muted); }
    .saved-presets-list { display: flex; flex-direction: column; gap: 6px; }
    .saved-preset-item { display: flex; gap: 6px; align-items: center; }
    .saved-preset-btn {
      flex: 1; padding: 8px 12px; background: var(--color-bg); border: 1px solid var(--color-border);
      border-radius: var(--radius-sm); color: var(--color-text-secondary);
      font-size: 12px; font-weight: 500; cursor: pointer; text-align: left;
      transition: all var(--transition-fast);
    }
    .saved-preset-btn:hover { border-color: var(--color-accent); color: var(--color-text-primary); }
    .delete-preset-btn {
      padding: 6px 10px; background: none; border: 1px solid var(--color-border);
      border-radius: var(--radius-sm); color: var(--color-text-muted);
      font-size: 14px; cursor: pointer; line-height: 1;
      transition: all var(--transition-fast);
    }
    .delete-preset-btn:hover { border-color: var(--color-danger); color: var(--color-danger); }
    @media (max-width: 768px) {
      .studio-layout { grid-template-columns: 1fr; }
      .preview-panel { min-height: 320px; }
    }
  `],
})
export class StudioPageComponent {
  readonly store = inject(StudioStore);
  private readonly api = inject(StudioApiService);

  readonly presets = signal<BrandPreset[]>([]);
  readonly textPresets = signal<TextPreset[]>([]);
  readonly compositionPresets = signal<CompositionPreset[]>([]);
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
