import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUBJECT_PALETTE,
  getSubjectColor,
  normalizeSubjectName,
  subjectColorOf,
} from './subjectColors.ts';

describe('normalizeSubjectName', () => {
  test('minúsculas, sin acentos y sin espacios extra', () => {
    assert.equal(normalizeSubjectName(' MATEMÁTICAS '), 'matematicas');
    assert.equal(normalizeSubjectName('Ciencias Naturales'), 'ciencias naturales');
  });

  test('trata null/undefined como vacío', () => {
    assert.equal(normalizeSubjectName(undefined as unknown as string), '');
    assert.equal(normalizeSubjectName(''), '');
  });
});

describe('getSubjectColor: misma materia, mismo color', () => {
  test('llamadas repetidas devuelven el mismo color', () => {
    assert.equal(getSubjectColor('Matemáticas'), getSubjectColor('Matemáticas'));
  });

  test('mayúsculas/minúsculas no cambian el color', () => {
    assert.equal(getSubjectColor('Matemáticas'), getSubjectColor('MATEMÁTICAS'));
    assert.equal(getSubjectColor('Matemáticas'), getSubjectColor('matemáticas'));
  });

  test('espacios alrededor no cambian el color', () => {
    assert.equal(getSubjectColor('Matemáticas'), getSubjectColor('  Matemáticas  '));
  });

  test('acentos no cambian el color', () => {
    assert.equal(getSubjectColor('Inglés'), getSubjectColor('Ingles'));
  });
});

describe('getSubjectColor: materias conocidas', () => {
  const esperado = [
    ['Matemáticas', '#2563eb'],
    ['Lengua Castellana', '#dc2626'],
    ['Ciencias Naturales', '#16a34a'],
    ['Inglés', '#9333ea'],
    ['Ciencias Sociales', '#ea580c'],
    ['Educación Física', '#ca8a04'],
    ['Artística', '#db2777'],
    ['Tecnología', '#0d9488'],
  ] as const;

  test('cada materia conocida usa su color asignado', () => {
    for (const [nombre, color] of esperado) {
      assert.equal(getSubjectColor(nombre), color, `esperado ${color} para ${nombre}`);
    }
  });

  test('materias distintas reciben colores distintos', () => {
    const colores = new Set(esperado.map(([nombre]) => getSubjectColor(nombre)));
    assert.equal(colores.size, esperado.length, 'todas las materias conocidas tienen color propio');
  });

  test('"Ciencias Sociales" (naranja) no es "Ciencias Naturales" (verde)', () => {
    assert.notEqual(getSubjectColor('Ciencias Sociales'), getSubjectColor('Ciencias Naturales'));
  });
});

describe('getSubjectColor: materias desconocidas', () => {
  test('color determinístico a partir del nombre (sin aleatoriedad)', () => {
    const a = getSubjectColor('Filosofía');
    const b = getSubjectColor('Filosofía');
    assert.equal(a, b);
  });

  test('misma materia desconocida conserva el color en llamadas posteriores', () => {
    const primero = getSubjectColor('Robótica');
    const segundo = getSubjectColor('Robótica');
    assert.equal(primero, segundo);
  });

  test('variantes de escritura de una desconocida resuelven al mismo color', () => {
    assert.equal(getSubjectColor('Robótica'), getSubjectColor('ROBÓTICA'));
    assert.equal(getSubjectColor('Robótica'), getSubjectColor('  robotica  '));
  });

  test('el color de una desconocida pertenece a la paleta', () => {
    const c = getSubjectColor('Materia Desconocida XYZ');
    assert.ok(SUBJECT_PALETTE.includes(c), `${c} debe pertenecer a la paleta`);
  });
});

describe('subjectColorOf', () => {
  test('resuelve colores de la paleta para entradas no mapeadas', () => {
    const c = subjectColorOf('filosofia');
    assert.ok(SUBJECT_PALETTE.includes(c));
  });
});
