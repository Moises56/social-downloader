import { defineConfig } from 'vitest/config';

/** Renders reales de FFmpeg verificados con ffprobe. Requiere ffmpeg/ffprobe en el host. */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/integration/**/*.spec.ts'],
    testTimeout: 120_000,
  }
});
