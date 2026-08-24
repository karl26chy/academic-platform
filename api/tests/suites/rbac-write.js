import { post, put, del } from '../helpers/http.js';
import { track } from '../helpers/fixtures.js';
import { suite, test, equal, expectError } from '../helpers/runner.js';

/**
 * RBAC de escritura (authorizeWrite): quién puede crear/editar/borrar qué.
 * Congela también los casos donde un admin NO puede escribir por falta de
 * columna institucion_id en la tabla (subjects, student_grades).
 */
export default async function rbacWriteSuite(world) {
  suite('RBAC de escritura');

  // ---- Instituciones: solo super admin ------------------------------------
  await test('un admin no puede crear instituciones', async () => {
    expectError(
      await post('/institutions', { nombre: 'X', subdominio: `x${world.id}`, tipo: 'colegio' }, world.tokens.adminA),
      403,
      'Solo el Super Administrador puede gestionar instituciones.'
    );
  });

  await test('un profesor no puede crear instituciones', async () => {
    expectError(
      await post('/institutions', { nombre: 'X', subdominio: `y${world.id}`, tipo: 'colegio' }, world.tokens.teacherA),
      403,
      'Solo el Super Administrador puede gestionar instituciones.'
    );
  });

  await test('un admin no puede editar su propia institución', async () => {
    expectError(
      await put(`/institutions/${world.inst.A.id}`, { nombre: 'Renombrada' }, world.tokens.adminA),
      403,
      'Solo el Super Administrador puede gestionar instituciones.'
    );
  });

  await test('un admin no puede borrar instituciones', async () => {
    expectError(await del(`/institutions/${world.inst.A.id}`, world.tokens.adminA), 403);
  });

  await test('el super admin sí puede crear y borrar instituciones', async () => {
    const res = await post('/institutions', {
      nombre: 'Temporal', subdominio: `tmp${world.id}`, tipo: 'colegio', nota_minima_aprobacion: 6, activa: true,
    }, world.tokens.super);
    equal(res.status, 201, 'creación');
    equal((await del(`/institutions/${res.data.id}`, world.tokens.super)).status, 200, 'borrado');
  });

  // ---- Usuarios: solo admin de la propia institución ----------------------
  await test('un profesor no puede crear usuarios', async () => {
    expectError(
      await post('/users', { email: `t${world.id}@x.com`, password: 'a', rol: 'student', institucion_id: world.inst.A.id }, world.tokens.teacherA),
      403,
      'No autorizado.'
    );
  });

  await test('un estudiante no puede crear usuarios', async () => {
    expectError(
      await post('/users', { email: `s${world.id}@x.com`, password: 'a', rol: 'student', institucion_id: world.inst.A.id }, world.tokens.studentA),
      403,
      'No autorizado.'
    );
  });

  await test('un admin no puede crear usuarios en OTRA institución', async () => {
    expectError(
      await post('/users', { email: `o${world.id}@x.com`, password: 'a', rol: 'student', institucion_id: world.inst.B.id }, world.tokens.adminA),
      403,
      'No autorizado.'
    );
  });

  await test('un admin no puede crear un super_admin', async () => {
    expectError(
      await post('/users', { email: `sa${world.id}@x.com`, password: 'a', rol: 'super_admin', institucion_id: world.inst.A.id }, world.tokens.adminA),
      403,
      'No autorizado.'
    );
  });

  await test('un admin sí puede crear usuarios de su institución', async () => {
    const res = await post('/users', {
      email: `nuevo${world.id}@test.local`, password: 'test1234', rol: 'student',
      nombre: 'Nuevo', apellido: 'Alumno', institucion_id: world.inst.A.id, activo: true,
      tipo_documento: 'TI', identificacion: `IDNUEVO${world.id}`,
    }, world.tokens.adminA);
    equal(res.status, 201, 'status');
    track(world, 'users', res.data.id);
  });

  await test('un admin no puede editar usuarios de otra institución', async () => {
    expectError(
      await put(`/users/${world.users.studentB.id}`, { nombre: 'Hackeado' }, world.tokens.adminA),
      403,
      'No autorizado.'
    );
  });

  // ---- Grados y asignaciones: admin de la propia institución --------------
  await test('un profesor no puede crear grados', async () => {
    expectError(
      await post('/grades', { institucion_id: world.inst.A.id, nombre: 'X' }, world.tokens.teacherA),
      403,
      'Solo un administrador puede gestionar este recurso.'
    );
  });

  await test('un admin no puede crear grados en otra institución', async () => {
    expectError(
      await post('/grades', { institucion_id: world.inst.B.id, nombre: 'X' }, world.tokens.adminA),
      403,
      'No autorizado.'
    );
  });

  await test('un admin sí puede crear grados de su institución', async () => {
    const res = await post('/grades', {
      institucion_id: world.inst.A.id, nombre: `7mo-${world.id}`, tipo_grado: 'A',
    }, world.tokens.adminA);
    equal(res.status, 201, 'status');
    track(world, 'grades', res.data.id);
  });

  await test('un admin sí puede crear asignaciones de su institución', async () => {
    const res = await post('/assignments', {
      profesor_id: world.users.teacherA2.id,
      materia_id: world.subjects.Y.id,
      grado_id: world.grades.A.id,
      institucion_id: world.inst.A.id,
    }, world.tokens.adminA);
    equal(res.status, 201, 'status');
    track(world, 'assignments', res.data.id);
  });

  // ---- Materias por institución --------------------------------------------
  await test('un admin sí puede crear materias de su institución', async () => {
    const res = await post('/subjects', { nombre: `Mat ${world.id}` }, world.tokens.adminA);
    equal(res.status, 201, 'status');
    equal(res.data.institucion_id, world.inst.A.id, 'la materia queda en SU institución (no confía en el body)');
    track(world, 'subjects', res.data.id);
  });

  await test('un admin NO puede crear una materia para otra institución', async () => {
    expectError(
      await post('/subjects', { nombre: `MatB ${world.id}`, institucion_id: world.inst.B.id }, world.tokens.adminA),
      403,
      'No autorizado.'
    );
  });

  await test('un profesor no puede crear materias', async () => {
    expectError(
      await post('/subjects', { nombre: `MatT ${world.id}` }, world.tokens.teacherA),
      403
    );
  });

  // ---- Coherencia de asignaciones ------------------------------------------
  await test('una asignación no puede usar una materia de otra institución', async () => {
    expectError(
      await post('/assignments', {
        profesor_id: world.users.teacherA.id, materia_id: world.subjects.Z.id,
        grado_id: world.grades.A.id, institucion_id: world.inst.A.id,
      }, world.tokens.adminA),
      400,
      'La materia no pertenece a esta institución.'
    );
  });

  await test('una asignación no puede usar un grado de otra institución', async () => {
    expectError(
      await post('/assignments', {
        profesor_id: world.users.teacherA.id, materia_id: world.subjects.X.id,
        grado_id: world.grades.B.id, institucion_id: world.inst.A.id,
      }, world.tokens.adminA),
      400,
      'El grado no pertenece a esta institución.'
    );
  });

  await test('una asignación no puede usar un docente de otra institución', async () => {
    expectError(
      await post('/assignments', {
        profesor_id: world.users.teacherB.id, materia_id: world.subjects.X.id,
        grado_id: world.grades.A.id, institucion_id: world.inst.A.id,
      }, world.tokens.adminA),
      400,
      'El docente no pertenece a esta institución.'
    );
  });

  // ---- Matrículas (student_grades) -----------------------------------------
  await test('un admin sí puede matricular a un estudiante de su institución', async () => {
    const res = await post('/student_grades', {
      estudiante_id: world.users.studentA2.id, grado_id: world.grades.A.id,
    }, world.tokens.adminA);
    equal(res.status, 201, 'status');
    track(world, 'student_grades', res.data.id);
  });

  await test('un admin NO puede matricular a un estudiante de otra institución', async () => {
    expectError(
      await post('/student_grades', { estudiante_id: world.users.studentB.id, grado_id: world.grades.A.id }, world.tokens.adminA),
      403
    );
  });

  await test('un admin NO puede matricular a un estudiante en un grado de otra institución', async () => {
    expectError(
      await post('/student_grades', { estudiante_id: world.users.studentA.id, grado_id: world.grades.B.id }, world.tokens.adminA),
      403
    );
  });

  await test('una matrícula duplicada en el mismo grado devuelve 409', async () => {
    expectError(
      await post('/student_grades', { estudiante_id: world.users.studentA.id, grado_id: world.grades.A.id }, world.tokens.adminA),
      409
    );
  });

  await test('un estudiante no puede matricularse a sí mismo', async () => {
    expectError(
      await post('/student_grades', { estudiante_id: world.users.studentA2.id, grado_id: world.grades.A.id }, world.tokens.studentA),
      403
    );
  });

  await test('el super admin sí puede matricular estudiantes', async () => {
    const res = await post('/student_grades', {
      estudiante_id: world.users.studentB.id, grado_id: world.grades.B.id,
    }, world.tokens.super);
    equal(res.status, 201, 'status');
    track(world, 'student_grades', res.data.id);
  });

  // ---- Notas -------------------------------------------------------------
  await test('un estudiante no puede registrar notas', async () => {
    expectError(
      await post('/marks', {
        estudiante_id: world.users.studentA.id, materia_id: world.subjects.X.id,
        grado_id: world.grades.A.id, evaluacion_id: world.evaluations.A.id, nota: 10,
      }, world.tokens.studentA),
      403,
      'Los estudiantes no pueden registrar notas.'
    );
  });

  await test('registrar nota sin grado_id devuelve 400', async () => {
    expectError(
      await post('/marks', {
        estudiante_id: world.users.studentA.id, materia_id: world.subjects.X.id,
        evaluacion_id: world.evaluations.A.id, nota: 8,
      }, world.tokens.teacherA),
      400,
      'Falta grado_id.'
    );
  });

  await test('un profesor SIN asignación no puede calificar esa materia y grado', async () => {
    expectError(
      await post('/marks', {
        estudiante_id: world.users.studentA.id, materia_id: world.subjects.X.id,
        grado_id: world.grades.A.id, evaluacion_id: world.evaluations.A.id, nota: 8,
      }, world.tokens.teacherA2),
      403,
      'No tienes asignada esta materia y grado.'
    );
  });

  await test('un profesor CON asignación sí puede calificar', async () => {
    const res = await post('/marks', {
      estudiante_id: world.users.studentA2.id, materia_id: world.subjects.X.id,
      grado_id: world.grades.A.id, evaluacion_id: world.evaluations.A.id,
      tipo_evaluacion: 'Parcial 1', porcentaje: 30, nota: 7, periodo: 'Periodo 1',
      registrado_por: world.users.teacherA.id,
    }, world.tokens.teacherA);
    equal(res.status, 201, 'status');
    track(world, 'marks', res.data.id);
  });

  await test('un profesor de otra institución no puede calificar ese grado', async () => {
    expectError(
      await post('/marks', {
        estudiante_id: world.users.studentA.id, materia_id: world.subjects.X.id,
        grado_id: world.grades.A.id, evaluacion_id: world.evaluations.A.id, nota: 8,
      }, world.tokens.teacherB),
      403,
      'No autorizado.'
    );
  });

  // ---- Asistencia y evaluaciones -----------------------------------------
  await test('un estudiante no puede registrar asistencia', async () => {
    expectError(
      await post('/attendance', {
        estudiante_id: world.users.studentA.id, grado_id: world.grades.A.id,
        materia_id: world.subjects.X.id, fecha: '2026-03-02', estado: 'presente',
      }, world.tokens.studentA),
      403,
      'No autorizado.'
    );
  });

  await test('un profesor sin asignación no puede registrar asistencia de esa clase', async () => {
    expectError(
      await post('/attendance', {
        estudiante_id: world.users.studentA.id, grado_id: world.grades.A.id,
        materia_id: world.subjects.X.id, fecha: '2026-03-02', estado: 'presente',
      }, world.tokens.teacherA2),
      403,
      'No tienes asignada esta materia y grado.'
    );
  });

  await test('un estudiante no puede crear evaluaciones', async () => {
    expectError(
      await post('/evaluations', {
        institucion_id: world.inst.A.id, materia_id: world.subjects.X.id,
        grado_id: world.grades.A.id, nombre: 'X', porcentaje: 10,
      }, world.tokens.studentA),
      403,
      'No autorizado.'
    );
  });

  await test('un profesor con asignación sí puede crear evaluaciones', async () => {
    const res = await post('/evaluations', {
      institucion_id: world.inst.A.id, materia_id: world.subjects.X.id,
      grado_id: world.grades.A.id, nombre: `Quiz ${world.id}`,
      fecha_evaluacion: '2026-05-01', porcentaje: 10, periodo: 'Periodo 1',
      creado_por: world.users.teacherA.id,
    }, world.tokens.teacherA);
    equal(res.status, 201, 'status');
    track(world, 'evaluations', res.data.id);
  });

  // ---- Citaciones --------------------------------------------------------
  await test('un estudiante no puede crear citaciones', async () => {
    expectError(
      await post('/citations', {
        estudiante_id: world.users.studentA.id, materia_id: world.subjects.X.id,
        fecha_citacion: '2026-03-11T10:00:00.000Z', motivo: 'X', estado: 'pendiente',
      }, world.tokens.studentA),
      403,
      'Los estudiantes no pueden crear citaciones.'
    );
  });

  await test('un profesor no puede citar a un estudiante de otra institución', async () => {
    expectError(
      await post('/citations', {
        estudiante_id: world.users.studentB.id, materia_id: world.subjects.X.id,
        fecha_citacion: '2026-03-11T10:00:00.000Z', motivo: 'X', estado: 'pendiente',
      }, world.tokens.teacherA),
      403,
      'No autorizado.'
    );
  });

  await test('un profesor sí puede citar a un estudiante de su institución', async () => {
    const res = await post('/citations', {
      estudiante_id: world.users.studentA.id, materia_id: world.subjects.X.id,
      fecha_citacion: '2026-03-12T10:00:00.000Z', motivo: 'Prueba', estado: 'pendiente',
      creado_por: world.users.teacherA.id,
    }, world.tokens.teacherA);
    equal(res.status, 201, 'status');
    track(world, 'citations', res.data.id);
  });
}
