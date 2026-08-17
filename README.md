# Social Downloader + Studio

Aplicación educativa para analizar, descargar y crear videos listos para redes sociales.

## Objetivo

- detectar automáticamente la plataforma;
- analizar metadata del contenido;
- permitir elegir calidad disponible;
- descargar video o audio desde el navegador;
- crear videos con insignia de marca, textos y música;
- renderizar MP4 listo para TikTok, Instagram Reels, YouTube Shorts.

## Stack

- pnpm workspace
- Angular 20 (signals, standalone components)
- Tailwind CSS
- NestJS
- TypeScript estricto
- Zod
- Vitest
- Playwright
- yt-dlp
- FFmpeg

## Requisitos del sistema

```bash
brew install node
brew install pnpm
brew install yt-dlp
brew install ffmpeg
```

## Instalación

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Scripts

```bash
pnpm dev          # API + Web simultáneamente
pnpm dev:api      # Solo backend
pnpm dev:web      # Solo frontend
pnpm build        # Build completo
pnpm test         # Todos los tests
pnpm lint         # Lint completo
```

## Arquitectura

```
social-downloader/
  apps/
    api/                          # NestJS backend
      src/
        media/                    # Bounded context: Descargas
          domain/                 # Platform detection
          application/            # Service, SSRF guard, Semaphore
          infrastructure/         # yt-dlp wrapper
          presentation/           # REST controller
          shared/errors/          # ApiError, error codes
        studio/                   # Bounded context: Video Studio
          domain/                 # VideoComposition, BrandPreset
          application/            # Brand, TextOverlay, AudioMixing services
          infrastructure/         # FFmpeg service, renderer, storage
          presentation/           # Studio controller
    web/                          # Angular 20 frontend
      src/app/
        features/studio/          # Studio UI
          state/                  # Signal-based store
          services/               # API service
          studio.page.ts          # Main page
  packages/
    contracts/                    # Shared TypeScript types
```

## Endpoints

### Media (Descargas)

- `POST /api/media/analyze` — Analizar URL
- `POST /api/media/download/prepare` — Preparar descarga
- `GET /api/media/download/:token` — Descargar archivo

### Studio (Video Creation)

- `GET /api/studio/brand-presets` — Listar presets de marca
- `POST /api/studio/sources/upload` — Subir video fuente
- `POST /api/studio/compositions` — Crear composición
- `POST /api/studio/renders` — Iniciar renderizado
- `GET /api/studio/renders/:id` — Consultar estado
- `GET /api/studio/renders/:id/download` — Descargar resultado

## Studio — Módulo de Video

### Flujo

1. Subir video fuente (o usar video descargado)
2. Seleccionar preset de marca (`Ilusiones & Colores`)
3. Configurar textos (versículos, frases, CTAs)
4. Agregar música/sonidos
5. Renderizar MP4 1080x1920 (9:16)
6. Descargar resultado

### Preset: Ilusiones & Colores

- Insignia: `@Ilusiones&Colores`
- Estilo: serif italic, cream (#f6efe2), opacidad 62%
- Modos: `ending` (últimos 2.5s), `persistent` (todo el video), `segmented` (tramos)
- Animaciones: fade-in, fade-out

### Tipos de texto soportados

- `message` — Mensaje principal
- `verse` — Versículo bíblico
- `reflection` — Reflexión
- `cta` — Call to action
- `poem` — Poema
- `quote` — Cita

### Audio

- Mantener audio original (con volumen ajustable)
- Agregar música adicional
- Fade in/out por pista
- Mezcla con `amix`

### Output

- Formato: MP4
- Resolución: 1080x1920 (9:16)
- Video: H.264, CRF 23
- Audio: AAC 192kbps
- Optimizado para redes sociales (`-movflags +faststart`)

## Seguridad

- SSRF guard con resolución DNS
- Bloqueo de IPs privadas
- Tamaño máximo de descarga
- Concurrency limitada (semaphore)
- Temporales aislados por UUID
- Limpieza automática
- Sin `exec()` — solo `spawn()`

## Consideraciones legales

Usa esta herramienta únicamente con contenido propio, autorizado o cuya descarga esté permitida por la plataforma y por la ley aplicable.
