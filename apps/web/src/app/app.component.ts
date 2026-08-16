import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

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
  imports: [FormsModule],
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
                [ngModel]="url()"
                (ngModelChange)="url.set($event)"
                class="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-base text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-900"
                placeholder="https://www.youtube.com/watch?v=..."
                [disabled]="loading()"
              />
              <button
                type="button"
                class="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                (click)="analyze()"
                [disabled]="loading() || !url()"
              >
                {{ loading() ? 'Analizando…' : 'Analizar' }}
              </button>
            </div>
          </div>

          @if (error()) {
            <div class="mt-4 rounded-xl border border-rose-700/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
              {{ error() }}
            </div>
          }

          @if (loading()) {
            <div class="mt-8 animate-pulse space-y-4">
              <div class="h-5 w-28 rounded bg-slate-800"></div>
              <div class="h-64 rounded-2xl bg-slate-800"></div>
            </div>
          }

          @if (media(); as item) {
            <section class="mt-8 grid gap-6 lg:grid-cols-[260px,1fr]">
              <div class="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                @if (item.thumbnail) {
                  <img [src]="item.thumbnail" [alt]="item.title" class="h-52 w-full object-cover" />
                } @else {
                  <div class="flex h-52 items-center justify-center bg-slate-800 text-slate-400">Sin miniatura</div>
                }
              </div>

              <div class="space-y-5">
                <div>
                  <p class="text-xs uppercase tracking-[0.2em] text-cyan-400">{{ item.platform }}</p>
                  <h2 class="mt-2 text-2xl font-semibold text-white">{{ item.title }}</h2>
                </div>

                <div class="flex flex-wrap gap-3 text-sm text-slate-300">
                  @if (item.author) { <span class="rounded-full border border-slate-700 bg-slate-800 px-3 py-1">{{ item.author }}</span> }
                  @if (item.duration) { <span class="rounded-full border border-slate-700 bg-slate-800 px-3 py-1">{{ formatDuration(item.duration) }}</span> }
                </div>

                <div class="grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 class="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Video</h3>
                    <div class="flex flex-wrap gap-2">
                      @for (quality of videoQualities(); track quality) {
                        <button
                          type="button"
                          class="rounded-lg border px-3 py-2 text-sm font-medium transition"
                          [class.border-cyan-500]="selectedQuality() === quality"
                          [class.bg-cyan-500]="selectedQuality() === quality"
                          [class.text-slate-950]="selectedQuality() === quality"
                          [class.border-slate-700]="selectedQuality() !== quality"
                          [class.bg-slate-800]="selectedQuality() !== quality"
                          [class.text-slate-200]="selectedQuality() !== quality"
                          (click)="selectedQuality.set(quality)"
                        >
                          {{ quality }}p
                        </button>
                      }
                    </div>
                  </div>

                  <div>
                    <h3 class="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Audio</h3>
                    <div class="flex flex-wrap gap-2">
                      @for (format of audioFormats(); track format) {
                        <button
                          type="button"
                          class="rounded-lg border px-3 py-2 text-sm font-medium uppercase transition"
                          [class.border-violet-500]="selectedAudioFormat() === format"
                          [class.bg-violet-500]="selectedAudioFormat() === format"
                          [class.text-slate-950]="selectedAudioFormat() === format"
                          [class.border-slate-700]="selectedAudioFormat() !== format"
                          [class.bg-slate-800]="selectedAudioFormat() !== format"
                          [class.text-slate-200]="selectedAudioFormat() !== format"
                          (click)="selectedAudioFormat.set(format)"
                        >
                          {{ format }}
                        </button>
                      }
                    </div>
                  </div>
                </div>

                <div class="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    class="rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
                    (click)="download('video')"
                    [disabled]="!selectedQuality() || downloading()"
                  >
                    Descargar video
                  </button>
                  <button
                    type="button"
                    class="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-semibold text-slate-100 transition hover:border-violet-400 hover:text-violet-200 disabled:opacity-60"
                    (click)="download('audio')"
                    [disabled]="!selectedAudioFormat() || downloading()"
                  >
                    Descargar audio
                  </button>
                </div>
              </div>
            </section>
          }
        </section>
      </div>
    </main>
  `,
})
export class AppComponent {
  private readonly http = inject(HttpClient);

  readonly url = signal('');
  readonly media = signal<MediaMetadata | null>(null);
  readonly loading = signal(false);
  readonly downloading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedQuality = signal<number | null>(null);
  readonly selectedAudioFormat = signal<'mp3' | 'm4a' | 'opus' | null>(null);

  readonly videoQualities = computed(() => {
    const formats = this.media()?.formats ?? [];
    const heights = [...new Set(formats.map((format) => format.height).filter((value): value is number => typeof value === 'number'))]
      .filter((height) => height >= 144)
      .sort((a, b) => b - a);

    const preferred = [2160, 1440, 1080, 720, 480, 360];
    const final = preferred.filter((value) => heights.includes(value));
    return final.length > 0 ? final : heights.slice(0, 6);
  });

  readonly audioFormats = computed(() => ['mp3', 'm4a', 'opus'] as const);

  analyze(): void {
    const value = this.url().trim();
    if (!value) {
      this.error.set('Introduce una URL válida.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.media.set(null);

    this.http.post<MediaMetadata>('http://localhost:3000/api/media/analyze', { url: value }).subscribe({
      next: (data) => {
        this.media.set(data);
        this.selectedQuality.set(this.videoQualities()[0] ?? null);
        this.selectedAudioFormat.set(this.audioFormats()[0] ?? null);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudo analizar la URL.');
        this.loading.set(false);
      },
    });
  }

  download(type: 'video' | 'audio'): void {
    const item = this.media();
    if (!item) return;

    const quality = this.selectedQuality();
    const format = this.selectedAudioFormat();
    this.downloading.set(true);

    const payload = {
      url: item.sourceUrl,
      type,
      ...(type === 'video' && quality ? { quality } : {}),
      ...(type === 'audio' && format ? { audioFormat: format } : {}),
    };

    fetch('http://localhost:3000/api/media/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          throw new Error(errorBody?.message ?? 'No se pudo descargar el archivo.');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = this.getSuggestedFilename(item.title, type, quality, format);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      })
      .catch((error) => {
        this.error.set(error instanceof Error ? error.message : 'No se pudo iniciar la descarga.');
      })
      .finally(() => this.downloading.set(false));
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
