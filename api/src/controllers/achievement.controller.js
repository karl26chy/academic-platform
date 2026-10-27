import * as achievementRepo from '../repositories/achievement.repository.js';
import { HttpError } from '../shared/http-error.js';
import { periodById } from '../repositories/resource.repository.js';
import { authorizeAchievement, exigirPeriodoDeLaInstitucion } from '../policies/annotations.policy.js';

/** Asignación existente y autorizada para el usuario. */
async function assignmentAutorizada(user, assignmentId) {
  const assignment = await achievementRepo.assignmentById(assignmentId);
  if (!assignment) throw new HttpError(404, 'Asignación no encontrada.');
  authorizeAchievement(user, assignment);
  return assignment;
}

export async function getAchievement(req, res, next) {
  try {
    const { assignmentId } = req.params;
    const { periodo_id } = req.query;
    if (!periodo_id) throw new HttpError(400, 'Falta periodo_id.');
    await assignmentAutorizada(req.user, assignmentId);
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

    const assignment = await assignmentAutorizada(req.user, assignmentId);

    const periodo = await periodById(periodo_id);
    exigirPeriodoDeLaInstitucion(periodo, assignment.institucion_id);
    if (periodo.activo === false) throw new HttpError(409, 'El periodo está cerrado; no se pueden editar logros.');

    const row = await achievementRepo.upsertAchievement(assignmentId, periodo_id, txt, req.user?.sub || null);
    res.json(row);
  } catch (err) {
    next(err);
  }
}
