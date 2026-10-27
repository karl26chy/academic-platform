import { HttpError } from '../shared/http-error.js';
import { institutionOfGrade, hasAssignmentInGrade } from '../repositories/resource.repository.js';
import { enrollmentOf } from '../repositories/observation.repository.js';

/**
 * Quién puede leer y escribir logros (por asignación) y observaciones (por
 * estudiante). Aplica igual a la lectura y a la escritura:
 *  · super_admin → cualquiera;
 *  · admin       → los de su institución;
 *  · docente     → logros de SUS asignaciones; observaciones de estudiantes de
 *                  un grado donde tenga alguna asignación;
 *  · estudiante  → nada.
 */

const denegar = (mensaje = 'No autorizado.') => {
  throw new HttpError(403, mensaje);
};

/** Logros de una asignación. */
export function authorizeAchievement(user, assignment) {
  if (user.rol === 'super_admin') return;
  if (user.rol === 'admin' && user.institucion_id === assignment.institucion_id) return;
  if (user.rol === 'teacher' && user.sub === assignment.profesor_id) return;
  denegar('No autorizado para este logro.');
}

/**
 * Observaciones de un estudiante. Devuelve la institución del grado en que
 * está matriculado, para validar después el período.
 */
export async function authorizeObservation(user, studentId) {
  const enrollment = await enrollmentOf(studentId);
  if (!enrollment) throw new HttpError(404, 'Estudiante sin matrícula.');
  const institucionId = await institutionOfGrade(enrollment.grado_id);

  if (user.rol === 'super_admin') return institucionId;
  if (user.rol === 'admin') {
    if (institucionId !== user.institucion_id) denegar();
    return institucionId;
  }
  if (user.rol === 'teacher') {
    if (!await hasAssignmentInGrade(user.sub, enrollment.grado_id)) {
      denegar('No tienes ninguna asignación en el grado de este estudiante.');
    }
    return institucionId;
  }
  denegar();
}

/** El período debe ser de la misma institución que el logro u observación. */
export function exigirPeriodoDeLaInstitucion(periodo, institucionId) {
  if (!periodo || periodo.institucion_id !== institucionId) {
    throw new HttpError(400, 'Periodo no encontrado.');
  }
}
