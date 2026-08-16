# Social Downloader

Aplicación educativa para analizar y descargar contenido multimedia de redes sociales mediante URLs públicas y contenido autorizado.

## Objetivo

- detectar automáticamente la plataforma;
- analizar metadata del contenido;
- permitir elegir calidad disponible;
- descargar video o audio desde el navegador;
- crear una base sólida con Angular + NestJS + yt-dlp.

## Stack

- pnpm workspace
- Angular 20
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
uname -m
```

Debe devolver:

```bash
arm64
```

## Instalación

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Scripts

```bash
pnpm dev
pnpm dev:api
pnpm dev:web
pnpm build
pnpm test
pnpm lint
```

## Endpoints

- POST /api/media/analyze
- POST /api/media/download

## Consideraciones legales

Usa esta herramienta únicamente con contenido propio, autorizado o cuya descarga esté permitida por la plataforma y por la ley aplicable.

## Arquitectura

- apps/web: frontend Angular + Tailwind
- apps/api: backend NestJS
- packages/contracts: contratos compartidos
- temp: archivos temporales de trabajo

## Troubleshooting

- Si `yt-dlp` no existe, instala el binario con Homebrew.
- Si `ffmpeg` no existe, instálalo también.
- Si la API no responde, revisa la variable `WEB_ORIGIN` o `API_PORT`.
- Si los archivos temporales quedan residuales, limpia `temp/`.
