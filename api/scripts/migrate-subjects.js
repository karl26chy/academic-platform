/**
 * Migración ADITIVA e idempotente para que las materias pertenezcan a una
 * institución (solo base LOCAL).
 *
 *   1. Asegura la columna subjects.institucion_id, el índice y la FK.
 *   2. Backfill de materias globales previas: a la institución que las use
 *      vía assignments (si es una sola); a la única/primera institución si
 *      no se usan. NO borra materias.
 *   3. Reporta materias que quedaron sin institución (decisión manual).
 *
 * Ejecutar SOLO contra la base local, tras hacer un backup:
 *   node scripts/migrate-subjects.js
 */
import pool from '../src/db/pool.js';

async function run() {
  console.log('== Migración de materias → institución (aditiva) ==\n');

  await pool.query('ALTER TABLE subjects ADD COLUMN IF NOT EXISTS institucion_id TEXT');
  console.log('>> columna institucion_id asegurada');

  const usadas = await pool.query(
    `UPDATE subjects s
     SET "institucion_id" = (
       SELECT a."institucion_id" FROM assignments a
       WHERE a."materia_id" = s.id LIMIT 1
     )
     WHERE s."institucion_id" IS NULL`
  );
  console.log('   materias vinculadas vía assignments:', usadas.rowCount);

  const porDefecto = await pool.query(
    `UPDATE subjects s
     SET "institucion_id" = (SELECT id FROM institutions ORDER BY id LIMIT 1)
     WHERE s."institucion_id" IS NULL AND EXISTS (SELECT 1 FROM institutions)`
  );
  console.log('   materias asignadas a la primera institución:', porDefecto.rowCount);

  const huérfanas = await pool.query(
    `SELECT id, nombre FROM subjects WHERE "institucion_id" IS NULL`
  );
  if (huérfanas.rows.length > 0) {
    console.log('\n>> ATENCIÓN: materias sin institución (se quedaron así):');
    for (const r of huérfanas.rows) console.log(`   → ${r.id} ${r.nombre}`);
  }

  await pool.query('ALTER TABLE subjects ALTER COLUMN institucion_id SET NOT NULL');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_subjects_institucion ON subjects("institucion_id")');
  await pool.query('ALTER TABLE subjects DROP CONSTRAINT IF EXISTS fk_subjects_institucion');
  await pool.query(
    `ALTER TABLE subjects
     ADD CONSTRAINT fk_subjects_institucion
     FOREIGN KEY ("institucion_id") REFERENCES institutions(id) ON DELETE CASCADE`
  );
  console.log('\n>> NOT NULL, índice y FK asegurados.');

  const total = await pool.query('SELECT count(*)::int AS n FROM subjects');
  console.log('   total materias:', total.rows[0].n);

  console.log('\n== Fin. ==');
}

run().catch((err) => {
  console.error('Error durante la migración:', err.message);
  process.exit(1);
});
