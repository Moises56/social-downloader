import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StudioStore } from './state/studio.store';
import { StudioApiService } from './services/studio-api.service';
import type { BrandPreset, TextOverlay, AudioTrack } from '@social-downloader/contracts';

@Component({
  selector: 'app-studio-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="studio-container">
      <header class="studio-header">
        <h1>Video Studio</h1>
        <p class="subtitle">Crea videos listos para redes sociales</p>
      </header>

      <div class="studio-layout">
        <div class="preview-panel">
          <div class="preview-area" *ngIf="store.sourceAsset() as asset; else uploadPlaceholder">
            <div class="video-placeholder">
              <div class="video-icon">&#9654;</div>
              <p class="video-name">{{ asset.fileName }}</p>
              <p class="video-meta" *ngIf="asset.duration">{{ asset.duration | number:'1.1-1' }}s</p>
            </div>
          </div>
          <ng-template #uploadPlaceholder>
            <div class="upload-area" (click)="fileInput.click()" (dragover)="$event.preventDefault()" (drop)="onDrop($event)">
              <div class="upload-icon">&#43;</div>
              <p>Sube un video o arrastra aquí</p>
              <p class="upload-hint">MP4, MOV, WebM</p>
            </div>
          </ng-template>
          <input #fileInput type="file" accept="video/*" (change)="onFileSelected($event)" hidden>
        </div>

        <div class="config-panel">
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
            <div class="text-overlays">
              <div *ngFor="let overlay of store.textOverlays()" class="overlay-item">
                <span class="overlay-text">{{ overlay.text }}</span>
                <span class="overlay-time">{{ overlay.startTime | number:'1.1-1' }}s - {{ overlay.endTime | number:'1.1-1' }}s</span>
                <button class="remove-btn" (click)="store.removeTextOverlay(overlay.id)">&times;</button>
              </div>
            </div>
            <div class="add-text-form">
              <input [(ngModel)]="newText" placeholder="Agregar texto..." class="text-input">
              <select [(ngModel)]="newTextType" class="type-select">
                <option value="message">Mensaje</option>
                <option value="verse">Versículo</option>
                <option value="reflection">Reflexión</option>
                <option value="cta">CTA</option>
              </select>
              <button class="add-btn" (click)="addText()" [disabled]="!newText()">Agregar</button>
            </div>
          </section>

          <section class="panel-section">
            <h3>Audio</h3>
            <div class="audio-controls">
              <label class="checkbox-label">
                <input type="checkbox" [checked]="keepOriginalAudio()" (change)="keepOriginalAudio.set(!keepOriginalAudio())">
                Mantener audio original
              </label>
              <div class="volume-control" *ngIf="keepOriginalAudio()">
                <label>Volumen original</label>
                <input type="range" min="0" max="1" step="0.1" [(ngModel)]="originalVolume">
                <span>{{ originalVolume() * 100 | number:'1.0-0' }}%</span>
              </div>
            </div>
          </section>

          <section class="panel-section">
            <h3>Exportar</h3>
            <div class="export-info">
              <span>1080x1920 &bull; 9:16 &bull; MP4 &bull; H.264</span>
            </div>
            <button
              class="render-btn"
              [disabled]="!store.canRender()"
              (click)="startRender()">
              {{ store.renderState() === 'rendering' ? 'Renderizando...' : 'Renderizar video' }}
            </button>
            <div class="render-status" *ngIf="store.renderResult() as result">
              <span *ngIf="result.status === 'completed'" class="status-success">Completado</span>
              <span *ngIf="result.status === 'failed'" class="status-error">{{ result.error }}</span>
              <a *ngIf="result.status === 'completed' && result.id" class="download-btn" [href]="getDownloadUrl(result.id)" target="_blank">
                Descargar
              </a>
            </div>
          </section>
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
    .preview-panel { background: var(--color-surface); border-radius: var(--radius-lg); min-height: 560px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--color-border-subtle); }
    .upload-area { text-align: center; padding: 56px 32px; cursor: pointer; border: 2px dashed var(--color-border); border-radius: var(--radius-lg); margin: 20px; transition: all var(--transition-normal); }
    .upload-area:hover { border-color: var(--color-accent); background: var(--color-accent-glow); }
    .upload-icon { font-size: 52px; color: var(--color-text-muted); margin-bottom: 16px; transition: color var(--transition-fast); }
    .upload-area:hover .upload-icon { color: var(--color-accent); }
    .upload-hint { color: var(--color-text-muted); font-size: 12px; margin-top: 10px; letter-spacing: 0.02em; }
    .video-placeholder { text-align: center; padding: 40px; }
    .video-icon { font-size: 72px; color: var(--color-accent); margin-bottom: 20px; opacity: 0.9; }
    .video-name { font-weight: 600; color: var(--color-text-primary); margin: 0 0 6px; font-size: 15px; }
    .video-meta { color: var(--color-text-secondary); font-size: 13px; margin: 0; }
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
  readonly newText = signal('');
  readonly newTextType = signal<string>('message');
  readonly keepOriginalAudio = signal(true);
  readonly originalVolume = signal(1.0);

  constructor() {
    this.api.getBrandPresets().subscribe({
      next: (res) => this.presets.set(res.presets),
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
    this.api.uploadSource(file).subscribe({
      next: (res) => this.store.setSource(res.asset),
    });
  }

  addText(): void {
    const text = this.newText();
    if (!text) return;

    const duration = this.store.totalDuration();
    const overlay: TextOverlay = {
      id: crypto.randomUUID(),
      text,
      type: this.newTextType() as TextOverlay['type'],
      startTime: 0,
      endTime: Math.max(duration, 5),
      position: 'center',
      style: {
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: 48,
        fontWeight: 'bold',
        color: '#f6efe2',
        opacity: 1,
        textShadow: true,
        shadowColor: 'rgba(0, 0, 0, 0.8)',
        shadowBlur: 16,
      },
    };

    this.store.addTextOverlay(overlay);
    this.newText.set('');
  }

  startRender(): void {
    const asset = this.store.sourceAsset();
    if (!asset) return;

    this.store.setRenderState('rendering');

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
            this.pollRender(renderRes.render.id);
          },
          error: () => this.store.setRenderState('error'),
        });
      },
      error: () => this.store.setRenderState('error'),
    });
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
}
