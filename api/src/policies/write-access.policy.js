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
 *
 * Las estrategias validan el estado RESULTANTE (cuerpo + fila guardada). Al
 * editar o borrar, además se valida la fila TAL COMO ESTÁ GUARDADA (ver
 * `exigirFilaPropia`): sin eso, enviar el propio institucion_id/grado_id en el
 * cuerpo bastaría para apropiarse de un registro de otra institución.
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

/**
 * El autor de un registro es quien hace la petición, nunca el que diga el
 * cuerpo. Al editar se conserva el autor original.
 */
const fijarAutor = (columna) => (ctx) => {
  if (ctx.op === 'create') ctx.data[columna] = ctx.uid;
  else delete ctx.data[columna];
};

const writeAccessByResource = {
  institutions: () => denegar('Solo el Super Administrador puede gestionar instituciones.'),

  users: async (ctx) => {
    if (ctx.rol !== 'admin') denegar();
    if (campo(ctx, 'institucion_id') !== ctx.instId) denegar();
    if (campo(ctx, 'rol') === 'super_admin') denegar();
    // Un admin institucional solo puede eliminar docentes o estudiantes de su institución
    if (ctx.op === 'delete' && ctx.existingRow.rol !== 'teacher' && ctx.existingRow.rol !== 'student') {
      denegar('Solo se permite eliminar docentes o estudiantes de su propia institución.');
    }
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
    fijarAutor('registrado_por')(ctx);
    if (ctx.rol === 'admin') return;
    if (ctx.rol === 'teacher') return exigirAsignacionDelProfesor(ctx, gradeId);
    denegar();
  },

  attendance: async (ctx) => {
    await soloPersonalDeLaClase(ctx);
    fijarAutor('registrado_por')(ctx);
  },
  evaluations: async (ctx) => {
    await soloPersonalDeLaClase(ctx);
    // La evaluación queda en la institución del usuario, igual que su grado.
    if (campo(ctx, 'institucion_id') !== ctx.instId) denegar();
    fijarAutor('creado_por')(ctx);
  },

  citations: async (ctx) => {
    if (ctx.rol === 'student') denegar('Los estudiantes no pueden crear citaciones.');
    const studentId = campo(ctx, 'estudiante_id');
    if (await institutionOfUser(studentId) !== ctx.instId) denegar();
    fijarAutor('creado_por')(ctx);
  },

  messages: async (ctx) => {
    if (ctx.op === 'create') {
      // El remitente siempre es quien envía; solo a usuarios de su institución.
      ctx.data.remitente_id = ctx.uid;
      const destinatario = ctx.data.destinatario_id;
      if (!destinatario || await institutionOfUser(destinatario) !== ctx.instId) {
        denegar('Solo puedes escribir a usuarios de tu institución.');
      }
      return;
    }
    if (ctx.op === 'delete') {
      if (ctx.existingRow.remitente_id !== ctx.uid) denegar();
      return;
    }
    // Editar: solo el destinatario, y solo para marcarlo como leído.
    if (ctx.existingRow.destinatario_id !== ctx.uid) denegar();
    if (Object.keys(ctx.data).some(col => col !== 'leido')) {
      denegar('Un mensaje enviado no se puede modificar.');
    }
  },
};

/**
 * Institución de una fila ya guardada. Los recursos que no aparecen o se
 * resuelven en su estrategia (instituciones, mensajes) o no tienen dueño.
 */
const institucionDeLaFila = {
  users: (row) => row.institucion_id,
  grades: (row) => row.institucion_id,
  subjects: (row) => row.institucion_id,
  assignments: (row) => row.institucion_id,
  evaluations: (row) => row.institucion_id,
  academic_periods: (row) => row.institucion_id,
  student_grades: (row) => institutionOfGrade(row.grado_id),
  marks: (row) => institutionOfGrade(row.grado_id),
  attendance: (row) => institutionOfGrade(row.grado_id),
  citations: (row) => institutionOfUser(row.estudiante_id),
};

/** Recursos que un profesor solo toca dentro de su propia clase. */
const DE_LA_CLASE = new Set(['marks', 'attendance', 'evaluations']);

/** La fila que se edita o borra debe ser de la institución (y clase) del usuario. */
async function exigirFilaPropia(resource, ctx) {
  const resolver = institucionDeLaFila[resource];
  if (!resolver) return;
  if (await resolver(ctx.existingRow) !== ctx.instId) denegar();
  if (ctx.rol === 'teacher' && DE_LA_CLASE.has(resource)) {
    const { materia_id, grado_id } = ctx.existingRow;
    if (!await hasAssignment(ctx.uid, materia_id, grado_id)) {
      denegar('No tienes asignada esta materia y grado.');
    }
  }
}

/**
 * @param op 'create' | 'update' | 'delete'
 */
export async function authorizeWrite(resource, data, existingRow, user, op) {
  if (!user || user.rol === 'super_admin') return;

  const instId = user.institucion_id;
  if (!instId) denegar();

  const strategy = writeAccessByResource[resource];
  if (!strategy) return;

  const ctx = { data, existingRow, user, instId, uid: user.sub, rol: user.rol, op };
  await strategy(ctx);
  if (existingRow) await exigirFilaPropia(resource, ctx);
}
