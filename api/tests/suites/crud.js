import { get, post, put, patch, del, loginStudent } from '../helpers/http.js';
import { track } from '../helpers/fixtures.js';
import { suite, test, equal, ok, notOk } from '../helpers/runner.js';

/** Ciclo CRUD genérico, saneado de columnas y manejo de la contraseña. */
export default async function crudSuite(world) {
  suite('CRUD genérico');

  await test('POST genera un id cuando no se envía', async () => {
    const res = await post('/grades', {
      institucion_id: world.inst.A.id, nombre: `Auto-${world.id}`, tipo_grado: 'C',
    }, world.tokens.adminA);
    equal(res.status, 201, 'status');
    ok(typeof res.data.id === 'string' && res.data.id.length > 0, 'debe generar un id');
    ok(res.data.id.length <= 8, 'el id generado no supera 8 caracteres');
    track(world, 'grades', res.data.id);
  });

  await test('POST respeta un id enviado explícitamente', async () => {
    const customId = `fix${world.id}`.slice(0, 12);
    const res = await post('/grades', {
      id: customId, institucion_id: world.inst.A.id, nombre: `Fijo-${world.id}`, tipo_grado: 'D',
    }, world.tokens.adminA);
    equal(res.status, 201, 'status');
    equal(res.data.id, customId, 'id conservado');
    track(world, 'grades', res.data.id);
  });

  await test('las columnas no declaradas se ignoran', async () => {
    const res = await post('/grades', {
      institucion_id: world.inst.A.id, nombre: `Extra-${world.id}`, tipo_grado: 'E',
      columna_inventada: 'valor', drop_table: 'x',
    }, world.tokens.adminA);
    equal(res.status, 201, 'status');
    notOk('columna_inventada' in res.data, 'la columna inventada no se persiste');
    track(world, 'grades', res.data.id);
  });

  await test('ciclo completo: crear, leer, actualizar (PUT y PATCH) y borrar', async () => {
    const creado = (await post('/grades', {
      institucion_id: world.inst.A.id, nombre: `Ciclo-${world.id}`, tipo_grado: 'F',
    }, world.tokens.adminA)).data;

    const lista = await get('/grades', world.tokens.adminA);
    ok(lista.data.some(g => g.id === creado.id), 'aparece en el listado');

    const porId = await get(`/grades/${creado.id}`, world.tokens.adminA);
    equal(porId.status, 200, 'GET por id');
    equal(porId.data.nombre, `Ciclo-${world.id}`, 'nombre');

    const actualizado = await put(`/grades/${creado.id}`, {
      institucion_id: world.inst.A.id, nombre: 'Renombrado', tipo_grado: 'F',
    }, world.tokens.adminA);
    equal(actualizado.status, 200, 'PUT status');
    equal(actualizado.data.nombre, 'Renombrado', 'nombre actualizado');

    const parcheado = await patch(`/grades/${creado.id}`, { nombre: 'Parcheado' }, world.tokens.adminA);
    equal(parcheado.status, 200, 'PATCH status');
    equal(parcheado.data.nombre, 'Parcheado', 'PATCH actualiza el campo');
    equal(parcheado.data.tipo_grado, 'F', 'PATCH no pisa otros campos');

    const borrado = await del(`/grades/${creado.id}`, world.tokens.adminA);
    equal(borrado.status, 200, 'DELETE status');
    equal(borrado.data.id, creado.id, 'DELETE devuelve la fila borrada');

    equal((await get(`/grades/${creado.id}`, world.tokens.adminA)).status, 404, 'ya no existe');
  });

  await test('PUT sobre un id inexistente devuelve 404', async () => {
    const res = await put('/grades/no-existe', { nombre: 'X' }, world.tokens.adminA);
    equal(res.status, 404, 'status');
    equal(res.data.error, 'Recurso no encontrado.', 'mensaje');
  });

  await test('PATCH sobre un id inexistente devuelve 404', async () => {
    equal((await patch('/grades/no-existe', { nombre: 'X' }, world.tokens.adminA)).status, 404, 'status');
  });

  await test('DELETE sobre un id inexistente devuelve 404', async () => {
    equal((await del('/grades/no-existe', world.tokens.adminA)).status, 404, 'status');
  });

  await test('el listado sale ordenado por id', async () => {
    const res = await get('/grades', world.tokens.super);
    const ids = res.data.map(g => g.id);
    const ordenados = [...ids].sort();
    equal(JSON.stringify(ids), JSON.stringify(ordenados), 'orden por id');
  });

  await test('crear un usuario nunca devuelve la contraseña', async () => {
    const res = await post('/users', {
      email: `pwd${world.id}@test.local`, password: 'secreto123', rol: 'student',
      nombre: 'P', apellido: 'W', institucion_id: world.inst.A.id, activo: true,
      tipo_documento: 'TI', identificacion: `IDPWD${world.id}`,
    }, world.tokens.adminA);
    equal(res.status, 201, 'status');
    notOk('password' in res.data, 'la respuesta no trae password');
    track(world, 'users', res.data.id);
  });

  await test('la contraseña se guarda hasheada y permite iniciar sesión', async () => {
    const email = `hash${world.id}@test.local`;
    const creado = (await post('/users', {
      email, password: 'clave-original', rol: 'student', nombre: 'H', apellido: 'A',
      institucion_id: world.inst.A.id, activo: true, tipo_documento: 'CC',
      identificacion: `IDHASH${world.id}`,
    }, world.tokens.adminA)).data;
    track(world, 'users', creado.id);

    const sesion = await loginStudent(`IDHASH${world.id}`, 'clave-original');
    equal(sesion.user.id, creado.id, 'inicia sesión con la contraseña original');
  });

  await test('actualizar la contraseña la vuelve a hashear', async () => {
    const email = `rehash${world.id}@test.local`;
    const creado = (await post('/users', {
      email, password: 'primera', rol: 'student', nombre: 'R', apellido: 'H',
      institucion_id: world.inst.A.id, activo: true, tipo_documento: 'TI',
      identificacion: `IDREH${world.id}`,
    }, world.tokens.adminA)).data;
    track(world, 'users', creado.id);

    const res = await put(`/users/${creado.id}`, { password: 'segunda' }, world.tokens.adminA);
    equal(res.status, 200, 'status');
    notOk('password' in res.data, 'la respuesta no trae password');

    const sesion = await loginStudent(`IDREH${world.id}`, 'segunda');
    equal(sesion.user.id, creado.id, 'inicia sesión con la contraseña nueva');
  });

  await test('enviar password vacío en un update no borra la contraseña', async () => {
    const email = `vacio${world.id}@test.local`;
    const creado = (await post('/users', {
      email, password: 'inicial', rol: 'student', nombre: 'V', apellido: 'A',
      institucion_id: world.inst.A.id, activo: true, tipo_documento: 'PPT',
      identificacion: `IDVAC${world.id}`,
    }, world.tokens.adminA)).data;
    track(world, 'users', creado.id);

    await put(`/users/${creado.id}`, { password: '', nombre: 'Vacio' }, world.tokens.adminA);
    const sesion = await loginStudent(`IDVAC${world.id}`, 'inicial');
    equal(sesion.user.nombre, 'Vacio', 'el nombre sí cambió y la contraseña sigue siendo válida');
  });

  // [DEFECTO CONOCIDO — pendiente de decisión del propietario]
  // updateRow() devuelve la fila sin sanear cuando no hay columnas que
  // actualizar, filtrando el hash de la contraseña. Este test congela el
  // comportamiento ACTUAL para que el refactor no lo altere por accidente.
  // Debe invertirse en cuanto se apruebe la corrección.
  await test('[defecto conocido] un PUT sin columnas válidas devuelve la fila sin sanear', async () => {
    const res = await put(`/users/${world.users.studentA.id}`, {}, world.tokens.adminA);
    equal(res.status, 200, 'status');
    ok('password' in res.data, 'comportamiento actual: expone el hash (defecto a corregir)');
  });
}
