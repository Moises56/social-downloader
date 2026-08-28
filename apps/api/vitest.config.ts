import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Los specs de `integration/` lanzan renders reales de FFmpeg (lentos y dependientes
    // de los binarios del host), así que quedan fuera del run por defecto.
    // Se ejecutan aparte con `pnpm test:integration`.
    include: ['src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'src/**/integration/**'],
    coverage: { provider: 'v8', reporter: ['text', 'html'] }
  }
});
