#!/usr/bin/env bash
#
# Exporta las cookies del navegador a un fichero para que la API pueda descargar contenido
# que exige sesion (YouTube con restriccion de edad, Instagram, TikTok, X...).
#
#   ./scripts/export-cookies.sh [navegador]     # por defecto: chrome
#
# Por que un fichero y no leer el navegador en cada descarga: en macOS descifrar las cookies
# de Chrome exige la clave "Chrome Safe Storage" del llavero, y eso abre un dialogo. La API
# corre en segundo plano y no tiene quien lo conteste; el llavero deniega y yt-dlp sigue con
# CERO cookies emitiendo solo un warning. Aqui ese dialogo se contesta UNA vez, a mano.
set -euo pipefail

BROWSER="${1:-chrome}"
DEST="${YTDLP_COOKIES_FILE:-$HOME/.config/social-downloader/cookies.txt}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

YTDLP="$(grep -E '^YTDLP_BINARY=' "$ROOT/.env" 2>/dev/null | cut -d= -f2- || true)"
[ -z "${YTDLP:-}" ] && YTDLP="yt-dlp"
command -v "$YTDLP" >/dev/null 2>&1 || { echo "No encuentro yt-dlp en '$YTDLP'. Revisa YTDLP_BINARY en .env." >&2; exit 1; }

mkdir -p "$(dirname "$DEST")"

echo "Exportando cookies de $BROWSER..."
echo "Si aparece un dialogo del llavero, pulsa PERMITIR SIEMPRE."
echo

# Se usa una URL cualquiera con --simulate porque yt-dlp necesita algo que procesar para
# volcar el tarro de cookies; no se descarga nada.
"$YTDLP" --cookies-from-browser "$BROWSER" \
         --cookies "$DEST" \
         --simulate --quiet --no-warnings \
         "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

chmod 600 "$DEST"

echo "Listo: $DEST ($(grep -cv '^#' "$DEST" || echo 0) cookies)"
echo
echo "Anade esto a .env y reinicia la API:"
echo "  YTDLP_COOKIES_FILE=$DEST"
echo
echo "El fichero contiene tus sesiones en claro. Esta con permisos 600 y fuera del repo."
echo "Las cookies de YouTube caducan solas cada pocas semanas: vuelve a ejecutar esto cuando"
echo "reaparezca el aviso de sesion."
