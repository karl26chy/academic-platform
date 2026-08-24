import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLoginPayload } from './loginPayload.ts';

describe('buildLoginPayload', () => {
  test('clasifica un correo sin espacios como email', () => {
    assert.deepEqual(buildLoginPayload('usuario@correo.com', 'secreta'), {
      email: 'usuario@correo.com',
      password: 'secreta',
    });
  });

  test('recorta espacios alrededor del correo', () => {
    assert.deepEqual(buildLoginPayload('  usuario@correo.com  ', 'secreta'), {
      email: 'usuario@correo.com',
      password: 'secreta',
    });
  });

  test('clasifica una identificación sin @ como identificacion', () => {
    assert.deepEqual(buildLoginPayload('123456', 'secreta'), {
      identificacion: '123456',
      password: 'secreta',
    });
  });

  test('recorta espacios alrededor de la identificación', () => {
    assert.deepEqual(buildLoginPayload('  123456  ', 'secreta'), {
      identificacion: '123456',
      password: 'secreta',
    });
  });

  test('una identificación alfanumérica se mantiene como texto', () => {
    assert.deepEqual(buildLoginPayload(' ID 12345-A ', 'secreta'), {
      identificacion: 'ID 12345-A',
      password: 'secreta',
    });
  });

  test('no modifica la contraseña (mayúsculas y espacios se respetan)', () => {
    assert.deepEqual(buildLoginPayload('  usuario@correo.com  ', '  Pass Word 1 '), {
      email: 'usuario@correo.com',
      password: '  Pass Word 1 ',
    });
  });
});