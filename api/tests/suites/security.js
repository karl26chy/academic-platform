import { get, post, put, del, login, baseUrl } from '../helpers/http.js';
import { track } from '../helpers/fixtures.js';
import { suite, test, equal, ok, notOk, expectError } from '../helpers/runner.js';

/**
 * Ataques concretos que antes funcionaban. Cada prueba reproduce el ataque y
 * exige que ahora se rechace:
 *  · apropiarse de registros de otra institución enviando el propio
 *    institucion_id/grado_id en el cuerpo;
 *  · suplantar o editar mensajes ajenos;
 *  · leer logros, observaciones y boletines PDF sin permiso;
 *  · falsear el autor de un registro;
 *  · abuso (fuerza bruta, cuerpos gigantes) y cabeceras de seguridad.
 */
export default async function securitySuite(world) {
  suite('Seguridad (ataques reproducidos)');

  const su = world.tokens.super;
  const { adminA, teacherA, teacherA2, studentA, adminB, teacherB } = world.users;
  let seq = 0;
  const tag = () => `${world.id}-sec${seq++}`;

  // Periodo abierto propio: las suites anteriores abren y cierran periodos de A.
  const periodo = (await post('/academic_periods', {
    institucion_id: world.inst.A.id, nombre: 'Periodo seguridad', numero: 1, anio: 2031,
    fecha_inicio: '2031-01-01', fecha_fin: '2031-12-31', activo: true,
  }, su)).data;
  track(world, 'academic_periods', periodo.id);

  // ---- Escrituras entre instituciones --------------------------------------

  await test('admin A NO puede tomar la cuenta del admin de B (institución + contraseña)', async () => {
    expectError(
      await put(`/users/${adminB.id}`, { institucion_id: world.inst.A.id, password: 'Robada123!' }, world.tokens.adminA),
      403,
      'No autorizado.'
    );
    const intento = await post('/auth/login', { email: adminB.email, password: 'Robada123!' });
    equal(intento.status, 401, 'la contraseña no cambió');
    const sigue = await get(`/users/${adminB.id}`, su);
    equal(sigue.data.institucion_id, world.inst.B.id, 'sigue en su institución');
  });

  await test('admin A NO puede apropiarse de un grado de B ni borrarlo', async () => {
    expectError(
      await put(`/grades/${world.grades.B.id}`, { institucion_id: world.inst.A.id, nombre: 'Robado' }, world.tokens.adminA),
      403
    );
    expectError(await del(`/grades/${world.grades.B.id}`, world.tokens.adminA), 403);
    equal((await get(`/grades/${world.grades.B.id}`, su)).data.institucion_id, world.inst.B.id, 'grado intacto');
  });

  await test('admin A NO puede apropiarse de un periodo de B', async () => {
    expectError(
      await put(`/academic_periods/${world.periods.B.id}`, { institucion_id: world.inst.A.id, nombre: 'Robado' }, world.tokens.adminA),
      403
    );
  });

  await test('un docente NO puede mover una nota de una clase que no es suya a la suya', async () => {
    // Clase de teacherA2 (materia Y), con una nota registrada.
    const asg = (await post('/assignments', {
      profesor_id: teacherA2.id, materia_id: world.subjects.Y.id, grado_id: world.grades.A.id, institucion_id: world.inst.A.id,
    }, su)).data;
    track(world, 'assignments', asg.id);
    const ev = (await post('/evaluations', {
      institucion_id: world.inst.A.id, materia_id: world.subjects.Y.id, grado_id: world.grades.A.id,
      nombre: `Ajena ${tag()}`, fecha_evaluacion: '2026-02-01', porcentaje: 10, periodo_id: periodo.id,
    }, su)).data;
    track(world, 'evaluations', ev.id);
    const nota = (await post('/marks', {
      estudiante_id: studentA.id, materia_id: world.subjects.Y.id, grado_id: world.grades.A.id,
      evaluacion_id: ev.id, tipo_evaluacion: 'Parcial', fecha_evaluacion: '2026-02-01', porcentaje: 10, nota: 9,
    }, su)).data;
    track(world, 'marks', nota.id);

    // teacherA envía SU materia (X) en el cuerpo para pasar la validación.
    expectError(
      await put(`/marks/${nota.id}`, { materia_id: world.subjects.X.id, nota: 1 }, world.tokens.teacherA),
      403,
      'No tienes asignada esta materia y grado.'
    );
    expectError(await del(`/marks/${nota.id}`, world.tokens.teacherA), 403);
    equal(Number((await get(`/marks/${nota.id}`, su)).data.nota), 9, 'la nota no cambió');
  });

  await test('un docente NO puede crear una evaluación en otra institución', async () => {
    expectError(
      await post('/evaluations', {
        institucion_id: world.inst.B.id, materia_id: world.subjects.X.id, grado_id: world.grades.A.id,
        nombre: `Cruzada ${tag()}`, fecha_evaluacion: '2026-02-01', porcentaje: 5, periodo_id: periodo.id,
      }, world.tokens.teacherA),
      403
    );
  });

  await test('el autor de un registro es quien lo crea, no el que diga el cuerpo', async () => {
    const cita = await post('/citations', {
      estudiante_id: studentA.id, materia_id: world.subjects.X.id, fecha_citacion: '2026-03-01',
      motivo: 'Prueba', estado: 'pendiente', creado_por: adminA.id,
    }, world.tokens.teacherA);
    equal(cita.status, 201, 'citación creada');
    track(world, 'citations', cita.data.id);
    equal(cita.data.creado_por, teacherA.id, 'creado_por = quien hizo la petición');
  });

  // ---- Mensajes ------------------------------------------------------------

  await test('mensajes: el remitente no se puede suplantar ni escribir a otra institución', async () => {
    const msg = await post('/messages', {
      remitente_id: adminA.id, destinatario_id: teacherA.id, asunto: 'x', cuerpo: 'hola', leido: false,
    }, world.tokens.studentA);
    equal(msg.status, 201, 'mensaje creado');
    track(world, 'messages', msg.data.id);
    equal(msg.data.remitente_id, studentA.id, 'el remitente es quien envía');

    expectError(
      await post('/messages', { destinatario_id: teacherB.id, asunto: 'x', cuerpo: 'y' }, world.tokens.studentA),
      403,
      'Solo puedes escribir a usuarios de tu institución.'
    );
  });

  await test('mensajes: solo el destinatario lo marca como leído; nadie reescribe el texto', async () => {
    const msg = (await post('/messages', {
      destinatario_id: teacherA.id, asunto: 'x', cuerpo: 'original', leido: false,
    }, world.tokens.studentA)).data;
    track(world, 'messages', msg.id);

    expectError(await put(`/messages/${msg.id}`, { leido: true }, world.tokens.teacherA2), 403);
    expectError(await put(`/messages/${msg.id}`, { cuerpo: 'alterado' }, world.tokens.teacherA), 403);
    expectError(await put(`/messages/${msg.id}`, { cuerpo: 'alterado' }, world.tokens.studentA), 403);
    equal((await put(`/messages/${msg.id}`, { leido: true }, world.tokens.teacherA)).status, 200, 'destinatario marca leído');

    expectError(await del(`/messages/${msg.id}`, world.tokens.teacherA), 403);
    equal((await del(`/messages/${msg.id}`, world.tokens.studentA)).status, 200, 'el remitente sí puede borrarlo');
  });

  // ---- Lecturas protegidas -------------------------------------------------

  await test('solo el admin descarga el boletín PDF (docente y estudiante → 403)', async () => {
    const url = `/students/${studentA.id}/report/pdf?anio=2026`;
    expectError(await get(url, world.tokens.teacherA), 403);
    expectError(await get(url, world.tokens.studentA), 403);
    // El admin de otra institución no lo encuentra (no se revela que existe).
    expectError(await get(url, world.tokens.adminB), 404, 'Estudiante no encontrado.');
  });

  await test('observaciones: solo personal autorizado de la institución las lee', async () => {
    const ruta = `/students/${studentA.id}/observations?periodo_id=${periodo.id}`;
    equal((await put(ruta, { texto: 'Confidencial' }, world.tokens.adminA)).status, 200, 'observación guardada');

    expectError(await get(ruta, world.tokens.studentB), 403);
    expectError(await get(ruta, world.tokens.studentA), 403);
    expectError(await get(ruta, world.tokens.adminB), 403);
    expectError(await get(ruta, world.tokens.teacherB), 403);
    equal((await get(ruta, world.tokens.teacherA)).data.texto, 'Confidencial', 'docente del grado la lee');
    equal((await get(ruta, world.tokens.adminA)).data.texto, 'Confidencial', 'admin de la institución la lee');
  });

  await test('observaciones: no se puede escribir con un periodo de otra institución', async () => {
    expectError(
      await put(`/students/${studentA.id}/observations?periodo_id=${world.periods.B.id}`, { texto: 'x' }, world.tokens.adminA),
      400,
      'Periodo no encontrado.'
    );
  });

  await test('logros: solo el docente de la asignación y su admin los leen', async () => {
    const ruta = `/assignments/${world.assignments.A.id}/achievements?periodo_id=${world.periods.A.id}`;
    expectError(await get(ruta, world.tokens.teacherB), 403);
    expectError(await get(ruta, world.tokens.adminB), 403);
    expectError(await get(ruta, world.tokens.studentA), 403);
    expectError(await get(ruta, world.tokens.teacherA2), 403);
    equal((await get(ruta, world.tokens.teacherA)).status, 200, 'su docente sí');
    equal((await get(ruta, world.tokens.adminA)).status, 200, 'su admin sí');
  });

  // ---- Sesión --------------------------------------------------------------

  await test('el rol vigente manda sobre el del token (un docente degradado pierde permisos)', async () => {
    const email = `degradado.${tag()}@test.local`;
    const u = (await post('/users', {
      email, password: world.password, rol: 'admin', nombre: 'D', apellido: 'G', institucion_id: world.inst.A.id, activo: true,
    }, su)).data;
    track(world, 'users', u.id);
    const token = (await login(email, world.password)).token;
    const grado = await post('/grades', { institucion_id: world.inst.A.id, nombre: `G ${tag()}`, tipo_grado: 'A' }, token);
    equal(grado.status, 201, 'como admin crea grados');
    track(world, 'grades', grado.data.id);

    await put(`/users/${u.id}`, { rol: 'teacher' }, su);
    expectError(
      await post('/grades', { institucion_id: world.inst.A.id, nombre: `G ${tag()}`, tipo_grado: 'A' }, token),
      403
    );
  });

  // ---- Abuso y configuración -----------------------------------------------

  await test('contraseñas de menos de 8 caracteres se rechazan', async () => {
    expectError(
      await post('/users', {
        email: `corta.${tag()}@test.local`, password: '1234567', rol: 'teacher', nombre: 'C', apellido: 'T',
        institucion_id: world.inst.A.id, activo: true,
      }, world.tokens.adminA),
      400,
      'La contraseña debe tener al menos 8 caracteres.'
    );
  });

  await test('fuerza bruta: 10 fallos seguidos bloquean esa cuenta, no las demás', async () => {
    const email = `nadie.${tag()}@test.local`;
    for (let i = 0; i < 10; i++) {
      equal((await post('/auth/login', { email, password: 'mala' })).status, 401, `intento ${i + 1} → 401`);
    }
    const bloqueado = await post('/auth/login', { email, password: 'mala' });
    equal(bloqueado.status, 429, 'el intento 11 queda bloqueado');
    equal((await post('/auth/login', { email: adminA.email, password: world.password })).status, 200, 'otra cuenta entra normal');
  });

  await test('cuerpo gigante → 413 y JSON roto → 400 (no 500)', async () => {
    const grande = await post('/grades', { nombre: 'a'.repeat(2 * 1024 * 1024) }, world.tokens.adminA);
    expectError(grande, 413, 'La petición es demasiado grande.');

    const res = await fetch(`${baseUrl()}/grades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${world.tokens.adminA}` },
      body: '{"nombre": ',
    });
    equal(res.status, 400, 'JSON roto → 400');
  });

  // Requiere Chromium: solo corre si PUPPETEER_EXECUTABLE_PATH está definido.
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    await test('el admin descarga un PDF real por HTTP (no JSON) y un ZIP masivo', async () => {
      const cfg = await post(`/institutions/${world.inst.A.id}/report-config`, { template_id: 'default' }, su);
      equal(cfg.status, 200, 'formato asignado');

      const pdf = await fetch(`${baseUrl()}/students/${studentA.id}/report/pdf?anio=2026`, {
        headers: { Authorization: `Bearer ${world.tokens.adminA}` },
      });
      equal(pdf.status, 200, 'status PDF');
      equal(pdf.headers.get('content-type'), 'application/pdf', 'content-type');
      equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), '%PDF', 'es un PDF');

      const zip = await fetch(`${baseUrl()}/grades/${world.grades.A.id}/bulk-report/pdf?anio=2026`, {
        headers: { Authorization: `Bearer ${world.tokens.adminA}` },
      });
      equal(zip.status, 200, 'status ZIP');
      equal(Buffer.from(await zip.arrayBuffer()).subarray(0, 2).toString(), 'PK', 'es un ZIP');
    });
  }

  await test('cabeceras de seguridad presentes y sin x-powered-by', async () => {
    const res = await fetch(`${baseUrl()}/health`);
    equal(res.headers.get('x-content-type-options'), 'nosniff', 'nosniff');
    ok(res.headers.get('x-frame-options'), 'x-frame-options');
    ok(res.headers.get('strict-transport-security'), 'HSTS');
    ok(res.headers.get('content-security-policy'), 'CSP');
    notOk(res.headers.get('x-powered-by'), 'sin x-powered-by');
  });
}
