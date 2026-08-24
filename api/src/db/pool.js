import pg from 'pg';
import dns from 'node:dns';
import config from '../config/index.js';

dns.setDefaultResultOrder('ipv4first');

const { Pool, types } = pg;

// NUMERIC llega como string desde pg; lo convertimos a número para que las
// notas y porcentajes viajen al cliente como valores numéricos.
types.setTypeParser(1700, parseFloat);

// Segunda capa del guard anti-producción (defensa en profundidad).
// config/index.js ya bloquea, pero pool.js vuelve a validar por si
// alguien importa el pool sin pasar por config o si DATABASE_URL cambia.
const PRODUCTION_MARKERS_POOL = ['supabase.co', 'pooler.supabase.com', 'pooler.supabase.co'];
const envPool = (process.env.NODE_ENV || 'development').toLowerCase();
if (envPool !== 'production') {
  const lowerConn = String(config.databaseUrl || '').toLowerCase();
  if (PRODUCTION_MARKERS_POOL.some((m) => lowerConn.includes(m))) {
    throw new Error(
      '[BLOQUEO pool.js] DATABASE_URL apunta a Supabase en entorno no productivo (NODE_ENV=' +
        envPool +
        '). Abortando conexión.'
    );
  }
}

const url = new URL(config.databaseUrl);
const isLocal =
  url.hostname === 'localhost' ||
  url.hostname === '127.0.0.1' ||
  url.hostname === '::1' ||
  url.hostname === 'db';

const sslMode = url.searchParams.get('sslmode');

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  ...(sslMode === 'disable' || isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de Postgres:', err);
});

export default pool;
