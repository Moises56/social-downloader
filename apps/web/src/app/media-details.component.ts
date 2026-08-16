import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { MediaMetadata, DownloadType, AudioFormat } from '@social-downloader/contracts';

export interface DownloadParams {
  type: DownloadType;
  quality?: number;
  audioFormat?: AudioFormat;
}

export type DownloadState = 'idle' | 'preparing' | 'downloading' | 'success' | 'error';

@Component({
  selector: 'app-media-details',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section *ngIf="media as item" class="media-details fade-in">
      <div class="media-layout">
        <div class="media-thumb">
          <img *ngIf="item.thumbnail; else noThumb" [src]="item.thumbnail" [alt]="item.title" />
          <ng-template #noThumb>
            <div class="thumb-placeholder">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                <line x1="7" y1="2" x2="7" y2="22"></line>
                <line x1="17" y1="2" x2="17" y2="22"></line>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <line x1="2" y1="7" x2="7" y2="7"></line>
                <line x1="2" y1="17" x2="7" y2="17"></line>
                <line x1="17" y1="7" x2="22" y2="7"></line>
                <line x1="17" y1="17" x2="22" y2="17"></line>
              </svg>
            </div>
          </ng-template>
        </div>

        <div class="media-info">
          <div class="media-header">
            <span class="platform-tag">{{ item.platform }}</span>
            <h2 class="media-title">{{ item.title }}</h2>
            <div class="media-meta">
              <span *ngIf="item.author" class="meta-item">{{ item.author }}</span>
              <span *ngIf="item.duration" class="meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.6;">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                {{ formatDuration(item.duration) }}
              </span>
            </div>
          </div>

          <div class="format-section">
            <div class="format-group">
              <h3 class="format-label">Video</h3>
              <div class="format-options">
                <button
                  *ngFor="let quality of videoQualities"
                  type="button"
                  class="format-chip"
                  [class.selected]="selectedQuality === quality"
                  (click)="selectedQuality = quality"
                  [attr.aria-pressed]="selectedQuality === quality"
                  [attr.aria-label]="'Calidad ' + quality + 'p'"
                >
                  {{ quality }}p
                </button>
              </div>
            </div>

            <div class="format-group">
              <h3 class="format-label">Audio</h3>
              <div class="format-options">
                <button
                  *ngFor="let format of audioFormats"
                  type="button"
                  class="format-chip"
                  [class.selected]="selectedAudioFormat === format"
                  (click)="selectedAudioFormat = format"
                  [attr.aria-pressed]="selectedAudioFormat === format"
                  [attr.aria-label]="'Formato ' + format.toUpperCase()"
                >
                  {{ format | uppercase }}
                </button>
              </div>
            </div>
          </div>

          <div class="download-actions">
            <button
              type="button"
              class="btn-primary"
              [class.downloading]="downloadState === 'preparing' || downloadState === 'downloading'"
              [class.success]="downloadState === 'success'"
              (click)="emitDownload('video')"
              [disabled]="!selectedQuality || downloading"
              [attr.aria-label]="getDownloadAriaLabel('video')"
            >
              <span *ngIf="downloadState === 'preparing'" class="spinner"></span>
              <span *ngIf="downloadState === 'downloading'" class="spinner"></span>
              <svg *ngIf="downloadState === 'success'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <svg *ngIf="downloadState === 'idle' || downloadState === 'error'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              {{ getDownloadLabel('video') }}
            </button>
            <button
              type="button"
              class="btn-secondary"
              [class.downloading]="downloadState === 'preparing' || downloadState === 'downloading'"
              [class.success]="downloadState === 'success'"
              (click)="emitDownload('audio')"
              [disabled]="!selectedAudioFormat || downloading"
              [attr.aria-label]="getDownloadAriaLabel('audio')"
            >
              <span *ngIf="downloadState === 'preparing' || downloadState === 'downloading'" class="spinner"></span>
              <svg *ngIf="downloadState === 'success'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <svg *ngIf="downloadState === 'idle' || downloadState === 'error'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
              </svg>
              {{ getDownloadLabel('audio') }}
            </button>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .media-details {
      margin-top: 32px;
    }

    .media-layout {
      display: grid;
      grid-template-columns: 1fr;
      gap: 28px;
    }

    @media (min-width: 768px) {
      .media-layout {
        grid-template-columns: 240px 1fr;
        gap: 32px;
      }
    }

    .media-thumb {
      border-radius: var(--radius-lg);
      overflow: hidden;
      background: var(--color-surface);
      border: 1px solid var(--color-border-subtle);
      aspect-ratio: 16 / 9;
    }

    @media (min-width: 768px) {
      .media-thumb {
        aspect-ratio: auto;
        height: fit-content;
        position: sticky;
        top: 24px;
      }
    }

    .media-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .thumb-placeholder {
      width: 100%;
      height: 100%;
      min-height: 180px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-surface);
    }

    .media-info {
      display: flex;
      flex-direction: column;
      gap: 28px;
    }

    .media-header {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .platform-tag {
      align-self: flex-start;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--color-accent);
      background: var(--color-accent-glow);
      border: 1px solid rgba(59, 130, 246, 0.2);
    }

    .platform-tag::before {
      content: '';
      display: inline-block;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--color-accent);
      margin-right: 6px;
      vertical-align: middle;
    }

    .media-title {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      line-height: 1.3;
      color: var(--color-text-primary);
      letter-spacing: -0.01em;
    }

    @media (min-width: 768px) {
      .media-title {
        font-size: 26px;
      }
    }

    .media-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 4px;
    }

    .meta-item {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 13px;
      color: var(--color-text-secondary);
    }

    .format-section {
      display: grid;
      grid-template-columns: 1fr;
      gap: 24px;
    }

    @media (min-width: 640px) {
      .format-section {
        grid-template-columns: 1fr 1fr;
      }
    }

    .format-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .format-label {
      margin: 0;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
    }

    .format-options {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .format-chip {
      padding: 8px 14px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      font-size: 13px;
      font-weight: 500;
      color: var(--color-text-secondary);
      background: var(--color-surface);
      cursor: pointer;
      transition: all var(--transition-fast);
    }

    .format-chip:hover:not(.selected) {
      background: var(--color-surface-hover);
      border-color: var(--color-text-muted);
      color: var(--color-text-primary);
    }

    .format-chip.selected {
      background: var(--color-accent);
      border-color: var(--color-accent);
      color: white;
      box-shadow: 0 1px 4px rgba(59, 130, 246, 0.3);
    }

    .download-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      padding-top: 4px;
    }

    .download-actions .btn-primary,
    .download-actions .btn-secondary {
      flex: 1;
      min-width: 160px;
      height: 48px;
      transition: all var(--transition-normal);
    }

    .download-actions .btn-primary.downloading,
    .download-actions .btn-secondary.downloading {
      opacity: 0.8;
      pointer-events: none;
    }

    .download-actions .btn-primary.success {
      background: var(--color-success);
      border-color: var(--color-success);
      box-shadow: 0 0 16px rgba(16, 185, 129, 0.3);
    }

    .download-actions .btn-secondary.success {
      border-color: var(--color-success);
      color: var(--color-success);
    }

    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 600ms linear infinite;
    }

    .btn-secondary .spinner {
      border-color: rgba(255, 255, 255, 0.2);
      border-top-color: var(--color-text-primary);
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class MediaDetailsComponent {
  @Input() media: MediaMetadata | null = null;
  @Input() downloading = false;
  @Input() downloadState: DownloadState = 'idle';
  @Output() downloadRequest = new EventEmitter<DownloadParams>();

  selectedQuality: number | null = null;
  selectedAudioFormat: AudioFormat | null = null;

  get videoQualities(): number[] {
    const formats = this.media?.formats ?? [];
    const heights = [...new Set(formats.map((format) => format.height).filter((value): value is number => typeof value === 'number'))]
      .filter((height) => height >= 144)
      .sort((a, b) => b - a);

    const preferred = [2160, 1440, 1080, 720, 480, 360];
    const final = preferred.filter((value) => heights.includes(value));
    return final.length > 0 ? final : heights.slice(0, 6);
  }

  get audioFormats(): AudioFormat[] {
    return ['mp3', 'm4a', 'opus'];
  }

  emitDownload(type: DownloadType): void {
    this.downloadRequest.emit({
      type,
      ...(type === 'video' && this.selectedQuality ? { quality: this.selectedQuality } : {}),
      ...(type === 'audio' && this.selectedAudioFormat ? { audioFormat: this.selectedAudioFormat } : {}),
    });
  }

  getDownloadLabel(type: DownloadType): string {
    const label = type === 'video' ? 'video' : 'audio';
    switch (this.downloadState) {
      case 'preparing': return `Preparando ${label}…`;
      case 'downloading': return `Descargando ${label}…`;
      case 'success': return `${label === 'video' ? 'Video' : 'Audio'} listo`;
      default: return type === 'video' ? 'Descargar video' : 'Descargar audio';
    }
  }

  getDownloadAriaLabel(type: DownloadType): string {
    const label = type === 'video' ? 'video' : 'audio';
    switch (this.downloadState) {
      case 'preparing': return `Preparando descarga de ${label}`;
      case 'downloading': return `Descargando ${label}`;
      case 'success': return `${label === 'video' ? 'Video' : 'Audio'} descargado`;
      default: return `Descargar ${label}`;
    }
  }

  formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
    }
    return [minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
  }
}
