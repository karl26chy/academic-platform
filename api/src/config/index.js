import 'dotenv/config';

// ============================================================
//  Guard anti-producción: bloquea Supabase en desarrollo
//  Corre SIEMPRE al importar config, sin importar si el proceso
//  arrancó vía Docker o vía `node src/server.js` directo.
//  Es la primera línea de defensa antes de que pool.js intente
//  conectar. Ver también api/src/db/pool.js (segunda capa).
// ============================================================
const PRODUCTION_HOST_MARKERS = [
  'supabase.co',
  'pooler.supabase.com',
  'pooler.supabase.co',
  'supabase.in',
  'db.hdbktxqfoscctxbofosm',
];

function isProductionDatabaseUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return PRODUCTION_HOST_MARKERS.some((marker) => lower.includes(marker));
}

const databaseUrl = process.env.DATABASE_URL;

// NODE_ENV=development | local | test => jamás debe apuntar a Supabase
const env = (process.env.NODE_ENV || 'development').toLowerCase();
const isNonProductionEnv = env !== 'production';

if (isNonProductionEnv && isProductionDatabaseUrl(databaseUrl)) {
  const hint =
    'Has arrancado el backend en modo desarrollo pero DATABASE_URL apunta a Supabase producción.\n' +
    '  NODE_ENV=' +
    env +
    '\n' +
    '  DATABASE_URL=' +
    (databaseUrl ? databaseUrl.replace(/:[^:@]*@/, ':****@') : '(vacío)') +
    '\n\n' +
    'Para desarrollo local usa PostgreSQL en Docker:\n' +
    '  docker compose -f docker-compose.local.yml up -d --build\n' +
    '  (usa DATABASE_URL=postgres://platform:platform@localhost:55432/platform o @db:5432 dentro de Docker)\n\n' +
    'Si necesitas conectar a Supabase a propósito, usa el overlay remoto:\n' +
    '  docker compose -f docker-compose.local.yml -f docker-compose.supabase-remote.yml --profile supabase-remote up -d\n' +
    'o exporta NODE_ENV=production.\n';
  throw new Error(
    '[BLOQUEO] Conexión a Supabase producción bloqueada en entorno de desarrollo.\n' + hint
  );
}

if (process.env.NODE_ENV === 'production' && (!databaseUrl || databaseUrl.trim() === '')) {
  throw new Error(
    '[ERROR CRÍTICO] La variable de entorno DATABASE_URL es requerida en producción.'
  );
}

// Con el secreto de ejemplo cualquiera podría firmar un token de super admin.
const INSECURE_JWT_SECRETS = [
  'dev-secret-change-me',
  'local-dev-secret-change-me',
  'genera-un-secreto-largo-y-aleatorio',
  'cambia-esto-por-un-secreto-largo',
];
const jwtSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production') {
  if (!jwtSecret || jwtSecret.length < 32 || INSECURE_JWT_SECRETS.includes(jwtSecret)) {
    throw new Error(
      '[ERROR CRÍTICO] JWT_SECRET es obligatorio en producción: al menos 32 caracteres aleatorios ' +
        'y distinto de los valores de ejemplo. Genera uno con:\n' +
        "  node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\""
    );
  }
}

export default {
  port: process.env.PORT || 5000,
  // El fallback a localhost queda solo para desarrollo/pruebas.
  // En 55432 para no colisionar y alinear con TEST_DATABASE_URL.
  databaseUrl: databaseUrl || 'postgres://platform:platform@localhost:55432/platform',
  // El valor por defecto solo llega a usarse fuera de producción (ver arriba).
  jwtSecret: jwtSecret || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
};
