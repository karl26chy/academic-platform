import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

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

  app.set('trust proxy', 1);

  if (ALLOWED_ORIGINS.length > 0) {
    app.use(cors({
      origin: ALLOWED_ORIGINS,
      credentials: true,
    }));
  } else {
    app.use(cors());
  }

  app.use(express.json({ limit: '1mb' }));

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
