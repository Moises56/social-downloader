import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { MediaMetadata, DownloadType, AudioFormat } from '@social-downloader/contracts';

export interface DownloadParams {
  type: DownloadType;
  quality?: number;
  audioFormat?: AudioFormat;
}

@Component({
  selector: 'app-media-details',
  standalone: true,
  imports: [CommonModule],
  template: `
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
            (click)="emitDownload('video')"
            [disabled]="!selectedQuality || downloading"
          >
            Descargar video
          </button>
          <button
            type="button"
            class="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-semibold text-slate-100 transition hover:border-violet-400 hover:text-violet-200 disabled:opacity-60"
            (click)="emitDownload('audio')"
            [disabled]="!selectedAudioFormat || downloading"
          >
            Descargar audio
          </button>
        </div>
      </div>
    </section>
  `,
})
export class MediaDetailsComponent {
  @Input() media: MediaMetadata | null = null;
  @Input() downloading = false;
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
