import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

const API_BASE_URL = 'http://localhost:3005';

type MediaPlatform = 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'x';

type MediaFormat = {
  id: string;
  ext: string;
  resolution?: string;
  width?: number;
  height?: number;
  container?: string;
  filesize?: number;
};

type MediaMetadata = {
  platform: MediaPlatform;
  title: string;
  author?: string;
  duration?: number;
  thumbnail?: string;
  sourceUrl: string;
  formats: MediaFormat[];
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
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

          <div class="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <label class="block text-sm font-medium text-slate-300">URL del video</label>
            <div class="flex flex-col gap-3 md:flex-row">
              <input
                [value]="url"
                (input)="onUrlInput($event)"
                class="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-base text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-900"
                placeholder="https://www.youtube.com/watch?v=..."
                [disabled]="loading"
              />
              <button
                type="button"
                class="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                (click)="analyze()"
                [disabled]="loading || !url"
              >
                {{ loading ? 'Analizando…' : 'Analizar' }}
              </button>
            </div>
          </div>

          <div *ngIf="error" class="mt-4 rounded-xl border border-rose-700/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
            {{ error }}
          </div>

          <div *ngIf="loading" class="mt-8 animate-pulse space-y-4">
            <div class="h-5 w-28 rounded bg-slate-800"></div>
            <div class="h-64 rounded-2xl bg-slate-800"></div>
          </div>

          <section *ngIf="media as item" class="mt-8 grid gap-6 lg:grid-cols-[260px,1fr]">
            <div class="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
              <img *ngIf="item.thumbnail; else noThumb" [src]="item.thumbnail" [alt]="item.title" class="h-52 w-full object-cover" />
              <ng-template #noThumb>
                <div class="flex h-52 items-center justify-center bg-slate-800 text-slate-400">Sin miniatura</div>
              </ng-template>
            </div>

            <div class="space-y-5">
              <div>
                <p class="text-xs uppercase tracking-[0.2em] text-cyan-400">{{ item.platform }}</p>
                <h2 class="mt-2 text-2xl font-semibold text-white">{{ item.title }}</h2>
              </div>

              <div class="flex flex-wrap gap-3 text-sm text-slate-300">
                <span *ngIf="item.author" class="rounded-full border border-slate-700 bg-slate-800 px-3 py-1">{{ item.author }}</span>
                <span *ngIf="item.duration" class="rounded-full border border-slate-700 bg-slate-800 px-3 py-1">{{ formatDuration(item.duration) }}</span>
              </div>

              <div class="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 class="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Video</h3>
                  <div class="flex flex-wrap gap-2">
                    <button
                      *ngFor="let quality of videoQualities"
                      type="button"
                      class="rounded-lg border px-3 py-2 text-sm font-medium transition"
                      [class.border-cyan-500]="selectedQuality === quality"
                      [class.bg-cyan-500]="selectedQuality === quality"
                      [class.text-slate-950]="selectedQuality === quality"
                      [class.border-slate-700]="selectedQuality !== quality"
                      [class.bg-slate-800]="selectedQuality !== quality"
                      [class.text-slate-200]="selectedQuality !== quality"
                      (click)="selectedQuality = quality"
                    >
                      {{ quality }}p
                    </button>
                  </div>
                </div>

                <div>
                  <h3 class="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Audio</h3>
                  <div class="flex flex-wrap gap-2">
                    <button
                      *ngFor="let format of audioFormats"
                      type="button"
                      class="rounded-lg border px-3 py-2 text-sm font-medium uppercase transition"
                      [class.border-violet-500]="selectedAudioFormat === format"
                      [class.bg-violet-500]="selectedAudioFormat === format"
                      [class.text-slate-950]="selectedAudioFormat === format"
                      [class.border-slate-700]="selectedAudioFormat !== format"
                      [class.bg-slate-800]="selectedAudioFormat !== format"
                      [class.text-slate-200]="selectedAudioFormat !== format"
                      (click)="selectedAudioFormat = format"
                    >
                      {{ format }}
                    </button>
                  </div>
                </div>
              </div>

              <div class="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  class="rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
                  (click)="download('video')"
                  [disabled]="!selectedQuality || downloading"
                >
                  Descargar video
                </button>
                <button
                  type="button"
                  class="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-semibold text-slate-100 transition hover:border-violet-400 hover:text-violet-200 disabled:opacity-60"
                  (click)="download('audio')"
                  [disabled]="!selectedAudioFormat || downloading"
                >
                  Descargar audio
                </button>
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  `,
})
export class AppComponent {
  url = '';
  media: MediaMetadata | null = null;
  loading = false;
  downloading = false;
  error: string | null = null;
  selectedQuality: number | null = null;
  selectedAudioFormat: 'mp3' | 'm4a' | 'opus' | null = null;

  get videoQualities(): number[] {
    const formats = this.media?.formats ?? [];
    const heights = [...new Set(formats.map((format) => format.height).filter((value): value is number => typeof value === 'number'))]
      .filter((height) => height >= 144)
      .sort((a, b) => b - a);

    const preferred = [2160, 1440, 1080, 720, 480, 360];
    const final = preferred.filter((value) => heights.includes(value));
    return final.length > 0 ? final : heights.slice(0, 6);
  }

  get audioFormats(): Array<'mp3' | 'm4a' | 'opus'> {
    return ['mp3', 'm4a', 'opus'];
  }

  onUrlInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.url = target?.value ?? '';
  }

  analyze(): void {
    const value = this.url.trim();
    if (!value) {
      this.error = 'Introduce una URL válida.';
      return;
    }

    this.loading = true;
    this.error = null;
    this.media = null;

    fetch(`${API_BASE_URL}/api/media/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: value }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          throw new Error(errorBody?.message ?? 'No se pudo analizar la URL.');
        }

        const data = (await response.json()) as MediaMetadata;
        this.media = data;
        this.selectedQuality = this.videoQualities[0] ?? null;
        this.selectedAudioFormat = this.audioFormats[0] ?? null;
      })
      .catch((error) => {
        this.error = error instanceof Error ? error.message : 'No se pudo analizar la URL.';
      })
      .finally(() => {
        this.loading = false;
      });
  }

  download(type: 'video' | 'audio'): void {
    const item = this.media;
    if (!item) return;

    const quality = this.selectedQuality;
    const format = this.selectedAudioFormat;
    this.downloading = true;

    const payload = {
      url: item.sourceUrl,
      type,
      ...(type === 'video' && quality ? { quality } : {}),
      ...(type === 'audio' && format ? { audioFormat: format } : {}),
    };

    this.prepareDownload(payload)
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
        anchor.download = this.getSuggestedFilename(item.title, type, quality, format);
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

  private prepareDownload(payload: {
    url: string;
    type: 'video' | 'audio';
    quality?: number;
    audioFormat?: 'mp3' | 'm4a' | 'opus';
  }): Promise<Response> {
    return fetch(`${API_BASE_URL}/api/media/download/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
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

  private getSuggestedFilename(title: string, type: 'video' | 'audio', quality?: number | null, format?: 'mp3' | 'm4a' | 'opus' | null): string {
    const cleanTitle = title.replace(/[^a-z0-9\-_ ]/gi, '').trim().slice(0, 80) || 'download';
    if (type === 'video') {
      return `${cleanTitle}-${quality ?? 1080}p.mp4`;
    }
    return `${cleanTitle}.${format ?? 'mp3'}`;
  }
}
