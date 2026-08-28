import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <nav class="top-nav">
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">Downloader</a>
      <a routerLink="/studio" routerLinkActive="active">Studio</a>
    </nav>
    <router-outlet></router-outlet>
  `,
  styles: [`
    .top-nav {
      display: flex;
      gap: 4px;
      padding: 12px 20px;
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-border-subtle);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .top-nav a {
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-secondary);
      text-decoration: none;
      transition: all 0.2s;
    }
    .top-nav a:hover { color: var(--color-text); background: var(--color-bg); }
    .top-nav a.active { color: var(--color-accent); background: rgba(59, 130, 246, 0.1); }
  `],
})
export class AppComponent {}
