import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { compareStudents, sortStudents, studentFullName } from './people.ts';

const s = (apellido: string, nombre: string, id = '0') => ({
  id, apellido, nombre, email: '', rol: 'student' as const, institucion_id: null, activo: true,
});

describe('studentFullName', () => {
  test('Caso 1: García López, Juan Carlos se muestra completo', () => {
    const student = s('García López', 'Juan Carlos', '1');
    assert.equal(studentFullName(student), 'García López, Juan Carlos');
  });

  test('Caso 2: Álvarez Rodríguez, María Fernanda se muestra completo', () => {
    const student = s('Álvarez Rodríguez', 'María Fernanda', '2');
    assert.equal(studentFullName(student), 'Álvarez Rodríguez, María Fernanda');
  });

  test('Devuelve cadena vacía para null/undefined', () => {
    assert.equal(studentFullName(null), '');
  });
});

describe('compareStudents / sortStudents', () => {
  test('Caso 3: Dos estudiantes con García López se ordenan por Andrés Felipe antes de Juan Carlos', () => {
    const input = [
      s('García López', 'Juan Carlos', '2'),
      s('García López', 'Andrés Felipe', '1'),
    ];
    const result = sortStudents(input);
    assert.deepEqual(result.map(x => x.nombre), ['Andrés Felipe', 'Juan Carlos']);
    assert.deepEqual(result.map(x => studentFullName(x)), [
      'García López, Andrés Felipe',
      'García López, Juan Carlos',
    ]);
  });

  test('Caso 4: Mismo apellido y nombre desempata por id ASC', () => {
    const input = [
      s('García López', 'Juan Carlos', 'z99'),
      s('García López', 'Juan Carlos', 'a01'),
    ];
    const result = sortStudents(input);
    assert.deepEqual(result.map(x => x.id), ['a01', 'z99']);
  });

  test('compareStudents devuelve resultado negativo, cero o positivo', () => {
    const a = s('Álvarez', 'Carlos', '1');
    const b = s('García', 'Carlos', '2');
    assert.ok(compareStudents(a, b) < 0);
    assert.ok(compareStudents(b, a) > 0);
    assert.equal(compareStudents(a, a), 0);
  });

  test('Caso 5: Las listas pasan correctamente por sortStudents manteniendo orden completo', () => {
    const input = [
      s('Gómez Pérez', 'Carlos Andrés', '4'),
      s('García López', 'Juan Carlos', '3'),
      s('García López', 'Andrés Felipe', '2'),
      s('Álvarez Rodríguez', 'María Fernanda', '1'),
    ];
    const result = sortStudents(input);
    assert.deepEqual(result.map(x => studentFullName(x)), [
      'Álvarez Rodríguez, María Fernanda',
      'García López, Andrés Felipe',
      'García López, Juan Carlos',
      'Gómez Pérez, Carlos Andrés',
    ]);
  });

  test('ordena por apellido ASC (primer apellido y segundo apellido)', () => {
    const input = [
      s('Rodríguez Santos', 'María', '3'),
      s('Álvarez Gómez', 'Carlos', '1'),
      s('García López', 'Pedro', '2'),
    ];
    const result = sortStudents(input);
    assert.deepEqual(result.map(x => x.apellido), ['Álvarez Gómez', 'García López', 'Rodríguez Santos']);
  });

  test('insensible a mayúsculas/minúsculas y acentos', () => {
    const input = [
      s('ALVAREZ', 'A', '3'),
      s('álvarez', 'B', '2'),
      s('Álvarez', 'C', '1'),
    ];
    const result = sortStudents(input);
    assert.deepEqual(result.map(x => x.nombre), ['A', 'B', 'C']);
  });

  test('sortStudents no muta el array original', () => {
    const input = [
      s('García', 'Pedro', '2'),
      s('Álvarez', 'Carlos', '1'),
    ];
    const snapshot = [...input];
    const result = sortStudents(input);
    assert.ok(result !== input, 'debe devolver una copia nueva');
    assert.deepEqual(input.map(x => x.id), snapshot.map(x => x.id));
  });
});
