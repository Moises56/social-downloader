import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import type { MediaPlatform } from '@social-downloader/contracts';

const PLATFORM_PATTERNS: Array<{ pattern: RegExp; platform: MediaPlatform }> = [
  { pattern: /(?:youtube\.com|youtu\.be|m\.youtube\.com)/i, platform: 'youtube' },
  { pattern: /(?:tiktok\.com)/i, platform: 'tiktok' },
  { pattern: /(?:instagram\.com)/i, platform: 'instagram' },
  { pattern: /(?:facebook\.com|fb\.watch)/i, platform: 'facebook' },
  { pattern: /(?:x\.com|twitter\.com)/i, platform: 'x' },
];

const PLATFORM_LABELS: Record<MediaPlatform, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X',
};

@Component({
  selector: 'app-url-form',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div class="url-form">
      <label for="url-input" class="input-label">Pega una URL de video</label>
      <div class="input-row">
        <div class="input-wrapper">
          <input
            id="url-input"
            type="url"
            [ngModel]="url"
            (ngModelChange)="onInput($event)"
            (keydown.enter)="submit()"
            class="input-field"
            placeholder="https://www.youtube.com/watch?v=..."
            [disabled]="loading"
            autocomplete="off"
            spellcheck="false"
          />
          <span *ngIf="detectedPlatform" class="detected-badge">
            {{ getPlatformLabel(detectedPlatform) }} detectado
          </span>
        </div>
        <button
          type="button"
          class="btn-primary submit-btn"
          (click)="submit()"
          [disabled]="loading || !url.trim()"
          [attr.aria-label]="loading ? 'Analizando video...' : 'Analizar URL'"
        >
          <svg *ngIf="!loading" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <span *ngIf="loading" class="spinner"></span>
          {{ loading ? 'Analizando…' : 'Analizar' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .url-form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .input-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--color-text-secondary);
      letter-spacing: 0.01em;
    }

    .input-row {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    @media (min-width: 640px) {
      .input-row {
        flex-direction: row;
      }
    }

    .input-wrapper {
      position: relative;
      flex: 1;
    }

    .input-wrapper .input-field {
      padding-right: 120px;
    }

    @media (max-width: 639px) {
      .input-wrapper .input-field {
        padding-right: 18px;
      }
    }

    .detected-badge {
      position: absolute;
      right: 14px;
      top: 50%;
      transform: translateY(-50%);
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.03em;
      color: var(--color-accent);
      background: var(--color-accent-glow);
      border: 1px solid rgba(59, 130, 246, 0.2);
      white-space: nowrap;
      pointer-events: none;
      animation: badge-in 200ms ease-out;
    }

    .detected-badge::before {
      content: '';
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--color-accent);
      flex-shrink: 0;
    }

    @media (max-width: 639px) {
      .detected-badge {
        position: static;
        transform: none;
        margin-top: -4px;
        margin-bottom: 4px;
        width: fit-content;
      }
    }

    @keyframes badge-in {
      from { opacity: 0; transform: translateY(-50%) scale(0.9); }
      to { opacity: 1; transform: translateY(-50%) scale(1); }
    }

    .submit-btn {
      flex-shrink: 0;
      min-width: 120px;
      height: 48px;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 600ms linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class UrlFormComponent {
  url = '';
  detectedPlatform: MediaPlatform | null = null;

  @Input() loading = false;
  @Output() analyze = new EventEmitter<string>();

  onInput(value: string): void {
    this.url = value;
    this.detectedPlatform = this.detectPlatform(value);
  }

  submit(): void {
    const value = this.url.trim();
    if (value) {
      this.analyze.emit(value);
    }
  }

  getPlatformLabel(platform: MediaPlatform): string {
    return PLATFORM_LABELS[platform];
  }

  private detectPlatform(url: string): MediaPlatform | null {
    for (const { pattern, platform } of PLATFORM_PATTERNS) {
      if (pattern.test(url)) return platform;
    }
    return null;
  }
}
