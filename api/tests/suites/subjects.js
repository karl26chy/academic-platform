import { get, post, put } from '../helpers/http.js';
import { track } from '../helpers/fixtures.js';
import { suite, test, equal, ok, expectError } from '../helpers/runner.js';

/**
 * Materias por institución:
 *  · super admin crea materias para cualquier institución;
 *  · el admin crea materias que quedan en SU institución (nunca confía en el
 *    institucion_id del body) y no puede crear/editar materias ajenas;
 *  · el GET está aislado por institución.
 */
export default async function subjectsSuite(world) {
  suite('Materias por institución');

  const su = world.tokens.super;
  const { A: instA, B: instB } = world.inst;

  await test('super admin crea una materia para la institución A', async () => {
    const res = await post('/subjects', { nombre: `MatA ${world.id}`, descripcion: 'x', institucion_id: instA.id }, su);
    equal(res.status, 201, 'status');
    equal(res.data.institucion_id, instA.id, 'asociada a A');
    track(world, 'subjects', res.data.id);
  });

  await test('super admin crea una materia para la institución B', async () => {
    const res = await post('/subjects', { nombre: `MatB ${world.id}`, descripcion: 'x', institucion_id: instB.id }, su);
    equal(res.status, 201, 'status');
    equal(res.data.institucion_id, instB.id, 'asociada a B');
    track(world, 'subjects', res.data.id);
  });

  await test('crear una materia sin institución devuelve 400', async () => {
    expectError(await post('/subjects', { nombre: `Sin ${world.id}` }, su), 400, 'Falta institucion_id.');
  });

  await test('admin A no puede crear una materia apuntando a otra institución', async () => {
    expectError(
      await post('/subjects', { nombre: `Forzada ${world.id}`, institucion_id: instB.id }, world.tokens.adminA),
      403
    );
  });

  await test('el GET de materias está aislado por institución', async () => {
    const a = (await get('/subjects', world.tokens.adminA)).data;
    const b = (await get('/subjects', world.tokens.adminB)).data;
    ok(a.every(s => s.institucion_id === instA.id), 'A solo ve materias de A');
    ok(b.every(s => s.institucion_id === instB.id), 'B solo ve materias de B');
    const idsA = a.map(s => s.id);
    const idsB = b.map(s => s.id);
    ok(!idsA.some(id => idsB.includes(id)), 'A y B no comparten materias');
  });

  await test('el super admin ve materias de todas las instituciones', async () => {
    const all = (await get('/subjects', su)).data;
    ok(all.some(s => s.institucion_id === instA.id), 've materias de A');
    ok(all.some(s => s.institucion_id === instB.id), 've materias de B');
  });

  await test('admin A no puede editar una materia de B', async () => {
    const matB = (await post('/subjects', { nombre: `MatB2 ${world.id}`, institucion_id: instB.id }, su)).data;
    track(world, 'subjects', matB.id);
    expectError(
      await put(`/subjects/${matB.id}`, { nombre: 'X', institucion_id: instB.id }, world.tokens.adminA),
      403
    );
  });
}
