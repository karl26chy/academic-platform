import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { apiRateLimit } from './middleware/rate-limits.js';

const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

/** TRUST_PROXY: número de saltos ("1"), o un valor de Express ("loopback"). */
const TRUST_PROXY = (() => {
  const raw = (process.env.TRUST_PROXY ?? '1').trim();
  return /^\d+$/.test(raw) ? Number(raw) : raw;
})();

/**
 * En producción un único contenedor sirve frontend + API: Express monta el
 * frontend compilado (client/dist) y el API vive bajo /api. Solo se activa con
 * NODE_ENV=production y cuando client/dist existe, para no alterar el dev local
 * ni los tests (que corren con NODE_ENV distinto).
 *
 * La ruta varía según el layout: en el repo es <raiz>/client/dist y en el
 * contenedor único (backend en /app) es /app/client/dist. Se prueban ambos.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = [
  path.resolve(here, '..', '..', 'client', 'dist'),
  path.resolve(here, '..', 'client', 'dist'),
].find(p => existsSync(p));
const SERVE_CLIENT = process.env.NODE_ENV === 'production' && Boolean(CLIENT_DIST);

/**
 * Ensambla la aplicación Express sin abrir ningún puerto, para que pueda
 * montarse también desde pruebas o desde otro proceso.
 */
export function createApp() {
  const app = express();

  // Número de proxies delante (nginx, Render…) para leer la IP real del
  // cliente en los límites de uso. Si el API quedara expuesto sin proxy,
  // TRUST_PROXY=0 impide falsear la IP con X-Forwarded-For.
  app.set('trust proxy', TRUST_PROXY);

  // Cabeceras de seguridad (nosniff, anti-iframe, HSTS…). La CSP cubre el
  // frontend que este mismo proceso sirve en producción: todo es propio salvo
  // imágenes de datos y estilos en línea que usan las gráficas y las alertas.
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'style-src': ["'self'", "'unsafe-inline'"],
        'font-src': ["'self'", 'data:'],
        // Sin forzar https: el servidor puede probarse por http antes del certificado.
        'upgrade-insecure-requests': null,
      },
    },
  }));

  // CORS solo si el frontend vive en OTRO origen (CORS_ORIGIN). Sin
  // configurar: en producción solo el mismo origen; en desarrollo, abierto.
  if (ALLOWED_ORIGINS.length > 0) {
    app.use(cors({
      origin: ALLOWED_ORIGINS,
      credentials: true,
    }));
  } else if (process.env.NODE_ENV !== 'production') {
    app.use(cors());
  }

  app.use(express.json({ limit: '1mb' }));

  // Freno general por usuario (o por IP sin sesión).
  app.use('/api', apiRateLimit);

  // Toda respuesta del API depende del token, y la caché del navegador se
  // indexa por URL: sin esto, tras cerrar sesión el siguiente usuario podría
  // recibir del disco los datos del anterior.
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('Vary', 'Authorization');
    next();
  });

  app.use('/api', routes);
  app.use('/api', notFoundHandler);

  // Frontend (solo en el contenedor único de producción): /api ya respondió
  // (o devolvió su 404); el resto de GET sirve el SPA (client/dist) con
  // fallback a index.html para que las rutas directas funcionen al recargar.
  if (SERVE_CLIENT) {
    app.use(express.static(CLIENT_DIST));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }
  app.use(errorHandler);

  return app;
}

export default createApp;
