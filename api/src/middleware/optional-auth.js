import requireAuth from './require-auth.js';
import { resolveSession, bearerToken, SessionError } from './session.js';

/** Adjunta el usuario si hay sesión válida; si no, sigue como anónimo. */
export async function optionalAuth(req, res, next) {
  const token = bearerToken(req);
  if (token) {
    try {
      req.user = await resolveSession(token);
    } catch (err) {
      // token inválido/expirado o cuenta desactivada: se trata como anónimo (público)
      if (!(err instanceof SessionError)) return next(err);
    }
  }
  next();
}

/** Única lectura pública del API; la necesita la pantalla de login. */
const isPublicRead = (resource, method) => resource === 'institutions' && method === 'GET';

/**
 * Deja pasar sin token solo las lecturas públicas; el resto exige sesión.
 *
 * NOTA: el recurso se extrae de originalUrl por posición, tal y como estaba.
 * Es frágil ante query strings, pero cambiarlo alteraría el comportamiento
 * actual, así que queda pendiente de aprobación.
 */
export function requireAuthOrPublic(req, res, next) {
  const resource = (req.originalUrl || '').split('/')[2];
  if (isPublicRead(resource, req.method)) return optionalAuth(req, res, next);
  return requireAuth(req, res, next);
}
