import pool from '../db/pool.js';
import { generateId } from '../shared/ids.js';
import { quote, selectColumns, sanitizeRow } from './registry.js';

/**
 * Única capa que habla SQL. Recibe el alcance de lectura ya resuelto por la
 * política correspondiente y no conoce roles, HTTP ni reglas de negocio.
 */

export async function list(resource, scope) {
  const where = scope.where ? `WHERE ${scope.where}` : '';
  const { rows } = await pool.query(
    `SELECT ${selectColumns(resource)} FROM ${quote(resource)} ${where} ORDER BY id`,
    scope.params
  );
  return rows;
}

export async function findById(resource, id, scope) {
  const where = scope.where ? `${scope.where} AND` : '';
  const { rows } = await pool.query(
    `SELECT ${selectColumns(resource)} FROM ${quote(resource)} WHERE ${where} id = $${scope.params.length + 1}`,
    [...scope.params, id]
  );
  return rows[0];
}

/** Fila completa y sin sanear: solo para comprobaciones internas. */
export async function findRaw(resource, id) {
  const { rows } = await pool.query(`SELECT * FROM ${quote(resource)} WHERE id = $1`, [id]);
  return rows[0];
}

export async function insert(resource, data) {
  if (!data.id) data.id = generateId();

  const cols = Object.keys(data);
  const values = Object.values(data);
  const placeholders = values.map((_, i) => '$' + (i + 1)).join(', ');

  const { rows } = await pool.query(
    `INSERT INTO ${quote(resource)} (${cols.map(quote).join(', ')}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  return sanitizeRow(resource, rows[0]);
}

export async function update(resource, id, data) {
  delete data.id;

  const cols = Object.keys(data);
  if (cols.length === 0) {
    // Sin columnas que actualizar se devuelve la fila tal cual está.
    // OJO: esta rama no sanea la fila; ver «defecto conocido» en tests/suites/crud.js.
    const { rows } = await pool.query(`SELECT * FROM ${quote(resource)} WHERE id = $1`, [id]);
    return rows[0];
  }

  const values = Object.values(data);
  const setClause = cols.map((col, i) => `${quote(col)} = $${i + 1}`).join(', ');
  const { rows } = await pool.query(
    `UPDATE ${quote(resource)} SET ${setClause} WHERE id = $${cols.length + 1} RETURNING *`,
    [...values, id]
  );
  return sanitizeRow(resource, rows[0]);
}

export async function remove(resource, id) {
  const { rows } = await pool.query(
    `DELETE FROM ${quote(resource)} WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] ? sanitizeRow(resource, rows[0]) : undefined;
}

// --- Consultas puntuales que necesitan las políticas de escritura ---------

export async function institutionOfGrade(gradeId) {
  const { rows } = await pool.query('SELECT "institucion_id" FROM grades WHERE id = $1', [gradeId]);
  return rows[0] ? rows[0].institucion_id : null;
}

export async function institutionOfUser(userId) {
  const { rows } = await pool.query('SELECT "institucion_id" FROM users WHERE id = $1', [userId]);
  return rows[0] ? rows[0].institucion_id : null;
}

export async function institutionOfSubject(subjectId) {
  const { rows } = await pool.query('SELECT "institucion_id" FROM subjects WHERE id = $1', [subjectId]);
  return rows[0] ? rows[0].institucion_id : null;
}

export async function institutionById(institutionId) {
  const { rows } = await pool.query('SELECT id FROM institutions WHERE id = $1', [institutionId]);
  return rows[0] || null;
}

export async function hasAssignment(teacherId, subjectId, gradeId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM assignments WHERE "profesor_id" = $1 AND "materia_id" = $2 AND "grado_id" = $3',
    [teacherId, subjectId, gradeId]
  );
  return rows.length > 0;
}

export async function gradingScaleFor(gradeId) {
  const { rows } = await pool.query(
    `SELECT i."escala_maxima", i."tipo"
     FROM grades g JOIN institutions i ON i.id = g."institucion_id"
     WHERE g.id = $1`,
    [gradeId]
  );
  const row = rows[0];
  if (!row) return null;
  // La escala configurada manda; si falta (institución previa a la migración),
  // se cae al default por tipo: universidad 1-5, resto 1-10.
  return Number(row.escala_maxima ?? (row.tipo === 'universidad' ? 5 : 10));
}

// --- Dependencias para borrados seguros ------------------------------------

/** Datos académicos asociados a una asignación docente→materia. */
export async function countAssignmentDependencies({ materia_id, grado_id, institucion_id }) {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM evaluations WHERE "materia_id" = $1 AND "grado_id" = $2 AND "institucion_id" = $3)::int AS evaluaciones,
       (SELECT COUNT(*) FROM marks WHERE "materia_id" = $1 AND "grado_id" = $2)::int AS notas,
       (SELECT COUNT(*) FROM attendance WHERE "materia_id" = $1 AND "grado_id" = $2)::int AS asistencias,
       (SELECT COUNT(*) FROM citations WHERE "materia_id" = $1)::int AS citas`,
    [materia_id, grado_id, institucion_id]
  );
  return rows[0];
}

/** Datos académicos asociados a la matrícula de un estudiante. */
export async function countStudentGradeDependencies(estudiante_id) {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM marks WHERE "estudiante_id" = $1)::int AS notas,
       (SELECT COUNT(*) FROM attendance WHERE "estudiante_id" = $1)::int AS asistencias,
       (SELECT COUNT(*) FROM citations WHERE "estudiante_id" = $1)::int AS citas`,
    [estudiante_id]
  );
  return rows[0];
}

/** Dependencias de un grado/curso (para no depender del CASCADE del esquema). */
export async function countGradeDependencies(gradeId) {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM student_grades WHERE "grado_id" = $1)::int AS matriculados,
       (SELECT COUNT(*) FROM assignments WHERE "grado_id" = $1)::int AS asignaciones,
       (SELECT COUNT(*) FROM evaluations WHERE "grado_id" = $1)::int AS evaluaciones,
       (SELECT COUNT(*) FROM marks WHERE "grado_id" = $1)::int AS notas,
       (SELECT COUNT(*) FROM attendance WHERE "grado_id" = $1)::int AS asistencias`,
    [gradeId]
  );
  return rows[0];
}

/** Dependencias de una materia (catálogo global compartido entre instituciones). */
export async function countSubjectDependencies(subjectId) {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM assignments WHERE "materia_id" = $1)::int AS asignaciones,
       (SELECT COUNT(*) FROM evaluations WHERE "materia_id" = $1)::int AS evaluaciones,
       (SELECT COUNT(*) FROM marks WHERE "materia_id" = $1)::int AS notas,
       (SELECT COUNT(*) FROM attendance WHERE "materia_id" = $1)::int AS asistencias,
       (SELECT COUNT(*) FROM citations WHERE "materia_id" = $1)::int AS citas`,
    [subjectId]
  );
  return rows[0];
}

/** Evaluaciones, notas y asistencias asociadas a un periodo (borrados seguros). */
export async function countPeriodDependencies(periodId) {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM evaluations WHERE "periodo_id" = $1)::int AS evaluaciones,
       (SELECT COUNT(*) FROM marks WHERE "periodo_id" = $1)::int AS notas,
       (SELECT COUNT(*) FROM attendance WHERE "periodo_id" = $1)::int AS asistencias`,
    [periodId]
  );
  return rows[0];
}

// --- Matrículas: consultas para validar duplicados --------------------------

/** Matrícula existente de un estudiante, si la tiene. */
export async function studentGradeOf(studentId) {
  const { rows } = await pool.query(
    'SELECT * FROM student_grades WHERE "estudiante_id" = $1 LIMIT 1',
    [studentId]
  );
  return rows[0] || null;
}

// --- Historial académico ----------------------------------------------------

/**
 * Notas históricas de un estudiante con su grado, materia y año, filtradas
 * opcionalmente. Cada nota conserva el grado que cursaba cuando se obtuvo.
 */
export async function academicHistory(studentId, { anio, periodo, grado_id, materia_id } = {}) {
  const filtros = ['m."estudiante_id" = $1'];
  const params = [studentId];

  const push = (cond) => {
    filtros.push(cond);
  };
  if (anio) { params.push(anio); push(`m."anio" = $${params.length}`); }
  if (periodo) { params.push(periodo); push(`m."periodo" = $${params.length}`); }
  if (grado_id) { params.push(grado_id); push(`m."grado_id" = $${params.length}`); }
  if (materia_id) { params.push(materia_id); push(`m."materia_id" = $${params.length}`); }

  const { rows } = await pool.query(
    `SELECT
       m.id, m.estudiante_id, m.materia_id, m.grado_id, m.evaluacion_id,
       m.tipo_evaluacion, m.fecha_evaluacion, m.porcentaje, m.nota, m.periodo, m.anio,
       m."periodo_id",
       ap.numero AS periodo_numero, ap.nombre AS periodo_nombre, ap.anio AS periodo_anio,
       g.nombre AS grado_nombre, g.tipo_grado,
       s.nombre AS materia_nombre
     FROM marks m
     LEFT JOIN academic_periods ap ON ap.id = m."periodo_id"
     LEFT JOIN grades g ON g.id = m.grado_id
     LEFT JOIN subjects s ON s.id = m.materia_id
     WHERE ${filtros.join(' AND ')}
     ORDER BY m.anio DESC, m.periodo, g.nombre, s.nombre, m.fecha_evaluacion`,
    params
  );
  return rows;
}

/** Usuario mínimo del estudiante para el historial (nunca la contraseña). */
export async function studentForHistory(studentId) {
  const { rows } = await pool.query(
    `SELECT id, email, rol, nombre, apellido, identificacion, tipo_documento, institucion_id
     FROM users WHERE id = $1`,
    [studentId]
  );
  return rows[0] || null;
}

// --- Evaluaciones y periodos académicos -------------------------------------

/** Evaluación por id (fila completa). */
export async function evaluationById(evaluationId) {
  const { rows } = await pool.query('SELECT * FROM evaluations WHERE id = $1', [evaluationId]);
  return rows[0] || null;
}

/**
 * Suma de porcentajes de las evaluaciones de una materia, grado y periodo.
 * `excludeId` excluye la evaluación que se está editando (null para creación).
 * Devuelve 0 cuando no hay evaluaciones.
 */
export async function sumEvaluationPercentages({ materia_id, grado_id, periodo_id, excludeId = null }) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(porcentaje), 0)::numeric AS total
     FROM evaluations
     WHERE "materia_id" = $1 AND "grado_id" = $2 AND "periodo_id" = $3
       AND ($4::text IS NULL OR id <> $4)`,
    [materia_id, grado_id, periodo_id, excludeId]
  );
  return Number(rows[0].total);
}

/** Periodo académico por id. */
export async function periodById(periodId) {
  const { rows } = await pool.query('SELECT * FROM academic_periods WHERE id = $1', [periodId]);
  return rows[0] || null;
}

/** Periodo de una institución por nombre exacto y año, si existe. */
export async function periodOfInstitutionByNameAndYear(institucionId, nombre, anio) {
  const { rows } = await pool.query(
    `SELECT * FROM academic_periods
     WHERE "institucion_id" = $1 AND LOWER(nombre) = LOWER($2) AND "anio" = $3
     LIMIT 1`,
    [institucionId, nombre, anio]
  );
  return rows[0] || null;
}

/** Periodos de una institución, ordenados por año y número. */
export async function periodsOfInstitution(institucionId) {
  const { rows } = await pool.query(
    `SELECT * FROM academic_periods WHERE "institucion_id" = $1 ORDER BY "anio" DESC, "numero" ASC`,
    [institucionId]
  );
  return rows;
}

/**
 * ¿Existe ya un período con la misma institución + año + número?
 * `excludeId` excluye el período que se está editando (null para creación).
 */
export async function periodDuplicateOf({ institucion_id, anio, numero, excludeId = null }) {
  const { rows } = await pool.query(
    `SELECT id FROM academic_periods
     WHERE "institucion_id" = $1 AND anio = $2 AND numero = $3
       AND ($4::text IS NULL OR id <> $4)
     LIMIT 1`,
    [institucion_id, anio, numero, excludeId]
  );
  return rows[0] || null;
}

/** Periodos abiertos (activo) de una institución. */
export async function openPeriodsOfInstitution(institucionId) {
  const { rows } = await pool.query(
    `SELECT * FROM academic_periods WHERE "institucion_id" = $1 AND activo ORDER BY "anio" ASC, "numero" ASC`,
    [institucionId]
  );
  return rows;
}

/**
 * Abre un periodo y cierra los demás de la misma institución, de forma
 * transaccional. Devuelve null si el periodo no existe o no pertenece a la
 * institución indicada.
 */
export async function setPeriodOpen(periodId, institucionId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE academic_periods SET activo = true WHERE id = $1 AND "institucion_id" = $2 RETURNING *`,
      [periodId, institucionId]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query(
      `UPDATE academic_periods SET activo = false WHERE "institucion_id" = $1 AND id <> $2`,
      [institucionId, periodId]
    );
    await client.query('COMMIT');
    return sanitizeRow('academic_periods', rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Inserta un periodo abierto y cierra los demás de la misma institución en la
 * misma transacción, para que nunca queden dos abiertos aunque falle a medias.
 */
export async function insertOpenPeriod(data) {
  if (!data.id) data.id = generateId();

  const cols = Object.keys(data);
  const values = Object.values(data);
  const placeholders = values.map((_, i) => '$' + (i + 1)).join(', ');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO academic_periods (${cols.map(quote).join(', ')}) VALUES (${placeholders}) RETURNING *`,
      values
    );
    await client.query(
      `UPDATE academic_periods SET activo = false WHERE "institucion_id" = $1 AND id <> $2`,
      [data.institucion_id, rows[0].id]
    );
    await client.query('COMMIT');
    return sanitizeRow('academic_periods', rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Dependencias de una institución: solo las que apuntan a su institucion_id o
 *  a sus grados/usuarios (para no depender del CASCADE del esquema). */
export async function countInstitutionDependencies(instId) {
  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE "institucion_id" = $1)::int AS usuarios,
       (SELECT COUNT(*) FROM grades WHERE "institucion_id" = $1)::int AS grados,
       (SELECT COUNT(*) FROM subjects WHERE "institucion_id" = $1)::int AS materias,
       (SELECT COUNT(*) FROM assignments WHERE "institucion_id" = $1)::int AS asignaciones,
       (SELECT COUNT(*) FROM evaluations WHERE "institucion_id" = $1)::int AS evaluaciones,
       (SELECT COUNT(*) FROM student_grades WHERE "grado_id" IN (SELECT id FROM grades WHERE "institucion_id" = $1))::int
         + (SELECT COUNT(*) FROM marks WHERE "grado_id" IN (SELECT id FROM grades WHERE "institucion_id" = $1))::int
         + (SELECT COUNT(*) FROM attendance WHERE "grado_id" IN (SELECT id FROM grades WHERE "institucion_id" = $1))::int
         + (SELECT COUNT(*) FROM citations WHERE "estudiante_id" IN (SELECT id FROM users WHERE "institucion_id" = $1))::int
         AS registros_academicos`,
    [instId]
  );
  return rows[0];
}
