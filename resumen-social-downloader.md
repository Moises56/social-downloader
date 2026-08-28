Resumen completo del proyecto — Social Downloader + Studio
1. Objetivo general

El proyecto se llama:

social-downloader

Repositorio:

https://github.com/Moises56/social-downloader

Rama principal de trabajo actual:

feat/initial-architecture

Es un proyecto educativo, funcional y sin fines comerciales cuyo objetivo inicial fue crear una aplicación web capaz de:

recibir una URL de una red social;
detectar automáticamente la plataforma;
analizar el contenido;
mostrar metadata y formatos disponibles;
descargar video o audio;
mantener buena calidad;
evitar cargar archivos grandes completos en memoria;
permitir al navegador gestionar la descarga.

Plataformas contempladas:

YouTube
YouTube Shorts
X / Twitter
TikTok
Instagram
Instagram Reels
Facebook
Facebook Reels

Posteriormente el proyecto evolucionó para incorporar un segundo bounded context llamado:

Studio

El objetivo de Studio es tomar un video descargado o subido por el usuario y convertirlo en una pieza lista para publicar en redes sociales.

El caso de uso principal actual es la marca:

@Ilusiones&Colores

2. Stack tecnológico

El proyecto es un monorepo con pnpm workspaces.

Stack:

Frontend
Angular 20
TypeScript estricto
Tailwind CSS
Angular Signals
Playwright


Backend
NestJS
TypeScript
yt-dlp
FFmpeg
ffprobe
Zod


Monorepo
pnpm workspaces


Testing
Vitest
Playwright


Multimedia
yt-dlp
FFmpeg
ffprobe

Entorno principal de desarrollo:

macOS
Apple Silicon
MacBook M5 Pro
ARM64

No se depende de Rosetta.

3. Estructura general

Aproximadamente:

social-downloader/
├── apps/
│   ├── api/
│   │   └── NestJS
│   │
│   └── web/
│       └── Angular
│
├── packages/
│   └── contracts/
│
├── pnpm-workspace.yaml
├── package.json
├── .env.example
└── README.md

Los contratos compartidos se encuentran en:

packages/contracts

El package:

@social-downloader/contracts

es la fuente común de tipos entre Angular y NestJS.

4. Configuración local

Actualmente el desarrollo está configurado aproximadamente así:

API_PORT=3005
WEB_ORIGIN=http://localhost:4205


YTDLP_BINARY=yt-dlp
FFMPEG_BINARY=ffmpeg


ANALYSIS_TIMEOUT_MS=30000
DOWNLOAD_TIMEOUT_MS=900000


MAX_DOWNLOAD_SIZE_MB=2048
MAX_CONCURRENT_DOWNLOADS=2


YTDLP_COOKIES_FROM_BROWSER=

Frontend:

http://localhost:4205

Backend:

http://localhost:3005

5. Downloader v1.1

El Downloader ya está esencialmente terminado y estable.

Flujo
URL
↓
Angular
↓
POST /api/media/analyze
↓
NestJS
↓
validación
↓
detección plataforma
↓
SSRF guard
↓
yt-dlp
↓
metadata + formatos
↓
selección usuario
↓
prepare download
↓
token temporal
↓
stream HTTP nativo
↓
navegador
6. Análisis de media

El backend utiliza yt-dlp para analizar URLs.

Conceptualmente:

yt-dlp \
  --dump-single-json \
  --skip-download \
  --no-playlist \
  URL

Se normaliza el JSON y no se expone directamente toda la respuesta interna de yt-dlp.

La aplicación devuelve información como:

plataforma;
título;
autor;
duración;
thumbnail;
formatos;
resolución;
codecs;
tamaño cuando está disponible.
7. Descarga de videos

Para video se utiliza yt-dlp y FFmpeg.

Se soportan diferentes calidades según la disponibilidad real.

Ejemplos:

2160p
1440p
1080p
720p
480p
360p

No se realiza upscaling desde el Downloader.

yt-dlp descarga streams apropiados y FFmpeg los combina cuando es necesario.

8. Descarga de audio

Formatos soportados:

MP3
M4A
OPUS

MP3 se convierte realmente con FFmpeg.

No se limita a renombrar extensiones.

Los MIME types están centralizados.

Ejemplos:

mp3  → audio/mpeg
m4a  → audio/mp4
opus → audio/ogg
mp4  → video/mp4
webm → video/webm

Se corrigió además un bug de audio relacionado con la detección del archivo final y se mejoró logging.

9. Streaming de descargas

La implementación inicial utilizaba:

response.blob()

pero esto fue eliminado porque podía cargar videos de varios GB completamente en memoria.

Ahora existe flujo de preparación y descarga mediante token temporal.

Conceptualmente:

POST /api/media/download/prepare
↓
download token
↓
GET /api/media/download/:token
↓
stream

El navegador recibe directamente el archivo mediante streaming HTTP.

10. Temporales

Cada operación trabaja con directorios temporales aislados.

Ejemplo:

/tmp/social-downloader/<uuid>

Se implementó cleanup idempotente.

Los temporales se eliminan cuando:

el streaming termina;
ocurre error;
el cliente cancela;
se cierra la conexión;
ocurre una excepción.
11. Cancelación de yt-dlp

La API soporta cancelación real de procesos.

Se utiliza:

AbortController
AbortSignal

La estrategia es aproximadamente:

SIGTERM
↓
grace period
↓
SIGKILL si sigue vivo

Esto evita procesos yt-dlp abandonados.

12. Seguridad SSRF

Se realizó hardening del backend.

Existe un SSRF guard que incluye:

validación de protocolo;
validación del hostname;
resolución DNS;
bloqueo de localhost;
bloqueo de loopback;
redes privadas;
link-local;
IPv6 privado;
hosts no permitidos.

Plataformas permitidas incluyen:

youtube.com
youtu.be
tiktok.com
instagram.com
facebook.com
fb.watch
x.com
twitter.com

Se validan también subdominios correctamente.

13. Límites operativos

Existe:

MAX_DOWNLOAD_SIZE_MB=2048
MAX_CONCURRENT_DOWNLOADS=2

El tamaño máximo se valida:

mediante metadata cuando está disponible;
y nuevamente sobre el archivo real cuando corresponde.

También existe un semaphore para limitar procesos concurrentes.

Esto evita lanzar demasiados procesos de:

yt-dlp
FFmpeg

simultáneamente.

14. Sistema de errores

Existe un sistema centralizado de errores.

Ubicación aproximada:

apps/api/src/media/shared/errors/
├── api-error.ts
├── error-codes.ts
├── yt-dlp-error-mapper.ts
└── index.ts

ApiError extiende HttpException.

Los códigos incluyen casos similares a:

INVALID_URL
UNSUPPORTED_PLATFORM
MEDIA_NOT_AVAILABLE
PRIVATE_MEDIA
AUTH_REQUIRED
GEO_RESTRICTED
FORMAT_NOT_AVAILABLE
DOWNLOAD_TOO_LARGE
ANALYSIS_TIMEOUT
DOWNLOAD_TIMEOUT
DOWNLOAD_FAILED
DOWNLOAD_CANCELLED
YTDLP_NOT_AVAILABLE

La API no expone:

stderr completo;
rutas locales;
stack traces;
comandos;
detalles internos.

Angular muestra mensajes amigables.

15. Frontend Downloader

La primera versión tenía todo dentro de AppComponent.

Luego fue modularizada.

Actualmente utiliza:

componentes separados;
Angular Signals;
computed();
contratos compartidos;
environments;
estado de análisis;
estado de descarga;
detección visual de plataforma.

Se eliminaron tipos locales duplicados.

16. Diseño del Downloader

Se realizó una pasada completa de UX/UI premium.

Las referencias principales fueron:

https://impeccable.style/

y principios de frontend-design.

Objetivos visuales:

moderno;
limpio;
premium;
minimalista;
responsive;
accesible;
no parecer template genérico;
no parecer UI típica generada por IA.

Incluye:

custom design tokens;
skeletons;
detección de plataforma;
estados claros;
mensajes amigables;
feedback de descarga;
mobile-first.
17. Downloader: estado final

Fue probado correctamente al menos con:

YouTube;
X / Twitter.

También se realizaron pruebas con las demás plataformas contempladas durante las fases posteriores.

El Downloader está considerado suficientemente estable para no ser el foco actual del desarrollo.

No modificarlo salvo que Studio revele una regresión real.

18. Studio — objetivo

Studio es un bounded context independiente.

Su objetivo es transformar:

Video fuente
↓
composición
↓
branding
↓
texto
↓
música / audio
↓
FFmpeg
↓
video final

Caso de uso principal:

@Ilusiones&Colores

Contenido esperado:

videos bíblicos;
mensajes cristianos;
reflexiones;
poemas;
frases motivacionales;
contenido emocional;
Reels;
TikTok;
Shorts;
Facebook Reels.
19. Studio — arquitectura

Existe un bounded context aproximadamente:

apps/api/src/studio/
├── domain/
├── application/
├── infrastructure/
│   ├── ffmpeg/
│   └── storage/
├── presentation/
└── studio.module.ts

Frontend:

apps/web/src/app/features/studio/
├── components/
├── services/
├── state/
└── studio.page.ts
20. Modelo de composición

Studio trabaja con conceptos similares a:

VideoComposition
VideoSource
BrandPreset
Overlay
TextOverlay
BrandOverlay
AudioTrack
RenderedVideo

El concepto principal es una composición declarativa.

Ejemplo conceptual:

interface VideoComposition {
  source: VideoSource;


  output: {
    width: number;
    height: number;
    fps?: number;
    format: 'mp4';
  };


  brandPresetId?: string;


  overlays: Overlay[];
  textTracks: TextOverlay[];
  audioTracks: AudioTrack[];


  keepOriginalAudio?: boolean;
  originalAudioVolume?: number;
}
21. Asset storage

Studio posee storage temporal de assets.

No se aceptan rutas arbitrarias enviadas desde Angular.

El frontend utiliza:

assetId

en lugar de:

/Users/.../video.mp4

Esto evita:

path traversal;
exposición de rutas;
filesystem injection.

Existe almacenamiento temporal para:

fuentes;
música;
SFX;
renders.
22. Renderer FFmpeg

Existe:

FFmpegVideoRenderer

basado en:

spawn()

No se utiliza exec() con contenido suministrado por usuario.

Soporta:

render;
cancelación;
cleanup;
timeout;
audio;
overlays;
branding;
textos.
23. Identidad principal: @Ilusiones&Colores

La firma principal de Studio es:

@Ilusiones&Colores

Se trata como un elemento central del branding.

Debe poder funcionar como:

Ending signature

Aparece en los últimos segundos.

Ejemplo:

13s → 15s
@Ilusiones&Colores
Persistent watermark

Visible durante todo o casi todo el video.

Timed watermark

Aparece solamente en segmentos determinados.

24. Referencia visual

El estilo de @Ilusiones&Colores busca videos similares conceptualmente a piezas verticales con:

imagen/video emocional;
tipografía serif editorial;
colores marfil/blanco cálido;
mensaje principal;
versículo;
CTA;
firma final.

Ejemplos de estructura:

MENSAJE PRINCIPAL


“A donde tú vayas, iré;
tu pueblo será mi pueblo.”


Rut 1:16


Compártelo con quien no te soltó


@Ilusiones&Colores

La intención es que los videos salgan prácticamente listos para publicar.

25. Text overlays

Studio ya soporta overlays temporales.

Cada overlay puede manejar:

texto;
inicio;
fin;
posición;
estilo;
animación.

Tipos de contenido contemplados:

Hero text
Scripture
Bible reference
Reflection
Poem
Motivational phrase
CTA
Signature
26. Presets editoriales

Se añadieron estilos/presets visuales como:

Hero Editorial
Scripture
Reflection
CTA
Signature

También existen presets de composición.

Entre ellos se diseñaron presets especializados para:

Ilusiones & Colores

Por ejemplo:

Ilusiones & Colores — Devotional
Ilusiones & Colores — Persistent Brand
27. Preview

Studio posee preview sincronizada.

La idea es no ejecutar FFmpeg por cada cambio.

Se utiliza:

<video>
+
HTML/CSS overlays

para aproximar inmediatamente:

posición;
timing;
textos;
firma;
composición.

El preview está sincronizado con el playhead.

28. Timeline

Se añadió timeline simple.

No pretende competir con Premiere o CapCut.

Permite visualizar pistas como:

VIDEO
TEXT
BRAND
MUSIC
SFX

Conceptualmente:

0s        5s       10s       15s


VIDEO █████████████████████████


TEXT  ──██████─────████────────


BRAND ───────────────────██████


MUSIC █████████████████████████
29. Safe zones

Studio incorpora safe zones para contenido vertical.

El objetivo es evitar que:

texto;
CTA;
firma;

queden detrás de:

botones de TikTok;
controles de Reels;
UI de Shorts.

Estas guías aparecen en preview, pero no en el render final.

30. Música

Studio soporta pistas adicionales de música.

Controles:

volumen;
inicio;
fade in;
fade out;
loop.

Existen presets simples de volumen como:

Background
Balanced
Prominent
31. Sound Effects

También existe soporte para pistas SFX.

Casos esperados:

whoosh
nature
rain
water
wind
ambient
soft impact

Los archivos los proporciona el usuario.

No existe integración con bancos externos todavía.

32. Audio original

El usuario puede:

mantener audio original;
apagarlo;
modificar volumen;
combinarlo con música;
aplicar ducking simple.
33. Render progress

FASE 13 completada.

El render tiene progreso real mediante:

SSE
+
FFmpeg progress

La interfaz puede mostrar:

Preparando
Renderizando
42%
Finalizando
Listo

No es un porcentaje inventado.

34. Cancel render

FASE 14 completada.

Existe:

endpoint para cancelar;
botón en Angular;
AbortController;
terminación del FFmpeg process;
cleanup.
35. Re-render

FASE 15 completada.

Después del render:

Descargar
Editar
Renderizar nuevamente

El usuario puede modificar la composición sin volver a subir el video.

36. Duplicar composiciones

FASE 16 completada.

Studio permite:

Duplicate composition

Esto facilita crear múltiples variantes del mismo video.

También se implementaron saved presets.

Commit agrupado conocido de fases 13–16:

bd3e61b

37. Export presets

FASE 17 fue implementada posteriormente.

Presets contemplados:

TikTok / Reels / Shorts
Social High Quality
Social Compact

Formato principal:

1080x1920
9:16
H.264
AAC
30fps
MP4
yuv420p
faststart
38. Adaptación del video fuente

FASE 18 agregó modos para videos que no sean 9:16.

Modos:

Crop
Fit + Blur
Fit + Background
Crop

Llena la pantalla vertical recortando.

Fit + Blur

Mantiene el video completo sobre fondo desenfocado.

Fit + Background

Utiliza fondo configurable.

Preview y renderer deben mantenerse consistentes.

39. UX final Studio

FASE 19 realizó refinamiento fuerte.

Referencias:

impeccable.style;
frontend-design.

Desktop:

Preview
+
Editor lateral
+
Timeline

Mobile:

Preview
↓
Timeline
↓
Text
Brand
Audio
Export

Studio debe sentirse como producto creativo real, no dashboard genérico.

40. Autosave

FASE 20 añadió recuperación temporal.

No existe base de datos.

Se utiliza almacenamiento temporal de composición y pequeñas referencias de sesión/localStorage cuando corresponde.

Objetivo:

Reload browser
↓
compositionId
↓
recover composition

No se guardan videos en localStorage.

41. Validaciones visuales

FASE 21 añadió warnings.

Casos:

texto demasiado largo;
texto fuera de safe zones;
timing inválido;
CTA solapado con branding;
pistas de audio fuera de duración;
posible conflicto música/audio original.

Son warnings, no bloqueos excesivos.

42. FASE 22 — FFmpeg Integration Tests

COMPLETADA.

Commit:

e2d2c5b

Se agregaron integration tests reales de FFmpeg.

Objetivo:

probar el renderer con archivos multimedia reales pequeños y verificar resultados usando ffprobe.

Casos contemplados:

brand-only
text-only
text + brand
music
music + original audio
multiple overlays
crop
fit-blur

Validaciones:

archivo generado;
container;
resolución;
duración;
video codec;
audio codec;
streams;
cleanup.
43. Estado actual exacto

Actualmente el roadmap se encuentra aquí:

[✓] FASE 22: FFmpeg integration tests
    Commit: e2d2c5b


[•] FASE 23: Playwright E2E Studio


[ ] FASE 24: Real case Ilusiones & Colores


[ ] FASE 25: Documentation Studio v1

Por tanto, NO repetir fases anteriores.

44. FASE 23 — tarea actual

La fase activa es:

Playwright E2E Studio

Debe cubrir un flujo aproximadamente:

abrir Studio
↓
cargar o mockear video source
↓
seleccionar preset Ilusiones & Colores
↓
editar texto
↓
agregar CTA
↓
configurar watermark
↓
seleccionar export preset
↓
renderizar
↓
mostrar progreso
↓
mostrar success
↓
ofrecer descarga

También sería deseable probar:

cancel render

si se puede hacer sin generar un E2E frágil.

No depender de Internet.

Usar fixtures pequeños/locales y mocks cuando corresponda.

Commit esperado:

test(web): cubrir flujo principal del studio
45. FASE 24 — caso real Ilusiones & Colores

Después de Playwright debe realizarse una prueba end-to-end representativa de producción.

Caso sugerido:

15 segundos
1080x1920
9:16

Ejemplo conceptual:

0–5s


SU FE NO EMPEZÓ
CON CERTEZA,
SINO ELIGIENDO
A QUIÉN NO SOLTAR




5–10s


“A donde tú vayas, iré;
tu pueblo será mi pueblo.”




9–12s


Rut 1:16




11–14s


Compártelo con quien no te soltó




13–15s


@Ilusiones&Colores

Objetivo:

comprobar timing;
legibilidad;
safe zones;
estética editorial;
CTA;
firma final;
audio;
resultado real MP4.

No utilizar material protegido innecesario dentro del repositorio.

Usar fixture propio/libre/sintético.

Commit esperado:

test(studio): validar composición editorial Ilusiones y Colores
46. FASE 25 — documentación final

Después de validar el caso real, actualizar documentación.

Debe incluir:

Flujo Studio
1. Seleccionar/cargar video
2. Elegir preset
3. Agregar textos
4. Configurar @Ilusiones&Colores
5. Configurar música/SFX
6. Revisar preview
7. Ajustar timeline
8. Elegir export preset
9. Renderizar
10. Descargar

Documentar también:

preview;
timeline;
safe zones;
text presets;
composition presets;
branding;
ending watermark;
persistent watermark;
timed watermark;
música;
SFX;
audio original;
progress;
cancel render;
re-render;
duplicate;
autosave;
crop;
fit blur;
export presets.

Commit esperado:

docs: documentar flujo de producción de studio v1
47. Testing actual

Antes de las últimas fases el proyecto había alcanzado:

87 tests

en Studio Foundation:

78 API
9 Web

Después se han añadido más tests, incluyendo los integration tests FFmpeg de la FASE 22.

Claude debe consultar el estado actual real con:

pnpm test

y reportar el número exacto actualizado.

48. Calidad obligatoria

Antes de cada commit:

pnpm lint
pnpm test
pnpm build

Para fases multimedia:

también realizar smoke/integration test FFmpeg.

Para frontend:

Playwright cuando corresponda.

No hacer commit si los checks están en rojo.

49. Git workflow

Cada fase debe tener commit independiente y push.

Antes de continuar:

git status --short
git branch --show-current
git log --oneline -15

Esperado:

feat/initial-architecture

No hacer commit directo a main.

No reescribir historia.

No borrar cambios ajenos.

50. Diseño y marca

Para cualquier cambio visual pendiente, mantener:

https://impeccable.style/

como referencia de calidad.

Principios:

editorial;
premium;
moderno;
excelente whitespace;
jerarquía;
mobile-first;
accesibilidad;
microinteracciones sutiles;
nada genérico.

La UI y los videos deben sentirse diseñados específicamente para producción de contenido social.

51. Regla crítica del branding

La marca exacta es:

@Ilusiones&Colores

No cambiarla por:

@Ilusiones & Colores
@IlusionesColores
Ilusiones & Colores

cuando se trate de la insignia oficial del video.

Debe preservarse exactamente:

@Ilusiones&Colores

salvo que el usuario explícitamente edite el contenido.

52. Lo que NO debe implementarse todavía

Fuera de alcance de Studio v1:

generación de textos con IA;
generación automática de versículos;
TTS;
ElevenLabs;
subtítulos automáticos;
música desde APIs externas;
cuentas de usuarios;
login;
base de datos;
cloud storage;
colaboración;
timeline tipo Premiere;
keyframes avanzados;
editor frame-by-frame.

No ampliar scope antes de terminar FASE 23–25.

53. Objetivo final

Después de completar las fases restantes, Studio debe poder producir:

video fuente
+
preset Ilusiones & Colores
+
mensaje principal
+
versículo/reflexión
+
CTA
+
@Ilusiones&Colores
+
música/audio
↓
preview
↓
timeline
↓
render FFmpeg
↓
MP4 1080x1920
↓
publicación en TikTok/Reels/Shorts/Facebook
54. Estado esperado al terminar

La salida final debe reportarse así:

STUDIO V1 — FINAL


Git:
- Branch
- Último commit
- Working tree


FASE 23:
- Playwright E2E
- Resultados


FASE 24:
- Caso real Ilusiones & Colores
- Render generado
- Validación ffprobe
- Timing
- Branding


FASE 25:
- Documentación


Rendering:
- FFmpeg version
- Output
- Resolution
- Video codec
- Audio codec
- Progress
- Cancellation


Tests:
- Unit
- API
- Web
- Integration
- E2E
- Total


Validation:
- lint
- test
- build


Known limitations:
- ...


READY FOR REAL CONTENT PRODUCTION:
YES / NO
Instrucción inmediata para Claude Cowork

No vuelvas a implementar Studio Foundation ni las fases 1–22.

Primero inspecciona el estado Git y confirma que el commit e2d2c5b está presente.

Después continúa exactamente con:

FASE 23 → Playwright E2E Studio
FASE 24 → Caso real @Ilusiones&Colores
FASE 25 → Documentación Studio v1

Cada fase debe terminar en:

lint
test
build
commit
push

antes de pasar a la siguiente.