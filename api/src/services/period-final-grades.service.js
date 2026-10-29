import { HttpError } from '../shared/http-error.js';
import * as repo from '../repositories/period-final-grades.repository.js';
import { assignmentById } from '../repositories/achievement.repository.js';
import { gradingScaleFor } from '../repositories/resource.repository.js';
import { authorizeAssignment } from '../policies/annotations.policy.js';

/**
 * "Notas boletín": definitivas de los periodos 1 a 3 cargadas a mano.
 *
 * TEMPORAL. La plataforma entró en uso en el cuarto periodo; esto completa
 * el boletín con las definitivas que los docentes ya tenían. Para apagarlo:
 * NOTAS_BOLETIN_HABILITADAS=false. Apagado, nadie carga ni cambia notas,
 * pero las ya guardadas siguen saliendo en el boletín.
 */

/** Periodos que se pueden completar a mano. */
export const PERIODOS_EDITABLES = [1, 2, 3];

export const habilitado = () =>
  String(process.env.NOTAS_BOLETIN_HABILITADAS ?? 'true').toLowerCase() !== 'false';

async function claseAutorizada(user, assignmentId) {
  const assignment = await assignmentById(assignmentId);
  if (!assignment) throw new HttpError(404, 'Asignación no encontrada.');
  authorizeAssignment(user, assignment);
  return assignment;
}

/** Definitivas cargadas de la clase en el año en curso de la institución. */
export async function getForClass(user, assignmentId) {
  const assignment = await claseAutorizada(user, assignmentId);
  const anio = await repo.currentYearOf(assignment.institucion_id);
  const [notas, notaMax] = await Promise.all([
    repo.ofClass(assignment.materia_id, assignment.grado_id, anio),
    gradingScaleFor(assignment.grado_id),
  ]);
  return { habilitado: habilitado(), anio, periodos: PERIODOS_EDITABLES, notaMax, notas };
}

/**
 * Guarda las definitivas enviadas. Cada item: { estudiante_id, numero, nota }
 * con nota numérica o null (borrar). Todo o nada: si un item es inválido no
 * se guarda ninguno.
 */
export async function saveForClass(user, assignmentId, body) {
  if (!habilitado()) {
    throw new HttpError(403, 'La carga de notas de boletín está desactivada.');
  }
  const assignment = await claseAutorizada(user, assignmentId);

  const items = Array.isArray(body?.notas) ? body.notas : null;
  if (!items || items.length === 0) throw new HttpError(400, 'No hay notas para guardar.');
  if (items.length > 2000) throw new HttpError(400, 'Demasiadas notas en una sola petición.');

  const [matriculados, notaMax, anio] = await Promise.all([
    repo.enrolledIn(assignment.grado_id),
    gradingScaleFor(assignment.grado_id),
    repo.currentYearOf(assignment.institucion_id),
  ]);

  const limpios = items.map((item) => {
    const numero = Number(item?.numero);
    if (!PERIODOS_EDITABLES.includes(numero)) {
      throw new HttpError(400, `Solo se pueden cargar los periodos ${PERIODOS_EDITABLES.join(', ')}.`);
    }
    if (!matriculados.has(item?.estudiante_id)) {
      throw new HttpError(400, 'Hay un estudiante que no está matriculado en este grado.');
    }
    const vacia = item.nota === null || item.nota === undefined || item.nota === '';
    if (vacia) return { estudiante_id: item.estudiante_id, numero, nota: null };
    const nota = Number(item.nota);
    if (!Number.isFinite(nota) || nota < 0 || nota > notaMax) {
      throw new HttpError(400, `Las notas deben estar entre 0 y ${notaMax}.`);
    }
    return { estudiante_id: item.estudiante_id, numero, nota: Math.round(nota * 100) / 100 };
  });

  await repo.saveForClass({
    materiaId: assignment.materia_id,
    gradoId: assignment.grado_id,
    anio,
    userId: user.sub,
    items: limpios,
  });
  return getForClass(user, assignmentId);
}
