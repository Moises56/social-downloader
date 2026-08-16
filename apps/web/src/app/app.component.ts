import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import type { MediaMetadata, AudioFormat } from '@social-downloader/contracts';
import { UrlFormComponent } from './url-form.component';
import { MediaDetailsComponent, DownloadParams } from './media-details.component';

const API_BASE_URL = 'http://localhost:3005';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, UrlFormComponent, MediaDetailsComponent],
  template: `
    <main class="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div class="mx-auto max-w-5xl">
        <section class="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/60 backdrop-blur md:p-10">
          <div class="mb-8 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">Social Downloader</p>
              <h1 class="mt-3 text-3xl font-bold tracking-tight md:text-5xl">Descarga contenido público y autorizado.</h1>
            </div>
            <div class="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300">
              YouTube · TikTok · Instagram · Facebook · X
            </div>
          </div>

          <app-url-form [loading]="loading" (analyze)="analyze($event)" />

          <div *ngIf="error" class="mt-4 rounded-xl border border-rose-700/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
            {{ error }}
          </div>

          <div *ngIf="loading" class="mt-8 animate-pulse space-y-4">
            <div class="h-5 w-28 rounded bg-slate-800"></div>
            <div class="h-64 rounded-2xl bg-slate-800"></div>
          </div>

          <app-media-details
            *ngIf="media"
            [media]="media"
            [downloading]="downloading"
            (downloadRequest)="onDownload($event)"
          />
        </section>
      </div>
    </main>
  `,
})
export class AppComponent {
  media: MediaMetadata | null = null;
  loading = false;
  downloading = false;
  error: string | null = null;

  analyze(url: string): void {
    this.loading = true;
    this.error = null;
    this.media = null;

    fetch(`${API_BASE_URL}/api/media/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          throw new Error(errorBody?.message ?? 'No se pudo analizar la URL.');
        }
        this.media = await response.json() as MediaMetadata;
      })
      .catch((error) => {
        this.error = error instanceof Error ? error.message : 'No se pudo analizar la URL.';
      })
      .finally(() => {
        this.loading = false;
      });
  }

  onDownload(params: DownloadParams): void {
    const item = this.media;
    if (!item) return;

    this.downloading = true;

    const payload = {
      url: item.sourceUrl,
      type: params.type,
      ...(params.quality ? { quality: params.quality } : {}),
      ...(params.audioFormat ? { audioFormat: params.audioFormat } : {}),
    };

    fetch(`${API_BASE_URL}/api/media/download/prepare`, {
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

        const anchor = document.createElement('a');
        anchor.href = `${API_BASE_URL}${data.downloadUrl}`;
        anchor.download = this.getSuggestedFilename(item.title, params.type, params.quality, params.audioFormat);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      })
      .catch((error) => {
        this.error = error instanceof Error ? error.message : 'No se pudo iniciar la descarga.';
      })
      .finally(() => {
        this.downloading = false;
      });
  }

  private getSuggestedFilename(title: string, type: string, quality?: number | null, format?: AudioFormat | null): string {
    const cleanTitle = title.replace(/[^a-z0-9\-_ ]/gi, '').trim().slice(0, 80) || 'download';
    if (type === 'video') {
      return `${cleanTitle}-${quality ?? 1080}p.mp4`;
    }
    return `${cleanTitle}.${format ?? 'mp3'}`;
  }
}
