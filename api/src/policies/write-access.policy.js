import { HttpError } from '../shared/http-error.js';
import {
  institutionOfGrade,
  institutionOfUser,
  hasAssignment,
} from '../repositories/resource.repository.js';

/**
 * RBAC de escritura: quién puede crear, editar o borrar cada recurso.
 *
 * Una estrategia por recurso. Cada una recibe el contexto ya resuelto y lanza
 * HttpError si la operación no está permitida.
 */

const denegar = (mensaje = 'No autorizado.') => {
  throw new HttpError(403, mensaje);
};

/** Valor efectivo de un campo: el que llega en el cuerpo o el ya guardado. */
const campo = ({ data, existingRow }, nombre) => data[nombre] ?? existingRow?.[nombre];

/** Solo un admin de la misma institución que el recurso. */
async function soloAdminDeLaInstitucion(ctx) {
  if (ctx.rol !== 'admin') {
    denegar('Solo un administrador puede gestionar este recurso.');
  }
  if (campo(ctx, 'institucion_id') !== ctx.instId) denegar();
}

/** El grado indicado debe pertenecer a la institución del usuario. */
async function exigirGradoDeLaInstitucion(ctx) {
  const gradeId = campo(ctx, 'grado_id');
  if (!gradeId) throw new HttpError(400, 'Falta grado_id.');
  if (await institutionOfGrade(gradeId) !== ctx.instId) denegar();
  return gradeId;
}

/** Un profesor solo actúa sobre la materia y grado que tiene asignados. */
async function exigirAsignacionDelProfesor(ctx, gradeId) {
  const subjectId = campo(ctx, 'materia_id');
  if (!await hasAssignment(ctx.uid, subjectId, gradeId)) {
    denegar('No tienes asignada esta materia y grado.');
  }
}

/** Cualquiera del personal de la institución; el profesor, solo su clase. */
async function soloPersonalDeLaClase(ctx) {
  if (ctx.rol === 'student') denegar();
  const gradeId = await exigirGradoDeLaInstitucion(ctx);
  if (ctx.rol === 'teacher') await exigirAsignacionDelProfesor(ctx, gradeId);
}

const writeAccessByResource = {
  institutions: () => denegar('Solo el Super Administrador puede gestionar instituciones.'),

  users: async (ctx) => {
    if (ctx.rol !== 'admin') denegar();
    if (campo(ctx, 'institucion_id') !== ctx.instId) denegar();
    if (campo(ctx, 'rol') === 'super_admin') denegar();
  },

  grades: soloAdminDeLaInstitucion,
  subjects: (ctx) => {
    if (ctx.rol !== 'admin') denegar('Solo un administrador puede gestionar materias de su institución.');
    // Nunca confiar en un institucion_id enviado por el frontend: la materia
    // queda en la institución del usuario (JWT).
    if (ctx.data.institucion_id && ctx.data.institucion_id !== ctx.instId) denegar();
    if (ctx.existingRow && ctx.existingRow.institucion_id !== ctx.instId) denegar();
    ctx.data.institucion_id = ctx.instId;
  },
  assignments: soloAdminDeLaInstitucion,
  student_grades: async (ctx) => {
    if (ctx.rol !== 'admin') denegar('Solo un administrador gestiona las matrículas.');
    const studentId = campo(ctx, 'estudiante_id');
    const gradeId = campo(ctx, 'grado_id');
    if (await institutionOfUser(studentId) !== ctx.instId) {
      denegar('Solo puedes matricular estudiantes de tu institución.');
    }
    if (await institutionOfGrade(gradeId) !== ctx.instId) {
      denegar('El grado debe pertenecer a tu institución.');
    }
  },
  academic_periods: soloAdminDeLaInstitucion,

  marks: async (ctx) => {
    if (ctx.rol === 'student') denegar('Los estudiantes no pueden registrar notas.');
    const gradeId = await exigirGradoDeLaInstitucion(ctx);
    if (ctx.rol === 'admin') return;
    if (ctx.rol === 'teacher') return exigirAsignacionDelProfesor(ctx, gradeId);
    denegar();
  },

  attendance: soloPersonalDeLaClase,
  evaluations: soloPersonalDeLaClase,

  citations: async (ctx) => {
    if (ctx.rol === 'student') denegar('Los estudiantes no pueden crear citaciones.');
    const studentId = campo(ctx, 'estudiante_id');
    if (await institutionOfUser(studentId) !== ctx.instId) denegar();
  },

  // `messages` no aparece: hoy cualquier usuario autenticado puede escribir.
};

export async function authorizeWrite(resource, data, existingRow, user) {
  if (!user || user.rol === 'super_admin') return;

  const instId = user.institucion_id;
  if (!instId) denegar();

  const strategy = writeAccessByResource[resource];
  if (!strategy) return;

  await strategy({ data, existingRow, user, instId, uid: user.sub, rol: user.rol });
}
