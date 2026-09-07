import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { compareStudents, sortStudents } from './people.ts';

const s = (apellido: string, nombre: string, id = '0') => ({ id, apellido, nombre, email: '', rol: 'student' as const, institucion_id: null, activo: true });

describe('compareStudents / sortStudents', () => {
  test('1) ordena por apellido ASC', () => {
    const input = [
      s('Rodríguez', 'María', '3'),
      s('Álvarez', 'Carlos', '1'),
      s('García', 'Pedro', '2'),
    ];
    const result = sortStudents(input);
    assert.deepEqual(result.map(x => x.apellido), ['Álvarez', 'García', 'Rodríguez']);
  });

  test('2) mismo apellido ordena por nombre ASC', () => {
    const input = [
      s('García', 'Pedro', '3'),
      s('García', 'Carlos', '1'),
      s('García', 'Juan', '2'),
    ];
    const result = sortStudents(input);
    assert.deepEqual(result.map(x => x.nombre), ['Carlos', 'Juan', 'Pedro']);
  });

  test('3) mismo apellido y nombre ordena por id ASC', () => {
    const input = [
      s('García', 'Juan', 'z99'),
      s('García', 'Juan', 'a01'),
    ];
    const result = sortStudents(input);
    assert.deepEqual(result.map(x => x.id), ['a01', 'z99']);
  });

  test('4) insensible a mayúsculas/minúsculas', () => {
    const input = [
      s('ALVAREZ', 'A', '3'),
      s('álvarez', 'B', '2'),
      s('Álvarez', 'C', '1'),
    ];
    const result = sortStudents(input);
    // Todos los apellidos son equivalentes → ordena por nombre
    assert.deepEqual(result.map(x => x.nombre), ['A', 'B', 'C']);
  });

  test('5) insensible a tildes/acentos', () => {
    const input = [
      s('Alvarez', 'Ana', '1'),
      s('Álvarez', 'Ana', '2'),
    ];
    const result = sortStudents(input);
    // Con sensitivity: 'base', Alvarez === Álvarez → desempate por id
    assert.deepEqual(result.map(x => x.id), ['1', '2']);
  });

  test('6) compareStudents devuelve negativo, cero o positivo (no exactamente -1/1)', () => {
    const a = s('Álvarez', 'Carlos', '1');
    const b = s('García', 'Carlos', '2');

    const cmp = compareStudents(a, b);
    assert.ok(cmp < 0, 'Álvarez < García');

    assert.ok(compareStudents(b, a) > 0, 'García > Álvarez');
    assert.equal(compareStudents(a, a), 0, 'iguales');
  });

  test('7) sortStudents no muta el array original', () => {
    const input = [
      s('García', 'Pedro', '2'),
      s('Álvarez', 'Carlos', '1'),
    ];
    const snapshot = [...input];
    const result = sortStudents(input);

    // No es la misma referencia
    assert.ok(result !== input, 'debe devolver una copia nueva');
    // El original permanece sin modificar
    assert.deepEqual(input.map(x => x.id), snapshot.map(x => x.id));
  });
});
