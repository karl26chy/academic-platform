import * as observationRepo from '../repositories/observation.repository.js';
import { HttpError } from '../shared/http-error.js';
import { periodById } from '../repositories/resource.repository.js';
import { authorizeObservation, exigirPeriodoDeLaInstitucion } from '../policies/annotations.policy.js';

export async function getObservation(req, res, next) {
  try {
    const { studentId } = req.params;
    const { periodo_id } = req.query;
    if (!periodo_id) throw new HttpError(400, 'Falta periodo_id.');
    await authorizeObservation(req.user, studentId);
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

    const institucionId = await authorizeObservation(req.user, studentId);
    exigirPeriodoDeLaInstitucion(periodo, institucionId);

    const row = await observationRepo.upsertObservation(studentId, periodo_id, txt, req.user?.sub || null);
    res.json(row);
  } catch (err) {
    next(err);
  }
}
