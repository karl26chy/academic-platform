import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  academicYearFromPeriods,
  groupByGrade,
  selectBestPerCourse,
  selectWorstPerCourse,
  type AcademicStatus,
} from './academicStatus.ts';
import type { AcademicPeriod } from '../types';

const periodo = (over: Partial<AcademicPeriod>): AcademicPeriod => ({
  id: 'p',
  institucion_id: 'inst',
  nombre: 'Periodo 1',
  numero: 1,
  anio: 2026,
  fecha_inicio: '2026-01-01',
  fecha_fin: '2026-03-31',
  activo: false,
  ...over,
});

describe('academicYearFromPeriods', () => {
  test('prioriza el año del período abierto', () => {
    const periods = [
      periodo({ numero: 1, anio: 2025, activo: false }),
      periodo({ id: 'p2', numero: 2, anio: 2026, activo: true }),
    ];
    assert.equal(academicYearFromPeriods(periods), 2026);
  });

  test('sin abierto usa el año mayor existente', () => {
    const periods = [
      periodo({ numero: 1, anio: 2025, activo: false }),
      periodo({ id: 'p2', numero: 2, anio: 2026, activo: false }),
    ];
    assert.equal(academicYearFromPeriods(periods), 2026);
  });

  test('sin períodos devuelve null', () => {
    assert.equal(academicYearFromPeriods([]), null);
  });
});

const st = (over: Partial<AcademicStatus>): AcademicStatus => ({
  studentId: 's',
  nombre: 'Estudiante',
  gradeId: 'g1a',
  gradeNombre: '1° "A"',
  promedio: 3.0,
  desempeno: 'B',
  asistenciaTasa: 90,
  ausentes: 2,
  ...over,
});

describe('selección POR CURSO: 3 peores y 3 mejores', () => {
  test('1) curso con más de 6 estudiantes selecciona exactamente 3 peores y 3 mejores', () => {
    const promedios = [2.1, 2.5, 2.8, 3.2, 4.1, 4.8, 3.0, 3.5];
    const curso = promedios.map((p, i) => st({ studentId: `s${i}`, nombre: `E${i}`, promedio: p }));

    const peores = selectWorstPerCourse(curso)[0].items;
    assert.deepEqual(peores.map(s => s.promedio), [2.1, 2.5, 2.8]);

    const mejores = selectBestPerCourse(curso)[0].items;
    assert.deepEqual(mejores.map(s => s.promedio), [4.8, 4.1, 3.5]);
  });

  test('2) curso con 5 estudiantes selecciona 3+3; el mediano puede coincidir en ambos grupos', () => {
    const promedios = [2.1, 2.5, 3.0, 4.1, 4.8];
    const curso = promedios.map((p, i) => st({ studentId: `s${i}`, nombre: `E${i}`, promedio: p }));

    const peores = selectWorstPerCourse(curso)[0].items;
    const mejores = selectBestPerCourse(curso)[0].items;

    assert.deepEqual(peores.map(s => s.studentId), ['s0', 's1', 's2']);
    assert.deepEqual(mejores.map(s => s.studentId), ['s4', 's3', 's2']);
    const enAmbos = peores.filter(p => mejores.some(m => m.studentId === p.studentId));
    assert.deepEqual(enAmbos.map(s => s.studentId), ['s2'], 'el mediano aparece en ambos grupos');
  });

  test('3) curso con menos de 3 estudiantes devuelve todos los disponibles', () => {
    const curso = [st({ studentId: 'unico', nombre: 'Único', promedio: 2.4 })];
    assert.equal(selectWorstPerCourse(curso)[0].items.length, 1);
    assert.equal(selectBestPerCourse(curso)[0].items.length, 1);
    assert.equal(selectWorstPerCourse(curso)[0].items[0].studentId, 'unico');
  });

  test('4) 1A, 1B y 1C no se mezclan (mismo nombre de grado, distinto gradeId)', () => {
    const mk = (gradeId: string, tipo: string) =>
      [2.1, 2.4, 3.0, 3.5, 4.0].map((p, i) =>
        st({ studentId: `${gradeId}-s${i}`, gradeId, gradeNombre: `1° "${tipo}"`, promedio: p })
      );
    const curso = [...mk('g1a', 'A'), ...mk('g1b', 'B'), ...mk('g1c', 'C')];

    const grupos = selectWorstPerCourse(curso);
    assert.equal(grupos.length, 3, 'tres cursos separados');
    for (const g of grupos) {
      assert.ok(g.items.every(s => s.gradeId === g.gradeId), `grupo ${g.gradeId} sin mezcla`);
      assert.equal(g.items.length, 3);
    }
  });

  test('5) instituciones distintas no mezclan estudiantes', () => {
    const mk = (inst: string) =>
      [2.2, 3.0, 3.8, 4.5].map((p, i) =>
        st({ studentId: `${inst}-s${i}`, gradeId: `${inst}-g1a`, gradeNombre: '1° "A"', promedio: p })
      );
    const curso = [...mk('instA'), ...mk('instB')];

    const grupos = selectBestPerCourse(curso);
    assert.equal(grupos.length, 2, 'dos grupos por institución (gradeId distinto)');
    assert.ok(grupos.every(g => g.items.every(s => s.gradeId === g.gradeId)));
  });

  test('6) estudiantes con promedio null no participan', () => {
    const curso = [
      st({ studentId: 'con1', promedio: 2.0 }),
      st({ studentId: 'sin1', promedio: null }),
      st({ studentId: 'con2', promedio: 4.5 }),
      st({ studentId: 'sin2', promedio: null }),
    ];
    const ids = (sels: ReturnType<typeof selectWorstPerCourse>) =>
      sels[0]?.items.map(s => s.studentId) ?? [];
    // Los dos con promedio válido (hay menos de 3) aparecen en ambos paneles.
    assert.deepEqual(ids(selectWorstPerCourse(curso)), ['con1', 'con2']);
    assert.deepEqual(ids(selectBestPerCourse(curso)), ['con2', 'con1']);
  });

  test('7) la selección usa exclusivamente promedio (promedioGeneralDefinitivo del año report)', () => {
    // Alta nota con banda null → aparece como destacado; baja nota con banda S → aparece en peores.
    const curso = [
      st({ studentId: 'alto', promedio: 4.9, desempeno: null }),
      st({ studentId: 'bajo', promedio: 1.8, desempeno: 'S' }),
      st({ studentId: 'medio', promedio: 3.0, desempeno: 'B' }),
    ];
    const mejores = selectBestPerCourse(curso)[0].items.map(s => s.studentId);
    const peores = selectWorstPerCourse(curso)[0].items.map(s => s.studentId);
    assert.deepEqual(mejores, ['alto', 'medio', 'bajo']);
    assert.deepEqual(peores, ['bajo', 'medio', 'alto']);
  });

  test('8) empates: desempate determinístico por nombre/id y resultado estable', () => {
    const curso = [
      st({ studentId: 'x', nombre: 'Zoe', promedio: 3.0 }),
      st({ studentId: 'y', nombre: 'Ana', promedio: 3.0 }),
      st({ studentId: 'z', nombre: 'Luis', promedio: 3.0 }),
    ];
    const primero = selectWorstPerCourse(curso)[0].items.map(s => s.nombre);
    const segundo = selectWorstPerCourse(curso)[0].items.map(s => s.nombre);
    assert.deepEqual(primero, ['Ana', 'Luis', 'Zoe'], 'ordenado por nombre en caso de empate');
    assert.deepEqual(primero, segundo, 'estable entre llamadas');
  });

  test('9) la selección no depende de nota_minima_aprobacion', () => {
    const curso = [5.5, 6.0, 6.5, 7.0].map((p, i) =>
      st({ studentId: `s${i}`, nombre: `E${i}`, promedio: p })
    );
    const peores = selectWorstPerCourse(curso)[0].items.map(s => s.promedio);
    // Con nota mínima 6.0, 6.0 y 6.5 estarían "aprobados", pero aun así son los 3 más bajos.
    assert.deepEqual(peores, [5.5, 6.0, 6.5]);
  });

  test('10) destacados no dependen de la banda de desempeño', () => {
    const curso = [
      st({ studentId: 's-bandas', nombre: 'BandaS', promedio: 3.0, desempeno: 'S' }),
      st({ studentId: 's4', nombre: 'E4', promedio: 4.5, desempeno: 'A' }),
      st({ studentId: 's5', nombre: 'E5', promedio: 4.8, desempeno: null }),
      st({ studentId: 's6', nombre: 'E6', promedio: 4.9, desempeno: 'B' }),
    ];
    const mejores = selectBestPerCourse(curso)[0].items.map(s => s.studentId);
    assert.deepEqual(mejores, ['s6', 's5', 's4'], 'los 3 más altos por promedio, sin mirar la banda');
    assert.ok(!mejores.includes('s-bandas'), 'banda S con promedio bajo NO es destacado');
  });
});

describe('groupByGrade', () => {
  test('agrupa por gradeId y ordena por etiqueta', () => {
    const grupos = groupByGrade([
      st({ studentId: 'a', gradeId: 'g10', gradeNombre: '10° "A"' }),
      st({ studentId: 'b', gradeId: 'g6', gradeNombre: '6° "A"' }),
      st({ studentId: 'c', gradeId: 'g6', gradeNombre: '6° "A"' }),
    ]);
    assert.equal(grupos.length, 2);
    assert.equal(grupos[0].gradeNombre, '6° "A"');
    assert.equal(grupos[0].items.length, 2);
  });
});
