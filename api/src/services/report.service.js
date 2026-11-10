import { HttpError } from '../shared/http-error.js';
import { periodById, findRaw } from '../repositories/resource.repository.js';
import * as repo from '../repositories/report.repository.js';
import * as finalGradesRepo from '../repositories/period-final-grades.repository.js';

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

/**
 * Nota del boletín anual con UNA cifra decimal (4.36 → 4.4), redondeando la
 * mitad hacia arriba (4.35 → 4.4). Se usa la notación exponencial porque
 * 4.35 * 10 en binario da 43.4999… y Math.round lo bajaría a 4.3.
 *
 * Antes se recorta el ruido binario de las sumas: (5 + 4.7 + 4.7 + 4.9 +
 * 4.9 + 4.3) / 6 debería ser 4.75 pero da 4.7499999999999…, y sin este paso
 * salía 4.7 en vez de 4.8 (y el resultado dependía del orden de las materias).
 */
export function notaBoletin(valor) {
  if (valor === null || valor === undefined) return null;
  const limpio = Number(Number(valor).toFixed(10));
  return Number(`${Math.round(Number(`${limpio}e1`))}e-1`);
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
 *
 * `assignments` (asignaciones del grado) puede venir ya cargado: el reporte
 * anual lo consulta una sola vez para sus cuatro períodos.
 */
async function buildPeriodData(student, period, institution, grade, assignments = null) {
  const escalaMaxima = escalaDe(institution);
  const notaMinima = notaMinimaDe(institution, escalaMaxima);

  const subjects = [];
  const bySubject = {};

  if (period.virtual) {
    if (grade) {
      assignments = assignments ?? await repo.assignmentsOfGrade(grade.id);
      for (const assign of assignments) {
        const subject = {
          materia_id: assign.materia_id,
          materia: assign.materia || 'Materia',
          docente: [assign.docente_nombre, assign.docente_apellido].filter(Boolean).join(' ') || null,
          evaluaciones: [],
          promedio: null,
          desempeno: null,
          estado: 'Sin notas',
          fallas: null,
          justificadas: null,
        };
        subjects.push(subject);
        bySubject[assign.materia_id] = {
          promedio: null,
          desempeno: null,
          hasMarks: false,
          fallas: null,
          justificadas: null,
        };
      }
    }
    return {
      report: {
        student: buildStudentBlock(student),
        institution: buildInstitutionBlock(institution, null),
        period: {
          id: period.id,
          numero: period.numero,
          nombre: period.nombre,
          anio: period.anio,
          fecha_inicio: null,
          fecha_fin: null,
          activo: false,
        },
        grade: grade ? { id: grade.id, nombre: grade.nombre, tipo_grado: grade.tipo_grado } : null,
        subjects,
        attendance: { presente: 0, ausente: 0, justificada: 0, total: 0, tasa: 0 },
        summary: {
          promedioGeneral: null,
          estadoGlobal: 'Sin notas',
          escalaMaxima,
          notaMinimaAprobacion: notaMinima,
        },
      },
      bySubject,
    };
  }

  let allMarks = [];
  let attendanceBySubject = {};

  if (grade) {
    // Consultas independientes entre sí: se lanzan a la vez.
    let allEvals;
    [assignments, allMarks, allEvals, attendanceBySubject] = await Promise.all([
      assignments ?? repo.assignmentsOfGrade(grade.id),
      repo.marksOfStudentPeriod(student.id, period.id),
      repo.evaluationsOfPeriod(institution.id, grade.id, period.id),
      repo.attendanceCountsBySubject(student.id, period.id),
    ]);

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

  const [institution, config, grade] = await Promise.all([
    findRaw('institutions', user.institucion_id),
    repo.reportConfigFor(user.institucion_id),
    repo.gradeOfStudent(studentId),
  ]);

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

  const [institution, config, grade, dbPeriods] = await Promise.all([
    findRaw('institutions', user.institucion_id),
    repo.reportConfigFor(user.institucion_id),
    repo.gradeOfStudent(studentId),
    repo.periodsOfYear(user.institucion_id, anio),
  ]);
  // Las asignaciones del grado son las mismas en los cuatro períodos.
  const assignments = grade ? await repo.assignmentsOfGrade(grade.id) : [];
  const periods = [1, 2, 3, 4].map(num => {
    const found = dbPeriods.find(p => Number(p.numero) === num);
    if (found) return found;
    return {
      id: `virtual-${user.institucion_id}-${anio}-${num}`,
      numero: num,
      nombre: `Periodo ${num}`,
      anio: Number(anio),
      fecha_inicio: null,
      fecha_fin: null,
      activo: false,
      virtual: true,
    };
  });

  const perPeriodBySubject = {}; // materia_id → array de { periodIndex, valoracion, desempeno }

  // Los períodos son independientes: se construyen a la vez (el orden se conserva).
  const built = await Promise.all(
    periods.map(period => buildPeriodData(student, period, institution, grade, assignments))
  );
  const periodsData = built.map(b => b.report);
  for (const [index, { bySubject }] of built.entries()) {
    for (const [materiaId, info] of Object.entries(bySubject)) {
      (perPeriodBySubject[materiaId] = perPeriodBySubject[materiaId] || []).push({
        index,
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

  // "Notas boletín" (TEMPORAL): definitivas de periodos anteriores cargadas a
  // mano. Ocupan la valoración de su periodo como si se hubiera calculado.
  const definitivasCargadas = await finalGradesRepo.ofStudentYear(studentId, anio);
  const cargadasPorPeriodo = {}; // índice de periodo → [notas]
  for (const { materia_id, numero, nota } of definitivasCargadas) {
    const index = periods.findIndex(p => Number(p.numero) === Number(numero));
    if (index < 0 || !subjectMeta[materia_id]) continue;
    const lista = (perPeriodBySubject[materia_id] = perPeriodBySubject[materia_id] || []);
    const previo = lista.find(d => d.index === index);
    const dato = {
      index,
      valoracion: nota,
      desempeno: desempeno(nota, escalaMaxima),
      fallas: previo?.fallas ?? null,
      justificadas: previo?.justificadas ?? null,
    };
    if (previo) Object.assign(previo, dato);
    else lista.push(dato);
    (cargadasPorPeriodo[index] = cargadasPorPeriodo[index] || []).push(nota);
  }
  // Promedio del periodo para los periodos que solo tienen definitivas cargadas.
  for (const [index, notas] of Object.entries(cargadasPorPeriodo)) {
    const summary = periodsData[index].summary;
    if (summary.promedioGeneral === null || summary.promedioGeneral === undefined) {
      summary.promedioGeneral = Number((notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(2));
      summary.estadoGlobal = summary.promedioGeneral >= notaMinima ? 'Aprobado' : 'Reprobado';
    }
  }

  // Logros: por assignment (materia+grado) y período más reciente con texto.
  const assignmentByMateria = {};
  for (const a of assignments) assignmentByMateria[a.materia_id] = a.id;

  // Más reciente primero. Logros y observaciones se traen en una sola consulta
  // cada uno y aquí se elige el primer período que tenga texto.
  const periodsDesc = [...periods].sort((a, b) => Number(b.numero) - Number(a.numero));
  const periodIds = periods.map(p => p.id);
  const [achievementRows, observationRows] = await Promise.all([
    repo.achievementsOf(Object.values(assignmentByMateria), periodIds),
    repo.observationsOf(studentId, periodIds),
  ]);
  const textoMasReciente = (rows, filtro) => {
    for (const p of periodsDesc) {
      const txt = rows.find(r => r.periodo_id === p.id && filtro(r))?.texto?.trim();
      if (txt) return txt;
    }
    return null;
  };

  // En el boletín anual todas las notas van con UNA cifra decimal, y la
  // definitiva, el desempeño y el estado se calculan con esas notas ya
  // redondeadas: lo que se ve es lo que cuenta (un 2.96 que se muestra como
  // 3.0 no puede salir "Reprobado" con mínima 3).
  const subjects = Object.keys(subjectMeta).map(materiaId => {
    const porPeriodo = periods.map((period, i) => {
      const dato = (perPeriodBySubject[materiaId] || []).find(d => d.index === i);
      const valoracion = dato ? notaBoletin(dato.valoracion) : null;
      return {
        period_id: period.id,
        numero: period.numero,
        valoracion,
        desempeno: desempeno(valoracion, escalaMaxima),
        fallas: dato ? dato.fallas : null,
        justificadas: dato ? dato.justificadas : null,
      };
    });
    const valoraciones = porPeriodo.map(p => p.valoracion).filter(v => v !== null && v !== undefined);
    const definitiva = valoraciones.length > 0
      ? notaBoletin(valoraciones.reduce((a, b) => a + b, 0) / valoraciones.length)
      : null;
    const estado =
      definitiva === null
        ? 'Sin notas'
        : definitiva >= notaMinima
          ? 'Aprobado'
          : 'Reprobado';

    // Logro más reciente (mayor numero) con texto
    const assignmentId = assignmentByMateria[materiaId];
    const logros = assignmentId
      ? textoMasReciente(achievementRows, r => r.assignment_id === assignmentId)
      : null;

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
  });

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

  const promediosPeriodo = periodsData.map(r => notaBoletin(r.summary.promedioGeneral));
  const desempenosPeriodo = promediosPeriodo.map(p => desempeno(p, escalaMaxima));
  const definitivas = subjects.map(s => s.definitiva).filter(v => v !== null && v !== undefined);
  const promedioGeneralDefinitivo =
    definitivas.length > 0
      ? notaBoletin(definitivas.reduce((a, b) => a + b, 0) / definitivas.length)
      : null;

  // Observación más reciente del estudiante con texto
  const observaciones = textoMasReciente(observationRows, () => true) ?? '';

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



/**
 * Estado académico anual de TODOS los estudiantes (con notas) de una
 * institución, para el resumen del admin (estudiantes en riesgo y destacados).
 *
 * Antes el navegador pedía el boletín anual de cada estudiante por separado
 * (N peticiones de ~20 consultas). Aquí se resuelve con un puñado de
 * consultas en bloque y la MISMA regla del boletín anual:
 *  · valoración de un período = promedio ponderado de sus notas, solo si la
 *    materia tiene evaluaciones en ese período; las definitivas cargadas a
 *    mano ("Notas boletín") la reemplazan;
 *  · cada valoración con una cifra decimal; definitiva = promedio de las
 *    valoraciones existentes; promedio general = promedio de las definitivas;
 *  · asistencia = suma de los cuatro períodos del año.
 * La prueba de equivalencia (tests) compara estudiante por estudiante con
 * getYearReport, para que ambas reglas no se separen.
 */
export async function getInstitutionYearStatus(user, institucionId, anio) {
  if (!user) throw new HttpError(401, 'No autorizado. Inicia sesión.');
  const esSuper = user.rol === 'super_admin';
  if (!esSuper && !(user.rol === 'admin' && user.institucion_id === institucionId)) {
    throw new HttpError(403, 'Solo el administrador de la institución puede ver su estado académico.');
  }
  if (!anio || !Number.isInteger(Number(anio))) throw new HttpError(400, 'Falta anio.');

  const institution = await findRaw('institutions', institucionId);
  if (!institution) throw new HttpError(404, 'Institución no encontrada.');
  const escalaMaxima = escalaDe(institution);

  const [estudiantes, dbPeriods, asignaciones] = await Promise.all([
    repo.studentsWithMarksOf(institucionId),
    repo.periodsOfYear(institucionId, anio),
    repo.assignmentsOfInstitution(institucionId),
  ]);
  // Mismos 4 períodos que el boletín: el primero real con cada número, o vacío.
  const periodos = [1, 2, 3, 4].map(num => dbPeriods.find(p => Number(p.numero) === num) ?? null);
  const periodIds = periodos.filter(Boolean).map(p => p.id);
  const studentIds = estudiantes.map(e => e.id);

  const [notas, evaluadas, asistencias, cargadas] = await Promise.all([
    repo.marksOfStudentsInPeriods(studentIds, periodIds),
    repo.evaluatedClassesInPeriods(institucionId, periodIds),
    repo.attendanceCountsOfStudents(studentIds, periodIds),
    finalGradesRepo.ofStudentsYear(studentIds, anio),
  ]);

  const materiasDeGrado = new Map();
  for (const a of asignaciones) {
    if (!materiasDeGrado.has(a.grado_id)) materiasDeGrado.set(a.grado_id, new Set());
    materiasDeGrado.get(a.grado_id).add(a.materia_id);
  }
  const conEvaluacion = new Set(evaluadas.map(e => `${e.grado_id}|${e.materia_id}|${e.periodo_id}`));
  const notasDe = new Map(); // estudiante|materia|periodo → [{nota, porcentaje}]
  for (const n of notas) {
    const k = `${n.estudiante_id}|${n.materia_id}|${n.periodo_id}`;
    if (!notasDe.has(k)) notasDe.set(k, []);
    notasDe.get(k).push({ nota: Number(n.nota), porcentaje: Number(n.porcentaje) });
  }
  const cargadaDe = new Map(cargadas.map(c => [`${c.estudiante_id}|${c.materia_id}|${c.numero}`, c.nota]));
  const asistenciaDe = new Map();
  for (const a of asistencias) {
    const t = asistenciaDe.get(a.estudiante_id) ?? { presente: 0, ausente: 0, justificada: 0 };
    if (a.estado in t) t[a.estado] += a.n;
    asistenciaDe.set(a.estudiante_id, t);
  }

  return estudiantes.map(({ id, grado_id }) => {
    const materias = grado_id ? [...(materiasDeGrado.get(grado_id) ?? [])] : [];
    const definitivas = [];
    for (const materiaId of materias) {
      const valoraciones = [];
      periodos.forEach((periodo, i) => {
        let valor = null;
        if (periodo && conEvaluacion.has(`${grado_id}|${materiaId}|${periodo.id}`)) {
          const marks = notasDe.get(`${id}|${materiaId}|${periodo.id}`);
          if (marks?.length) valor = weightedAverage(marks);
        }
        const cargada = cargadaDe.get(`${id}|${materiaId}|${i + 1}`);
        if (cargada !== undefined) valor = cargada;
        if (valor !== null) valoraciones.push(notaBoletin(valor));
      });
      if (valoraciones.length) definitivas.push(notaBoletin(valoraciones.reduce((a, b) => a + b, 0) / valoraciones.length));
    }
    const promedio = definitivas.length
      ? notaBoletin(definitivas.reduce((a, b) => a + b, 0) / definitivas.length)
      : null;
    // Igual que el boletín: sin grado no se cuenta la asistencia.
    const asis = (grado_id && asistenciaDe.get(id)) || { presente: 0, ausente: 0, justificada: 0 };
    const total = asis.presente + asis.ausente + asis.justificada;
    return {
      studentId: id,
      promedio,
      desempeno: desempeno(promedio, escalaMaxima),
      asistenciaTasa: total === 0 ? 0 : Math.round((asis.presente / total) * 100),
      ausentes: asis.ausente,
    };
  });
}
