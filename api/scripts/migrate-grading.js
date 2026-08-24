/**
 * Migración ADITIVA e idempotente para la escala de calificación por
 * institución (solo base LOCAL).
 *
 *   1. Asegura la columna escala_maxima (idempotente).
 *   2. Backfill: las instituciones previas reciben la escala por defecto
 *      según su tipo (universidad → 5, resto → 10). La nota mínima guardada
 *      se conserva tal cual (es un umbral del usuario).
 *   3. Reporta si alguna nota mínima queda fuera de su escala para decisión
 *      manual (no se corrige automáticamente).
 *
 * Ejecutar SOLO contra la base local, tras hacer un backup:
 *   node scripts/migrate-grading.js
 */
import pool from '../src/db/pool.js';

async function run() {
  console.log('== Migración de escala de calificación (aditiva) ==\n');

  await pool.query('ALTER TABLE institutions ADD COLUMN IF NOT EXISTS escala_maxima INTEGER');
  console.log('>> columna escala_maxima asegurada');

  const backfill = await pool.query(
    `UPDATE institutions
     SET escala_maxima = CASE WHEN tipo = 'universidad' THEN 5 ELSE 10 END
     WHERE escala_maxima IS NULL`
  );
  console.log('   instituciones con escala backfilled:', backfill.rowCount);

  const fuera = await pool.query(
    `SELECT id, nombre, tipo, escala_maxima, "nota_minima_aprobacion"
     FROM institutions
     WHERE "nota_minima_aprobacion" < 1
        OR "nota_minima_aprobacion" > escala_maxima
        OR escala_maxima NOT IN (5, 10, 100)`
  );
  if (fuera.rows.length > 0) {
    console.log('\n>> ATENCIÓN: instituciones con valores fuera de rango (NO se corrigieron):');
    for (const r of fuera.rows) {
      console.log(`   → ${r.id} ${r.nombre} | tipo=${r.tipo} | escala=${r.escala_maxima} | nota_min=${r.nota_minima_aprobacion}`);
    }
  } else {
    console.log('\n>> Sin instituciones fuera de rango.');
  }

  console.log('\n== Fin. ==');
}

run().catch((err) => {
  console.error('Error durante la migración:', err.message);
  process.exit(1);
});
