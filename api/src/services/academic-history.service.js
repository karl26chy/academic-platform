import { HttpError } from '../shared/http-error.js';
import * as repo from '../repositories/resource.repository.js';

/**
 * Historial académico individual por estudiante.
 *
 * Autorización (basada en el usuario del JWT, nunca en el studentId de la URL):
 *  · student      → solo su propio historial
 *  · admin        → solo estudiantes de su institución
 *  · super_admin  → cualquier estudiante
 *  · teacher      → no consulta historial en esta fase
 */
export async function academicHistory(studentId, user, filtros = {}) {
  if (!user) throw new HttpError(401, 'No autorizado. Inicia sesión.');

  if (user.rol === 'student') {
    if (studentId !== user.sub) {
      throw new HttpError(403, 'No puedes consultar el historial de otro estudiante.');
    }
  } else if (user.rol === 'admin') {
    const target = await repo.studentForHistory(studentId);
    if (!target || target.rol !== 'student' || target.institucion_id !== user.institucion_id) {
      throw new HttpError(403, 'Solo puedes consultar estudiantes de tu institución.');
    }
  } else if (user.rol !== 'super_admin') {
    throw new HttpError(403, 'No tienes permiso para consultar historiales.');
  }

  const student = await repo.studentForHistory(studentId);
  if (!student) throw new HttpError(404, 'Estudiante no encontrado.');

  const filas = await repo.academicHistory(studentId, filtros);

  const years = [];
  for (const fila of filas) {
    const anio = fila.anio || 'Sin año';

    let yearEntry = years.find(y => y.year === anio);
    if (!yearEntry) {
      yearEntry = { year: anio, periods: [] };
      years.push(yearEntry);
    }

    const periodo = fila.periodo || 'Sin periodo';
    let periodEntry = yearEntry.periods.find(p => p.period === periodo);
    if (!periodEntry) {
      periodEntry = {
        period: periodo,
        // Datos del periodo académico para mostrar "Periodo N — nombre — año".
        periodo_id: fila.periodo_id || null,
        numero: fila.periodo_numero !== null && fila.periodo_numero !== undefined ? Number(fila.periodo_numero) : null,
        nombre: fila.periodo_nombre || null,
        anio: fila.periodo_anio !== null && fila.periodo_anio !== undefined ? Number(fila.periodo_anio) : null,
        grade: null,
        subjects: [],
      };
      yearEntry.periods.push(periodEntry);
    }

    const gradeLabel = fila.grado_nombre ? `${fila.grado_nombre} "${fila.tipo_grado}"` : null;
    if (!periodEntry.grade && gradeLabel) {
      periodEntry.grade = { id: fila.grado_id, label: gradeLabel };
    }

    const materiaId = fila.materia_id;
    let subjectEntry = periodEntry.subjects.find(s => s.materia_id === materiaId);
    if (!subjectEntry) {
      subjectEntry = {
        materia_id: materiaId,
        subject: fila.materia_nombre || 'Materia',
        evaluations: [],
      };
      periodEntry.subjects.push(subjectEntry);
    }

    subjectEntry.evaluations.push({
      evaluacion_id: fila.evaluacion_id,
      tipo_evaluacion: fila.tipo_evaluacion || 'Evaluación',
      fecha_evaluacion: fila.fecha_evaluacion || null,
      nota: Number(fila.nota),
      porcentaje: fila.porcentaje !== null ? Number(fila.porcentaje) : null,
    });
  }

  return {
    student: {
      id: student.id,
      email: student.email,
      nombre: student.nombre,
      apellido: student.apellido,
      identificacion: student.identificacion,
      tipo_documento: student.tipo_documento,
    },
    years,
  };
}
