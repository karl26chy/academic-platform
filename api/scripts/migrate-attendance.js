/**
 * Migración ADITIVA e idempotente para asociar la asistencia al periodo
 * académico (solo base LOCAL).
 *
 *   1. Asegura la columna attendance.periodo_id y su índice (idempotente).
 *   2. Backfill: las asistencias previas sin periodo se asocian al ÚNICO
 *      periodo abierto de su institución (la de su grado). Si la institución
 *      tiene 0 o varios abiertos, se deja NULL y se reporta.
 *
 * Ejecutar SOLO contra la base local, tras hacer un backup:
 *   node scripts/migrate-attendance.js
 */
import pool from '../src/db/pool.js';

async function run() {
  console.log('== Migración de asistencia → periodo (aditiva) ==\n');

  await pool.query('ALTER TABLE attendance ADD COLUMN IF NOT EXISTS periodo_id TEXT');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_attendance_periodo ON attendance(periodo_id)');
  console.log('>> columna periodo_id e índice asegurados');

  const sinPeriodo = await pool.query(
    `SELECT a.id, a."grado_id", g."institucion_id"
     FROM attendance a
     LEFT JOIN grades g ON g.id = a."grado_id"
     WHERE a."periodo_id" IS NULL`
  );

  let asignadas = 0;
  const sinResolver = [];
  for (const att of sinPeriodo.rows) {
    if (!att.institucion_id) {
      sinResolver.push({ id: att.id, motivo: 'sin grado válido' });
      continue;
    }
    const { rows: abiertos } = await pool.query(
      `SELECT id FROM academic_periods
       WHERE "institucion_id" = $1 AND activo
       ORDER BY "anio" ASC, "numero" ASC`,
      [att.institucion_id]
    );
    if (abiertos.length === 1) {
      await pool.query('UPDATE attendance SET "periodo_id" = $1 WHERE id = $2', [abiertos[0].id, att.id]);
      asignadas++;
    } else {
      sinResolver.push({ id: att.id, motivo: abiertos.length === 0 ? 'sin periodo abierto' : `${abiertos.length} periodos abiertos` });
    }
  }
  console.log('   asistencias vinculadas al periodo abierto:', asignadas);

  if (sinResolver.length > 0) {
    console.log('\n>> Asistencias SIN vínculo (se dejaron NULL; decisión manual):');
    for (const r of sinResolver) {
      console.log(`   → ${r.id} | ${r.motivo}`);
    }
  } else {
    console.log('\n>> Todas las asistencias quedaron vinculadas a un periodo.');
  }

  console.log('\n== Fin. ==');
}

run().catch((err) => {
  console.error('Error durante la migración:', err.message);
  process.exit(1);
});
