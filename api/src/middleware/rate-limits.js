import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';

/**
 * Límites de uso del API.
 *
 * Un colegio suele salir a internet con UNA sola IP para todos sus equipos:
 * por eso los límites del API se cuentan por usuario autenticado y solo por
 * IP cuando no hay sesión. El login, que no tiene usuario, se cuenta por IP +
 * cuenta intentada, de modo que un estudiante que se equivoca no bloquea al
 * resto del colegio.
 */

const MINUTO = 60 * 1000;
const numero = (valor, porDefecto) => Number(valor) > 0 ? Number(valor) : porDefecto;
const mensaje = (texto) => ({ error: texto });

/** Usuario del token (solo firma, sin ir a la base) o, si no hay, la IP. */
function usuarioOIp(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    try {
      return 'u:' + jwt.verify(header.slice(7), config.jwtSecret, { algorithms: ['HS256'] }).sub;
    } catch {
      // token inválido: cuenta por IP
    }
  }
  return 'ip:' + req.ip;
}

const base = { standardHeaders: true, legacyHeaders: false };

/** Intentos FALLIDOS por IP + cuenta: frena adivinar la contraseña de alguien. */
const loginPorCuenta = rateLimit({
  ...base,
  windowMs: 15 * MINUTO,
  max: numero(process.env.LOGIN_MAX_FAILS_PER_ACCOUNT, 10),
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const { email, identificacion } = req.body || {};
    const cuenta = String(email || identificacion || '').trim().toLowerCase();
    return `${req.ip}|${cuenta}`;
  },
  message: mensaje('Demasiados intentos fallidos con esta cuenta. Intenta de nuevo en 15 minutos.'),
});

/** Intentos FALLIDOS por IP: frena probar muchas cuentas desde un mismo sitio. */
const loginPorIp = rateLimit({
  ...base,
  windowMs: 15 * MINUTO,
  max: numero(process.env.LOGIN_MAX_FAILS_PER_IP, 100),
  skipSuccessfulRequests: true,
  message: mensaje('Demasiados intentos fallidos desde esta red. Intenta de nuevo en 15 minutos.'),
});

export const loginRateLimit = [loginPorIp, loginPorCuenta];

/** Uso general del API por usuario (o IP sin sesión). */
export const apiRateLimit = rateLimit({
  ...base,
  windowMs: MINUTO,
  max: numero(process.env.API_MAX_PER_MINUTE, 600),
  keyGenerator: usuarioOIp,
  message: mensaje('Demasiadas peticiones. Espera un momento e intenta de nuevo.'),
});

/** Boletín PDF individual: cada uno abre una página de Chromium. */
export const pdfRateLimit = rateLimit({
  ...base,
  windowMs: MINUTO,
  max: numero(process.env.PDF_MAX_PER_MINUTE, 60),
  keyGenerator: usuarioOIp,
  message: mensaje('Demasiados boletines generados seguidos. Espera un minuto.'),
});

/** Boletines masivos: un grado entero por petición. */
export const bulkPdfRateLimit = rateLimit({
  ...base,
  windowMs: 10 * MINUTO,
  max: numero(process.env.BULK_PDF_MAX_PER_10_MINUTES, 5),
  keyGenerator: usuarioOIp,
  message: mensaje('Demasiadas generaciones masivas seguidas. Espera unos minutos.'),
});
