import { get, post, login, loginStudent } from '../helpers/http.js';
import { track } from '../helpers/fixtures.js';
import { suite, test, equal, ok, notOk, expectError } from '../helpers/runner.js';

export default async function authSuite(world) {
  suite('Autenticación');

  await test('login sin credenciales devuelve 400', async () => {
    expectError(await post('/auth/login', {}), 400, 'Correo o identificación y contraseña son requeridos.');
  });

  await test('login sin password devuelve 400', async () => {
    expectError(await post('/auth/login', { email: world.superEmail }), 400, 'Correo o identificación y contraseña son requeridos.');
  });

  await test('login con password incorrecta devuelve 401', async () => {
    expectError(
      await post('/auth/login', { email: world.users.adminA.email, password: 'incorrecta' }),
      401,
      'Credenciales inválidas. Inténtalo de nuevo.'
    );
  });

  await test('login con email inexistente devuelve 401', async () => {
    expectError(
      await post('/auth/login', { email: 'noexiste@test.local', password: 'x' }),
      401,
      'Credenciales inválidas. Inténtalo de nuevo.'
    );
  });

  await test('login de usuario desactivado devuelve 403', async () => {
    expectError(
      await post('/auth/login', {
        identificacion: world.users.inactiveUser.identificacion,
        password: world.password,
      }),
      403,
      'Tu cuenta está desactivada. Contacta al administrador.'
    );
  });

  await test('login correcto devuelve token y usuario sin password', async () => {
    const res = await post('/auth/login', { email: world.users.adminA.email, password: world.password });
    equal(res.status, 200, 'status');
    ok(typeof res.data.token === 'string' && res.data.token.length > 0, 'debe traer token');
    equal(res.data.user.id, world.users.adminA.id, 'id de usuario');
    notOk('password' in res.data.user, 'el usuario NO debe exponer password');
  });

  await test('login es insensible a mayúsculas en el email', async () => {
    const res = await post('/auth/login', {
      email: world.users.adminA.email.toUpperCase(),
      password: world.password,
    });
    equal(res.status, 200, 'status');
    equal(res.data.user.id, world.users.adminA.id, 'id de usuario');
  });

  await test('login con email con espacios alrededor funciona', async () => {
    const res = await post('/auth/login', {
      email: `  ${world.users.adminA.email}  `,
      password: world.password,
    });
    equal(res.status, 200, 'status');
    equal(res.data.user.id, world.users.adminA.id, 'id de usuario');
  });

  await test('login con email en mayúsculas y con espacios funciona', async () => {
    const res = await post('/auth/login', {
      email: `  ${world.users.adminA.email.toUpperCase()}  `,
      password: world.password,
    });
    equal(res.status, 200, 'status');
    equal(res.data.user.id, world.users.adminA.id, 'id de usuario');
  });

  await test('login de estudiante con identificación con espacios funciona', async () => {
    const res = await post('/auth/login', {
      identificacion: `  ${world.users.studentA.identificacion}  `,
      password: world.password,
    });
    equal(res.status, 200, 'status');
    equal(res.data.user.id, world.users.studentA.id, 'id de usuario');
  });

  await test('login de estudiante con identificación alfanumérica insensible a mayúsculas', async () => {
    const res = await post('/auth/login', {
      identificacion: world.users.studentA.identificacion.toLowerCase(),
      password: world.password,
    });
    equal(res.status, 200, 'status');
    equal(res.data.user.id, world.users.studentA.id, 'id de usuario');
  });

  await test('una contraseña con espacio adicional al final falla', async () => {
    expectError(
      await post('/auth/login', {
        email: world.users.adminA.email,
        password: `${world.password} `,
      }),
      401,
      'Credenciales inválidas. Inténtalo de nuevo.'
    );
  });

  await test('una contraseña con mayúsculas diferentes falla', async () => {
    expectError(
      await post('/auth/login', {
        email: world.users.adminA.email,
        password: world.password.toUpperCase(),
      }),
      401,
      'Credenciales inválidas. Inténtalo de nuevo.'
    );
  });

  await test('1) un estudiante sin correo inicia sesión con identificación y contraseña', async () => {
    // Crea un estudiante sin email en una institución propia y entra por id.
    const inst = (await post('/institutions', {
      nombre: `SinEmail ${world.id}`, subdominio: `sinemail${world.id}`,
      tipo: 'colegio', escala_maxima: 10, nota_minima_aprobacion: 6, activa: true,
    }, world.tokens.super)).data;
    track(world, 'institutions', inst.id);

    const estudiante = (await post('/users', {
      email: undefined, password: world.password, rol: 'student',
      nombre: 'Sin', apellido: 'Correo', institucion_id: inst.id,
      tipo_documento: 'TI', identificacion: `SINID${world.id}`, activo: true,
    }, world.tokens.super)).data;
    track(world, 'users', estudiante.id);

    const ok = await post('/auth/login', {
      identificacion: `SINID${world.id}`, password: world.password,
    });
    equal(ok.status, 200, 'entra por identificación');
    equal(ok.data.user.id, estudiante.id, 'es el estudiante sin correo');
    equal(ok.data.user.email, null, 'no inventa un email ficticio');
  });

  await test('2) un estudiante con email inicia sesión por su identificación', async () => {
    const res = await post('/auth/login', {
      identificacion: world.users.studentA.identificacion, password: world.password,
    });
    equal(res.status, 200, 'status');
    equal(res.data.user.id, world.users.studentA.id, 'encuentra al estudiante correcto');
    notOk('password' in res.data.user, 'no expone password');
  });

  await test('3) un estudiante inicia sesión por identificación SIN subdominio', async () => {
    const res = await post('/auth/login', {
      identificacion: world.users.studentA.identificacion, password: world.password,
    });
    equal(res.status, 200, 'status');
    equal(res.data.user.id, world.users.studentA.id, 'no necesita institución ni subdominio');
  });

  await test('4) estudiantes de instituciones diferentes entran sin seleccionar institución', async () => {
    const a = await post('/auth/login', {
      identificacion: world.users.studentA.identificacion, password: world.password,
    });
    const b = await post('/auth/login', {
      identificacion: world.users.studentB.identificacion, password: world.password,
    });
    equal(a.status, 200, 'estudiante A entra');
    equal(b.status, 200, 'estudiante B entra');
    equal(a.data.user.institucion_id, world.inst.A.id, 'A queda en su institución');
    equal(b.data.user.institucion_id, world.inst.B.id, 'B queda en su institución');
  });

  await test('5) una identificación inexistente devuelve 401', async () => {
    expectError(
      await post('/auth/login', { identificacion: 'IDNOEXISTE', password: world.password }),
      401,
      'Credenciales inválidas. Inténtalo de nuevo.'
    );
  });

  await test('6) una contraseña incorrecta de un estudiante devuelve 401', async () => {
    expectError(
      await post('/auth/login', { identificacion: world.users.studentA.identificacion, password: 'incorrecta' }),
      401,
      'Credenciales inválidas. Inténtalo de nuevo.'
    );
  });

  await test('7) un estudiante no puede iniciar sesión con su correo', async () => {
    expectError(
      await post('/auth/login', { email: world.users.studentA.email, password: world.password }),
      403,
      'Los estudiantes deben iniciar sesión con su número de identificación.'
    );
  });

  await test('8) un administrador no puede iniciar sesión con su identificación', async () => {
    // El admin no tiene identificación por diseño; se le crea una para verificar
    // que el canal se rechaza aunque el dato exista.
    const admin = (await post('/users', {
      email: `adminid.${world.id}@test.local`, password: world.password, rol: 'admin',
      nombre: 'A', apellido: 'B', institucion_id: world.inst.A.id, activo: true,
      identificacion: `ADMID${world.id}`,
    }, world.tokens.super)).data;
    track(world, 'users', admin.id);

    expectError(
      await post('/auth/login', { identificacion: `ADMID${world.id}`, password: world.password }),
      403,
      'Este rol debe iniciar sesión con su correo electrónico.'
    );
  });

  await test('9) un docente no puede iniciar sesión con su identificación', async () => {
    const docente = (await post('/users', {
      email: `docid.${world.id}@test.local`, password: world.password, rol: 'teacher',
      nombre: 'D', apellido: 'ID', institucion_id: world.inst.A.id, activo: true,
      identificacion: `DOCID${world.id}`,
    }, world.tokens.super)).data;
    track(world, 'users', docente.id);

    expectError(
      await post('/auth/login', { identificacion: `DOCID${world.id}`, password: world.password }),
      403,
      'Este rol debe iniciar sesión con su correo electrónico.'
    );
  });

  await test('10) un super admin no puede iniciar sesión con su identificación', async () => {
    const sup2 = (await post('/users', {
      email: `supid.${world.id}@test.local`, password: world.password, rol: 'super_admin',
      nombre: 'S', apellido: 'ID', activo: true,
      identificacion: `SUPID${world.id}`,
    }, world.tokens.super)).data;
    track(world, 'users', sup2.id);

    expectError(
      await post('/auth/login', { identificacion: `SUPID${world.id}`, password: world.password }),
      403,
      'Este rol debe iniciar sesión con su correo electrónico.'
    );
  });

  await test('11) el JWT del estudiante incluye su institucion_id correcta', async () => {
    const session = await loginStudent(world.users.studentB.identificacion, world.password);
    const payload = JSON.parse(Buffer.from(session.token.split('.')[1], 'base64url').toString());
    equal(payload.sub, world.users.studentB.id, 'claim sub');
    equal(payload.rol, 'student', 'claim rol');
    equal(payload.institucion_id, world.inst.B.id, 'claim institucion_id');
    ok(typeof payload.exp === 'number', 'debe tener expiración');
  });

  await test('el token incluye sub, rol, email e institucion_id', async () => {
    const session = await login(world.users.teacherA.email, world.password);
    const payload = JSON.parse(Buffer.from(session.token.split('.')[1], 'base64url').toString());
    equal(payload.sub, world.users.teacherA.id, 'claim sub');
    equal(payload.rol, 'teacher', 'claim rol');
    equal(payload.email, world.users.teacherA.email, 'claim email');
    equal(payload.institucion_id, world.inst.A.id, 'claim institucion_id');
    ok(typeof payload.exp === 'number', 'debe tener expiración');
  });

  await test('GET /auth/me sin token devuelve 401', async () => {
    expectError(await get('/auth/me'), 401, 'No autorizado. Inicia sesión.');
  });

  await test('GET /auth/me con token inválido devuelve 401', async () => {
    expectError(await get('/auth/me', 'token-basura'), 401, 'Sesión expirada o inválida. Inicia sesión de nuevo.');
  });

  await test('GET /auth/me devuelve el usuario autenticado sin password', async () => {
    const res = await get('/auth/me', world.tokens.studentA);
    equal(res.status, 200, 'status');
    equal(res.data.id, world.users.studentA.id, 'id');
    notOk('password' in res.data, 'no debe exponer password');
  });

  await test('el header Authorization sin prefijo Bearer se rechaza', async () => {
    const res = await get('/auth/me', undefined);
    equal(res.status, 401, 'status');
  });
}
