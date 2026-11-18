import { get, post, put, del, login, loginStudent, baseUrl } from '../helpers/http.js';
import { track } from '../helpers/fixtures.js';
import { suite, test, equal, ok, notOk, expectError } from '../helpers/runner.js';

/**
 * Corporaciones (programas técnicos y cursos cortos): programas, grupos
 * (programa + jornada + nivel), semestres, módulos compartidos entre grupos y
 * certificados PDF. Y que los colegios no cambien en nada.
 */
export default async function corporationsSuite(world) {
  suite('Corporaciones');

  const su = world.tokens.super;
  const pw = world.password;
  const t = String(world.id).toLowerCase().replace(/[^a-z0-9]/g, '');

  // ---- Corporación de prueba ------------------------------------------------
  const corp = (await post('/institutions', {
    nombre: `CETIC ${t}`, tipo: 'corporacion', escala_maxima: 5, nota_minima_aprobacion: 3, activa: true,
  }, su)).data;
  track(world, 'institutions', corp.id);
  const mkUser = async (rol, extra) => {
    const u = (await post('/users', { rol, password: pw, nombre: 'Cor', apellido: rol, institucion_id: corp.id, activo: true, ...extra }, su)).data;
    track(world, 'users', u.id);
    return u;
  };
  const admin = await mkUser('admin', { email: `admcorp.${t}@test.local` });
  const docente = await mkUser('teacher', { email: `doccorp.${t}@test.local` });
  const est1 = await mkUser('student', { email: `est1corp.${t}@test.local`, tipo_documento: 'CC', identificacion: `CORP1${t}` });
  const est2 = await mkUser('student', { email: `est2corp.${t}@test.local`, tipo_documento: 'CC', identificacion: `CORP2${t}` });
  const adminTok = (await login(admin.email, pw)).token;
  const docTok = (await login(docente.email, pw)).token;
  const est1Tok = (await loginStudent(est1.identificacion, pw)).token;
  const est2Tok = (await loginStudent(est2.identificacion, pw)).token;

  const crearPrograma = (nombre, tipo, token = adminTok) =>
    post('/programs', { institucion_id: corp.id, nombre, tipo }, token);
  const crearGrupo = (body, token = adminTok) => post('/grades', { institucion_id: corp.id, ...body }, token);

  let enfermeria, maquillaje, grupoNoche, grupoManana, semestre;

  // ---- Programas -------------------------------------------------------------

  await test('el admin crea programas técnicos y cursos cortos', async () => {
    const a = await crearPrograma('Auxiliar en Enfermería', 'tecnico');
    const b = await crearPrograma('Maquillajes', 'curso_corto');
    equal(a.status, 201, 'técnico');
    equal(b.status, 201, 'curso corto');
    enfermeria = a.data; maquillaje = b.data;
    track(world, 'programs', b.data.id);
    track(world, 'programs', a.data.id);
    equal(a.data.activo, true, 'activo por defecto');
  });

  await test('programas: sin duplicados (tildes y mayúsculas no cuentan) y tipo válido', async () => {
    expectError(await crearPrograma('  auxiliar EN enfermeria ', 'tecnico'), 409, 'Ya existe un programa llamado "auxiliar EN enfermeria".');
    expectError(await crearPrograma('Belleza', 'diplomado'), 400, 'El tipo debe ser programa técnico o curso corto.');
    expectError(await crearPrograma('   ', 'tecnico'), 400, 'El nombre del programa es obligatorio.');
    expectError(await crearPrograma('Sistemas', 'curso_corto', docTok), 403);
  });

  await test('programas: un colegio no puede tenerlos ni ver los de la corporación', async () => {
    expectError(
      await post('/programs', { institucion_id: world.inst.A.id, nombre: 'Belleza', tipo: 'tecnico' }, world.tokens.adminA),
      400, 'Los programas solo existen en las corporaciones.'
    );
    const visibles = (await get('/programs', world.tokens.adminA)).data;
    notOk(visibles.some(p => p.id === enfermeria.id), 'el colegio no ve programas ajenos');
  });

  // ---- Grupos ----------------------------------------------------------------

  await test('grupo = programa + jornada + nivel, con el nombre armado por la API', async () => {
    const r = await crearGrupo({ programa_id: enfermeria.id, jornada: 'noche', nivel: 1 });
    equal(r.status, 201, 'creado');
    grupoNoche = r.data;
    track(world, 'grades', r.data.id);
    equal(r.data.nombre, 'Auxiliar en Enfermería · Noche · Nivel 1', 'nombre automático');
    equal(r.data.tipo_grado, null, 'sin "tipo" de colegio');

    const m = await crearGrupo({ programa_id: enfermeria.id, jornada: 'manana', nivel: 1, nombre: 'ignorado' });
    grupoManana = m.data;
    track(world, 'grades', m.data.id);
    equal(m.data.nombre, 'Auxiliar en Enfermería · Mañana · Nivel 1', 'mismo programa en otra jornada');
  });

  await test('grupos: sin duplicados, nivel obligatorio en técnicos y sin nivel en cursos cortos', async () => {
    expectError(await crearGrupo({ programa_id: enfermeria.id, jornada: 'noche', nivel: 1 }), 409,
      'El grupo "Auxiliar en Enfermería · Noche · Nivel 1" ya existe.');
    expectError(await crearGrupo({ programa_id: enfermeria.id, jornada: 'noche' }), 400,
      'El nivel de un programa técnico debe ser un número entre 1 y 20.');
    expectError(await crearGrupo({ programa_id: enfermeria.id, jornada: 'madrugada', nivel: 1 }), 400,
      'Elige la jornada: mañana, tarde, noche o fin de semana.');
    const corto = await crearGrupo({ programa_id: maquillaje.id, jornada: 'fin_de_semana', nivel: 3 });
    equal(corto.status, 201, 'curso corto creado');
    track(world, 'grades', corto.data.id);
    equal(corto.data.nivel, null, 'el curso corto no guarda nivel');
    equal(corto.data.nombre, 'Maquillajes · Fin de semana', 'nombre sin nivel');
  });

  await test('los grados de un colegio no cambian y no aceptan datos de corporación', async () => {
    const normal = await post('/grades', { institucion_id: world.inst.A.id, nombre: `9no-${t}`, tipo_grado: 'B' }, world.tokens.adminA);
    equal(normal.status, 201, 'grado de colegio');
    track(world, 'grades', normal.data.id);
    equal(normal.data.nombre, `9no-${t}`, 'nombre tal cual');
    equal(normal.data.tipo_grado, 'B', 'tipo tal cual');
    expectError(
      await post('/grades', { institucion_id: world.inst.A.id, nombre: 'X', tipo_grado: 'A', jornada: 'noche' }, world.tokens.adminA),
      400, 'Programa, jornada y nivel solo aplican a las corporaciones.'
    );
  });

  await test('renombrar un programa renombra sus grupos; no se borra un programa con grupos', async () => {
    const r = await put(`/programs/${enfermeria.id}`, { nombre: 'Auxiliar de Enfermería' }, adminTok);
    equal(r.status, 200, 'renombrado');
    const g = (await get(`/grades/${grupoNoche.id}`, adminTok)).data;
    equal(g.nombre, 'Auxiliar de Enfermería · Noche · Nivel 1', 'el grupo tomó el nombre nuevo');
    expectError(await del(`/programs/${enfermeria.id}`, adminTok), 409,
      'No se puede eliminar el programa porque tiene 2 grupo(s). Desactívalo en su lugar.');
  });

  // ---- Semestres -------------------------------------------------------------

  await test('en una corporación los periodos son semestres 1 o 2 llamados "2027-1"', async () => {
    const r = await post('/academic_periods', {
      institucion_id: corp.id, nombre: 'cualquiera', numero: 1, anio: 2027,
      fecha_inicio: '2027-02-01', fecha_fin: '2027-06-30', activo: true,
    }, adminTok);
    equal(r.status, 201, 'semestre creado');
    semestre = r.data;
    track(world, 'academic_periods', r.data.id);
    equal(r.data.nombre, '2027-1', 'nombre del semestre');
    expectError(await post('/academic_periods', {
      institucion_id: corp.id, nombre: 'x', numero: 3, anio: 2027, fecha_inicio: '2027-07-01', fecha_fin: '2027-11-30',
    }, adminTok), 400, 'En una corporación el semestre debe ser 1 o 2.');
  });

  // ---- Módulo compartido -----------------------------------------------------

  await test('un módulo se comparte entre grupos y el docente califica en ambos', async () => {
    const modulo = (await post('/subjects', { institucion_id: corp.id, nombre: `Anatomía ${t}`, descripcion: 'x' }, adminTok)).data;
    track(world, 'subjects', modulo.id);
    for (const [est, grupo] of [[est1, grupoNoche], [est2, grupoManana]]) {
      const a = await post('/assignments', { profesor_id: docente.id, materia_id: modulo.id, grado_id: grupo.id, institucion_id: corp.id }, adminTok);
      equal(a.status, 201, `módulo asignado a ${grupo.nombre}`);
      track(world, 'assignments', a.data.id);
      const m = await post('/student_grades', { estudiante_id: est.id, grado_id: grupo.id }, adminTok);
      equal(m.status, 201, 'estudiante matriculado en su grupo');
      track(world, 'student_grades', m.data.id);
      const ev = (await post('/evaluations', {
        institucion_id: corp.id, materia_id: modulo.id, grado_id: grupo.id, nombre: 'Parcial', fecha_evaluacion: '2027-03-01',
        porcentaje: 50, periodo_id: semestre.id,
      }, docTok)).data;
      track(world, 'evaluations', ev.id);
      const nota = await post('/marks', {
        estudiante_id: est.id, materia_id: modulo.id, grado_id: grupo.id, evaluacion_id: ev.id,
        tipo_evaluacion: 'Parcial', fecha_evaluacion: '2027-03-01', porcentaje: 50, nota: 4.2,
      }, docTok);
      equal(nota.status, 201, `el docente califica en ${grupo.nombre}`);
      track(world, 'marks', nota.data.id);
    }
  });

  // ---- Certificados ----------------------------------------------------------

  const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
  const subir = (estudianteId, titulo, cuerpo, token, tipo = 'application/pdf') =>
    fetch(`${baseUrl()}/students/${estudianteId}/certificates?titulo=${encodeURIComponent(titulo)}`, {
      method: 'POST', headers: { 'Content-Type': tipo, Authorization: `Bearer ${token}` }, body: cuerpo,
    }).then(async r => ({ status: r.status, data: await r.json().catch(() => null) }));
  let certificado;

  await test('el admin sube un certificado PDF y solo el estudiante dueño lo ve y descarga', async () => {
    const r = await subir(est1.id, 'Certificado de estudios — Enfermería', PDF, adminTok);
    equal(r.status, 201, 'subido');
    certificado = r.data;
    equal(r.data.titulo, 'Certificado de estudios — Enfermería', 'título');
    notOk('archivo' in r.data, 'la respuesta no incluye el archivo');

    const propios = await get(`/students/${est1.id}/certificates`, est1Tok);
    equal(propios.data.length, 1, 'el estudiante ve su certificado');
    const descarga = await fetch(`${baseUrl()}/certificates/${certificado.id}/archivo`, { headers: { Authorization: `Bearer ${est1Tok}` } });
    equal(descarga.status, 200, 'descarga');
    equal(descarga.headers.get('content-type'), 'application/pdf', 'es PDF');
    equal(Buffer.from(await descarga.arrayBuffer()).subarray(0, 5).toString(), '%PDF-', 'contenido íntegro');

    expectError(await get(`/students/${est1.id}/certificates`, est2Tok), 404);
    const ajena = await fetch(`${baseUrl()}/certificates/${certificado.id}/archivo`, { headers: { Authorization: `Bearer ${est2Tok}` } });
    equal(ajena.status, 404, 'otro estudiante no lo descarga');
    expectError(await get(`/students/${est1.id}/certificates`, world.tokens.adminA), 404);
  });

  await test('certificados: solo PDF, con título, solo el admin sube y borra, solo corporaciones', async () => {
    equal((await subir(est1.id, 'Falso', Buffer.from('MZ ejecutable'), adminTok)).status, 400, 'no PDF');
    equal((await subir(est1.id, '  ', PDF, adminTok)).status, 400, 'sin título');
    equal((await subir(est1.id, 'X', PDF, docTok)).status, 403, 'el docente no sube');
    equal((await subir(est1.id, 'X', PDF, est1Tok)).status, 403, 'el estudiante no sube');
    equal((await subir(world.users.studentA.id, 'X', PDF, world.tokens.adminA)).status, 400, 'un colegio no tiene certificados');
    expectError(await del(`/certificates/${certificado.id}`, est1Tok), 404);
    equal((await del(`/certificates/${certificado.id}`, adminTok)).status, 200, 'el admin lo borra');
    equal((await get(`/students/${est1.id}/certificates`, est1Tok)).data.length, 0, 'ya no está');
  });

  await test('las "Notas boletín" de colegios no aplican a corporaciones', async () => {
    const asg = (await get('/assignments', adminTok)).data.find(a => a.grado_id === grupoNoche.id);
    expectError(await get(`/assignments/${asg.id}/period-final-grades`, adminTok), 400, 'Las notas de boletín no aplican a las corporaciones.');
    ok(true);
  });
}
