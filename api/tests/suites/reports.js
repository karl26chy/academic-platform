import { get, post, put, login } from '../helpers/http.js';
import { track } from '../helpers/fixtures.js';
import { suite, test, equal, ok, notOk, expectError } from '../helpers/runner.js';

/**
 * Reporte académico individual por período:
 *  · solo ADMIN de la institución (docente/estudiante/sin sesión → rechazado);
 *  · aislamiento: admin A no genera boletín de estudiante ni período de B;
 *  · datos filtrados por período (notas, evaluaciones, asistencia);
 *  · períodos cerrados e históricos consultables;
 *  · escalas 5/10/100 con nota mínima de la institución;
 *  · boletín estrictamente individual.
 */
export default async function reportsSuite(world) {
  suite('Boletines (reporte académico)');

  const su = world.tokens.super;
  let seq = 0;
  const tag = () => `${world.id}-${seq++}`;

  async function mkInstitution(escala, notaMinima) {
    const t = tag();
    const inst = (await post('/institutions', {
      nombre: `Reporte ${t}`, subdominio: `rep${t}`,
      tipo: 'colegio', escala_maxima: escala, nota_minima_aprobacion: notaMinima, activa: true,
    }, su)).data;
    track(world, 'institutions', inst.id);

    const grade = (await post('/grades', { institucion_id: inst.id, nombre: `G-${t}`, tipo_grado: 'A' }, su)).data;
    track(world, 'grades', grade.id);

    const subject = (await post('/subjects', { institucion_id: inst.id, nombre: `Mat-${t}`, descripcion: 'x' }, su)).data;
    track(world, 'subjects', subject.id);

    const admin = (await post('/users', {
      email: `admrep.${t}@test.local`, password: world.password, rol: 'admin',
      nombre: 'Adm', apellido: 'R', institucion_id: inst.id, activo: true,
    }, su)).data;
    track(world, 'users', admin.id);

    const teacher = (await post('/users', {
      email: `tearep.${t}@test.local`, password: world.password, rol: 'teacher',
      nombre: 'Prof', apellido: 'R', institucion_id: inst.id, activo: true,
    }, su)).data;
    track(world, 'users', teacher.id);

    const student = (await post('/users', {
      email: `sturep.${t}@test.local`, password: world.password, rol: 'student',
      nombre: 'Carlos', apellido: 'Charris', institucion_id: inst.id,
      tipo_documento: 'TI', identificacion: `ID1${t}`, activo: true,
    }, su)).data;
    track(world, 'users', student.id);

    const student2 = (await post('/users', {
      email: `sturep2.${t}@test.local`, password: world.password, rol: 'student',
      nombre: 'Juan', apellido: 'Perez', institucion_id: inst.id,
      tipo_documento: 'TI', identificacion: `ID2${t}`, activo: true,
    }, su)).data;
    track(world, 'users', student2.id);

    const assignment = (await post('/assignments', {
      profesor_id: teacher.id, materia_id: subject.id, grado_id: grade.id, institucion_id: inst.id,
    }, su)).data;
    track(world, 'assignments', assignment.id);

    const enrollment = (await post('/student_grades', {
      estudiante_id: student.id, grado_id: grade.id,
    }, su)).data;
    track(world, 'student_grades', enrollment.id);
    const enrollment2 = (await post('/student_grades', {
      estudiante_id: student2.id, grado_id: grade.id,
    }, su)).data;
    track(world, 'student_grades', enrollment2.id);

    const period = (await post('/academic_periods', {
      institucion_id: inst.id, nombre: 'Primer periodo', numero: 1, anio: 2026,
      fecha_inicio: '2026-01-01', fecha_fin: '2026-03-31', activo: true,
    }, su)).data;
    track(world, 'academic_periods', period.id);

    const adminToken = (await login(admin.email, world.password)).token;
    return { inst, grade, subject, admin, adminToken, teacher, student, student2, period };
  }

  /** Crea evaluación + nota para un estudiante en el período del contexto. */
  async function addMark(ctx, estudianteId, nota, porcentaje = 30, period = ctx.period) {
    const evalRes = (await post('/evaluations', {
      institucion_id: ctx.inst.id, materia_id: ctx.subject.id, grado_id: ctx.grade.id,
      nombre: `Parcial ${seq}`, fecha_evaluacion: '2026-02-15', porcentaje,
      periodo_id: period.id, creado_por: ctx.teacher.id,
    }, su)).data;
    track(world, 'evaluations', evalRes.id);
    const mark = (await post('/marks', {
      estudiante_id: estudianteId, materia_id: ctx.subject.id, grado_id: ctx.grade.id,
      evaluacion_id: evalRes.id, tipo_evaluacion: 'Parcial', fecha_evaluacion: '2026-02-15',
      porcentaje, nota, registrado_por: ctx.teacher.id,
    }, su)).data;
    track(world, 'marks', mark.id);
    return mark;
  }

  async function addAttendance(ctx, estudianteId) {
    const att = (await post('/attendance', {
      estudiante_id: estudianteId, materia_id: ctx.subject.id, grado_id: ctx.grade.id,
      fecha: '2026-02-10', estado: 'presente', periodo_id: ctx.period.id, registrado_por: ctx.teacher.id,
    }, su)).data;
    track(world, 'attendance', att.id);
    return att;
  }

  /** Crea un período del mismo año (cerrado, sin cerrar los demás). */
  async function mkClosedPeriod(ctx, numero, nombre) {
    const p = (await post('/academic_periods', {
      institucion_id: ctx.inst.id, nombre, numero, anio: 2026,
      fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', activo: false,
    }, su)).data;
    track(world, 'academic_periods', p.id);
    return p;
  }

  /** Abre un período (cierra los demás) con el admin del contexto. */
  async function openPeriod(ctx, period) {
    await put(`/academic_periods/${period.id}`, {
      institucion_id: ctx.inst.id, nombre: period.nombre, numero: period.numero,
      anio: period.anio, fecha_inicio: period.fecha_inicio || '2026-01-01',
      fecha_fin: period.fecha_fin || '2026-12-31', activo: true,
    }, ctx.adminToken);
  }

  /** Crea una materia extra + asignación + evaluación + nota en el período. */
  async function addSubjectWithMark(ctx, nota, nombre, period = ctx.period) {
    const subject = (await post('/subjects', { institucion_id: ctx.inst.id, nombre, descripcion: 'x' }, su)).data;
    track(world, 'subjects', subject.id);
    const assignment = (await post('/assignments', {
      profesor_id: ctx.teacher.id, materia_id: subject.id, grado_id: ctx.grade.id, institucion_id: ctx.inst.id,
    }, su)).data;
    track(world, 'assignments', assignment.id);
    const evalRes = (await post('/evaluations', {
      institucion_id: ctx.inst.id, materia_id: subject.id, grado_id: ctx.grade.id,
      nombre: `Eval ${nombre}`, fecha_evaluacion: '2026-02-15', porcentaje: 30,
      periodo_id: period.id, creado_por: ctx.teacher.id,
    }, su)).data;
    track(world, 'evaluations', evalRes.id);
    const mark = (await post('/marks', {
      estudiante_id: ctx.student.id, materia_id: subject.id, grado_id: ctx.grade.id,
      evaluacion_id: evalRes.id, tipo_evaluacion: 'Parcial', fecha_evaluacion: '2026-02-15',
      porcentaje: 30, nota, registrado_por: ctx.teacher.id,
    }, su)).data;
    track(world, 'marks', mark.id);
    return { subject, mark };
  }

  // ---- Autorización --------------------------------------------------------

  await test('admin A genera el boletín de un estudiante de su institución', async () => {
    const ctx = await mkInstitution(10, 6);
    await addMark(ctx, ctx.student.id, 8);
    await addAttendance(ctx, ctx.student.id);

    const res = await get(`/students/${ctx.student.id}/report?period_id=${ctx.period.id}`, ctx.adminToken);
    equal(res.status, 200, 'status');
    equal(res.data.student.nombre, 'Carlos', 'estudiante correcto');
    equal(res.data.institution.id, ctx.inst.id, 'institución correcta');
    equal(res.data.summary.escalaMaxima, 10, 'escala 10');
    equal(res.data.summary.notaMinimaAprobacion, 6, 'nota mínima 6');
    equal(res.data.subjects[0].promedio, 8, 'promedio de la materia');
    equal(res.data.subjects[0].estado, 'Aprobado', 'nota 8 en escala 10 min 6 aprueba');
    equal(res.data.attendance.presente, 1, 'asistencia presente');
  });

  await test('admin A NO puede generar el boletín de un estudiante de otra institución', async () => {
    const ctx = await mkInstitution(10, 6);
    expectError(
      await get(`/students/${world.users.studentB.id}/report?period_id=${ctx.period.id}`, ctx.adminToken),
      404,
      'Estudiante no encontrado.'
    );
  });

  await test('admin A NO puede usar un período de otra institución', async () => {
    const ctx = await mkInstitution(10, 6);
    expectError(
      await get(`/students/${ctx.student.id}/report?period_id=${world.periods.B.id}`, ctx.adminToken),
      404,
      'Período académico no encontrado.'
    );
  });

  await test('faltar el period_id devuelve 400', async () => {
    const ctx = await mkInstitution(10, 6);
    expectError(await get(`/students/${ctx.student.id}/report`, ctx.adminToken), 400, 'Falta period_id.');
  });

  await test('un docente NO puede generar boletines', async () => {
    expectError(
      await get(`/students/${world.users.studentA.id}/report?period_id=${world.periods.A.id}`, world.tokens.teacherA),
      403
    );
  });

  await test('un estudiante NO puede generar boletines', async () => {
    expectError(
      await get(`/students/${world.users.studentA.id}/report?period_id=${world.periods.A.id}`, world.tokens.studentA),
      403
    );
  });

  await test('un super admin NO puede generar boletines institucionales', async () => {
    expectError(
      await get(`/students/${world.users.studentA.id}/report?period_id=${world.periods.A.id}`, su),
      403
    );
  });

  await test('sin autenticación el endpoint devuelve 401', async () => {
    const res = await get(`/students/${world.users.studentA.id}/report?period_id=${world.periods.A.id}`);
    equal(res.status, 401, 'status');
  });

  // ---- Datos y período -----------------------------------------------------

  await test('un período cerrado sigue siendo consultable', async () => {
    const ctx = await mkInstitution(10, 6);
    await addMark(ctx, ctx.student.id, 9);
    await put(`/academic_periods/${ctx.period.id}`, {
      institucion_id: ctx.inst.id, nombre: 'Primer periodo', numero: 1, anio: 2026,
      fecha_inicio: '2026-01-01', fecha_fin: '2026-03-31', activo: false,
    }, ctx.adminToken);

    const res = await get(`/students/${ctx.student.id}/report?period_id=${ctx.period.id}`, ctx.adminToken);
    equal(res.status, 200, 'reporte disponible');
    equal(res.data.period.activo, false, 'periodo cerrado');
    equal(res.data.subjects[0].promedio, 9, 'las notas del periodo cerrado se conservan');
  });

  await test('un estudiante sin notas devuelve un reporte válido con información vacía', async () => {
    const ctx = await mkInstitution(10, 6);
    const res = await get(`/students/${ctx.student.id}/report?period_id=${ctx.period.id}`, ctx.adminToken);
    equal(res.status, 200, 'status');
    equal(res.data.subjects[0].estado, 'Sin notas', 'materia sin notas');
    equal(res.data.summary.promedioGeneral, null, 'promedio general sin datos');
    equal(res.data.summary.estadoGlobal, 'Sin notas', 'estado global');
  });

  await test('un estudiante sin asistencia devuelve un reporte válido', async () => {
    const ctx = await mkInstitution(10, 6);
    await addMark(ctx, ctx.student.id, 7);
    const res = await get(`/students/${ctx.student.id}/report?period_id=${ctx.period.id}`, ctx.adminToken);
    equal(res.status, 200, 'status');
    equal(res.data.attendance.total, 0, 'sin asistencia');
    equal(res.data.attendance.tasa, 0, 'tasa 0');
  });

  await test('el reporte se filtra por período (notas, evaluaciones y asistencia)', async () => {
    const ctx = await mkInstitution(10, 6);
    const p1 = ctx.period;
    await addMark(ctx, ctx.student.id, 8);
    await addAttendance(ctx, ctx.student.id);

    // Abre el período 2 (cierra el 1 automáticamente) y registra otra nota.
    const p2 = (await post('/academic_periods', {
      institucion_id: ctx.inst.id, nombre: 'Segundo periodo', numero: 2, anio: 2026,
      fecha_inicio: '2026-04-01', fecha_fin: '2026-06-30', activo: true,
    }, su)).data;
    track(world, 'academic_periods', p2.id);
    ctx.period = p2;
    await addMark(ctx, ctx.student.id, 5);

    const r2 = (await get(`/students/${ctx.student.id}/report?period_id=${p2.id}`, ctx.adminToken)).data;
    equal(r2.subjects[0].promedio, 5, 'p2 solo trae su nota');
    equal(r2.attendance.total, 0, 'p2 sin asistencia');

    const r1 = (await get(`/students/${ctx.student.id}/report?period_id=${p1.id}`, ctx.adminToken)).data;
    equal(r1.subjects[0].promedio, 8, 'p1 trae su nota');
    equal(r1.attendance.presente, 1, 'p1 conserva la asistencia');
  });

  // ---- Escalas e individualidad --------------------------------------------

  await test('escala 5 (mínima 3): aprueba 4.5 y reprueba 2.9', async () => {
    const ctx = await mkInstitution(5, 3);
    await addMark(ctx, ctx.student.id, 4.5);
    await addMark(ctx, ctx.student2.id, 2.9);

    const a = (await get(`/students/${ctx.student.id}/report?period_id=${ctx.period.id}`, ctx.adminToken)).data;
    equal(a.summary.escalaMaxima, 5, 'escala 5');
    equal(a.subjects[0].estado, 'Aprobado', '4.5 aprueba');
    equal(a.subjects[0].promedio, 4.5, 'promedio 4.5');

    const b = (await get(`/students/${ctx.student2.id}/report?period_id=${ctx.period.id}`, ctx.adminToken)).data;
    equal(b.subjects[0].estado, 'Reprobado', '2.9 reprueba');
    equal(b.subjects[0].promedio, 2.9, 'promedio 2.9');
    ok(a.student.id !== b.student.id, 'boletines individuales');
  });

  await test('escala 10 (mínima 6): aprueba 7 y reprueba 5', async () => {
    const ctx = await mkInstitution(10, 6);
    await addMark(ctx, ctx.student.id, 7);
    await addMark(ctx, ctx.student2.id, 5);
    const a = (await get(`/students/${ctx.student.id}/report?period_id=${ctx.period.id}`, ctx.adminToken)).data;
    const b = (await get(`/students/${ctx.student2.id}/report?period_id=${ctx.period.id}`, ctx.adminToken)).data;
    equal(a.summary.escalaMaxima, 10, 'escala 10');
    equal(a.subjects[0].estado, 'Aprobado', '7 aprueba');
    equal(b.subjects[0].estado, 'Reprobado', '5 reprueba');
  });

  await test('escala 100 (mínima 60): aprueba 70 y reprueba 50', async () => {
    const ctx = await mkInstitution(100, 60);
    await addMark(ctx, ctx.student.id, 70);
    await addMark(ctx, ctx.student2.id, 50);
    const a = (await get(`/students/${ctx.student.id}/report?period_id=${ctx.period.id}`, ctx.adminToken)).data;
    const b = (await get(`/students/${ctx.student2.id}/report?period_id=${ctx.period.id}`, ctx.adminToken)).data;
    equal(a.summary.escalaMaxima, 100, 'escala 100');
    equal(a.subjects[0].estado, 'Aprobado', '70 aprueba');
    equal(b.subjects[0].estado, 'Reprobado', '50 reprueba');
  });

  // ---- Reporte anual (dinámico) ---------------------------------------------

  await test('reporte anual con 2 períodos (dinámico)', async () => {
    const ctx = await mkInstitution(5, 3);
    await addMark(ctx, ctx.student.id, 4.0);
    const p2 = await mkClosedPeriod(ctx, 2, 'Segundo periodo');
    await openPeriod(ctx, p2);
    await addMark(ctx, ctx.student.id, 4.5, 30, p2);

    const res = (await get(`/students/${ctx.student.id}/report?anio=2026`, ctx.adminToken)).data;
    equal(res.periods.length, 2, 'dos períodos en el año');
    equal(res.subjects.length, 1, 'una materia');
    equal(res.subjects[0].porPeriodo.length, 2, 'dos bloques por materia');
    equal(res.subjects[0].porPeriodo[0].valoracion, 4.0, 'P1 = 4.0');
    equal(res.subjects[0].porPeriodo[1].valoracion, 4.5, 'P2 = 4.5');
    equal(res.subjects[0].definitiva, 4.25, 'definitiva = promedio de los períodos con dato');
    equal(res.summary.promedioGeneralDefinitivo, 4.25, 'promedio general definitivo');
  });

  await test('reporte anual con 4 períodos (dinámico)', async () => {
    const ctx = await mkInstitution(5, 3);
    await addMark(ctx, ctx.student.id, 4.0);
    for (const n of [2, 3, 4]) {
      const p = await mkClosedPeriod(ctx, n, `Periodo ${n}`);
      await openPeriod(ctx, p);
      await addMark(ctx, ctx.student.id, 4.0 + n * 0.1, 30, p);
    }
    const res = (await get(`/students/${ctx.student.id}/report?anio=2026`, ctx.adminToken)).data;
    equal(res.periods.length, 4, 'cuatro períodos');
    equal(res.subjects[0].porPeriodo.length, 4, 'cuatro bloques por materia');
    equal(res.subjects[0].definitiva, 4.22, 'definitiva = (4.0+4.2+4.3+4.4)/4');
  });

  await test('período sin notas no se inventa como 0 en la definitiva', async () => {
    const ctx = await mkInstitution(5, 3);
    await addMark(ctx, ctx.student.id, 4.0);
    const p2 = await mkClosedPeriod(ctx, 2, 'Segundo periodo');
    await openPeriod(ctx, p2);

    const res = (await get(`/students/${ctx.student.id}/report?anio=2026`, ctx.adminToken)).data;
    equal(res.periods.length, 2, 'dos períodos');
    equal(res.subjects[0].porPeriodo[1].valoracion, null, 'P2 sin valoración');
    equal(res.subjects[0].definitiva, 4.0, 'definitiva usa solo P1 (no divide entre 0)');
  });

  await test('desempeño S/A/B/Z (escala 5) y materias múltiples dinámicas', async () => {
    const ctx = await mkInstitution(5, 3);
    const casos = [[4.6, 'S'], [4.5, 'A'], [3.9, 'B'], [2.9, 'Z']];
    for (const [nota, letra] of casos) {
      await addSubjectWithMark(ctx, nota, `Materia ${letra}-${seq}`);
    }
    const res = (await get(`/students/${ctx.student.id}/report?anio=2026`, ctx.adminToken)).data;
    const desempenos = res.subjects
      .map(s => s.porPeriodo[0] && s.porPeriodo[0].desempeno)
      .filter(Boolean)
      .sort();
    equal(desempenos.join(''), 'ABSZ', 'bandas S/A/B/Z correctas (4.6→S, 4.5→A, 3.9→B, 2.9→Z)');
  });

  await test('materias dinámicas: cada institución solo aporta sus materias', async () => {
    const ctxA = await mkInstitution(5, 3);
    const ctxB = await mkInstitution(5, 3);
    await addMark(ctxA, ctxA.student.id, 4.0);
    await addMark(ctxB, ctxB.student.id, 3.5);

    const a = (await get(`/students/${ctxA.student.id}/report?anio=2026`, ctxA.adminToken)).data;
    const b = (await get(`/students/${ctxB.student.id}/report?anio=2026`, ctxB.adminToken)).data;
    equal(a.subjects.length, 1, 'A una materia');
    equal(b.subjects.length, 1, 'B una materia');
    notOk(a.subjects[0].materia_id === b.subjects[0].materia_id, 'materias distintas entre instituciones');
  });

  await test('estudiantes en grados distintos ven materias distintas', async () => {
    const ctx = await mkInstitution(5, 3);
    await addMark(ctx, ctx.student.id, 4.0);
    await addSubjectWithMark(ctx, 3.5, 'Materia Extra');

    // Un tercer estudiante se matricula en un grado nuevo con otra materia.
    const otro = (await post('/users', {
      email: `otro.${seq}@test.local`, password: world.password, rol: 'student',
      nombre: 'Otro', apellido: 'Estudiante', institucion_id: ctx.inst.id,
      tipo_documento: 'TI', identificacion: `IDX${seq++}`, activo: true,
    }, su)).data;
    track(world, 'users', otro.id);
    const grade2 = (await post('/grades', { institucion_id: ctx.inst.id, nombre: 'G2', tipo_grado: 'B' }, su)).data;
    track(world, 'grades', grade2.id);
    const subj2 = (await post('/subjects', { institucion_id: ctx.inst.id, nombre: 'Solo B', descripcion: 'x' }, su)).data;
    track(world, 'subjects', subj2.id);
    const asg2 = (await post('/assignments', { profesor_id: ctx.teacher.id, materia_id: subj2.id, grado_id: grade2.id, institucion_id: ctx.inst.id }, su)).data;
    track(world, 'assignments', asg2.id);
    const enc2 = (await post('/student_grades', { estudiante_id: otro.id, grado_id: grade2.id }, su)).data;
    track(world, 'student_grades', enc2.id);

    const a = (await get(`/students/${ctx.student.id}/report?anio=2026`, ctx.adminToken)).data;
    const b = (await get(`/students/${otro.id}/report?anio=2026`, ctx.adminToken)).data;
    ok(a.subjects.some(s => s.materia_id === ctx.subject.id), 'estudiante 1 ve su materia');
    ok(b.subjects.some(s => s.materia_id === subj2.id), 'estudiante 2 ve la materia de SU grado');
    notOk(a.subjects.some(s => s.materia_id === subj2.id), 'estudiante 1 NO ve la materia del otro grado');
    notOk(b.subjects.some(s => s.materia_id === ctx.subject.id), 'estudiante 2 NO ve la materia del otro grado');
  });

  await test('asistencia por materia: fallas y justificadas en el reporte anual', async () => {
    const ctx = await mkInstitution(5, 3);
    await addMark(ctx, ctx.student.id, 4.0);
    const baseAtt = {
      estudiante_id: ctx.student.id, materia_id: ctx.subject.id, grado_id: ctx.grade.id,
      fecha: '2026-02-10', periodo_id: ctx.period.id, registrado_por: ctx.teacher.id,
    };
    await post('/attendance', { ...baseAtt, estado: 'ausente' }, su).then(r => track(world, 'attendance', r.data.id));
    await post('/attendance', { ...baseAtt, estado: 'justificada' }, su).then(r => track(world, 'attendance', r.data.id));
    await post('/attendance', { ...baseAtt, estado: 'justificada' }, su).then(r => track(world, 'attendance', r.data.id));

    const res = (await get(`/students/${ctx.student.id}/report?anio=2026`, ctx.adminToken)).data;
    equal(res.subjects[0].porPeriodo[0].fallas, 1, '1 falla');
    equal(res.subjects[0].porPeriodo[0].justificadas, 2, '2 justificadas');
    equal(res.attendance.ausente, 1, 'total ausente');
    equal(res.attendance.justificada, 2, 'total justificadas');
    equal(res.attendance.presente, 0, 'total presente');
  });

  await test('materia sin asistencia no inventa fallas', async () => {
    const ctx = await mkInstitution(5, 3);
    await addMark(ctx, ctx.student.id, 4.0);
    const res = (await get(`/students/${ctx.student.id}/report?anio=2026`, ctx.adminToken)).data;
    equal(res.subjects[0].porPeriodo[0].fallas, null, 'sin registros → null (no 0)');
    equal(res.subjects[0].porPeriodo[0].justificadas, null, 'sin registros → null');
  });

  await test('reporte anual: autorización y aislamiento', async () => {
    const ctx = await mkInstitution(5, 3);
    expectError(await get(`/students/${ctx.student.id}/report?anio=2026`, world.tokens.teacherA), 403);
    expectError(await get(`/students/${ctx.student.id}/report?anio=2026`, world.tokens.studentA), 403);
    expectError(await get(`/students/${ctx.student.id}/report?anio=2026`, su), 403);
    expectError(await get(`/students/${world.users.studentB.id}/report?anio=2026`, ctx.adminToken), 404, 'Estudiante no encontrado.');
  });

  await test('reporte anual no mezcla años: 2026 ignora 2025 y viceversa', async () => {
    const ctx = await mkInstitution(5, 3);
    await addMark(ctx, ctx.student.id, 4.0);

    // Período de 2025 con su propia nota (abierto para poder calificar).
    const p25 = (await post('/academic_periods', {
      institucion_id: ctx.inst.id, nombre: 'Periodo 1', numero: 1, anio: 2025,
      fecha_inicio: '2025-01-01', fecha_fin: '2025-03-31', activo: true,
    }, su)).data;
    track(world, 'academic_periods', p25.id);
    await addMark(ctx, ctx.student.id, 2.0, 30, p25);

    const r2026 = (await get(`/students/${ctx.student.id}/report?anio=2026`, ctx.adminToken)).data;
    equal(r2026.year, 2026, 'año 2026');
    ok(r2026.periods.every(p => Number(p.period.anio) === 2026), 'solo períodos de 2026');
    equal(r2026.subjects[0].porPeriodo.length, 1, '2026 tiene 1 período');
    equal(r2026.subjects[0].definitiva, 4.0, 'la definitiva de 2026 no incluye 2025');

    const r2025 = (await get(`/students/${ctx.student.id}/report?anio=2025`, ctx.adminToken)).data;
    equal(r2025.year, 2025, 'año 2025');
    ok(r2025.periods.every(p => Number(p.period.anio) === 2025), 'solo períodos de 2025');
    equal(r2025.subjects[0].definitiva, 2.0, 'la definitiva de 2025 usa solo 2025');
  });
}
