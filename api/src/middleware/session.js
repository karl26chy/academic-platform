import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { currentUserState } from '../repositories/session.repository.js';

/**
 * Sesión del usuario a partir del JWT.
 *
 * El token solo prueba QUIÉN es el usuario. Rol, institución y si sigue
 * activo se leen de la base: así desactivar a alguien, cambiarle el rol o
 * moverlo de institución surte efecto de inmediato y no cuando expire el
 * token (8 h).
 */

export class SessionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Devuelve el usuario de la petición o lanza SessionError. */
export async function resolveSession(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw new SessionError(401, 'Sesión expirada o inválida. Inicia sesión de nuevo.');
  }
  const estado = await currentUserState(payload.sub);
  if (!estado) throw new SessionError(401, 'Sesión expirada o inválida. Inicia sesión de nuevo.');
  if (!estado.activo) throw new SessionError(403, 'Tu cuenta está desactivada. Contacta al administrador.');
  return { ...payload, rol: estado.rol, institucion_id: estado.institucion_id };
}

export function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}
