/**
 * Migración ADITIVA e idempotente de los estados de asistencia (solo base
 * LOCAL): "tardanza" se reemplaza por "justificada" (Inasistencia justificada).
 *
 * Ejecutar SOLO contra la base local, tras hacer un backup:
 *   node scripts/migrate-attendance-states.js
 */
import pool from '../src/db/pool.js';

async function run() {
  console.log('== Migración de estados de asistencia (aditiva) ==\n');

  const res = await pool.query(
    `UPDATE attendance SET estado = 'justificada' WHERE estado = 'tardanza'`
  );
  console.log('   asistencias con estado "tardanza" → "justificada":', res.rowCount);

  const restantes = await pool.query(
    `SELECT DISTINCT estado FROM attendance ORDER BY estado`
  );
  console.log('   estados presentes en la tabla:', restantes.rows.map(r => r.estado).join(', ') || '(sin filas)');

  console.log('\n== Fin. ==');
}

run().catch((err) => {
  console.error('Error durante la migración:', err.message);
  process.exit(1);
});
