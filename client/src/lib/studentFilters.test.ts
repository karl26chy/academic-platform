import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_FILTERS,
  applyStudentFilters,
  countActiveFilters,
  hasActiveFilters,
  type StudentFilters,
} from './studentFilters.ts';
import { getAge } from './people.ts';
import type { StudentGrade, User } from '../types';

const u = (over: Partial<User>): User => ({
  id: 'u1',
  email: 'u1@test.local',
  rol: 'student',
  nombre: 'Nombre',
  apellido: 'Apellido',
  genero: 'masculino',
  fecha_nacimiento: '2010-06-01',
  institucion_id: 'inst',
  activo: true,
  ...over,
});

const sg = (estudiante_id: string, grado_id: string): StudentGrade => ({
  id: `${estudiante_id}-${grado_id}`,
  estudiante_id,
  grado_id,
});

/** Edades derivadas de la fecha real (independiente del año en que corra el test). */
const edadAna = getAge('2010-06-01');
const edadCarla = getAge('2012-06-01');

// Ana (femenino, ~2 años menor que Beto y ~2 mayor que Carla), Beto (masculino), Carla (femenino).
const estudiantes = [
  u({ id: 'ana', nombre: 'Ana', genero: 'femenino', fecha_nacimiento: '2010-06-01' }),
  u({ id: 'beto', nombre: 'Beto', genero: 'masculino', fecha_nacimiento: '2008-06-01' }),
  u({ id: 'carla', nombre: 'Carla', genero: 'femenino', fecha_nacimiento: '2012-06-01' }),
];

// Matrículas: Ana y Beto en 1A; Carla en 1B.
const matriculas = [
  sg('ana', 'g1a'),
  sg('beto', 'g1a'),
  sg('carla', 'g1b'),
];

const ids = (users: User[]) => users.map(x => x.id).sort();

describe('applyStudentFilters (AND)', () => {
  test('1) sin filtros aparecen todos', () => {
    assert.deepEqual(ids(applyStudentFilters(estudiantes, matriculas, EMPTY_FILTERS)), ['ana', 'beto', 'carla']);
  });

  test('2) solo género: femenino', () => {
    const f: StudentFilters = { ...EMPTY_FILTERS, genero: 'femenino' };
    assert.deepEqual(ids(applyStudentFilters(estudiantes, matriculas, f)), ['ana', 'carla']);
  });

  test('3) solo edad: mínima = edad de Ana', () => {
    const f: StudentFilters = { ...EMPTY_FILTERS, edadMin: edadAna };
    // Ana (edadAna) y Beto (mayor); Carla (menor) queda fuera.
    assert.deepEqual(ids(applyStudentFilters(estudiantes, matriculas, f)), ['ana', 'beto']);
    assert.ok(edadAna > edadCarla, 'precondición: Ana > Carla');
  });

  test('4) solo grado: 1A', () => {
    const f: StudentFilters = { ...EMPTY_FILTERS, gradoId: 'g1a' };
    assert.deepEqual(ids(applyStudentFilters(estudiantes, matriculas, f)), ['ana', 'beto']);
  });

  test('5) género + grado → AND', () => {
    const f: StudentFilters = { ...EMPTY_FILTERS, genero: 'femenino', gradoId: 'g1a' };
    assert.deepEqual(ids(applyStudentFilters(estudiantes, matriculas, f)), ['ana']);
  });

  test('6) género + edad → AND', () => {
    const f: StudentFilters = { ...EMPTY_FILTERS, genero: 'femenino', edadMin: edadAna };
    assert.deepEqual(ids(applyStudentFilters(estudiantes, matriculas, f)), ['ana']);
  });

  test('7) edad + grado → AND', () => {
    const f: StudentFilters = { ...EMPTY_FILTERS, edadMin: edadAna, gradoId: 'g1a' };
    assert.deepEqual(ids(applyStudentFilters(estudiantes, matriculas, f)), ['ana', 'beto']);
  });

  test('8) género + edad + grado → AND', () => {
    const f: StudentFilters = { ...EMPTY_FILTERS, genero: 'femenino', edadMin: edadAna, gradoId: 'g1a' };
    assert.deepEqual(ids(applyStudentFilters(estudiantes, matriculas, f)), ['ana']);
  });

  test('9) limpiar filtros → todos de nuevo', () => {
    assert.deepEqual(ids(applyStudentFilters(estudiantes, matriculas, EMPTY_FILTERS)), ['ana', 'beto', 'carla']);
  });

  test('12) 1A y 1B no se mezclan aunque compartan grado general', () => {
    const en1a = ids(applyStudentFilters(estudiantes, matriculas, { ...EMPTY_FILTERS, gradoId: 'g1a' }));
    const en1b = ids(applyStudentFilters(estudiantes, matriculas, { ...EMPTY_FILTERS, gradoId: 'g1b' }));
    assert.deepEqual(en1a, ['ana', 'beto']);
    assert.deepEqual(en1b, ['carla']);
    assert.ok(!en1a.includes('carla'), 'carla (1B) no aparece en 1A');
  });

  test('13) combinación sin resultados → lista vacía', () => {
    const f: StudentFilters = { ...EMPTY_FILTERS, genero: 'masculino', gradoId: 'g1b' };
    assert.deepEqual(applyStudentFilters(estudiantes, matriculas, f), []);
  });
});

describe('countActiveFilters / hasActiveFilters', () => {
  test('14) contador de criterios activos (género, edad, grado)', () => {
    assert.equal(countActiveFilters(EMPTY_FILTERS), 0);
    assert.equal(countActiveFilters({ ...EMPTY_FILTERS, genero: 'masculino' }), 1);
    assert.equal(countActiveFilters({ ...EMPTY_FILTERS, genero: 'masculino', gradoId: 'g1a' }), 2);
    assert.equal(
      countActiveFilters({ ...EMPTY_FILTERS, genero: 'femenino', edadMin: edadAna, gradoId: 'g1a' }),
      3
    );
    // La edad (mínimo y/o máximo) cuenta como un solo criterio.
    assert.equal(countActiveFilters({ ...EMPTY_FILTERS, edadMin: edadAna, edadMax: edadAna + 2 }), 1);
    assert.equal(hasActiveFilters(EMPTY_FILTERS), false);
    assert.equal(hasActiveFilters({ ...EMPTY_FILTERS, gradoId: 'g1a' }), true);
  });
});

