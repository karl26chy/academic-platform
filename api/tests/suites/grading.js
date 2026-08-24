import { post, put, del } from '../helpers/http.js';
import { track } from '../helpers/fixtures.js';
import { suite, test, equal, ok, expectError } from '../helpers/runner.js';

/**
 * Configuración de calificación por institución:
 *  · la escala (5, 10 o 100) la define la institución, no está fija;
 *  · las notas van de 0 a escala_maxima (una nota 0 sí es registrable);
 *  · nota_minima_aprobacion es un umbral entre 1 y escala_maxima (nunca 0);
 *  · una nota >= nota_minima aprueba; < nota_minima reprueba (la mínima se
 *    conserva tal cual como umbral; el clasificado vive en el frontend);
 *  · el tipo de institución admite colegio, corporacion y universidad.
 */
export default async function gradingSuite(world) {
  suite('Configuración de calificación por institución');

  const su = world.tokens.super;
  let seq = 0;
  const tag = () => `${world.id}-${seq++}`;

  /** Crea una institución con escala y nota mínima, y su clase lista para notas. */
  async function mkClass(tipo, escala, notaMinima) {
    const t = tag();
    const inst = (await post('/institutions', {
      nombre: `Escala-${t}`,
      subdominio: `esc${t}`,
      tipo,
      escala_maxima: escala,
      nota_minima_aprobacion: notaMinima,
      activa: true,
    }, su)).data;
    track(world, 'institutions', inst.id);

    const grade = (await post('/grades', {
      institucion_id: inst.id, nombre: `Grado-${t}`, tipo_grado: 'A',
    }, su)).data;
    track(world, 'grades', grade.id);

    const subject = (await post('/subjects', {
      institucion_id: inst.id, nombre: `Subj-${t}`, descripcion: 'Test',
    }, su)).data;
    track(world, 'subjects', subject.id);

    const period = (await post('/academic_periods', {
      institucion_id: inst.id, nombre: 'Periodo 1', numero: 1, anio: 2026,
      fecha_inicio: '2026-01-01', fecha_fin: '2026-12-31', activo: true,
    }, su)).data;
    track(world, 'academic_periods', period.id);

    const student1 = (await post('/users', {
      email: `alumno1.${t}@test.local`, password: world.password,
      rol: 'student', nombre: 'Alumno', apellido: `${escala}`, institucion_id: inst.id,
      tipo_documento: 'TI', identificacion: `ID1${t}`, activo: true,
    }, su)).data;
    track(world, 'users', student1.id);

    const student2 = (await post('/users', {
      email: `alumno2.${t}@test.local`, password: world.password,
      rol: 'student', nombre: 'Alumno', apellido: `${escala}b`, institucion_id: inst.id,
      tipo_documento: 'TI', identificacion: `ID2${t}`, activo: true,
    }, su)).data;
    track(world, 'users', student2.id);

    const evaluacion = (await post('/evaluations', {
      institucion_id: inst.id, materia_id: subject.id, grado_id: grade.id,
      nombre: 'Parcial', fecha_evaluacion: '2026-03-01', porcentaje: 30,
      periodo_id: period.id, creado_por: world.users.adminA.id,
    }, su)).data;
    track(world, 'evaluations', evaluacion.id);

    return { inst, grade, subject, period, student1, student2, evaluacion };
  }

  const baseMark = (ctx, nota, estudianteId = ctx.student1.id) => ({
    estudiante_id: estudianteId,
    materia_id: ctx.subject.id,
    grado_id: ctx.grade.id,
    evaluacion_id: ctx.evaluacion.id,
    tipo_evaluacion: 'Parcial',
    fecha_evaluacion: '2026-03-01',
    porcentaje: 30,
    nota,
    registrado_por: world.users.adminA.id,
  });

  // ---- Escalas 5 / 10 / 100 ----------------------------------------------

  await test('institución 1-5 con aprobación 3: acepta 5 y 0, rechaza 6', async () => {
    const ctx = await mkClass('colegio', 5, 3);

    equal(ctx.inst.escala_maxima, 5, 'escala guardada 5');
    equal(ctx.inst.nota_minima_aprobacion, 3, 'nota mínima guardada 3');

    const ok5 = (await post('/marks', baseMark(ctx, 5), su)).data;
    track(world, 'marks', ok5.id);
    equal(ok5.nota, 5, 'nota 5 aceptada');

    const ok0 = (await post('/marks', baseMark(ctx, 0, ctx.student2.id), su)).data;
    track(world, 'marks', ok0.id);
    equal(ok0.nota, 0, 'nota 0 aceptada (reprobada pero registrable)');

    expectError(await post('/marks', baseMark(ctx, 6), su), 400, 'La nota debe estar entre 0 y 5.');
  });

  await test('institución 1-10 con aprobación 6: acepta 10, rechaza 11', async () => {
    const ctx = await mkClass('colegio', 10, 6);
    equal(ctx.inst.escala_maxima, 10, 'escala guardada 10');
    equal(ctx.inst.nota_minima_aprobacion, 6, 'nota mínima guardada 6');

    const ok = (await post('/marks', baseMark(ctx, 10), su)).data;
    track(world, 'marks', ok.id);
    equal(ok.nota, 10, 'nota 10 aceptada');

    expectError(await post('/marks', baseMark(ctx, 11), su), 400, 'La nota debe estar entre 0 y 10.');
  });

  await test('institución 1-100 con aprobación 60: acepta 100, rechaza 101', async () => {
    const ctx = await mkClass('colegio', 100, 60);
    equal(ctx.inst.escala_maxima, 100, 'escala guardada 100');
    equal(ctx.inst.nota_minima_aprobacion, 60, 'nota mínima guardada 60');

    const ok = (await post('/marks', baseMark(ctx, 100), su)).data;
    track(world, 'marks', ok.id);
    equal(ok.nota, 100, 'nota 100 aceptada');

    expectError(await post('/marks', baseMark(ctx, 101), su), 400, 'La nota debe estar entre 0 y 100.');
  });

  // ---- Umbral de aprobación (nota < mínima es válida pero reprobada) ------

  await test('una nota bajo la mínima sigue siendo registrable (reprobada)', async () => {
    const ctx = await mkClass('colegio', 5, 3);
    const mark = (await post('/marks', baseMark(ctx, 2), su)).data;
    track(world, 'marks', mark.id);
    equal(mark.nota, 2, 'nota 2 (reprobada) aceptada en escala 1-5 con mínima 3');
    ok(mark.nota < ctx.inst.nota_minima_aprobacion, 'queda por debajo del umbral de aprobación');
  });

  // ---- La nota mínima respeta la escala -----------------------------------

  await test('no se permite nota mínima 0', async () => {
    const res = await post('/institutions', {
      nombre: `Min0-${world.id}`, subdominio: `min0${world.id}`,
      tipo: 'colegio', escala_maxima: 5, nota_minima_aprobacion: 0, activa: true,
    }, su);
    expectError(res, 400, 'La nota mínima de aprobación debe estar entre 1 y 5.');
  });

  await test('no se permite nota mínima mayor que la escala', async () => {
    const res = await post('/institutions', {
      nombre: `Min6-${world.id}`, subdominio: `min6${world.id}`,
      tipo: 'colegio', escala_maxima: 5, nota_minima_aprobacion: 6, activa: true,
    }, su);
    expectError(res, 400, 'La nota mínima de aprobación debe estar entre 1 y 5.');
  });

  // ---- Corporación y edición de escala ------------------------------------

  await test('el tipo corporacion es válido', async () => {
    const inst = (await post('/institutions', {
      nombre: `Corp-${world.id}`, subdominio: `corp${world.id}`,
      tipo: 'corporacion', escala_maxima: 10, nota_minima_aprobacion: 6, activa: true,
    }, su)).data;
    track(world, 'institutions', inst.id);
    equal(inst.tipo, 'corporacion', 'tipo corporacion guardado');
    equal(inst.escala_maxima, 10, 'escala corporacion por defecto 10');
  });

  await test('cambiar la escala dejando la mínima fuera devuelve 400', async () => {
    const inst = (await post('/institutions', {
      nombre: `Edit-${world.id}`, subdominio: `edit${world.id}`,
      tipo: 'colegio', escala_maxima: 10, nota_minima_aprobacion: 6, activa: true,
    }, su)).data;
    track(world, 'institutions', inst.id);

    expectError(await put(`/institutions/${inst.id}`, {
      nombre: inst.nombre, subdominio: inst.subdominio, tipo: 'colegio',
      escala_maxima: 5, nota_minima_aprobacion: 6, activa: true,
    }, su), 400, 'La nota mínima de aprobación debe estar entre 1 y 5.');
  });

  await test('la escala por defecto según tipo es editable, no una regla rígida', async () => {
    // Sin escala explícita: universidad → 5; luego se puede editar a 100.
    const inst = (await post('/institutions', {
      nombre: `Default-${world.id}`, subdominio: `def${world.id}`,
      tipo: 'universidad', nota_minima_aprobacion: 3, activa: true,
    }, su)).data;
    track(world, 'institutions', inst.id);
    equal(inst.escala_maxima, 5, 'default universidad → 5');

    const actualizada = (await put(`/institutions/${inst.id}`, {
      ...inst, escala_maxima: 100, nota_minima_aprobacion: 60,
    }, su)).data;
    equal(actualizada.escala_maxima, 100, 'escala editada a 100');
    equal(actualizada.nota_minima_aprobacion, 60, 'mínima editada a 60');
    equal(actualizada.tipo, 'universidad', 'el tipo no cambió al editar la escala');

    // Limpieza: el borrado pasa por el mismo API.
    await del(`/institutions/${inst.id}`, su).catch(() => {});
  });
}
