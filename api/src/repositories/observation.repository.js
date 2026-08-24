import pool from '../db/pool.js';

/**
 * Observaciones por estudiante + período.
 * Una por estudiante+periodo, last-write-wins.
 */

export async function getObservation(estudianteId, periodoId) {
  const { rows } = await pool.query(
    `SELECT * FROM student_observations WHERE estudiante_id = $1 AND periodo_id = $2`,
    [estudianteId, periodoId]
  );
  return rows[0] || null;
}

export async function upsertObservation(estudianteId, periodoId, texto, updatedBy) {
  const id = `${estudianteId}::${periodoId}`;
  const now = new Date().toISOString();
  const { rows } = await pool.query(
    `INSERT INTO student_observations (id, estudiante_id, periodo_id, texto, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (estudiante_id, periodo_id) DO UPDATE SET
       texto = EXCLUDED.texto,
       updated_by = EXCLUDED.updated_by,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [id, estudianteId, periodoId, texto, updatedBy || null, now]
  );
  return rows[0];
}
