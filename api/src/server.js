import config from './config/index.js';
import pool from './db/pool.js';
import { createApp } from './app.js';

const MAX_ATTEMPTS = 5;
const RETRY_DELAY_MS = 2500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDatabase() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await pool.query('SELECT 1');
      console.log('>> Conectado a PostgreSQL.');
      return;
    } catch (err) {
      console.error(
        `>> Intento ${attempt}/${MAX_ATTEMPTS} - No se pudo conectar a PostgreSQL.`
      );
      console.error('   err.code:', err?.code ?? 'N/A');
      console.error('   err.message:', err?.message ?? 'N/A');
      console.error('   err.stack:', err?.stack ?? 'N/A');
      console.error(err);
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
    }
  }
  console.error('>> Se agotaron los reintentos de conexión a PostgreSQL. Abortando.');
  process.exit(1);
}

async function start() {
  await waitForDatabase();

  createApp().listen(config.port, '0.0.0.0', () => {
    console.log(`>> API corriendo en http://localhost:${config.port}`);
  });
}

start();
