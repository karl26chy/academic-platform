import { HttpError } from '../shared/http-error.js';
import {
  institutionOfGrade,
  periodById,
  openPeriodsOfInstitution,
} from '../repositories/resource.repository.js';

/** Estados de asistencia válidos (ya no existe "tardanza"). */
const ESTADOS_VALIDOS = ['presente', 'ausente', 'justificada'];

/**
 * Reglas de asistencias (espejo de las de evaluaciones):
 *  · la asistencia siempre pertenece a un periodo académico;
 *  · si llega periodo_id, debe existir, pertenecer a la institución del grado
 *    y estar abierto (cerrado → 409);
 *  · si no llega, se autoasigna el ÚNICO periodo abierto de la institución:
 *    0 abiertos → 409, varios abiertos → 409 sin elegir arbitrariamente;
 *  · el estado debe ser uno de los válidos (rechaza "tardanza").
 */
export async function validateAttendance(data, existingRow) {
  if (data.estado !== undefined && !ESTADOS_VALIDOS.includes(data.estado)) {
    throw new HttpError(400, 'Estado de asistencia inválido.');
  }

  const gradeId = data.grado_id ?? existingRow?.grado_id;
  if (!gradeId) throw new HttpError(400, 'Falta grado_id.');

  const institucionId = await institutionOfGrade(gradeId);
  if (!institucionId) throw new HttpError(400, 'Grado no encontrado.');

  const periodoId = data.periodo_id ?? existingRow?.periodo_id;

  if (periodoId) {
    const periodo = await periodById(periodoId);
    if (!periodo) throw new HttpError(400, 'El periodo no existe.');
    if (String(periodo.institucion_id) !== String(institucionId)) {
      throw new HttpError(403, 'El periodo no pertenece a esta institución.');
    }
    if (periodo.activo === false) {
      throw new HttpError(409, 'El periodo está cerrado; no se pueden registrar o modificar asistencias.');
    }
    data.periodo_id = periodoId;
  } else {
    const abiertos = await openPeriodsOfInstitution(institucionId);
    if (abiertos.length === 0) {
      throw new HttpError(409, 'No hay un periodo académico abierto para esta institución.');
    }
    if (abiertos.length > 1) {
      throw new HttpError(409, 'Hay más de un periodo académico abierto; revisa la configuración de periodos.');
    }
    data.periodo_id = abiertos[0].id;
  }
}
