import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boletinChoices,
  periodLabel,
  periodsOfYear,
  yearsOf,
  type PeriodLike,
} from './periods.ts';

const periodos: PeriodLike[] = [
  { id: 'p1-25', numero: 1, nombre: 'Periodo 1', anio: 2025 },
  { id: 'p2-25', numero: 2, nombre: 'Periodo 2', anio: 2025 },
  { id: 'p3-25', numero: 3, nombre: 'Periodo 3', anio: 2025 },
  { id: 'p4-25', numero: 4, nombre: 'Periodo 4', anio: 2025 },
  { id: 'p1-26', numero: 1, nombre: 'Primer periodo', anio: 2026 },
  { id: 'p2-26', numero: 2, nombre: 'Periodo 2', anio: 2026 },
];

describe('yearsOf', () => {
  test('años únicos, ordenados descendente y sin duplicados', () => {
    assert.deepEqual(yearsOf(periodos), [2026, 2025]);
  });

  test('sin períodos devuelve lista vacía', () => {
    assert.deepEqual(yearsOf([]), []);
  });

  test('ignora períodos sin año', () => {
    assert.deepEqual(yearsOf([{ id: 'x', numero: 1, anio: null }]), []);
  });
});

describe('periodsOfYear', () => {
  test('2026 solo trae los períodos de 2026, ordenados por número', () => {
    const r = periodsOfYear(periodos, 2026);
    assert.deepEqual(r.map(p => p.id), ['p1-26', 'p2-26']);
  });

  test('2025 trae los cuatro períodos en orden numérico (no alfabético)', () => {
    const r = periodsOfYear(periodos, 2025);
    assert.deepEqual(r.map(p => p.id), ['p1-25', 'p2-25', 'p3-25', 'p4-25']);
  });
});

describe('boletinChoices', () => {
  test('2025 ofrece sus períodos reales + "Todos los períodos — 2025"', () => {
    const c = boletinChoices(periodos, 2025);
    assert.equal(c.length, 5);
    assert.equal(c[0].type, 'period');
    assert.equal(c[0].periodId, 'p1-25');
    assert.equal(c[4].type, 'all');
    assert.equal(c[4].label, 'Todos los períodos — 2025');
    assert.ok(c.filter(x => x.type === 'period').every(x => x.periodId?.startsWith('p') && x.periodId.includes('-25')));
  });

  test('2026 ofrece solo sus 2 períodos y su opción "Todos los períodos"', () => {
    const c = boletinChoices(periodos, 2026);
    assert.equal(c.length, 3);
    assert.equal(c[0].periodId, 'p1-26');
    assert.equal(c[1].periodId, 'p2-26');
    assert.equal(c[2].label, 'Todos los períodos — 2026');
  });

  test('no mezcla años: ninguna opción de 2026 pertenece a 2025', () => {
    const c = boletinChoices(periodos, 2026);
    assert.ok(c.filter(x => x.type === 'period').every(x => x.periodId?.includes('-26')));
  });
});

describe('periodLabel', () => {
  test('etiqueta con número, nombre y año', () => {
    assert.equal(periodLabel({ numero: 1, nombre: 'Primer periodo', anio: 2026 }), 'Periodo 1 — Primer periodo — 2026');
  });

  test('sin repetir "Periodo X" cuando el nombre coincide con el número', () => {
    assert.equal(periodLabel({ numero: 1, nombre: 'Periodo 1', anio: 2026 }), 'Periodo 1 — 2026');
  });
});
