import { HttpError } from '../shared/http-error.js';
import { findRaw, groupDuplicateOf } from '../repositories/resource.repository.js';
import { JORNADAS, esCorporacion, nombreGrupo } from '../shared/corporacion.js';

const NIVEL_MAXIMO = 20;

/**
 * Grados de un colegio: sin cambios (nombre y tipo libres), pero no aceptan
 * datos de corporación.
 *
 * Grupos de una corporación: programa + jornada + nivel (los cursos cortos no
 * tienen nivel). El nombre lo arma la API y no se puede repetir el grupo.
 */
export async function validateGrade(data, existingRow) {
  const institucionId = data.institucion_id ?? existingRow?.institucion_id;
  const institucion = institucionId ? await findRaw('institutions', institucionId) : null;
  const datosDeGrupo = ['programa_id', 'jornada', 'nivel'].some(k => data[k] !== undefined && data[k] !== null && data[k] !== '');

  if (!esCorporacion(institucion)) {
    if (datosDeGrupo) throw new HttpError(400, 'Programa, jornada y nivel solo aplican a las corporaciones.');
    return;
  }

  const programaId = data.programa_id ?? existingRow?.programa_id;
  if (!programaId) throw new HttpError(400, 'Elige el programa del grupo.');
  const programa = await findRaw('programs', programaId);
  if (!programa || programa.institucion_id !== institucionId) {
    throw new HttpError(400, 'El programa no pertenece a esta corporación.');
  }

  const jornada = data.jornada ?? existingRow?.jornada;
  if (!JORNADAS[jornada]) throw new HttpError(400, 'Elige la jornada: mañana, tarde, noche o fin de semana.');

  let nivel = null;
  if (programa.tipo === 'tecnico') {
    nivel = Number(data.nivel ?? existingRow?.nivel);
    if (!Number.isInteger(nivel) || nivel < 1 || nivel > NIVEL_MAXIMO) {
      throw new HttpError(400, `El nivel de un programa técnico debe ser un número entre 1 y ${NIVEL_MAXIMO}.`);
    }
  }

  if (await groupDuplicateOf({ programaId, jornada, nivel, excludeId: existingRow?.id ?? null })) {
    throw new HttpError(409, `El grupo "${nombreGrupo(programa, jornada, nivel)}" ya existe.`);
  }

  data.programa_id = programaId;
  data.jornada = jornada;
  data.nivel = nivel;
  data.nombre = nombreGrupo(programa, jornada, nivel);
  data.tipo_grado = null;
}
