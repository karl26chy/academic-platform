import { HttpError } from '../shared/http-error.js';
import { institutionById } from '../repositories/resource.repository.js';

/**
 * Reglas de materias:
 *  · la materia siempre pertenece a una institución;
 *  · institucion_id es obligatorio y debe existir (para super admin y para
 *    quien llega por un camino sin política que lo fuerce).
 */
export async function validateSubject(data, existingRow) {
  const institucionId = data.institucion_id ?? existingRow?.institucion_id;
  if (!institucionId) {
    throw new HttpError(400, 'Falta institucion_id.');
  }
  if (data.institucion_id !== undefined) {
    const existe = await institutionById(data.institucion_id);
    if (!existe) throw new HttpError(400, 'La institución no existe.');
  }
}
