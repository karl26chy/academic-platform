/**
 * Verifica que el entorno local está aislado de producción.
 * No toca la BD, solo inspecciona configuración.
 *
 * Uso: node scripts/verify-isolation.js
 *      npm run verify:isolation
 */
import config from '../src/config/index.js';

const url = config.databaseUrl || '';
const lower = url.toLowerCase();
const isLocal = ['localhost', '127.0.0.1', '::1', 'db'].some((h) => {
  try { return new URL(url).hostname === h; } catch { return false; }
});
const hasSupabase = lower.includes('supabase.co') || lower.includes('pooler.supabase');
const masked = url.replace(/:[^:@]*@/, ':****@');

console.log('=== Verificación de aislamiento local ===');
console.log('NODE_ENV   :', process.env.NODE_ENV || '(no definido -> development)');
console.log('DATABASE_URL:', masked || '(vacío)');
console.log('isLocal    :', isLocal ? 'SÍ (localhost/db)' : 'NO');
console.log('Supabase?  :', hasSupabase ? 'SÍ ⚠️' : 'NO ✅');
console.log('Pool SSL   :', isLocal || url.includes('sslmode=disable') ? 'desactivado (local)' : 'activado (remoto)');
console.log('');

if (hasSupabase && (process.env.NODE_ENV || 'development').toLowerCase() !== 'production') {
  console.error('❌ BLOQUEO: DATABASE_URL apunta a Supabase en entorno no productivo.');
  console.error('   Corrige .env.local o docker-compose.local.yml para usar localhost:55432 / db:5432');
  process.exit(1);
}
if (!isLocal && !hasSupabase && url) {
  console.warn('⚠️  DATABASE_URL no es localhost ni Supabase — verifica que sea tu PG local esperado.');
}
if (!url) {
  console.error('❌ DATABASE_URL vacío — define en .env.local o en el entorno.');
  process.exit(1);
}
console.log('✅ Aislamiento OK: backend local usa PostgreSQL local.');
