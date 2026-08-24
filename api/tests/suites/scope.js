import { get, post } from '../helpers/http.js';
import { track } from '../helpers/fixtures.js';
import { suite, test, equal, ok, notOk } from '../helpers/runner.js';

const idsOf = (rows) => rows.map(r => r.id);

/**
 * Aislamiento multi-institución (buildScope): qué filas ve cada rol.
 * Congela también el comportamiento actual de `subjects`, que es un
 * catálogo global sin filtro por institución.
 */
export default async function scopeSuite(world) {
  suite('Aislamiento multi-institución (lectura)');

  // Datos de apoyo: una nota, una asistencia, una citación y un mensaje del estudiante A.
  const mark = (await post('/marks', {
    estudiante_id: world.users.studentA.id,
    materia_id: world.subjects.X.id,
    grado_id: world.grades.A.id,
    evaluacion_id: world.evaluations.A.id,
    tipo_evaluacion: 'Parcial 1',
    fecha_evaluacion: '2026-03-01',
    porcentaje: 30,
    nota: 8,
    periodo: 'Periodo 1',
    registrado_por: world.users.teacherA.id,
  }, world.tokens.teacherA)).data;
  track(world, 'marks', mark.id);

  const att = (await post('/attendance', {
    estudiante_id: world.users.studentA.id,
    materia_id: world.subjects.X.id,
    grado_id: world.grades.A.id,
    fecha: '2026-03-01',
    estado: 'presente',
    registrado_por: world.users.teacherA.id,
  }, world.tokens.teacherA)).data;
  track(world, 'attendance', att.id);

  const cit = (await post('/citations', {
    estudiante_id: world.users.studentA.id,
    materia_id: world.subjects.X.id,
    fecha_citacion: '2026-03-10T10:00:00.000Z',
    motivo: 'Test',
    estado: 'pendiente',
    creado_por: world.users.teacherA.id,
  }, world.tokens.teacherA)).data;
  track(world, 'citations', cit.id);

  const msg = (await post('/messages', {
    remitente_id: world.users.teacherA.id,
    destinatario_id: world.users.studentA.id,
    materia_id: world.subjects.X.id,
    asunto: 'Hola',
    cuerpo: 'Mensaje de prueba',
    leido: false,
    created_at: '2026-03-01T10:00:00.000Z',
  }, world.tokens.teacherA)).data;
  track(world, 'messages', msg.id);

  await test('un admin solo ve los usuarios de su institución', async () => {
    const res = await get('/users', world.tokens.adminA);
    const ids = idsOf(res.data);
    ok(ids.includes(world.users.studentA.id), 've a su estudiante');
    notOk(ids.includes(world.users.studentB.id), 'NO ve estudiantes de otra institución');
    notOk(ids.includes(world.users.adminB.id), 'NO ve admins de otra institución');
  });

  await test('el admin de la otra institución tampoco cruza datos', async () => {
    const ids = idsOf((await get('/users', world.tokens.adminB)).data);
    ok(ids.includes(world.users.studentB.id), 've a su estudiante');
    notOk(ids.includes(world.users.studentA.id), 'NO ve al de la institución A');
  });

  await test('los usuarios nunca exponen password en el listado', async () => {
    const res = await get('/users', world.tokens.adminA);
    ok(res.data.every(u => !('password' in u)), 'ninguna fila trae password');
  });

  await test('un admin solo ve los grados de su institución', async () => {
    const ids = idsOf((await get('/grades', world.tokens.adminA)).data);
    ok(ids.includes(world.grades.A.id), 've su grado');
    notOk(ids.includes(world.grades.B.id), 'NO ve el grado ajeno');
  });

  await test('un admin solo ve las asignaciones de su institución', async () => {
    const ids = idsOf((await get('/assignments', world.tokens.adminB)).data);
    notOk(ids.includes(world.assignments.A.id), 'NO ve asignaciones ajenas');
  });

  await test('un admin solo ve las evaluaciones de su institución', async () => {
    const ids = idsOf((await get('/evaluations', world.tokens.adminB)).data);
    notOk(ids.includes(world.evaluations.A.id), 'NO ve evaluaciones ajenas');
  });

  await test('un estudiante solo ve SUS notas', async () => {
    const res = await get('/marks', world.tokens.studentA);
    ok(res.data.every(m => m.estudiante_id === world.users.studentA.id), 'todas las notas son suyas');
    ok(idsOf(res.data).includes(mark.id), 've su propia nota');
  });

  await test('un estudiante de otra institución no ve esa nota', async () => {
    const ids = idsOf((await get('/marks', world.tokens.studentB)).data);
    notOk(ids.includes(mark.id), 'NO ve la nota ajena');
  });

  await test('un estudiante solo ve SUS asistencias', async () => {
    const res = await get('/attendance', world.tokens.studentA);
    ok(res.data.every(a => a.estudiante_id === world.users.studentA.id), 'todas son suyas');
  });

  await test('un estudiante solo ve SUS citaciones', async () => {
    const res = await get('/citations', world.tokens.studentA);
    ok(res.data.every(c => c.estudiante_id === world.users.studentA.id), 'todas son suyas');
  });

  await test('un estudiante solo ve SU matrícula', async () => {
    const res = await get('/student_grades', world.tokens.studentA);
    ok(res.data.every(sg => sg.estudiante_id === world.users.studentA.id), 'todas son suyas');
  });

  await test('un profesor ve las notas de los grados de su institución', async () => {
    const ids = idsOf((await get('/marks', world.tokens.teacherA)).data);
    ok(ids.includes(mark.id), 've la nota de su grado');
  });

  await test('un profesor de otra institución no ve esas notas', async () => {
    const ids = idsOf((await get('/marks', world.tokens.teacherB)).data);
    notOk(ids.includes(mark.id), 'NO ve notas ajenas');
  });

  await test('los mensajes solo los ven remitente y destinatario', async () => {
    const visto = idsOf((await get('/messages', world.tokens.studentA)).data);
    ok(visto.includes(msg.id), 'el destinatario lo ve');
    const ajeno = idsOf((await get('/messages', world.tokens.studentB)).data);
    notOk(ajeno.includes(msg.id), 'un tercero NO lo ve');
    const remitente = idsOf((await get('/messages', world.tokens.teacherA)).data);
    ok(remitente.includes(msg.id), 'el remitente lo ve');
  });

  await test('el super admin ve los datos de todas las instituciones', async () => {
    const users = idsOf((await get('/users', world.tokens.super)).data);
    ok(users.includes(world.users.studentA.id) && users.includes(world.users.studentB.id), 've ambos');
  });

  await test('las materias están aisladas por institución', async () => {
    const a = idsOf((await get('/subjects', world.tokens.adminA)).data);
    const b = idsOf((await get('/subjects', world.tokens.adminB)).data);
    ok(a.includes(world.subjects.X.id), 'A ve la materia de su institución');
    ok(b.includes(world.subjects.Z.id), 'B ve la materia de su institución');
    notOk(a.includes(world.subjects.Z.id), 'A NO ve la materia de B');
    notOk(b.includes(world.subjects.X.id), 'B NO ve la materia de A');
  });

  await test('pedir por id un recurso fuera del alcance devuelve 404', async () => {
    const res = await get(`/users/${world.users.studentB.id}`, world.tokens.adminA);
    equal(res.status, 404, 'status');
    equal(res.data.error, 'Recurso no encontrado.', 'mensaje');
  });

  await test('pedir por id un recurso propio devuelve 200', async () => {
    const res = await get(`/users/${world.users.studentA.id}`, world.tokens.adminA);
    equal(res.status, 200, 'status');
    equal(res.data.id, world.users.studentA.id, 'id');
  });
}
