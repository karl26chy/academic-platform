import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { leerListaPegada, nombreGrupo, vocabulario } from './corporacion.ts';
import { gradeLabel } from './people.ts';
import { periodLabel } from './periods.ts';

describe('leerListaPegada', () => {
  test('quita la numeración y las líneas vacías', () => {
    const r = leerListaPegada('1. Auxiliar Administrativo\n\n2) Recursos Humanos\n- Belleza\n   \n10.Sistemas', []);
    assert.deepEqual(r.map(l => l.nombre), ['Auxiliar Administrativo', 'Recursos Humanos', 'Belleza', 'Sistemas']);
    assert.ok(r.every(l => !l.repetido));
  });

  test('marca repetidos contra el catálogo y dentro de la lista, sin importar tildes ni mayúsculas', () => {
    const r = leerListaPegada('Auxiliar en Enfermeria\nMaquillajes\nmaquillajes', ['Auxiliar en Enfermería']);
    assert.deepEqual(r.map(l => l.repetido), [true, false, true]);
  });
});

describe('nombreGrupo', () => {
  test('técnico con semestre y curso corto sin semestre', () => {
    assert.equal(nombreGrupo({ nombre: 'Auxiliar en Enfermería' }, 'noche', 2), 'Auxiliar en Enfermería · Noche · Semestre 2');
    assert.equal(nombreGrupo({ nombre: 'Maquillajes' }, 'fin_de_semana', null), 'Maquillajes · Fin de semana');
  });
});

describe('vocabulario', () => {
  test('el colegio conserva el de siempre; la corporación usa módulos, grupos y semestres', () => {
    const c = vocabulario({ tipo: 'colegio' });
    assert.deepEqual([c.materia, c.grado, c.periodo], ['Materia', 'Grado', 'Periodo']);
    const k = vocabulario({ tipo: 'corporacion' });
    assert.deepEqual([k.materia, k.grado, k.periodo], ['Módulo', 'Grupo', 'Semestre']);
  });
});

describe('etiquetas en corporaciones sin cambiar las de colegios', () => {
  test('gradeLabel: colegio 6to "A"; grupo solo con su nombre', () => {
    const base = { id: '1', institucion_id: 'i' };
    assert.equal(gradeLabel({ ...base, nombre: '6to', tipo_grado: 'A' }), '6to "A"');
    assert.equal(gradeLabel({ ...base, nombre: 'Belleza · Noche · Semestre 1', tipo_grado: null }), 'Belleza · Noche · Semestre 1');
  });

  test('periodLabel: periodo de colegio igual que antes; semestre "2027-1"', () => {
    assert.equal(periodLabel({ numero: 4, nombre: 'Periodo 4', anio: 2026 }), 'Periodo 4 — 2026');
    assert.equal(periodLabel({ numero: 1, nombre: '2027-1', anio: 2027 }), 'Semestre 2027-1');
  });
});
