import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-url-form',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <label class="block text-sm font-medium text-slate-300">URL del video</label>
      <div class="flex flex-col gap-3 md:flex-row">
        <input
          [(ngModel)]="url"
          class="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-base text-white outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-900"
          placeholder="https://www.youtube.com/watch?v=..."
          [disabled]="loading"
        />
        <button
          type="button"
          class="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          (click)="submit()"
          [disabled]="loading || !url"
        >
          {{ loading ? 'Analizando…' : 'Analizar' }}
        </button>
      </div>
    </div>
  `,
})
export class UrlFormComponent {
  url = '';
  @Input() loading = false;
  @Output() urlChange = new EventEmitter<string>();
  @Output() analyze = new EventEmitter<string>();

  submit(): void {
    const value = this.url.trim();
    if (value) {
      this.analyze.emit(value);
    }
  }
}
