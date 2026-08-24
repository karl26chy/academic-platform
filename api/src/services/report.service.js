import { HttpError } from '../shared/http-error.js';
import { periodById, findRaw } from '../repositories/resource.repository.js';
import * as repo from '../repositories/report.repository.js';
import pool from '../db/pool.js';

/**
 * Reporte académico.
 *
 * · `GET report?period_id=…` → reporte de UN período (AcademicReportData).
 * · `GET report?anio=…`      → reporte ANUAL (AcademicYearReportData):
 *   períodos y materias DINÁMICOS (los que existan en el sistema), columnas
 *   F/V/D por período y Definitiva = promedio de las valoraciones de los
 *   períodos que realmente tienen datos (un período sin notas NO se inventa
 *   como 0).
 *
 * Autorización (backend es la autoridad): solo el ADMIN de la institución;
 * estudiante y período/año deben pertenecer a la institución del admin.
 */

/** Promedio ponderado Σ(nota × porcentaje) / Σ(porcentaje); si no hay
 *  porcentajes, cae al promedio aritmético (misma regla que lib/grades.ts). */
function weightedAverage(marks) {
  if (marks.length === 0) return 0;
  const totalWeighted = marks.reduce((acc, m) => acc + m.nota * (m.porcentaje || 0), 0);
  const totalWeight = marks.reduce((acc, m) => acc + (m.porcentaje || 0), 0);
  const avg =
    totalWeight > 0
      ? totalWeighted / totalWeight
      : marks.reduce((acc, m) => acc + m.nota, 0) / marks.length;
  return Number(avg.toFixed(2));
}

function edadDesde(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const match = String(fechaNacimiento).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const nac = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

/**
 * Desempeño S/A/B/Z a partir de una valoración, escalado por la escala de la
 * institución (factor = escala_maxima / 5):
 *   S ≥ 4.6·k · A 4.0–4.5·k · B 3.0–3.9·k · Z < 3.0·k
 * Devuelve null si no hay valoración.
 */
export function desempeno(valoracion, escalaMaxima) {
  if (valoracion === null || valoracion === undefined) return null;
  const k = (Number(escalaMaxima) || 5) / 5;
  const v = Number(valoracion);
  if (v >= 4.6 * k) return 'S';
  if (v >= 4.0 * k) return 'A';
  if (v >= 3.0 * k) return 'B';
  return 'Z';
}

const escalaDe = (institution) =>
  Number(institution?.escala_maxima ?? (institution?.tipo === 'universidad' ? 5 : 10));
const notaMinimaDe = (institution, escala) =>
  Number(institution?.nota_minima_aprobacion ?? Math.round(escala * 0.6));

function buildStudentBlock(student) {
  return {
    id: student.id,
    nombre: student.nombre,
    apellido: student.apellido,
    identificacion: student.identificacion ?? null,
    tipo_documento: student.tipo_documento ?? null,
    edad: edadDesde(student.fecha_nacimiento),
    genero: student.genero ?? null,
  };
}

function buildInstitutionBlock(institution, config) {
  return {
    id: institution.id,
    nombre: institution.nombre,
    tipo: institution.tipo,
    escala_maxima: escalaDe(institution),
    nota_minima_aprobacion: notaMinimaDe(institution, escalaDe(institution)),
    reportConfig: config
      ? {
          logo_url: config.logo_url || null,
          config: config.config || {},
        }
      : null,
  };
}

/**
 * Datos de UN período. Devuelve el reporte por período y, además, un mapa
 * interno materia_id → { promedio, desempeno, fallas, justificadas, hasMarks }
 * para la agregación anual.
 */
async function buildPeriodData(student, period, institution, grade) {
  const escalaMaxima = escalaDe(institution);
  const notaMinima = notaMinimaDe(institution, escalaMaxima);

  const subjects = [];
  const bySubject = {};
  let allMarks = [];
  let attendanceRows = [];
  let attendanceBySubject = {};

  if (grade) {
    const assignments = await repo.assignmentsOfGrade(grade.id);
    allMarks = await repo.marksOfStudentPeriod(student.id, period.id);
    const allEvals = await repo.evaluationsOfPeriod(institution.id, grade.id, period.id);
    attendanceBySubject = await repo.attendanceCountsBySubject(student.id, period.id);

    for (const assign of assignments) {
      const evals = allEvals.filter(e => e.materia_id === assign.materia_id);
      const subjectMarks = allMarks.filter(m => m.materia_id === assign.materia_id);
      const hasMarks = evals.length > 0 && subjectMarks.length > 0;
      const promedio = hasMarks
        ? weightedAverage(subjectMarks.map(m => ({ nota: Number(m.nota), porcentaje: Number(m.porcentaje) })))
        : null;
      const att = attendanceBySubject[assign.materia_id] || null;

      const subject = {
        materia_id: assign.materia_id,
        materia: assign.materia || 'Materia',
        docente: [assign.docente_nombre, assign.docente_apellido].filter(Boolean).join(' ') || null,
        evaluaciones: evals.map(ev => ({
          evaluacion_id: ev.id,
          nombre: ev.nombre,
          porcentaje: ev.porcentaje !== null ? Number(ev.porcentaje) : null,
          fecha: ev.fecha_evaluacion || null,
          nota: (() => {
            const mark = subjectMarks.find(m => m.evaluacion_id === ev.id);
            return mark ? Number(mark.nota) : null;
          })(),
        })),
        promedio,
        desempeno: desempeno(promedio, escalaMaxima),
        estado: hasMarks ? (promedio >= notaMinima ? 'Aprobado' : 'Reprobado') : 'Sin notas',
        fallas: att ? att.ausente : null,
        justificadas: att ? att.justificada : null,
      };
      subjects.push(subject);
      bySubject[assign.materia_id] = {
        promedio,
        desempeno: subject.desempeno,
        hasMarks,
        fallas: att ? att.ausente : null,
        justificadas: att ? att.justificada : null,
      };
    }
  } else {
    allMarks = await repo.marksOfStudentPeriod(student.id, period.id);
  }

  attendanceRows = await repo.attendanceOfStudentPeriod(student.id, period.id);
  if (attendanceRows.length === 0) attendanceRows = null; // solo para no iterar de más

  const presente = Object.values(attendanceBySubject).reduce((s, v) => s + v.presente, 0);
  const ausente = Object.values(attendanceBySubject).reduce((s, v) => s + v.ausente, 0);
  const justificada = Object.values(attendanceBySubject).reduce((s, v) => s + v.justificada, 0);
  const total = presente + ausente + justificada;
  const tasa = total === 0 ? 0 : Math.round((presente / total) * 100);

  const promedioGeneral = weightedAverage(
    allMarks.map(m => ({ nota: Number(m.nota), porcentaje: Number(m.porcentaje) }))
  );
  const estadoGlobal =
    allMarks.length === 0 ? 'Sin notas' : promedioGeneral >= notaMinima ? 'Aprobado' : 'Reprobado';

  return {
    report: {
      student: buildStudentBlock(student),
      institution: buildInstitutionBlock(institution, null),
      period: {
        id: period.id,
        numero: period.numero,
        nombre: period.nombre,
        anio: period.anio,
        fecha_inicio: period.fecha_inicio || null,
        fecha_fin: period.fecha_fin || null,
        activo: period.activo,
      },
      grade: grade ? { id: grade.id, nombre: grade.nombre, tipo_grado: grade.tipo_grado } : null,
      subjects,
      attendance: { presente, ausente, justificada, total, tasa },
      summary: {
        promedioGeneral: allMarks.length === 0 ? null : promedioGeneral,
        estadoGlobal,
        escalaMaxima,
        notaMinimaAprobacion: notaMinima,
      },
    },
    bySubject,
  };
}

export async function getReport(user, studentId, periodId) {
  if (!user) throw new HttpError(401, 'No autorizado. Inicia sesión.');
  if (user.rol !== 'admin') {
    throw new HttpError(403, 'Solo el administrador de la institución puede generar boletines.');
  }
  if (!periodId) throw new HttpError(400, 'Falta period_id.');

  const student = await repo.studentForReport(studentId);
  if (!student || student.institucion_id !== user.institucion_id) {
    throw new HttpError(404, 'Estudiante no encontrado.');
  }

  const period = await periodById(periodId);
  if (!period || period.institucion_id !== user.institucion_id) {
    throw new HttpError(404, 'Período académico no encontrado.');
  }

  const institution = await findRaw('institutions', user.institucion_id);
  const config = await repo.reportConfigFor(user.institucion_id);
  const grade = await repo.gradeOfStudent(studentId);

  const { report } = await buildPeriodData(student, period, institution, grade);
  report.institution = buildInstitutionBlock(institution, config);
  return report;
}

export async function getYearReport(user, studentId, anio) {
  if (!user) throw new HttpError(401, 'No autorizado. Inicia sesión.');
  if (user.rol !== 'admin') {
    throw new HttpError(403, 'Solo el administrador de la institución puede generar boletines.');
  }
  if (!anio) throw new HttpError(400, 'Falta anio.');

  const student = await repo.studentForReport(studentId);
  if (!student || student.institucion_id !== user.institucion_id) {
    throw new HttpError(404, 'Estudiante no encontrado.');
  }

  const institution = await findRaw('institutions', user.institucion_id);
  const config = await repo.reportConfigFor(user.institucion_id);
  const grade = await repo.gradeOfStudent(studentId);
  const periods = await repo.periodsOfYear(user.institucion_id, anio);

  const periodsData = [];
  const perPeriodBySubject = {}; // materia_id → array de { periodIndex, valoracion, desempeno }

  for (const period of periods) {
    const { report, bySubject } = await buildPeriodData(student, period, institution, grade);
    periodsData.push(report);
    for (const [materiaId, info] of Object.entries(bySubject)) {
      (perPeriodBySubject[materiaId] = perPeriodBySubject[materiaId] || []).push({
        index: periodsData.length - 1,
        valoracion: info.promedio,
        desempeno: info.desempeno,
        fallas: info.fallas,
        justificadas: info.justificadas,
      });
    }
  }

  const escalaMaxima = escalaDe(institution);
  const notaMinima = notaMinimaDe(institution, escalaMaxima);

  // Materias dinámicas: las del grado del estudiante (de cualquier período);
  // porPeríodo alineado con el array de períodos.
  const subjectMeta = {}; // materia_id → { materia, docente }
  for (const report of periodsData) {
    for (const s of report.subjects) {
      subjectMeta[s.materia_id] = { materia: s.materia, docente: s.docente };
    }
  }

  // Logros: por assignment (materia+grado) y período más reciente con texto
  // Mapa assignment por materia_id para este grado
  const assignmentByMateria = {};
  if (grade) {
    const { rows: assignRows } = await pool.query(
      `SELECT id, materia_id FROM assignments WHERE grado_id = $1`,
      [grade.id]
    );
    for (const a of assignRows) assignmentByMateria[a.materia_id] = a.id;
  }

  const subjects = await Promise.all(
    Object.keys(subjectMeta).map(async materiaId => {
      const porPeriodo = periods.map((period, i) => {
        const dato = (perPeriodBySubject[materiaId] || []).find(d => d.index === i);
        return {
          period_id: period.id,
          numero: period.numero,
          valoracion: dato ? dato.valoracion : null,
          desempeno: dato ? dato.desempeno : null,
          fallas: dato ? dato.fallas : null,
          justificadas: dato ? dato.justificadas : null,
        };
      });
      const valoraciones = porPeriodo.map(p => p.valoracion).filter(v => v !== null && v !== undefined);
      const definitiva = valoraciones.length > 0
        ? Number((valoraciones.reduce((a, b) => a + b, 0) / valoraciones.length).toFixed(2))
        : null;
      const estado =
        definitiva === null
          ? 'Sin notas'
          : definitiva >= notaMinima
            ? 'Aprobado'
            : 'Reprobado';

      // Logro más reciente (mayor numero) con texto
      let logros = null;
      const assignmentId = assignmentByMateria[materiaId];
      if (assignmentId) {
        const periodsDesc = [...periods].sort((a, b) => Number(b.numero) - Number(a.numero));
        for (const p of periodsDesc) {
          const { rows } = await pool.query(
            `SELECT texto FROM subject_achievements WHERE assignment_id = $1 AND periodo_id = $2`,
            [assignmentId, p.id]
          );
          const txt = rows[0]?.texto?.trim();
          if (txt) { logros = txt; break; }
        }
      }

      return {
        materia_id: materiaId,
        materia: subjectMeta[materiaId].materia,
        docente: subjectMeta[materiaId].docente,
        porPeriodo,
        definitiva,
        desempenoDefinitiva: desempeno(definitiva, escalaMaxima),
        estado,
        logros,
      };
    })
  );

  // Asistencia anual: suma de los períodos.
  const attendance = periodsData.reduce(
    (acc, r) => {
      acc.presente += r.attendance.presente;
      acc.ausente += r.attendance.ausente;
      acc.justificada += r.attendance.justificada;
      acc.total += r.attendance.total;
      return acc;
    },
    { presente: 0, ausente: 0, justificada: 0, total: 0 }
  );
  attendance.tasa = attendance.total === 0 ? 0 : Math.round((attendance.presente / attendance.total) * 100);

  const promediosPeriodo = periodsData.map(r => r.summary.promedioGeneral);
  const desempenosPeriodo = promediosPeriodo.map(p => desempeno(p, escalaMaxima));
  const definitivas = subjects.map(s => s.definitiva).filter(v => v !== null && v !== undefined);
  const promedioGeneralDefinitivo =
    definitivas.length > 0
      ? Number((definitivas.reduce((a, b) => a + b, 0) / definitivas.length).toFixed(2))
      : null;

  // Observación más reciente del estudiante con texto
  let observaciones = '';
  {
    const periodsDesc = [...periods].sort((a, b) => Number(b.numero) - Number(a.numero));
    for (const p of periodsDesc) {
      const { rows } = await pool.query(
        `SELECT texto FROM student_observations WHERE estudiante_id = $1 AND periodo_id = $2`,
        [studentId, p.id]
      );
      const txt = rows[0]?.texto?.trim();
      if (txt) { observaciones = txt; break; }
    }
  }

  return {
    student: buildStudentBlock(student),
    institution: buildInstitutionBlock(institution, config),
    grade: grade ? { id: grade.id, nombre: grade.nombre, tipo_grado: grade.tipo_grado } : null,
    year: Number(anio),
    periods: periodsData,
    subjects,
    attendance,
    observaciones,
    summary: {
      promediosPeriodo,
      desempenosPeriodo,
      promedioGeneralDefinitivo,
      desempenoGlobal: desempeno(promedioGeneralDefinitivo, escalaMaxima),
      escalaMaxima,
      notaMinimaAprobacion: notaMinima,
    },
  };
}


