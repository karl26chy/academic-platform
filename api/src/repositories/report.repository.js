import pool from '../db/pool.js';

/**
 * Consultas del reporte académico. Prefiere reutilizar el repositorio general
 * (resource.repository.js) cuando la consulta ya existe; aquí solo viven las
 * que son específicas del reporte.
 */

/** Datos del estudiante para el reporte (nunca la contraseña). */
export async function studentForReport(studentId) {
  const { rows } = await pool.query(
    `SELECT id, email, rol, nombre, apellido, identificacion, tipo_documento,
            genero, fecha_nacimiento, institucion_id
     FROM users WHERE id = $1`,
    [studentId]
  );
  return rows[0] || null;
}

/** Grado actual del estudiante (vía matrícula), si tiene uno. */
export async function gradeOfStudent(studentId) {
  const { rows } = await pool.query(
    `SELECT g.id, g.nombre, g.tipo_grado
     FROM student_grades sg
     JOIN grades g ON g.id = sg.grado_id
     WHERE sg.estudiante_id = $1
     LIMIT 1`,
    [studentId]
  );
  return rows[0] || null;
}

/** Asignaciones (materia + docente) de un grado, con los nombres resueltos. */
export async function assignmentsOfGrade(gradeId) {
  const { rows } = await pool.query(
    `SELECT a.id, a.materia_id, a.profesor_id,
            s.nombre AS materia,
            u.nombre AS docente_nombre, u.apellido AS docente_apellido
     FROM assignments a
     LEFT JOIN subjects s ON s.id = a.materia_id
     LEFT JOIN users u ON u.id = a.profesor_id
     WHERE a.grado_id = $1`,
    [gradeId]
  );
  return rows;
}

/** Evaluaciones de un grado+institución dentro de un período. */
export async function evaluationsOfPeriod(institucionId, gradeId, periodId) {
  const { rows } = await pool.query(
    `SELECT id, institucion_id, materia_id, grado_id, nombre, fecha_evaluacion,
            porcentaje, periodo, anio, periodo_id, creado_por
     FROM evaluations
     WHERE "institucion_id" = $1 AND "grado_id" = $2 AND "periodo_id" = $3
     ORDER BY nombre`,
    [institucionId, gradeId, periodId]
  );
  return rows;
}

/** Notas de un estudiante dentro de un período. */
export async function marksOfStudentPeriod(studentId, periodId) {
  const { rows } = await pool.query(
    `SELECT id, estudiante_id, materia_id, grado_id, evaluacion_id,
            tipo_evaluacion, fecha_evaluacion, porcentaje, nota, periodo, anio,
            periodo_id, registrado_por
     FROM marks
     WHERE "estudiante_id" = $1 AND "periodo_id" = $2`,
    [studentId, periodId]
  );
  return rows;
}

/** Asistencias de un estudiante dentro de un período. */
export async function attendanceOfStudentPeriod(studentId, periodId) {
  const { rows } = await pool.query(
    `SELECT id, estudiante_id, materia_id, grado_id, fecha, estado, periodo_id, registrado_por
     FROM attendance
     WHERE "estudiante_id" = $1 AND "periodo_id" = $2`,
    [studentId, periodId]
  );
  return rows;
}

/** Configuración de reporte activa de una institución para un tipo de documento. */
export async function reportConfigFor(institucionId, tipoDocumento = 'boletin') {
  const { rows } = await pool.query(
    `SELECT id, institucion_id, tipo_documento, config, logo_url, version, activo
     FROM institution_report_configs
     WHERE "institucion_id" = $1 AND "tipo_documento" = $2 AND activo
     ORDER BY version DESC
     LIMIT 1`,
    [institucionId, tipoDocumento]
  );
  return rows[0] || null;
}



/** Períodos de una institución para un año académico (dinámicos). */
export async function periodsOfYear(institucionId, anio) {
  const { rows } = await pool.query(
    `SELECT * FROM academic_periods
     WHERE "institucion_id" = $1 AND anio = $2
     ORDER BY numero ASC`,
    [institucionId, Number(anio)]
  );
  return rows;
}

/**
 * Conteo de asistencia de un estudiante en un período, agrupado por materia.
 * Devuelve un mapa: materia_id → { presente, ausente, justificada, hasData }.
 * `hasData` distingue "no hay registros" de "0 fallas".
 */
export async function attendanceCountsBySubject(studentId, periodId) {
  const { rows } = await pool.query(
    `SELECT materia_id, estado, COUNT(*)::int AS n
     FROM attendance
     WHERE "estudiante_id" = $1 AND "periodo_id" = $2
     GROUP BY materia_id, estado`,
    [studentId, periodId]
  );
  const map = {};
  for (const r of rows) {
    if (!map[r.materia_id]) map[r.materia_id] = { presente: 0, ausente: 0, justificada: 0, hasData: true };
    map[r.materia_id][r.estado] = (map[r.materia_id][r.estado] || 0) + r.n;
  }
  return map;
}
