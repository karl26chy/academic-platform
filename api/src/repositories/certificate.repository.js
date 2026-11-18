import pool from '../db/pool.js';
import { generateId } from '../shared/ids.js';

/** Certificados PDF de los estudiantes de una corporación. */

export async function insertCertificate({ institucionId, estudianteId, titulo, archivo, subidoPor }) {
  const { rows } = await pool.query(
    `INSERT INTO certificates (id, institucion_id, estudiante_id, titulo, archivo, tamano, subido_por, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, estudiante_id, titulo, tamano, created_at`,
    [generateId(), institucionId, estudianteId, titulo, archivo, archivo.length, subidoPor, new Date().toISOString()]
  );
  return rows[0];
}

/** Lista sin el contenido del archivo (solo los datos para mostrar). */
export async function certificatesOfStudent(estudianteId) {
  const { rows } = await pool.query(
    `SELECT id, estudiante_id, titulo, tamano, created_at
     FROM certificates WHERE estudiante_id = $1 ORDER BY created_at DESC`,
    [estudianteId]
  );
  return rows;
}

export async function certificateMeta(id) {
  const { rows } = await pool.query(
    'SELECT id, institucion_id, estudiante_id, titulo FROM certificates WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

export async function certificateFile(id) {
  const { rows } = await pool.query('SELECT titulo, archivo FROM certificates WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function deleteCertificate(id) {
  await pool.query('DELETE FROM certificates WHERE id = $1', [id]);
}
