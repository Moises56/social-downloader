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
  | 'TOO_MANY_REQUESTS';

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
};
