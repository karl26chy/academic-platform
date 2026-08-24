import { get, post, put, del } from '../helpers/http.js';
import { track } from '../helpers/fixtures.js';
import { query as dbQuery } from '../helpers/db.js';
import { suite, test, equal, ok, notOk, expectError } from '../helpers/runner.js';

/**
 * Sistema de periodos académicos:
 *  · una institución tiene UN SOLO periodo abierto (el "actual");
 *  · abrir un periodo cierra los demás de la misma institución (transaccional);
 *  · las evaluaciones se asocian automáticamente al único periodo abierto;
 *  · sobre un periodo cerrado no se puede crear/modificar/eliminar ni
 *    evaluaciones ni notas (409);
 *  · un periodo con evaluaciones o notas asociadas no se puede eliminar (409);
 *  · un admin jamás manipula periodos de otra institución.
 */
export default async function periodsSuite(world) {
  suite('Periodos académicos');

  const { A: instA, B: instB } = world.inst;
  const adminA = world.tokens.adminA;
  const adminB = world.tokens.adminB;
  const teacherA = world.tokens.teacherA;

  // Números únicos para los períodos creados por la suite: la regla de
  // duplicados (institución + año + número) impide reutilizar combinaciones.
  let seq = 100;

  const mkPeriod = async (institucion_id, token, over = {}) => {
    const res = await post('/academic_periods', {
      institucion_id,
      nombre: 'Periodo 1',
      numero: over.numero ?? seq++,
      anio: 2026,
      fecha_inicio: '2026-01-01',
      fecha_fin: '2026-12-31',
      activo: false,
      ...over,
    }, token);
    return res;
  };

  const baseEval = (over = {}) => ({
    institucion_id: instA.id,
    materia_id: world.subjects.X.id,
    grado_id: world.grades.A.id,
    nombre: `Eval ${world.id}`,
    fecha_evaluacion: '2026-05-01',
    porcentaje: 10,
    creado_por: world.users.teacherA.id,
    ...over,
  });

  const baseMark = (over = {}) => ({
    estudiante_id: world.users.studentA.id,
    materia_id: world.subjects.X.id,
    grado_id: world.grades.A.id,
    tipo_evaluacion: 'Parcial',
    fecha_evaluacion: '2026-05-02',
    porcentaje: 10,
    nota: 7,
    registrado_por: world.users.teacherA.id,
    ...over,
  });

  // ---- Evaluaciones -------------------------------------------------------

  await test('crear evaluación en un periodo abierto (con periodo_id) es válido', async () => {
    const per = (await mkPeriod(instA.id, adminA, { activo: true })).data;
    track(world, 'academic_periods', per.id);

    const res = await post('/evaluations', baseEval({ periodo_id: per.id }), teacherA);
    equal(res.status, 201, 'status');
    equal(res.data.periodo_id, per.id, 'queda asociada al periodo');
    track(world, 'evaluations', res.data.id);
  });

  await test('crear evaluación sin periodo_id se asigna al único periodo abierto', async () => {
    const per = (await mkPeriod(instA.id, adminA, { activo: true })).data;
    track(world, 'academic_periods', per.id);

    const res = await post('/evaluations', baseEval(), teacherA);
    equal(res.status, 201, 'status');
    equal(res.data.periodo_id, per.id, 'se asigna el único abierto');
    equal(res.data.periodo, per.nombre, 'se copia el nombre del periodo');
    equal(res.data.anio, String(per.anio), 'se copia el año del periodo');
    track(world, 'evaluations', res.data.id);
  });

  await test('crear evaluación sin periodo abierto devuelve 409', async () => {
    // Cierra temporalmente el único periodo abierto de instB.
    await put(`/academic_periods/${world.periods.B.id}`, {
      institucion_id: instB.id, nombre: 'Periodo 1', numero: world.periods.B.numero, anio: 2026, activo: false,
    }, adminB);

    expectError(
      await post('/evaluations', {
        institucion_id: instB.id, materia_id: world.subjects.Z.id,
        grado_id: world.grades.B.id, nombre: `Eval ${world.id}`,
        fecha_evaluacion: '2026-05-01', porcentaje: 10, creado_por: world.users.adminB.id,
      }, adminB),
      409,
      'No hay un periodo académico abierto para esta institución.'
    );

    // Restaura el periodo abierto de instB.
    await put(`/academic_periods/${world.periods.B.id}`, {
      institucion_id: instB.id, nombre: 'Periodo 1', numero: world.periods.B.numero, anio: 2026, activo: true,
    }, adminB);
  });

  await test('crear evaluación con varios periodos abiertos devuelve 409', async () => {
    // Estado heredado/inconsistente: se inyecta un segundo periodo abierto en
    // instB directamente en la base de pruebas (no reproducible vía API).
    const injectedId = `legacy${world.id}`.slice(0, 20);
    await dbQuery(
      `INSERT INTO academic_periods (id, "institucion_id", nombre, numero, anio, activo)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [injectedId, instB.id, 'Periodo Extra', 9, 2026]
    );

    try {
      expectError(
        await post('/evaluations', {
          institucion_id: instB.id, materia_id: world.subjects.Z.id,
          grado_id: world.grades.B.id, nombre: `Eval ${world.id}`,
          fecha_evaluacion: '2026-05-01', porcentaje: 10, creado_por: world.users.adminB.id,
        }, adminB),
        409,
        'Hay más de un periodo académico abierto; revisa la configuración de periodos.'
      );
    } finally {
      await dbQuery('DELETE FROM academic_periods WHERE id = $1', [injectedId]);
    }
  });

  await test('modificar evaluación de un periodo cerrado devuelve 409', async () => {
    const per = (await mkPeriod(instA.id, adminA, { activo: true })).data;
    track(world, 'academic_periods', per.id);

    const ev = (await post('/evaluations', baseEval({ periodo_id: per.id }), teacherA)).data;
    track(world, 'evaluations', ev.id);

    await put(`/academic_periods/${per.id}`, {
      institucion_id: instA.id, nombre: 'Periodo 1', numero: per.numero, anio: 2026, activo: false,
    }, adminA);

    expectError(
      await put(`/evaluations/${ev.id}`, baseEval({ periodo_id: per.id, nombre: 'Cambiada' }), teacherA),
      409,
      'El periodo está cerrado; no se pueden crear o modificar evaluaciones.'
    );
  });

  await test('eliminar evaluación de un periodo cerrado devuelve 409', async () => {
    const per = (await mkPeriod(instA.id, adminA, { activo: true })).data;
    track(world, 'academic_periods', per.id);

    const ev = (await post('/evaluations', baseEval({ periodo_id: per.id }), teacherA)).data;
    track(world, 'evaluations', ev.id);

    await put(`/academic_periods/${per.id}`, {
      institucion_id: instA.id, nombre: 'Periodo 1', numero: per.numero, anio: 2026, activo: false,
    }, adminA);

    expectError(
      await del(`/evaluations/${ev.id}`, teacherA),
      409,
      'El periodo está cerrado; no se puede eliminar la evaluación.'
    );
  });

  // ---- Notas --------------------------------------------------------------

  await test('crear nota de una evaluación de periodo cerrado devuelve 409', async () => {
    const per = (await mkPeriod(instA.id, adminA, { activo: true })).data;
    track(world, 'academic_periods', per.id);

    const ev = (await post('/evaluations', baseEval({ periodo_id: per.id }), teacherA)).data;
    track(world, 'evaluations', ev.id);

    await put(`/academic_periods/${per.id}`, {
      institucion_id: instA.id, nombre: 'Periodo 1', numero: per.numero, anio: 2026, activo: false,
    }, adminA);

    expectError(
      await post('/marks', baseMark({ evaluacion_id: ev.id }), teacherA),
      409,
      'El periodo está cerrado; no se pueden registrar o modificar notas.'
    );
  });

  await test('modificar nota de una evaluación de periodo cerrado devuelve 409', async () => {
    const per = (await mkPeriod(instA.id, adminA, { activo: true })).data;
    track(world, 'academic_periods', per.id);

    const ev = (await post('/evaluations', baseEval({ periodo_id: per.id }), teacherA)).data;
    track(world, 'evaluations', ev.id);

    const mark = (await post('/marks', baseMark({ evaluacion_id: ev.id }), teacherA)).data;
    track(world, 'marks', mark.id);

    await put(`/academic_periods/${per.id}`, {
      institucion_id: instA.id, nombre: 'Periodo 1', numero: per.numero, anio: 2026, activo: false,
    }, adminA);

    expectError(
      await put(`/marks/${mark.id}`, baseMark({ evaluacion_id: ev.id, nota: 8 }), teacherA),
      409,
      'El periodo está cerrado; no se pueden registrar o modificar notas.'
    );
  });

  await test('eliminar nota de una evaluación de periodo cerrado devuelve 409', async () => {
    const per = (await mkPeriod(instA.id, adminA, { activo: true })).data;
    track(world, 'academic_periods', per.id);

    const ev = (await post('/evaluations', baseEval({ periodo_id: per.id }), teacherA)).data;
    track(world, 'evaluations', ev.id);

    const mark = (await post('/marks', baseMark({ evaluacion_id: ev.id }), teacherA)).data;
    track(world, 'marks', mark.id);

    await put(`/academic_periods/${per.id}`, {
      institucion_id: instA.id, nombre: 'Periodo 1', numero: per.numero, anio: 2026, activo: false,
    }, adminA);

    expectError(
      await del(`/marks/${mark.id}`, teacherA),
      409,
      'El periodo está cerrado; no se puede eliminar la nota.'
    );
  });

  // ---- Apertura de periodos ------------------------------------------------

  await test('abrir un periodo cierra los demás de la misma institución', async () => {
    const p1 = (await mkPeriod(instA.id, adminA, { nombre: 'Periodo 1', numero: 1 })).data;
    const p2 = (await mkPeriod(instA.id, adminA, { nombre: 'Periodo 2', numero: 2 })).data;
    const p3 = (await mkPeriod(instA.id, adminA, { nombre: 'Periodo 3', numero: 3 })).data;
    track(world, 'academic_periods', p1.id);
    track(world, 'academic_periods', p2.id);
    track(world, 'academic_periods', p3.id);

    const res = await put(`/academic_periods/${p2.id}`, {
      institucion_id: instA.id, nombre: 'Periodo 2', numero: 2, anio: 2026, activo: true,
    }, adminA);
    equal(res.status, 200, 'status');
    equal(res.data.activo, true, 'p2 queda abierto');

    const lista = (await get('/academic_periods', adminA)).data;
    const abiertos = lista.filter(p => p.activo);
    equal(abiertos.length, 1, 'solo un periodo abierto en la institución');
    equal(abiertos[0].id, p2.id, 'el abierto es p2');
    const otros = lista.filter(p => [p1.id, p3.id, world.periods.A.id].includes(p.id));
    ok(otros.every(p => p.activo === false), 'los demás (incluido el abierto anterior) quedan cerrados');
  });

  await test('un admin no puede abrir el periodo de otra institución', async () => {
    const per = (await mkPeriod(instA.id, adminA)).data;
    track(world, 'academic_periods', per.id);

    expectError(
      await put(`/academic_periods/${per.id}`, {
        institucion_id: instA.id, nombre: 'Periodo 1', numero: per.numero, anio: 2026, activo: true,
      }, adminB),
      403
    );
  });

  // ---- Nombre y número independientes -------------------------------------

  await test('el número del periodo se mantiene separado del nombre', async () => {
    const res = await post('/academic_periods', {
      institucion_id: instA.id, nombre: 'Primer periodo', numero: 52, anio: 2026,
      fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', activo: false,
    }, adminA);
    equal(res.status, 201, 'status');
    equal(res.data.nombre, 'Primer periodo', 'el nombre es solo descriptivo');
    equal(res.data.numero, 52, 'el número vive en su propio campo');
    notOk(String(res.data.nombre).includes('2'), 'el número NO se duplica en el nombre');
    track(world, 'academic_periods', res.data.id);
  });

  await test('el número se devuelve correctamente desde la API', async () => {
    const creado = (await post('/academic_periods', {
      institucion_id: instA.id, nombre: 'Primer periodo', numero: 51, anio: 2026,
      fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', activo: false,
    }, adminA)).data;
    track(world, 'academic_periods', creado.id);

    const porId = (await get(`/academic_periods/${creado.id}`, adminA)).data;
    equal(porId.numero, 51, 'GET por id trae el número');
    equal(porId.nombre, 'Primer periodo', 'GET por id trae el nombre descriptivo');
  });

  // ---- Borrado de periodos -------------------------------------------------

  await test('eliminar un periodo sin datos asociados es válido', async () => {
    const per = (await mkPeriod(instA.id, adminA)).data;

    const res = await del(`/academic_periods/${per.id}`, adminA);
    equal(res.status, 200, 'status');
    equal(res.data.id, per.id, 'devuelve la fila borrada');
  });

  await test('eliminar un periodo con evaluaciones o notas devuelve 409', async () => {
    const per = (await mkPeriod(instA.id, adminA, { activo: true })).data;
    track(world, 'academic_periods', per.id);

    const ev = (await post('/evaluations', baseEval({ periodo_id: per.id }), teacherA)).data;
    track(world, 'evaluations', ev.id);

    expectError(
      await del(`/academic_periods/${per.id}`, adminA),
      409
    );
  });

  // ---- Integridad: duplicados, años y protección del historial -------------

  await test('no permitir dos períodos con la misma institución + año + número', async () => {
    const per = (await mkPeriod(instA.id, adminA, { anio: 2024, numero: 44 })).data;
    track(world, 'academic_periods', per.id);

    expectError(
      await mkPeriod(instA.id, adminA, { anio: 2024, numero: 44 }),
      409,
      'Ya existe un período con el mismo número para esta institución y año.'
    );
  });

  await test('el mismo número y año en otra institución es válido', async () => {
    const pa = (await mkPeriod(instA.id, adminA, { anio: 2023, numero: 44 })).data;
    track(world, 'academic_periods', pa.id);
    const pb = (await mkPeriod(instB.id, adminB, { anio: 2023, numero: 44 })).data;
    track(world, 'academic_periods', pb.id);
    equal(pa.institucion_id, instA.id, 'pertenece a A');
    equal(pb.institucion_id, instB.id, 'pertenece a B');
  });

  await test('P1-2025 y P1-2026 pueden coexistir (años separados)', async () => {
    const p25 = (await mkPeriod(instA.id, adminA, { anio: 2025, numero: 1 })).data;
    track(world, 'academic_periods', p25.id);
    const p26 = (await mkPeriod(instA.id, adminA, { numero: 9, anio: 2026 })).data;
    track(world, 'academic_periods', p26.id);
    equal(p25.anio, 2025, 'año 2025');
    equal(p26.anio, 2026, 'año 2026');
  });

  await test('no se puede cambiar el año de un período con evaluaciones (409)', async () => {
    const per = (await mkPeriod(instA.id, adminA, { anio: 2022, numero: 22, activo: true })).data;
    track(world, 'academic_periods', per.id);
    const ev = (await post('/evaluations', baseEval({ periodo_id: per.id }), teacherA)).data;
    track(world, 'evaluations', ev.id);

    expectError(
      await put(`/academic_periods/${per.id}`, {
        institucion_id: instA.id, nombre: 'Periodo 1', numero: 22, anio: 2021, activo: false,
      }, adminA),
      409,
      'No se puede cambiar el año o el número de un período que ya tiene evaluaciones, notas o asistencia.'
    );
  });

  await test('no se puede cambiar el número de un período con notas (409)', async () => {
    const per = (await mkPeriod(instA.id, adminA, { anio: 2021, numero: 24, activo: true })).data;
    track(world, 'academic_periods', per.id);
    const ev = (await post('/evaluations', baseEval({ periodo_id: per.id }), teacherA)).data;
    track(world, 'evaluations', ev.id);
    const mark = (await post('/marks', baseMark({ evaluacion_id: ev.id }), teacherA)).data;
    track(world, 'marks', mark.id);

    expectError(
      await put(`/academic_periods/${per.id}`, {
        institucion_id: instA.id, nombre: 'Periodo 1', numero: 25, anio: 2021, activo: false,
      }, adminA),
      409,
      'No se puede cambiar el año o el número de un período que ya tiene evaluaciones, notas o asistencia.'
    );
  });

  await test('cambiar año y número de un período SIN datos es válido', async () => {
    const per = (await mkPeriod(instA.id, adminA, { anio: 2020, numero: 26 })).data;
    track(world, 'academic_periods', per.id);

    const res = await put(`/academic_periods/${per.id}`, {
      institucion_id: instA.id, nombre: 'Periodo 1', numero: 27, anio: 2019, activo: false,
    }, adminA);
    equal(res.status, 200, 'status');
    equal(res.data.numero, 27, 'número actualizado');
    equal(res.data.anio, 2019, 'año actualizado');
  });

  await test('reabrir un período cerrado sigue permitido', async () => {
    const per = (await mkPeriod(instA.id, adminA, { anio: 2018, numero: 28, activo: true })).data;
    track(world, 'academic_periods', per.id);
    const ev = (await post('/evaluations', baseEval({ periodo_id: per.id }), teacherA)).data;
    track(world, 'evaluations', ev.id);

    await put(`/academic_periods/${per.id}`, {
      institucion_id: instA.id, nombre: 'Periodo 1', numero: 28, anio: 2018, activo: false,
    }, adminA);

    const res = await put(`/academic_periods/${per.id}`, {
      institucion_id: instA.id, nombre: 'Periodo 1', numero: 28, anio: 2018, activo: true,
    }, adminA);
    equal(res.status, 200, 'reapertura permitida');
    equal(res.data.activo, true, 'queda abierto');
  });
}
