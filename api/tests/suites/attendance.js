import { get, post, put, del, login } from '../helpers/http.js';
import { track } from '../helpers/fixtures.js';
import { query as dbQuery } from '../helpers/db.js';
import { suite, test, equal, ok, expectError } from '../helpers/runner.js';

/**
 * Asistencia asociada al periodo académico (backend como autoridad):
 *  · la asistencia siempre pertenece a un periodo (conserva periodo_id);
 *  · 0 periodos abiertos → 409; 1 → autoasigna; varios → 409;
 *  · periodo cerrado → no crear/modificar/eliminar asistencia (409);
 *  · cerrar un periodo NO borra ni modifica el historial;
 *  · aislamiento: un admin/profesor no manipula asistencias de otra institución.
 */
export default async function attendanceSuite(world) {
  suite('Asistencia y periodos académicos');

  const su = world.tokens.super;
  const t = world.id;

  // Institución C propia y autocontenida (no depende del estado de A/B).
  const instC = (await post('/institutions', {
    nombre: `Asistencia ${t}`, subdominio: `asist${t}`,
    tipo: 'colegio', escala_maxima: 10, nota_minima_aprobacion: 6, activa: true,
  }, su)).data;
  track(world, 'institutions', instC.id);

  const subjC = (await post('/subjects', {
    institucion_id: instC.id, nombre: `SubjC ${t}`, descripcion: 'Test',
  }, su)).data;
  track(world, 'subjects', subjC.id);
  const subj = subjC.id;

  const adminC = (await post('/users', {
    email: `adminc.${t}@test.local`, password: world.password, rol: 'admin',
    nombre: 'Admin', apellido: 'C', institucion_id: instC.id, activo: true,
  }, su)).data;
  track(world, 'users', adminC.id);

  const teacherC = (await post('/users', {
    email: `teacherc.${t}@test.local`, password: world.password, rol: 'teacher',
    nombre: 'Teacher', apellido: 'C', institucion_id: instC.id, activo: true,
  }, su)).data;
  track(world, 'users', teacherC.id);

  const studentC = (await post('/users', {
    email: `studentc.${t}@test.local`, password: world.password, rol: 'student',
    nombre: 'Student', apellido: 'C', institucion_id: instC.id, tipo_documento: 'TI',
    identificacion: `IDC${t}`, activo: true,
  }, su)).data;
  track(world, 'users', studentC.id);

  const gradeC = (await post('/grades', {
    institucion_id: instC.id, nombre: `Grado-C-${t}`, tipo_grado: 'A',
  }, su)).data;
  track(world, 'grades', gradeC.id);

  const assignC = (await post('/assignments', {
    profesor_id: teacherC.id, materia_id: subj, grado_id: gradeC.id, institucion_id: instC.id,
  }, su)).data;
  track(world, 'assignments', assignC.id);

  const adminCtok = (await login(adminC.email, world.password)).token;
  const teacherCtok = (await login(teacherC.email, world.password)).token;

  // Números únicos por período: la regla de duplicados (institución+año+número)
  // impide reutilizar combinaciones entre tests.
  let seq = 100;
  const mkPeriod = (nombre, _numero, activo) => post('/academic_periods', {
    institucion_id: instC.id, nombre, numero: seq++, anio: 2026,
    fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', activo,
  }, su);

  const baseAtt = (over = {}) => ({
    estudiante_id: studentC.id,
    materia_id: subj,
    grado_id: gradeC.id,
    fecha: '2026-02-01',
    estado: 'presente',
    registrado_por: teacherC.id,
    ...over,
  });

  // ---- Crear asistencia con periodo abierto -------------------------------

  await test('crear asistencia con periodo abierto (explícito o autoasignado)', async () => {
    const p1 = (await mkPeriod('Primer periodo', 1, true)).data;
    track(world, 'academic_periods', p1.id);

    const explicita = (await post('/attendance', baseAtt({ periodo_id: p1.id }), teacherCtok)).data;
    track(world, 'attendance', explicita.id);
    equal(explicita.periodo_id, p1.id, 'queda asociada al periodo indicado');

    const automatica = (await post('/attendance', baseAtt(), teacherCtok)).data;
    track(world, 'attendance', automatica.id);
    equal(automatica.periodo_id, p1.id, 'sin periodo_id se autoasigna el único abierto');
  });

  // ---- Sin periodo abierto ------------------------------------------------

  await test('crear asistencia sin periodo abierto devuelve 409', async () => {
    const p1 = (await mkPeriod('Primer periodo', 1, true)).data;
    track(world, 'academic_periods', p1.id);

    await put(`/academic_periods/${p1.id}`, {
      institucion_id: instC.id, nombre: 'Primer periodo', numero: p1.numero, anio: 2026,
      fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', activo: false,
    }, adminCtok);

    try {
      expectError(
        await post('/attendance', baseAtt(), teacherCtok),
        409,
        'No hay un periodo académico abierto para esta institución.'
      );
    } finally {
      await put(`/academic_periods/${p1.id}`, {
        institucion_id: instC.id, nombre: 'Primer periodo', numero: p1.numero, anio: 2026,
        fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', activo: true,
      }, adminCtok);
    }
  });

  // ---- Varios periodos abiertos -------------------------------------------

  await test('crear asistencia con varios periodos abiertos devuelve 409', async () => {
    const p1 = (await mkPeriod('Primer periodo', 1, true)).data;
    track(world, 'academic_periods', p1.id);
    const p2 = (await mkPeriod('Segundo periodo', 2, false)).data;
    track(world, 'academic_periods', p2.id);

    // Estado inconsistente heredado: se fuerza el segundo abierto vía SQL.
    await dbQuery('UPDATE academic_periods SET activo = true WHERE id = $1', [p2.id]);

    try {
      expectError(
        await post('/attendance', baseAtt(), teacherCtok),
        409,
        'Hay más de un periodo académico abierto; revisa la configuración de periodos.'
      );
    } finally {
      await dbQuery('UPDATE academic_periods SET activo = false WHERE id = $1', [p2.id]);
    }
  });

  // ---- Periodo cerrado: no crear/modificar/eliminar -----------------------

  await test('no se crea asistencia en un periodo cerrado (409)', async () => {
    const p1 = (await mkPeriod('Primer periodo', 1, true)).data;
    track(world, 'academic_periods', p1.id);

    await put(`/academic_periods/${p1.id}`, {
      institucion_id: instC.id, nombre: 'Primer periodo', numero: p1.numero, anio: 2026,
      fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', activo: false,
    }, adminCtok);

    try {
      expectError(
        await post('/attendance', baseAtt({ periodo_id: p1.id }), teacherCtok),
        409,
        'El periodo está cerrado; no se pueden registrar o modificar asistencias.'
      );
    } finally {
      await put(`/academic_periods/${p1.id}`, {
        institucion_id: instC.id, nombre: 'Primer periodo', numero: p1.numero, anio: 2026,
        fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', activo: true,
      }, adminCtok);
    }
  });

  await test('no se modifica asistencia de un periodo cerrado (409)', async () => {
    const p1 = (await mkPeriod('Primer periodo', 1, true)).data;
    track(world, 'academic_periods', p1.id);

    const att = (await post('/attendance', baseAtt({ periodo_id: p1.id }), teacherCtok)).data;
    track(world, 'attendance', att.id);

    await put(`/academic_periods/${p1.id}`, {
      institucion_id: instC.id, nombre: 'Primer periodo', numero: p1.numero, anio: 2026,
      fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', activo: false,
    }, adminCtok);

    try {
      expectError(
        await put(`/attendance/${att.id}`, baseAtt({ estado: 'ausente', periodo_id: p1.id }), teacherCtok),
        409,
        'El periodo está cerrado; no se pueden registrar o modificar asistencias.'
      );
    } finally {
      await put(`/academic_periods/${p1.id}`, {
        institucion_id: instC.id, nombre: 'Primer periodo', numero: p1.numero, anio: 2026,
        fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', activo: true,
      }, adminCtok);
    }
  });

  await test('no se elimina asistencia de un periodo cerrado (409)', async () => {
    const p1 = (await mkPeriod('Primer periodo', 1, true)).data;
    track(world, 'academic_periods', p1.id);

    const att = (await post('/attendance', baseAtt({ periodo_id: p1.id }), teacherCtok)).data;
    track(world, 'attendance', att.id);

    await put(`/academic_periods/${p1.id}`, {
      institucion_id: instC.id, nombre: 'Primer periodo', numero: p1.numero, anio: 2026,
      fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', activo: false,
    }, adminCtok);

    try {
      expectError(
        await del(`/attendance/${att.id}`, teacherCtok),
        409,
        'El periodo está cerrado; no se puede eliminar la asistencia.'
      );
    } finally {
      await put(`/academic_periods/${p1.id}`, {
        institucion_id: instC.id, nombre: 'Primer periodo', numero: p1.numero, anio: 2026,
        fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', activo: true,
      }, adminCtok);
    }
  });

  // ---- Cerrar periodo conserva el historial -------------------------------

  await test('cerrar un periodo conserva las asistencias en su periodo original', async () => {
    const p1 = (await mkPeriod('Primer periodo', 1, true)).data;
    track(world, 'academic_periods', p1.id);

    const att1 = (await post('/attendance', baseAtt({ fecha: '2026-02-01', periodo_id: p1.id }), teacherCtok)).data;
    track(world, 'attendance', att1.id);
    const att2 = (await post('/attendance', baseAtt({ fecha: '2026-02-05', periodo_id: p1.id }), teacherCtok)).data;
    track(world, 'attendance', att2.id);

    // Cierra P1 y abre P2 (abrir cierra los demás automáticamente).
    const p2 = (await mkPeriod('Segundo periodo', 2, true)).data;
    track(world, 'academic_periods', p2.id);
    equal((await get(`/academic_periods/${p2.id}`, adminCtok)).data.activo, true, 'P2 queda abierto');
    equal((await get(`/academic_periods/${p1.id}`, adminCtok)).data.activo, false, 'P1 queda cerrado');

    const lista = (await get('/attendance', adminCtok)).data;
    ok(lista.some(a => a.id === att1.id), 'la asistencia 1 sigue existiendo');
    ok(lista.some(a => a.id === att2.id), 'la asistencia 2 sigue existiendo');

    const guardada = lista.find(a => a.id === att1.id);
    equal(guardada.periodo_id, p1.id, 'sigue asociada al periodo original (P1), no al nuevo (P2)');
    const guardada2 = lista.find(a => a.id === att2.id);
    equal(guardada2.periodo_id, p1.id, 'la segunda también conserva su periodo original');
  });

  // ---- Aislamiento entre instituciones ------------------------------------

  await test('un admin/docente no manipula asistencias de otra institución', async () => {
    // admin de instA intenta registrar asistencia en el grado de instC.
    expectError(
      await post('/attendance', {
        estudiante_id: studentC.id, materia_id: subj, grado_id: gradeC.id,
        fecha: '2026-02-02', estado: 'presente',
      }, world.tokens.adminA),
      403,
      'No autorizado.'
    );

    // teacher de instC intenta modificar una asistencia de instA (la de scope.js).
    const listaA = (await get('/attendance', world.tokens.adminA)).data;
    const ajena = listaA.find(a => a.estudiante_id === world.users.studentA.id);
    if (ajena) {
      expectError(
        await put(`/attendance/${ajena.id}`, {
          estudiante_id: ajena.estudiante_id, materia_id: ajena.materia_id,
          grado_id: ajena.grado_id, fecha: ajena.fecha, estado: 'ausente',
        }, teacherCtok),
        403
      );
    }

    // adminC solo ve las asistencias de su institución.
    const deC = (await get('/attendance', adminCtok)).data;
    ok(
      deC.every(a => a.grado_id === gradeC.id),
      'el admin de C solo ve asistencias de su propia institución'
    );
  });

  // ---- Estados de asistencia -----------------------------------------------

  await test('la asistencia acepta presente, ausente y justificada', async () => {
    const p = (await mkPeriod('Estados', 9, true)).data;
    track(world, 'academic_periods', p.id);

    for (const estado of ['presente', 'ausente', 'justificada']) {
      const res = await post('/attendance', baseAtt({ estado, periodo_id: p.id }), teacherCtok);
      equal(res.status, 201, `estado ${estado} aceptado`);
      track(world, 'attendance', res.data.id);
    }
  });

  await test('la asistencia rechaza el estado tardanza', async () => {
    const p = (await mkPeriod('Estados2', 8, true)).data;
    track(world, 'academic_periods', p.id);

    expectError(
      await post('/attendance', baseAtt({ estado: 'tardanza', periodo_id: p.id }), teacherCtok),
      400,
      'Estado de asistencia inválido.'
    );
  });

  // Limpieza directa: las asistencias de la institución C se eliminan en la
  // base de pruebas aunque su periodo esté cerrado (evita huérfanos).
  await dbQuery('DELETE FROM attendance WHERE "grado_id" = $1', [gradeC.id]).catch(() => {});
}
