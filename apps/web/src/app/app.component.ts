import { CommonModule } from '@angular/common';
import { Component, signal, computed } from '@angular/core';
import type { MediaMetadata, AudioFormat } from '@social-downloader/contracts';
import { environment } from '../environments/environment';
import { UrlFormComponent } from './url-form.component';
import { MediaDetailsComponent, DownloadParams, DownloadState } from './media-details.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, UrlFormComponent, MediaDetailsComponent],
  template: `
    <main class="app-shell">
      <div class="app-container">
        <header class="app-header">
          <div class="brand">
            <span class="brand-label">Social Downloader</span>
            <h1 class="brand-title">Descarga contenido público<br class="hide-mobile" /> y autorizado.</h1>
          </div>
          <div class="platforms-pill">
            YouTube · TikTok · Instagram · Facebook · X
          </div>
        </header>

        <app-url-form [loading]="loading()" (analyze)="analyze($event)" />

        <div *ngIf="error()" class="error-banner fade-in" role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="error-icon">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <div class="error-content">
            <p class="error-message">{{ error() }}</p>
            <button *ngIf="errorAction()" type="button" class="error-retry" (click)="retry()">
              Intentar nuevamente
            </button>
          </div>
        </div>

        <div *ngIf="loading()" class="skeleton-card fade-in">
          <div class="skeleton-layout">
            <div class="skeleton-thumb skeleton"></div>
            <div class="skeleton-info">
              <div class="skeleton skeleton-line short"></div>
              <div class="skeleton skeleton-line long"></div>
              <div class="skeleton skeleton-line medium"></div>
              <div class="skeleton-meta">
                <div class="skeleton skeleton-pill"></div>
                <div class="skeleton skeleton-pill"></div>
              </div>
              <div class="skeleton-formats">
                <div class="skeleton skeleton-chip"></div>
                <div class="skeleton skeleton-chip"></div>
                <div class="skeleton skeleton-chip"></div>
              </div>
              <div class="skeleton-actions">
                <div class="skeleton skeleton-btn"></div>
                <div class="skeleton skeleton-btn secondary"></div>
              </div>
            </div>
          </div>
        </div>

        <app-media-details
          *ngIf="media() && !loading()"
          [media]="media()!"
          [downloading]="downloading()"
          [downloadState]="downloadState()"
          (downloadRequest)="onDownload($event)"
        />
      </div>
    </main>
  `,
  styles: [`
    .app-shell {
      min-height: 100vh;
      padding: 40px 20px 60px;
      background:
        radial-gradient(ellipse at 50% 0%, rgba(59, 130, 246, 0.06) 0%, transparent 60%),
        var(--color-bg);
    }

    @media (min-width: 768px) {
      .app-shell {
        padding: 60px 24px 80px;
      }
    }

    .app-container {
      max-width: 720px;
      margin: 0 auto;
    }

    .app-header {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 40px;
    }

    @media (min-width: 640px) {
      .app-header {
        flex-direction: row;
        align-items: flex-end;
        justify-content: space-between;
      }
    }

    .brand {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .brand-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--color-accent);
    }

    .brand-title {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.02em;
      color: var(--color-text-primary);
    }

    @media (min-width: 768px) {
      .brand-title {
        font-size: 36px;
      }
    }

    .hide-mobile {
      display: none;
    }

    @media (min-width: 640px) {
      .hide-mobile {
        display: inline;
      }
    }

    .platforms-pill {
      display: inline-flex;
      align-items: center;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 500;
      color: var(--color-text-muted);
      background: var(--color-surface);
      border: 1px solid var(--color-border-subtle);
      white-space: nowrap;
      align-self: flex-start;
    }

    @media (min-width: 640px) {
      .platforms-pill {
        align-self: center;
      }
    }

    .error-banner {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-top: 16px;
      padding: 14px 18px;
      border-radius: var(--radius-md);
      background: var(--color-danger-bg);
      border: 1px solid var(--color-danger-border);
    }

    .error-icon {
      flex-shrink: 0;
      color: var(--color-danger);
      margin-top: 1px;
    }

    .error-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .error-message {
      margin: 0;
      font-size: 14px;
      line-height: 1.5;
      color: var(--color-text-primary);
    }

    .error-retry {
      align-self: flex-start;
      padding: 0;
      border: none;
      background: none;
      font-size: 13px;
      font-weight: 600;
      color: var(--color-accent);
      cursor: pointer;
      transition: color var(--transition-fast);
    }

    .error-retry:hover {
      color: var(--color-accent-hover);
    }

    .error-retry:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
      border-radius: 4px;
    }

    .skeleton-card {
      margin-top: 32px;
    }

    .skeleton-layout {
      display: grid;
      grid-template-columns: 1fr;
      gap: 24px;
    }

    @media (min-width: 768px) {
      .skeleton-layout {
        grid-template-columns: 240px 1fr;
        gap: 32px;
      }
    }

    .skeleton-thumb {
      aspect-ratio: 16 / 9;
      border-radius: var(--radius-lg);
    }

    @media (min-width: 768px) {
      .skeleton-thumb {
        aspect-ratio: auto;
        height: 180px;
      }
    }

    .skeleton-info {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .skeleton-line {
      height: 14px;
      border-radius: 6px;
    }

    .skeleton-line.short { width: 80px; }
    .skeleton-line.medium { width: 160px; }
    .skeleton-line.long { width: 100%; max-width: 400px; height: 20px; }

    .skeleton-meta {
      display: flex;
      gap: 10px;
    }

    .skeleton-pill {
      width: 80px;
      height: 26px;
      border-radius: 9999px;
    }

    .skeleton-formats {
      display: flex;
      gap: 8px;
    }

    .skeleton-chip {
      width: 60px;
      height: 34px;
      border-radius: var(--radius-sm);
    }

    .skeleton-actions {
      display: flex;
      gap: 12px;
      padding-top: 8px;
    }

    .skeleton-btn {
      flex: 1;
      height: 48px;
      border-radius: var(--radius-md);
    }

    .skeleton-btn.secondary {
      flex: 0.8;
    }
  `],
})
export class AppComponent {
  readonly media = signal<MediaMetadata | null>(null);
  readonly loading = signal(false);
  readonly downloading = signal(false);
  readonly downloadState = signal<DownloadState>('idle');
  readonly error = signal<string | null>(null);
  readonly errorAction = signal<(() => void) | null>(null);

  private lastUrl = signal<string | null>(null);

  readonly hasMedia = computed(() => this.media() !== null && !this.loading());

  analyze(url: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.errorAction.set(null);
    this.media.set(null);
    this.lastUrl.set(url);

    fetch(`${environment.apiBaseUrl}/api/media/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          throw new Error(errorBody?.message ?? 'No se pudo analizar la URL.');
        }
        this.media.set(await response.json() as MediaMetadata);
      })
      .catch((error) => {
        this.error.set(this.getErrorMessage(error));
        this.errorAction.set(() => this.analyze(url));
      })
      .finally(() => {
        this.loading.set(false);
      });
  }

  retry(): void {
    const url = this.lastUrl();
    if (url) {
      this.analyze(url);
    }
  }

  onDownload(params: DownloadParams): void {
    const item = this.media();
    if (!item) return;

    this.downloading.set(true);
    this.downloadState.set('preparing');
    this.error.set(null);

    const payload = {
      url: item.sourceUrl,
      type: params.type,
      ...(params.quality ? { quality: params.quality } : {}),
      ...(params.audioFormat ? { audioFormat: params.audioFormat } : {}),
    };

    fetch(`${environment.apiBaseUrl}/api/media/download/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          throw new Error(errorBody?.message ?? 'No se pudo preparar la descarga.');
        }

        const data = (await response.json()) as { downloadUrl?: string };
        if (!data.downloadUrl) {
          throw new Error('No se recibió URL de descarga.');
        }

        this.downloadState.set('downloading');

        const anchor = document.createElement('a');
        anchor.href = `${environment.apiBaseUrl}${data.downloadUrl}`;
        anchor.download = this.getSuggestedFilename(item.title, params.type, params.quality, params.audioFormat);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        this.downloadState.set('success');
        setTimeout(() => this.downloadState.set('idle'), 2000);
      })
      .catch((error) => {
        this.error.set(this.getErrorMessage(error));
        this.downloadState.set('error');
        this.errorAction.set(null);
        setTimeout(() => this.downloadState.set('idle'), 3000);
      })
      .finally(() => {
        this.downloading.set(false);
      });
  }

  private getErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) return 'Ocurrió un error inesperado.';

    const msg = error.message;
    if (msg === 'UNSUPPORTED_PLATFORM') return 'Esta plataforma no es compatible aún.';
    if (msg === 'INVALID_URL') return 'La URL no parece válida. Verifica que sea correcta.';
    if (msg === 'MEDIA_NOT_AVAILABLE') return 'No pudimos acceder a este contenido. Puede ser privado, requerir inicio de sesión o no estar disponible.';
    if (msg === 'PRIVATE_MEDIA') return 'Este contenido es privado y no puede descargarse.';
    if (msg === 'AUTH_REQUIRED') return 'Este contenido requiere iniciar sesión para acceder.';
    if (msg === 'GEO_RESTRICTED') return 'Este contenido no está disponible en tu región.';
    if (msg === 'DOWNLOAD_TOO_LARGE') return 'El archivo excede el tamaño máximo permitido.';
    if (msg === 'SSRF_BLOCKED') return 'La URL no es válida o apunta a un recurso restringido.';
    if (msg === 'YTDLP_NOT_AVAILABLE') return 'El servicio de descarga no está disponible temporalmente. Intenta más tarde.';

    if (msg.includes('fetch')) return 'No se pudo conectar con el servidor. Verifica tu conexión.';
    return 'No se pudo completar la operación. Intenta nuevamente.';
  }

  private getSuggestedFilename(title: string, type: string, quality?: number | null, format?: AudioFormat | null): string {
    const cleanTitle = title.replace(/[^a-z0-9\-_ ]/gi, '').trim().slice(0, 80) || 'download';
    if (type === 'video') {
      return `${cleanTitle}-${quality ?? 1080}p.mp4`;
    }
    return `${cleanTitle}.${format ?? 'mp3'}`;
  }
}
