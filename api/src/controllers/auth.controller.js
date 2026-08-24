import * as authService from '../services/auth.service.js';
import { HttpError } from '../shared/http-error.js';

/**
 * Las rutas de autenticación responden sus propios errores (no delegan en el
 * manejador central) para conservar el mensaje de 500 propio del login.
 */
const responder = (res, err, contexto) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(`${contexto}:`, err);
  res.status(500).json({ error: 'Error del servidor.' });
};

export async function login(req, res) {
  try {
    const { email, identificacion, password } = req.body || {};
    res.json(await authService.login({ email, identificacion, password }));
  } catch (err) {
    responder(res, err, 'Error en login');
  }
}

export async function me(req, res) {
  try {
    res.json(await authService.currentUser(req.user.sub));
  } catch (err) {
    responder(res, err, 'Error en /me');
  }
}
