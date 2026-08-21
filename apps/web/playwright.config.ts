import { defineConfig } from '@playwright/test';

const CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  // En CI un fallo aislado suele ser ruido de arranque, no una regresión.
  retries: CI ? 2 : 0,
  forbidOnly: CI,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4205',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  /**
   * El Studio no funciona sin la API (subida de assets, presets, render), así que los E2E
   * levantan las dos. Sin esto había que arrancar `pnpm dev` a mano o la suite fallaba entera.
   * `reuseExistingServer` en local evita pelearse con un dev server ya abierto.
   */
  webServer: [
    {
      command: 'pnpm --filter @social-downloader/api start:dev',
      url: 'http://localhost:3005/api/studio/brand-presets',
      cwd: '../..',
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @social-downloader/web start',
      url: 'http://localhost:4205',
      cwd: '../..',
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
  ],
});
