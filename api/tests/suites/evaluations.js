import { post, put, del } from '../helpers/http.js';
import { track } from '../helpers/fixtures.js';
import { suite, test, equal, ok, notOk, expectError } from '../helpers/runner.js';

/**
 * Límite de porcentaje de las evaluaciones:
 *  · la suma de porcentajes de las evaluaciones de una misma materia + grado
 *    + periodo no puede superar 100%;
 *  · se valida al crear y al modificar (409); el borrado solo reduce la suma;
 *  · el porcentaje individual debe estar entre 1 y 100 (400).
 *
 * La suite es autocontenida: crea su propio periodo abierto y registra todos
 * los recursos con track() para que la limpieza del mundo los borre al final.
 */
export default async function evaluationsSuite(world) {
  suite('Evaluaciones: suma de porcentajes');

  const { A: instA } = world.inst;
  const adminA = world.tokens.adminA;
  const teacherA = world.tokens.teacherA;

  const per = (await post('/academic_periods', {
    institucion_id: instA.id,
    nombre: `Periodo Eval ${world.id}`,
    numero: 8,
    anio: 2026,
    fecha_inicio: '2026-01-01',
    fecha_fin: '2026-12-31',
    activo: true,
  }, adminA)).data;
  track(world, 'academic_periods', per.id);

  const baseEval = (over = {}) => ({
    institucion_id: instA.id,
    materia_id: world.subjects.X.id,
    grado_id: world.grades.A.id,
    nombre: `Eval ${world.id}`,
    fecha_evaluacion: '2026-05-01',
    porcentaje: 10,
    periodo_id: per.id,
    creado_por: world.users.teacherA.id,
    ...over,
  });

  const crearMateria = async (nombre) => {
    const m = (await post('/subjects', {
      nombre, descripcion: 'Test', institucion_id: instA.id,
    }, adminA)).data;
    track(world, 'subjects', m.id);
    return m;
  };

  await test('50% + 50% es permitido (total exacto 100%)', async () => {
    const e1 = (await post('/evaluations', baseEval({ porcentaje: 50 }), teacherA)).data;
    track(world, 'evaluations', e1.id);
    equal(e1.porcentaje, 50, 'primera evaluación creada');

    const e2 = (await post('/evaluations', baseEval({ porcentaje: 50 }), teacherA)).data;
    track(world, 'evaluations', e2.id);
    equal(e2.porcentaje, 50, 'segunda evaluación creada');
  });

  await test('50% + 40% es permitido (suma menor a 100%)', async () => {
    const m = await crearMateria(`Materia Eval 40 ${world.id}`);
    const adminEval = (p) => baseEval({ materia_id: m.id, creado_por: world.users.adminA.id, ...p });

    const e1 = (await post('/evaluations', adminEval({ porcentaje: 50 }), adminA)).data;
    track(world, 'evaluations', e1.id);
    equal(e1.porcentaje, 50, 'primera evaluación creada');

    const e2 = (await post('/evaluations', adminEval({ porcentaje: 40 }), adminA)).data;
    track(world, 'evaluations', e2.id);
    equal(e2.porcentaje, 40, 'segunda evaluación creada');
  });

  await test('50% + 60% devuelve 409 (suma superaría 100%)', async () => {
    const m = await crearMateria(`Materia Eval 60 ${world.id}`);
    const adminEval = (p) => baseEval({ materia_id: m.id, creado_por: world.users.adminA.id, ...p });

    const e1 = (await post('/evaluations', adminEval({ porcentaje: 50 }), adminA)).data;
    track(world, 'evaluations', e1.id);
    equal(e1.porcentaje, 50, 'primera evaluación creada');

    const res = await post('/evaluations', adminEval({ porcentaje: 60 }), adminA);
    expectError(
      res,
      409,
      'La suma de porcentajes de esta materia, grado y período no puede superar 100%. Actual: 50% — solo quedan 50%.'
    );
  });

  await test('primera evaluación con 100% es permitida', async () => {
    const m = await crearMateria(`Materia Eval 100 ${world.id}`);
    const ev = (await post('/evaluations', baseEval({
      materia_id: m.id, porcentaje: 100, creado_por: world.users.adminA.id,
    }), adminA)).data;
    track(world, 'evaluations', ev.id);
    equal(ev.porcentaje, 100, '100% guardado');
  });

  await test('editar respeta excludeId: no se cuenta a sí misma y no permite superar 100%', async () => {
    const m = await crearMateria(`Materia Eval Edit ${world.id}`);
    const adminEval = (p) => baseEval({ materia_id: m.id, creado_por: world.users.adminA.id, ...p });

    const e1 = (await post('/evaluations', adminEval({ porcentaje: 50 }), adminA)).data;
    track(world, 'evaluations', e1.id);
    const e2 = (await post('/evaluations', adminEval({ porcentaje: 50 }), adminA)).data;
    track(world, 'evaluations', e2.id);

    // La otra evaluación (50) + nuevo 60 = 110 > 100 → rechazado.
    const res = await put(`/evaluations/${e2.id}`, adminEval({ porcentaje: 60 }), adminA);
    expectError(
      res,
      409,
      'La suma de porcentajes de esta materia, grado y período no puede superar 100%. Actual: 50% — solo quedan 50%.'
    );

    // Mismo valor 50: si excludeId no excluyera la propia evaluación, la suma
    // sería 100 y este cambio daría 409. Debe permitirse.
    const okRes = await put(`/evaluations/${e2.id}`, adminEval({ porcentaje: 50 }), adminA);
    equal(okRes.status, 200, 'editar al mismo valor es permitido (excludeId funciona)');
    equal(okRes.data.porcentaje, 50, 'porcentaje actualizado');
  });

  await test('eliminar una evaluación reduce la suma y permite crear hasta 100%', async () => {
    const m = await crearMateria(`Materia Eval Del ${world.id}`);
    const adminEval = (p) => baseEval({ materia_id: m.id, creado_por: world.users.adminA.id, ...p });

    const e1 = (await post('/evaluations', adminEval({ porcentaje: 50 }), adminA)).data;
    track(world, 'evaluations', e1.id);
    const e2 = (await post('/evaluations', adminEval({ porcentaje: 50 }), adminA)).data;
    track(world, 'evaluations', e2.id);

    const delRes = await del(`/evaluations/${e1.id}`, adminA);
    ok(delRes.status === 200 || delRes.status === 204, 'eliminar evaluación sigue funcionando');

    // Tras borrar 50%, queda 50%; crear otro 50% llega a 100% → permitido.
    const e3 = (await post('/evaluations', adminEval({ porcentaje: 50 }), adminA)).data;
    track(world, 'evaluations', e3.id);
    equal(e3.porcentaje, 50, 'se puede crear tras eliminar');
  });

  await test('P2 al 100% es válido aunque P1 ya esté al 100% (porcentajes independientes por periodo)', async () => {
    const m = await crearMateria(`Materia Eval Indep ${world.id}`);

    // P1 al 100% sobre el período de la suite (per, aún abierto).
    const e1 = (await post('/evaluations', baseEval({
      materia_id: m.id, periodo_id: per.id, porcentaje: 100, creado_por: world.users.adminA.id,
    }), adminA)).data;
    track(world, 'evaluations', e1.id);
    equal(e1.porcentaje, 100, 'P1 al 100%');

    // Abrir P2 cierra P1 automáticamente (invariante de un solo abierto).
    const p2 = (await post('/academic_periods', {
      institucion_id: instA.id,
      nombre: `Periodo Eval Indep ${world.id}`,
      numero: 90,
      anio: 2026,
      fecha_inicio: '2026-04-01',
      fecha_fin: '2026-12-31',
      activo: true,
    }, adminA)).data;
    track(world, 'academic_periods', p2.id);

    const e2 = (await post('/evaluations', baseEval({
      materia_id: m.id, periodo_id: p2.id, porcentaje: 100, creado_por: world.users.adminA.id,
    }), adminA)).data;
    track(world, 'evaluations', e2.id);
    equal(e2.porcentaje, 100, 'P2 al 100% a pesar de que P1 ya está al 100%');
  });
}
