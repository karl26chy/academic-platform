import * as observationRepo from '../repositories/observation.repository.js';
import { HttpError } from '../shared/http-error.js';
import { periodById } from '../repositories/resource.repository.js';
import pool from '../db/pool.js';

export async function getObservation(req, res, next) {
  try {
    const { studentId } = req.params;
    const { periodo_id } = req.query;
    if (!periodo_id) throw new HttpError(400, 'Falta periodo_id.');
    const row = await observationRepo.getObservation(studentId, periodo_id);
    res.json(row || null);
  } catch (err) {
    next(err);
  }
}

export async function upsertObservation(req, res, next) {
  try {
    const { studentId } = req.params;
    const { periodo_id } = req.query;
    const { texto } = req.body;
    if (!periodo_id) throw new HttpError(400, 'Falta periodo_id.');
    if (texto === undefined || texto === null) throw new HttpError(400, 'Falta texto.');
    const txt = String(texto).trim();
    if (txt.length === 0) throw new HttpError(400, 'La observación no puede estar vacía.');
    if (txt.length > 1000) throw new HttpError(400, 'La observación no puede exceder 1000 caracteres.');

    const periodo = await periodById(periodo_id);
    if (!periodo) throw new HttpError(400, 'Periodo no encontrado.');
    if (periodo.activo === false) throw new HttpError(409, 'El periodo está cerrado; no se pueden editar observaciones.');

    // Verificar que el docente tiene alguna asignación en el grado del estudiante
    const { rows: sgRows } = await pool.query(`SELECT grado_id FROM student_grades WHERE estudiante_id = $1 LIMIT 1`, [studentId]);
    const gradoId = sgRows[0]?.grado_id;
    if (!gradoId) throw new HttpError(404, 'Estudiante sin matrícula.');

    const user = req.user;
    if (user?.rol === 'super_admin') {
      // super_admin puede todo
    } else if (user?.rol === 'admin') {
      // admin debe ser de la misma institución que el grado
      const { rows: gRows } = await pool.query(`SELECT institucion_id FROM grades WHERE id = $1`, [gradoId]);
      if (gRows[0]?.institucion_id !== user?.institucion_id) throw new HttpError(403, 'No autorizado.');
    } else {
      // docente: debe tener al menos una assignment con ese grado_id
      const { rows } = await pool.query(
        `SELECT 1 FROM assignments WHERE profesor_id = $1 AND grado_id = $2 LIMIT 1`,
        [user?.sub, gradoId]
      );
      if (rows.length === 0) throw new HttpError(403, 'No tienes ninguna asignación en el grado de este estudiante.');
    }

    const row = await observationRepo.upsertObservation(studentId, periodo_id, txt, user?.sub || null);
    res.json(row);
  } catch (err) {
    next(err);
  }
}
