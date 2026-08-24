import { post } from '../helpers/http.js';
import { track } from '../helpers/fixtures.js';
import { suite, test, equal, expectError } from '../helpers/runner.js';

/**
 * Registro de estudiantes:
 *  · correo, EPS, tipo de sangre y contacto de emergencia son OPCIONALES;
 *  · la identificación es OBLIGATORIA para estudiantes.
 */
export default async function studentsSuite(world) {
  suite('Registro de estudiantes');

  const su = world.tokens.super;
  const instA = world.inst.A.id;

  const base = {
    password: world.password,
    rol: 'student',
    nombre: 'Alu',
    apellido: 'Test',
    institucion_id: instA,
    tipo_documento: 'TI',
    activo: true,
  };

  await test('se crea un estudiante sin correo', async () => {
    const res = await post('/users', { ...base, identificacion: `S1${world.id}` }, su);
    equal(res.status, 201, 'status');
    equal(res.data.email, null, 'email queda vacío');
    track(world, 'users', res.data.id);
  });

  await test('se crea un estudiante sin EPS', async () => {
    const res = await post('/users', { ...base, email: `s2.${world.id}@t.local`, identificacion: `S2${world.id}` }, su);
    equal(res.status, 201, 'status');
    track(world, 'users', res.data.id);
  });

  await test('se crea un estudiante sin tipo de sangre', async () => {
    const res = await post('/users', { ...base, email: `s3.${world.id}@t.local`, identificacion: `S3${world.id}` }, su);
    equal(res.status, 201, 'status');
    track(world, 'users', res.data.id);
  });

  await test('se crea un estudiante sin contacto de emergencia', async () => {
    const res = await post('/users', { ...base, email: `s4.${world.id}@t.local`, identificacion: `S4${world.id}` }, su);
    equal(res.status, 201, 'status');
    track(world, 'users', res.data.id);
  });

  await test('un estudiante sin identificación devuelve 400', async () => {
    expectError(
      await post('/users', { ...base, email: `s5.${world.id}@t.local` }, su),
      400,
      'Identificación requerida para estudiantes.'
    );
  });
}
