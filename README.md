# Social Downloader

Proyecto educativo para analizar y descargar contenido multimedia autorizado desde YouTube, TikTok, Instagram, Facebook y X.

## Stack
- Angular 20
- NestJS
- pnpm workspaces
- yt-dlp
- FFmpeg

## macOS Apple Silicon
```bash
brew install node pnpm yt-dlp ffmpeg
pnpm install
pnpm dev:api
pnpm dev:web
```

## API inicial
- `POST /api/media/analyze`
- `POST /api/media/download`

> Usa la aplicación únicamente con contenido propio, autorizado o cuya descarga esté permitida.
