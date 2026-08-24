import { HttpError } from '../shared/http-error.js';
import {
  institutionOfUser,
  institutionOfSubject,
  institutionOfGrade,
} from '../repositories/resource.repository.js';

/**
 * Coherencia de una asignación: profesor, materia y grado deben pertenecer a
 * la MISMA institución que la asignación. Aplica a todos (incluido super
 * admin); el alcance por institución del admin lo resuelve la política.
 */
export async function validateAssignment(data, existingRow) {
  const institucionId = data.institucion_id ?? existingRow?.institucion_id;
  if (!institucionId) throw new HttpError(400, 'Falta institucion_id.');

  const profesorId = data.profesor_id ?? existingRow?.profesor_id;
  const materiaId = data.materia_id ?? existingRow?.materia_id;
  const gradoId = data.grado_id ?? existingRow?.grado_id;

  if (!profesorId) throw new HttpError(400, 'Falta profesor_id.');
  if (!materiaId) throw new HttpError(400, 'Falta materia_id.');
  if (!gradoId) throw new HttpError(400, 'Falta grado_id.');

  if (await institutionOfUser(profesorId) !== institucionId) {
    throw new HttpError(400, 'El docente no pertenece a esta institución.');
  }
  if (await institutionOfSubject(materiaId) !== institucionId) {
    throw new HttpError(400, 'La materia no pertenece a esta institución.');
  }
  if (await institutionOfGrade(gradoId) !== institucionId) {
    throw new HttpError(400, 'El grado no pertenece a esta institución.');
  }
}
