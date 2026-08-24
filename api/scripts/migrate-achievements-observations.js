/**
 * Migración ADITIVA e idempotente para Logros y Observaciones (Fase logros/observaciones).
 *
 * SOLO crea las 2 tablas + índices, tal como quedaron en schema.sql:
 *   subject_achievements (assignment_id, periodo_id, texto VARCHAR(1000))
 *   student_observations (estudiante_id, periodo_id, texto VARCHAR(1000))
 *
 * No ejecuta seedAcademicPeriods(), seedEvaluationPeriodLinks() ni ningún otro paso de setup.js.
 * Idempotente: IF NOT EXISTS / IF NOT EXISTS en índices.
 *
 * Ejecutar SOLO contra producción, con confirmación manual:
 *   DATABASE_URL="<url_real Render>" NODE_ENV=production node api/scripts/migrate-achievements-observations.js
 */
import pool from '../src/db/pool.js';
import readline from 'node:readline';

if (process.env.NODE_ENV !== 'production') {
  console.error('[ERROR] Este script exige NODE_ENV=production explícitamente.');
  console.error('        Ejecuta: DATABASE_URL="<url_real>" NODE_ENV=production node api/scripts/migrate-achievements-observations.js');
  process.exit(1);
}

function hostOfuscado() {
  const url = process.env.DATABASE_URL || '';
  try {
    const u = new URL(url);
    return u.host; // solo host, nunca contraseña
  } catch {
    return '(DATABASE_URL inválida o vacía)';
  }
}

async function pedirConfirmacion() {
  console.log('⚠️  Vas a ejecutar esto contra:', hostOfuscado());
  console.log('   Tablas a crear: subject_achievements, student_observations (VARCHAR(1000), ON DELETE CASCADE)');
  console.log('   Escribe CONFIRMAR para continuar (cualquier otra cosa aborta).');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = await new Promise((r) => rl.question('> ', r));
  rl.close();
  if (ans.trim() !== 'CONFIRMAR') {
    console.log('Abortado. No se hizo ningún cambio.');
    process.exit(0);
  }
}

async function run() {
  await pedirConfirmacion();

  console.log('\n== Creando subject_achievements ==');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subject_achievements (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      periodo_id TEXT NOT NULL REFERENCES academic_periods(id) ON DELETE CASCADE,
      texto VARCHAR(1000) NOT NULL,
      updated_by TEXT,
      updated_at TEXT
    )
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_subject_achievements_assign_periodo ON subject_achievements(assignment_id, periodo_id)`);
  console.log('>> subject_achievements OK');

  console.log('\n== Creando student_observations ==');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_observations (
      id TEXT PRIMARY KEY,
      estudiante_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      periodo_id TEXT NOT NULL REFERENCES academic_periods(id) ON DELETE CASCADE,
      texto VARCHAR(1000) NOT NULL,
      updated_by TEXT,
      updated_at TEXT
    )
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_student_observations_est_periodo ON student_observations(estudiante_id, periodo_id)`);
  console.log('>> student_observations OK');

  console.log('\n== Estructura resultante ==');
  for (const t of ['subject_achievements', 'student_observations']) {
    const { rows } = await pool.query(
      `SELECT column_name, data_type, character_maximum_length, is_nullable
       FROM information_schema.columns
       WHERE table_name = $1 AND table_schema = 'public'
       ORDER BY ordinal_position`,
      [t]
    );
    console.log(`\n-- ${t} --`);
    console.table(rows);
    const { rows: idx } = await pool.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1 ORDER BY indexname`, [t]);
    console.table(idx);
  }

  console.log('\n== Fin migración logros/observaciones (aditiva, idempotente) ==');
  await pool.end();
}

run().catch((err) => {
  console.error('Error durante la migración:', err.message);
  console.error(err.stack);
  process.exit(1);
});
