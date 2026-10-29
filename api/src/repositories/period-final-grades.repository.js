import pool from '../db/pool.js';
import { generateId } from '../shared/ids.js';

/**
 * Definitivas de periodo cargadas a mano ("Notas boletín").
 *
 * TEMPORAL: la plataforma entró en uso en el cuarto periodo, así que de los
 * periodos 1 a 3 solo existen las definitivas que ya se entregaron en papel.
 * Se guardan por estudiante + materia + año + NÚMERO de periodo (no por
 * periodo_id), para no obligar a crear periodos que nunca se usaron.
 *
 * La tabla se crea sola la primera vez que se usa (idempotente), para no
 * depender de correr una migración a mano contra producción.
 */

const CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS period_final_grades (
    id TEXT PRIMARY KEY,
    estudiante_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    materia_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    grado_id TEXT NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
    anio INTEGER NOT NULL,
    numero INTEGER NOT NULL CHECK (numero BETWEEN 1 AND 4),
    nota NUMERIC(6,2) NOT NULL,
    registrado_por TEXT,
    updated_at TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uq_period_final_grades
    ON period_final_grades (estudiante_id, materia_id, anio, numero);
`;

let ready = null;
function ensureTable() {
  if (!ready) {
    ready = pool.query(CREATE_SQL).catch((err) => {
      ready = null; // reintentar en la próxima llamada
      throw err;
    });
  }
  return ready;
}

/** Definitivas de una clase (materia + grado) en un año. */
export async function ofClass(materiaId, gradoId, anio) {
  await ensureTable();
  const { rows } = await pool.query(
    `SELECT estudiante_id, numero, nota FROM period_final_grades
     WHERE materia_id = $1 AND grado_id = $2 AND anio = $3`,
    [materiaId, gradoId, anio]
  );
  return rows.map(r => ({ ...r, nota: Number(r.nota) }));
}

/** Definitivas de un estudiante en un año (todas sus materias), para el boletín. */
export async function ofStudentYear(studentId, anio) {
  await ensureTable();
  const { rows } = await pool.query(
    `SELECT materia_id, numero, nota FROM period_final_grades
     WHERE estudiante_id = $1 AND anio = $2`,
    [studentId, Number(anio)]
  );
  return rows.map(r => ({ ...r, nota: Number(r.nota) }));
}

/**
 * Guarda varias definitivas de una clase en una transacción. `nota: null`
 * borra la definitiva de ese estudiante y periodo.
 */
export async function saveForClass({ materiaId, gradoId, anio, userId, items }) {
  await ensureTable();
  const now = new Date().toISOString();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const { estudiante_id, numero, nota } of items) {
      if (nota === null) {
        await client.query(
          `DELETE FROM period_final_grades
           WHERE estudiante_id = $1 AND materia_id = $2 AND anio = $3 AND numero = $4`,
          [estudiante_id, materiaId, anio, numero]
        );
      } else {
        await client.query(
          `INSERT INTO period_final_grades
             (id, estudiante_id, materia_id, grado_id, anio, numero, nota, registrado_por, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (estudiante_id, materia_id, anio, numero) DO UPDATE SET
             nota = EXCLUDED.nota,
             grado_id = EXCLUDED.grado_id,
             registrado_por = EXCLUDED.registrado_por,
             updated_at = EXCLUDED.updated_at`,
          [generateId(), estudiante_id, materiaId, gradoId, anio, numero, nota, userId, now]
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Ids de los estudiantes matriculados en un grado. */
export async function enrolledIn(gradoId) {
  const { rows } = await pool.query(
    'SELECT estudiante_id FROM student_grades WHERE grado_id = $1',
    [gradoId]
  );
  return new Set(rows.map(r => r.estudiante_id));
}

/** Año académico en curso de la institución: el de su periodo abierto o el más reciente. */
export async function currentYearOf(institucionId) {
  const { rows } = await pool.query(
    `SELECT anio FROM academic_periods WHERE institucion_id = $1
     ORDER BY activo DESC, anio DESC LIMIT 1`,
    [institucionId]
  );
  return rows[0] ? Number(rows[0].anio) : new Date().getFullYear();
}
