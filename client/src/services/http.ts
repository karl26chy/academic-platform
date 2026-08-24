/**
 * Transporte HTTP: URL base, token de sesión y traducción de errores.
 * Es la única pieza que conoce `fetch`; los módulos de API construyen sobre ella.
 */

export const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || '/api';

const TOKEN_KEY = 'edu_platform_token';

/** Evento global emitido cuando el servidor rechaza la sesión. */
export const UNAUTHORIZED_EVENT = 'auth:unauthorized';

/** Estado que se le atribuye a un fallo sin respuesta del servidor. */
export const SIN_RESPUESTA = 0;

/**
 * Fallo de una llamada al API conservando el estado HTTP y el mensaje que
 * envió el servidor. Quien lo captura decide cómo presentarlo: sin el estado
 * es imposible distinguir "credenciales inválidas" de "backend caído".
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }

  /** No hubo respuesta: servidor caído, sin red o petición bloqueada. */
  get esFalloDeRed(): boolean {
    return this.status === SIN_RESPUESTA;
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export interface ApiFetchOptions extends RequestInit {
  /**
   * Marca el intento de autenticación. Un 401 en el login significa
   * "credenciales incorrectas", no "tu sesión caducó": no debe borrar el token
   * ni emitir el cierre de sesión global.
   */
  isAuthAttempt?: boolean;
}

/** Prefiere el mensaje del servidor; si no hay cuerpo, describe el estado. */
async function mensajeDelServidor(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (data?.error) return String(data.error);
  } catch {
    // respuesta sin cuerpo JSON: nos quedamos con el estado
  }
  return `API error: ${response.status} ${response.statusText}`;
}

export async function apiFetch<T>(
  endpoint: string,
  { isAuthAttempt = false, ...options }: ApiFetchOptions = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    // `no-store`: la respuesta depende del token, y la caché del navegador se
    // indexa solo por URL. Reutilizarla serviría datos de la sesión anterior.
    response = await fetch(url, { ...options, headers, cache: 'no-store' });
  } catch {
    throw new ApiError(
      SIN_RESPUESTA,
      'No se pudo conectar con el servidor API. Verifica que el backend esté activo.'
    );
  }

  if (!response.ok) {
    const message = await mensajeDelServidor(response);

    // Solo un 401 fuera del login invalida la sesión que teníamos por buena.
    if (response.status === 401 && !isAuthAttempt) {
      setAuthToken(null);
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }

    throw new ApiError(response.status, message);
  }

  return response.json();
}

/** Atajos para las operaciones REST que expone el API. */
export const http = {
  get: <T>(path: string, options?: ApiFetchOptions) => apiFetch<T>(path, options),
  post: <T>(path: string, body: unknown, options?: ApiFetchOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};
