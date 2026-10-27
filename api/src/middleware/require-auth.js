import { resolveSession, bearerToken, SessionError } from './session.js';

/** Exige un JWT válido de un usuario activo y deja el usuario en req.user. */
export default async function requireAuth(req, res, next) {
  const token = bearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
  }

  try {
    req.user = await resolveSession(token);
    next();
  } catch (err) {
    if (err instanceof SessionError) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}
