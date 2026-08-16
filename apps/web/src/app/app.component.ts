import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="shell">
      <section class="card">
        <p class="eyebrow">YouTube · TikTok · Instagram · Facebook · X</p>
        <h1>Descarga tus videos.</h1>
        <p class="muted">Pega una URL pública o autorizada y analiza los formatos disponibles.</p>
        <div class="row">
          <input [ngModel]="url()" (ngModelChange)="url.set($event)" placeholder="https://..." />
          <button (click)="analyze()" [disabled]="loading() || !url()">{{ loading() ? 'Analizando…' : 'Analizar' }}</button>
        </div>
        @if (error()) { <p class="error">{{ error() }}</p> }
        @if (media(); as item) {
          <div class="result">
            @if (item.thumbnail) { <img [src]="item.thumbnail" alt="Miniatura" /> }
            <div><strong>{{ item.title }}</strong><p class="muted">{{ item.platform }}</p></div>
          </div>
        }
      </section>
    </main>`
})
export class AppComponent {
  private readonly http = inject(HttpClient);
  readonly url = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly media = signal<any>(null);

  analyze(): void {
    this.loading.set(true); this.error.set(''); this.media.set(null);
    this.http.post<any>('http://localhost:3000/api/media/analyze', { url: this.url() }).subscribe({
      next: data => { this.media.set(data); this.loading.set(false); },
      error: err => { this.error.set(err?.error?.message ?? 'No se pudo analizar la URL'); this.loading.set(false); }
    });
  }
}
