export type ApiErrorCode =
  | 'INVALID_URL'
  | 'UNSUPPORTED_PLATFORM'
  | 'MEDIA_NOT_AVAILABLE'
  | 'PRIVATE_MEDIA'
  | 'AUTH_REQUIRED'
  | 'GEO_RESTRICTED'
  | 'FORMAT_NOT_AVAILABLE'
  | 'DOWNLOAD_TOO_LARGE'
  | 'ANALYSIS_TIMEOUT'
  | 'DOWNLOAD_TIMEOUT'
  | 'DOWNLOAD_FAILED'
  | 'DOWNLOAD_CANCELLED'
  | 'YTDLP_NOT_AVAILABLE'
  | 'SSRF_BLOCKED'
  | 'INVALID_DOWNLOAD_TOKEN'
  | 'TOO_MANY_REQUESTS'
  | 'STUDIO_ASSET_NOT_FOUND'
  | 'STUDIO_ASSET_TOO_LARGE'
  | 'STUDIO_INVALID_COMPOSITION'
  | 'STUDIO_RENDER_FAILED'
  | 'STUDIO_RENDER_TIMEOUT'
  | 'STUDIO_RENDER_CANCELLED'
  | 'STUDIO_FFMPEG_NOT_AVAILABLE'
  | 'STUDIO_UNSUPPORTED_FORMAT'
  | 'STUDIO_INVALID_SOURCE'
  | 'STUDIO_COMPOSITION_NOT_FOUND'
  | 'STUDIO_RENDER_NOT_FOUND';

export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  INVALID_URL: 'La URL no es válida.',
  UNSUPPORTED_PLATFORM: 'Esta plataforma no es compatible.',
  MEDIA_NOT_AVAILABLE: 'El contenido no está disponible.',
  PRIVATE_MEDIA: 'Este contenido es privado.',
  AUTH_REQUIRED: 'Se requiere iniciar sesión para acceder.',
  GEO_RESTRICTED: 'Este contenido no está disponible en tu región.',
  FORMAT_NOT_AVAILABLE: 'El formato solicitado no está disponible.',
  DOWNLOAD_TOO_LARGE: 'El archivo excede el tamaño máximo permitido.',
  ANALYSIS_TIMEOUT: 'El análisis tardó demasiado. Intenta con otra URL.',
  DOWNLOAD_TIMEOUT: 'La descarga tardó demasiado. Intenta nuevamente.',
  DOWNLOAD_FAILED: 'No se pudo completar la descarga.',
  DOWNLOAD_CANCELLED: 'La descarga fue cancelada.',
  YTDLP_NOT_AVAILABLE: 'El servicio de descarga no está disponible.',
  SSRF_BLOCKED: 'La URL apunta a un recurso restringido.',
  INVALID_DOWNLOAD_TOKEN: 'El enlace de descarga expiró o no es válido.',
  TOO_MANY_REQUESTS: 'Demasiadas solicitudes. Espera un momento.',
  STUDIO_ASSET_NOT_FOUND: 'El recurso no fue encontrado.',
  STUDIO_ASSET_TOO_LARGE: 'El archivo excede el tamaño máximo permitido.',
  STUDIO_INVALID_COMPOSITION: 'La composición no es válida.',
  STUDIO_RENDER_FAILED: 'Error al renderizar el video.',
  STUDIO_RENDER_TIMEOUT: 'La renderización tardó demasiado.',
  STUDIO_RENDER_CANCELLED: 'La renderización fue cancelada.',
  STUDIO_FFMPEG_NOT_AVAILABLE: 'El servicio de renderización no está disponible.',
  STUDIO_UNSUPPORTED_FORMAT: 'El formato no es compatible.',
  STUDIO_INVALID_SOURCE: 'La fuente no es válida.',
  STUDIO_COMPOSITION_NOT_FOUND: 'La composición no fue encontrada.',
  STUDIO_RENDER_NOT_FOUND: 'La renderización no fue encontrada.',
};
