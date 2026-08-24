import * as achievementRepo from '../repositories/achievement.repository.js';
import { HttpError } from '../shared/http-error.js';
import { periodById } from '../repositories/resource.repository.js';

export async function getAchievement(req, res, next) {
  try {
    const { assignmentId } = req.params;
    const { periodo_id } = req.query;
    if (!periodo_id) throw new HttpError(400, 'Falta periodo_id.');
    const row = await achievementRepo.getAchievement(assignmentId, periodo_id);
    res.json(row || null);
  } catch (err) {
    next(err);
  }
}

export async function upsertAchievement(req, res, next) {
  try {
    const { assignmentId } = req.params;
    const { periodo_id } = req.query;
    const { texto } = req.body;
    if (!periodo_id) throw new HttpError(400, 'Falta periodo_id.');
    if (texto === undefined || texto === null) throw new HttpError(400, 'Falta texto.');
    const txt = String(texto).trim();
    if (txt.length === 0) throw new HttpError(400, 'El logro no puede estar vacío.');
    if (txt.length > 1000) throw new HttpError(400, 'El logro no puede exceder 1000 caracteres.');

    const assignment = await achievementRepo.assignmentById(assignmentId);
    if (!assignment) throw new HttpError(404, 'Asignación no encontrada.');

    const user = req.user;
    const isDocenteDueño = user?.sub === assignment.profesor_id;
    const isAdmin = user?.rol === 'admin' && user?.institucion_id === assignment.institucion_id;
    const isSuper = user?.rol === 'super_admin';
    if (!isDocenteDueño && !isAdmin && !isSuper) {
      throw new HttpError(403, 'No autorizado para editar este logro.');
    }

    const periodo = await periodById(periodo_id);
    if (!periodo) throw new HttpError(400, 'Periodo no encontrado.');
    if (periodo.activo === false) throw new HttpError(409, 'El periodo está cerrado; no se pueden editar logros.');

    const row = await achievementRepo.upsertAchievement(assignmentId, periodo_id, txt, user?.sub || null);
    res.json(row);
  } catch (err) {
    next(err);
  }
}
