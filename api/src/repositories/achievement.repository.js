import pool from '../db/pool.js';
import { generateId } from '../shared/ids.js';

/**
 * Logros por assignment + período.
 * Un texto por docente+materia+grado+período, compartido por todo el grupo.
 */

export async function getAchievement(assignmentId, periodoId) {
  const { rows } = await pool.query(
    `SELECT * FROM subject_achievements WHERE assignment_id = $1 AND periodo_id = $2`,
    [assignmentId, periodoId]
  );
  return rows[0] || null;
}

export async function upsertAchievement(assignmentId, periodoId, texto, updatedBy) {
  const id = `${assignmentId}::${periodoId}`;
  const now = new Date().toISOString();
  const { rows } = await pool.query(
    `INSERT INTO subject_achievements (id, assignment_id, periodo_id, texto, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (assignment_id, periodo_id) DO UPDATE SET
       texto = EXCLUDED.texto,
       updated_by = EXCLUDED.updated_by,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [id, assignmentId, periodoId, texto, updatedBy || null, now]
  );
  return rows[0];
}

export async function getAchievementsByGrade(gradoId, periodoId) {
  const { rows } = await pool.query(
    `SELECT sa.* FROM subject_achievements sa
     JOIN assignments a ON a.id = sa.assignment_id
     WHERE a.grado_id = $1 AND sa.periodo_id = $2`,
    [gradoId, periodoId]
  );
  return rows;
}

export async function assignmentById(id) {
  const { rows } = await pool.query(`SELECT * FROM assignments WHERE id = $1`, [id]);
  return rows[0] || null;
}
