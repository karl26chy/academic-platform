import { pickColumns, secretCols } from '../repositories/registry.js';
import * as repo from '../repositories/resource.repository.js';
import { buildReadScope } from '../policies/read-scope.policy.js';
import { authorizeWrite } from '../policies/write-access.policy.js';
import { validateRow } from '../validators/index.js';
import { notFound, HttpError } from '../shared/http-error.js';
import { hash } from '../shared/password.js';

/**
 * Casos de uso sobre cualquier recurso del catálogo.
 * Orquesta siempre en el mismo orden: autorizar → validar → persistir.
 */

/** Hashea in situ las columnas secretas; una vacía se descarta del update. */
async function hashSecrets(resource, data) {
  for (const col of secretCols(resource)) {
    if (!Object.prototype.hasOwnProperty.call(data, col)) continue;
    if (data[col]) {
      data[col] = await hash(data[col]);
    } else {
      delete data[col];
    }
  }
}

/** Deriva el año académico desde la fecha de evaluación, si falta. */
function ensureYear(resource, data) {
  if ((resource === 'marks' || resource === 'evaluations') && data.fecha_evaluacion) {
    const match = String(data.fecha_evaluacion).match(/^(\d{4})-/);
    if (!data.anio && match) data.anio = match[1];
  }
}

export function listAll(resource, user) {
  return repo.list(resource, buildReadScope(resource, user));
}

export async function getById(resource, id, user) {
  const row = await repo.findById(resource, id, buildReadScope(resource, user));
  if (!row) throw notFound();
  return row;
}

export async function create(resource, body, user) {
  const data = pickColumns(resource, body);
  await authorizeWrite(resource, data, null, user);
  await validateRow(resource, data, null);
  await hashSecrets(resource, data);
  ensureYear(resource, data);

  if (resource === 'academic_periods') {
    // Crear un periodo nunca abre silenciosamente el periodo actual: si no se
    // indica, nace cerrado. Abrir es una acción explícita y transaccional.
    if (data.activo === undefined) data.activo = false;
    if (data.activo === true) return repo.insertOpenPeriod(data);
  }

  const row = await repo.insert(resource, data);
  return row;
}

export async function replace(resource, id, body, user) {
  const existing = await repo.findRaw(resource, id);
  if (!existing) throw notFound();

  const data = pickColumns(resource, body);
  await authorizeWrite(resource, data, existing, user);
  await validateRow(resource, data, existing);
  await hashSecrets(resource, data);
  ensureYear(resource, data);

  if (resource === 'academic_periods' && data.activo === true) {
    // Abrir un periodo cierra los demás de la institución, transaccionalmente.
    const row = await repo.setPeriodOpen(id, existing.institucion_id);
    if (!row) throw notFound();
    return row;
  }

  const row = await repo.update(resource, id, data);
  if (!row) throw notFound();
  return row;
}

const DEP_LABELS = {
  usuarios: 'usuarios',
  grados: 'grados',
  materias: 'materias',
  asignaciones: 'asignaciones',
  evaluaciones: 'evaluaciones',
  registros_academicos: 'registros académicos',
};

const ASSIGNMENT_DEP_LABELS = {
  evaluaciones: 'evaluaciones',
  notas: 'notas',
  asistencias: 'registros de asistencia',
  citas: 'citas',
};

const STUDENT_GRADE_DEP_LABELS = {
  notas: 'notas',
  asistencias: 'registros de asistencia',
  citas: 'citas',
};

const GRADE_DEP_LABELS = {
  matriculados: 'estudiantes matriculados',
  asignaciones: 'asignaciones',
  evaluaciones: 'evaluaciones',
  notas: 'notas',
  asistencias: 'registros de asistencia',
};

const SUBJECT_DEP_LABELS = {
  asignaciones: 'asignaciones',
  evaluaciones: 'evaluaciones',
  notas: 'notas',
  asistencias: 'registros de asistencia',
  citas: 'citas',
};

function detalleConteos(conteos, labels) {
  const activas = Object.entries(conteos).filter(([, n]) => n > 0);
  if (activas.length === 0) return null;
  const partes = activas.map(([k, n]) => `${n} ${labels[k]}`);
  return partes.length > 1
    ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
    : partes[0];
}

export async function destroy(resource, id, user) {
  const existing = await repo.findRaw(resource, id);
  if (!existing) throw notFound();

  await authorizeWrite(resource, {}, existing, user);

  if (resource === 'institutions') {
    const deps = await repo.countInstitutionDependencies(id);
    const detalle = detalleConteos(deps, DEP_LABELS);
    if (detalle) {
      throw new HttpError(409, `No se puede eliminar la institución porque tiene datos asociados: ${detalle}.`);
    }
  }

  if (resource === 'assignments') {
    const deps = await repo.countAssignmentDependencies(existing);
    const detalle = detalleConteos(deps, ASSIGNMENT_DEP_LABELS);
    if (detalle) {
      throw new HttpError(409, `No se puede eliminar esta asignación porque tiene datos asociados: ${detalle}.`);
    }
  }

  if (resource === 'student_grades') {
    const deps = await repo.countStudentGradeDependencies(existing.estudiante_id);
    const detalle = detalleConteos(deps, STUDENT_GRADE_DEP_LABELS);
    if (detalle) {
      throw new HttpError(409, `No se puede eliminar esta matrícula porque tiene ${detalle} asociados.`);
    }
  }

  if (resource === 'grades') {
    const deps = await repo.countGradeDependencies(id);
    const detalle = detalleConteos(deps, GRADE_DEP_LABELS);
    if (detalle) {
      throw new HttpError(409, `No se puede eliminar este grado porque tiene datos asociados: ${detalle}.`);
    }
  }

  if (resource === 'subjects') {
    const deps = await repo.countSubjectDependencies(id);
    const detalle = detalleConteos(deps, SUBJECT_DEP_LABELS);
    if (detalle) {
      throw new HttpError(409, `No se puede eliminar esta materia porque tiene datos asociados: ${detalle}.`);
    }
  }

  if (resource === 'academic_periods') {
    const deps = await repo.countPeriodDependencies(id);
    const partes = [];
    if (deps.evaluaciones > 0) partes.push(`${deps.evaluaciones} evaluaciones`);
    if (deps.notas > 0) partes.push(`${deps.notas} notas`);
    if (deps.asistencias > 0) partes.push(`${deps.asistencias} asistencias`);
    if (partes.length > 0) {
      throw new HttpError(409, `No se puede eliminar este periodo porque tiene datos asociados: ${partes.join(', ')}.`);
    }
  }

  if (resource === 'evaluations') {
    if (existing.periodo_id) {
      const periodo = await repo.periodById(existing.periodo_id);
      if (periodo && periodo.activo === false) {
        throw new HttpError(409, 'El periodo está cerrado; no se puede eliminar la evaluación.');
      }
    }
  }

  if (resource === 'marks') {
    if (existing.evaluacion_id) {
      const evaluacion = await repo.evaluationById(existing.evaluacion_id);
      if (evaluacion && evaluacion.periodo_id) {
        const periodo = await repo.periodById(evaluacion.periodo_id);
        if (periodo && periodo.activo === false) {
          throw new HttpError(409, 'El periodo está cerrado; no se puede eliminar la nota.');
        }
      }
    }
  }

  if (resource === 'attendance') {
    if (existing.periodo_id) {
      const periodo = await repo.periodById(existing.periodo_id);
      if (periodo && periodo.activo === false) {
        throw new HttpError(409, 'El periodo está cerrado; no se puede eliminar la asistencia.');
      }
    }
  }

  const row = await repo.remove(resource, id);
  if (!row) throw notFound();
  return row;
}
