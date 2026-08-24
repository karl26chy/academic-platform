import { post, put } from '../helpers/http.js';
import { track } from '../helpers/fixtures.js';
import { suite, test, equal, expectError } from '../helpers/runner.js';

/**
 * Validaciones de datos por recurso (validateRow) y errores de integridad
 * traducidos desde los códigos de PostgreSQL (23505 → 409, 23503 → 400).
 */
export default async function validationSuite(world) {
  suite('Validación de datos');

  const markBase = {
    estudiante_id: world.users.studentA.id,
    materia_id: world.subjects.X.id,
    grado_id: world.grades.A.id,
    tipo_evaluacion: 'Parcial 2',
    fecha_evaluacion: '2026-04-01',
    porcentaje: 30,
    periodo: 'Periodo 1',
    registrado_por: world.users.teacherA.id,
  };

  await test('una nota sin evaluación asociada devuelve 400', async () => {
    expectError(
      await post('/marks', { ...markBase, nota: 8 }, world.tokens.teacherA),
      400,
      'La evaluación es obligatoria para registrar notas.'
    );
  });

  await test('una nota no numérica devuelve 400', async () => {
    expectError(
      await post('/marks', { ...markBase, evaluacion_id: world.evaluations.A2.id, nota: 'ocho' }, world.tokens.teacherA),
      400,
      'La nota debe ser un número.'
    );
  });

  await test('en un colegio la nota no puede superar 10', async () => {
    expectError(
      await post('/marks', { ...markBase, evaluacion_id: world.evaluations.A2.id, nota: 11 }, world.tokens.teacherA),
      400,
      'La nota debe estar entre 0 y 10.'
    );
  });

  await test('la nota no puede ser negativa', async () => {
    expectError(
      await post('/marks', { ...markBase, evaluacion_id: world.evaluations.A2.id, nota: -1 }, world.tokens.teacherA),
      400,
      'La nota debe estar entre 0 y 10.'
    );
  });

  await test('el porcentaje debe estar entre 0 y 100', async () => {
    expectError(
      await post('/marks', { ...markBase, evaluacion_id: world.evaluations.A2.id, nota: 8, porcentaje: 150 }, world.tokens.teacherA),
      400,
      'El porcentaje debe estar entre 0 y 100.'
    );
  });

  await test('en una universidad la escala baja a 0-5', async () => {
    const evalB = (await post('/evaluations', {
      institucion_id: world.inst.B.id, materia_id: world.subjects.Z.id,
      grado_id: world.grades.B.id, nombre: `EvalB ${world.id}`,
      fecha_evaluacion: '2026-04-01', porcentaje: 20, periodo: 'Periodo 1', anio: '2026',
      creado_por: world.users.adminB.id,
    }, world.tokens.super)).data;
    track(world, 'evaluations', evalB.id);

    expectError(
      await post('/marks', {
        estudiante_id: world.users.studentB.id, materia_id: world.subjects.Z.id,
        grado_id: world.grades.B.id, evaluacion_id: evalB.id, nota: 6,
      }, world.tokens.adminB),
      400,
      'La nota debe estar entre 0 y 5.'
    );

    const ok5 = await post('/marks', {
      estudiante_id: world.users.studentB.id, materia_id: world.subjects.Z.id,
      grado_id: world.grades.B.id, evaluacion_id: evalB.id, nota: 4.5,
      porcentaje: 20, periodo: 'Periodo 1',
    }, world.tokens.adminB);
    equal(ok5.status, 201, 'una nota de 4.5 sí se acepta en universidad');
    track(world, 'marks', ok5.data.id);
  });

  await test('una nota válida en el límite superior se acepta', async () => {
    const res = await post('/marks', {
      ...markBase, evaluacion_id: world.evaluations.A2.id, nota: 10,
    }, world.tokens.teacherA);
    equal(res.status, 201, 'status');
    track(world, 'marks', res.data.id);
  });

  await test('no se puede registrar dos veces la nota del mismo estudiante y evaluación', async () => {
    expectError(
      await post('/marks', { ...markBase, evaluacion_id: world.evaluations.A2.id, nota: 9 }, world.tokens.teacherA),
      409,
      'Ya existe un registro con esos datos.'
    );
  });

  await test('un email inválido devuelve 400', async () => {
    expectError(
      await post('/users', {
        email: 'no-es-un-email', password: 'x', rol: 'student',
        institucion_id: world.inst.A.id,
      }, world.tokens.adminA),
      400,
      'Email inválido.'
    );
  });

  await test('un rol inválido devuelve 400', async () => {
    expectError(
      await post('/users', {
        email: `rol${world.id}@test.local`, password: 'x', rol: 'director',
        institucion_id: world.inst.A.id,
      }, world.tokens.adminA),
      400,
      'Rol inválido.'
    );
  });

  await test('el email se normaliza recortando espacios', async () => {
    const email = `  espacios${world.id}@test.local  `;
    const res = await post('/users', {
      email, password: 'test1234', rol: 'student', nombre: 'E', apellido: 'S',
      institucion_id: world.inst.A.id, activo: true, tipo_documento: 'TI',
      identificacion: `IDESP${world.id}`,
    }, world.tokens.adminA);
    equal(res.status, 201, 'status');
    equal(res.data.email, email.trim(), 'email recortado');
    track(world, 'users', res.data.id);
  });

  await test('un email duplicado devuelve 409', async () => {
    expectError(
      await post('/users', {
        email: world.users.studentA.email, password: 'x', rol: 'student',
        nombre: 'Dup', apellido: 'Dup', institucion_id: world.inst.A.id,
        tipo_documento: 'TI', identificacion: `IDDUP${world.id}`,
      }, world.tokens.adminA),
      409,
      'Ya existe un registro con esos datos.'
    );
  });

  await test('un subdominio duplicado devuelve 409', async () => {
    expectError(
      await post('/institutions', {
        nombre: 'Duplicada', subdominio: world.inst.A.subdominio,
        tipo: 'colegio', nota_minima_aprobacion: 6, activa: true,
      }, world.tokens.super),
      409,
      'Ya existe un registro con esos datos.'
    );
  });

  await test('una clave foránea inexistente devuelve 400', async () => {
    expectError(
      await post('/grades', {
        institucion_id: 'no-existe', nombre: 'Fantasma', tipo_grado: 'A',
      }, world.tokens.super),
      400,
      'El registro está relacionado con otros datos y no se puede modificar.'
    );
  });

  await test('la validación también corre al actualizar', async () => {
    expectError(
      await put(`/users/${world.users.studentA.id}`, { email: 'malo' }, world.tokens.adminA),
      400,
      'Email inválido.'
    );
  });

  await test('crear un estudiante sin tipo de documento devuelve 400', async () => {
    expectError(
      await post('/users', {
        email: `sintipo${world.id}@test.local`, password: 'x', rol: 'student',
        nombre: 'S', apellido: 'T', institucion_id: world.inst.A.id,
      }, world.tokens.adminA),
      400,
      'Tipo de documento requerido.'
    );
  });

  await test('un tipo de documento fuera del catálogo devuelve 400', async () => {
    expectError(
      await post('/users', {
        email: `tipomalo${world.id}@test.local`, password: 'x', rol: 'student',
        nombre: 'S', apellido: 'T', institucion_id: world.inst.A.id,
        tipo_documento: 'DNI',
      }, world.tokens.adminA),
      400,
      'Tipo de documento inválido.'
    );
  });
}
