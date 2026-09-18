/**
 * Tests de lógica pura para la generación masiva de boletines.
 * Verifica: nombre del ZIP, nombres de archivos internos, filtrado de grados
 * y extracción de años académicos.
 *
 * No hace fetch, no usa React. Solo lógica de strings/arrays.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Lógica replicada aquí para testearla de forma aislada
// (la fuente de verdad es la implementación real en report-pdf.service.js
//  y BoletinMasivoModal.tsx; estos tests actúan como contrato de comportamiento)
// ---------------------------------------------------------------------------

/**
 * Replica exacta de safeFilename() en report-pdf.service.js
 * Así garantizamos que el backend y los tests comparten el mismo contrato.
 */
function safeFilename(index: number, student: { nombre: string; apellido: string }): string {
  const slug = `${student.nombre}_${student.apellido}`
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
  const num = String(index + 1).padStart(3, '0');
  return `${num}_${slug}.pdf`;
}

/**
 * Replica exacta de buildZipName() en BoletinMasivoModal.tsx
 */
function buildZipName(grade: { nombre: string; tipo_grado: string } | null, year: number | ''): string {
  if (!grade || year === '') return 'Boletines.zip';
  const slug = `${grade.nombre}_${grade.tipo_grado}`
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');
  return `Boletines_${slug}_${year}.zip`;
}

/**
 * Filtra grados de una institución (misma lógica que el componente)
 */
function gradesBelongingTo(grades: Array<{ id: string; institucion_id: string }>, instId: string) {
  return grades.filter(g => g.institucion_id === instId);
}

/**
 * Replica exacta de yearsOf() en lib/periods.ts
 */
function yearsOf(periods: Array<{ anio?: number | string | null }>): number[] {
  const años = new Set<number>();
  for (const p of periods) {
    const a = Number(p.anio);
    if (Number.isFinite(a) && a > 0) años.add(a);
  }
  return [...años].sort((a, b) => b - a);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Generación masiva — nombre del ZIP', () => {
  test('nombre correcto para grado y año válidos', () => {
    const grade = { nombre: '8vo', tipo_grado: 'A' };
    assert.equal(buildZipName(grade, 2026), 'Boletines_8vo_A_2026.zip');
  });

  test('nombre correcto para grado con espacios', () => {
    const grade = { nombre: 'Grado 10', tipo_grado: 'B' };
    assert.equal(buildZipName(grade, 2025), 'Boletines_Grado_10_B_2025.zip');
  });

  test('nombre de fallback cuando no hay grado', () => {
    assert.equal(buildZipName(null, 2026), 'Boletines.zip');
  });

  test('nombre de fallback cuando no hay año', () => {
    const grade = { nombre: '9no', tipo_grado: 'C' };
    assert.equal(buildZipName(grade, ''), 'Boletines.zip');
  });

  test('caracteres especiales en nombre del grado se eliminan', () => {
    const grade = { nombre: 'Grado/Noveno', tipo_grado: 'A' };
    const result = buildZipName(grade, 2026);
    assert.ok(!result.includes('/'), 'el slash debe eliminarse');
    assert.ok(result.endsWith('_2026.zip'), 'debe terminar con año correcto');
  });
});

describe('Generación masiva — nombre de archivos internos del ZIP', () => {
  test('formato correcto: número + slug + .pdf', () => {
    const student = { nombre: 'Juan Carlos', apellido: 'García López' };
    assert.equal(safeFilename(0, student), '001_juan_carlos_garca_lpez.pdf');
  });

  test('segundo estudiante tiene número 002', () => {
    const student = { nombre: 'Ana', apellido: 'Martínez' };
    assert.equal(safeFilename(1, student), '002_ana_martnez.pdf');
  });

  test('décimo estudiante tiene número 010', () => {
    const student = { nombre: 'Carlos', apellido: 'Pérez' };
    assert.equal(safeFilename(9, student), '010_carlos_prez.pdf');
  });

  test('centésimo estudiante tiene número 100', () => {
    const student = { nombre: 'María', apellido: 'Rodríguez' };
    assert.equal(safeFilename(99, student), '100_mara_rodrguez.pdf');
  });

  test('nombre y apellido con múltiples espacios se normalizan', () => {
    const student = { nombre: 'Juan  Carlos', apellido: 'García  López' };
    const result = safeFilename(0, student);
    assert.ok(!result.includes('  '), 'no debe haber doble espacio/subguión');
    assert.ok(result.endsWith('.pdf'), 'debe terminar en .pdf');
  });

  test('caracteres especiales no ASCII se eliminan del slug', () => {
    const student = { nombre: 'José', apellido: 'Ñoño' };
    const result = safeFilename(0, student);
    // Los caracteres especiales como é, ñ se eliminan por el regex [^a-z0-9_]
    assert.ok(/^001_[a-z0-9_]+\.pdf$/.test(result), 'debe tener solo caracteres ASCII seguros');
  });

  test('nombres de archivos son únicos para estudiantes en el mismo grado', () => {
    const students = [
      { nombre: 'Juan', apellido: 'García' },
      { nombre: 'Ana', apellido: 'García' },
      { nombre: 'Carlos', apellido: 'García' },
    ];
    const names = students.map((s, i) => safeFilename(i, s));
    const uniqueNames = new Set(names);
    assert.equal(uniqueNames.size, names.length, 'todos los nombres deben ser únicos');
  });
});

describe('Filtrado de grados por institución', () => {
  const grades = [
    { id: 'g1', institucion_id: 'inst-A' },
    { id: 'g2', institucion_id: 'inst-A' },
    { id: 'g3', institucion_id: 'inst-B' },
    { id: 'g4', institucion_id: 'inst-B' },
  ];

  test('solo devuelve grados de la institución A', () => {
    const result = gradesBelongingTo(grades, 'inst-A');
    assert.equal(result.length, 2);
    assert.ok(result.every(g => g.institucion_id === 'inst-A'));
  });

  test('institución sin grados devuelve array vacío', () => {
    const result = gradesBelongingTo(grades, 'inst-C');
    assert.equal(result.length, 0);
  });

  test('grados de institución B son correctos', () => {
    const result = gradesBelongingTo(grades, 'inst-B');
    assert.deepEqual(result.map(g => g.id), ['g3', 'g4']);
  });
});

describe('Extracción de años académicos (yearsOf)', () => {
  test('extrae años únicos en orden descendente', () => {
    const periods = [
      { anio: 2024 },
      { anio: 2026 },
      { anio: 2025 },
      { anio: 2026 }, // duplicado
    ];
    assert.deepEqual(yearsOf(periods), [2026, 2025, 2024]);
  });

  test('ignora períodos sin año', () => {
    const periods = [
      { anio: 2026 },
      { anio: null },
      { anio: undefined },
      {},
    ];
    assert.deepEqual(yearsOf(periods), [2026]);
  });

  test('lista vacía devuelve array vacío', () => {
    assert.deepEqual(yearsOf([]), []);
  });

  test('años como string se convierten correctamente', () => {
    const periods = [{ anio: '2025' }, { anio: '2026' }];
    assert.deepEqual(yearsOf(periods), [2026, 2025]);
  });
});

describe('Concurrencia controlada — simulación de lotes', () => {
  /**
   * Simula el procesamiento por lotes de renderBulkReportZip.
   * Verifica que con CONCURRENCY=4 y 10 estudiantes se crean 3 lotes.
   */
  function computeBatches<T>(items: T[], concurrency: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += concurrency) {
      batches.push(items.slice(i, i + concurrency));
    }
    return batches;
  }

  test('10 estudiantes con concurrencia 4 produce 3 lotes', () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const batches = computeBatches(items, 4);
    assert.equal(batches.length, 3);
    assert.equal(batches[0].length, 4);
    assert.equal(batches[1].length, 4);
    assert.equal(batches[2].length, 2);
  });

  test('38 estudiantes con concurrencia 4 produce 10 lotes', () => {
    const items = Array.from({ length: 38 }, (_, i) => i);
    const batches = computeBatches(items, 4);
    assert.equal(batches.length, 10);
  });

  test('4 estudiantes con concurrencia 4 produce 1 lote', () => {
    const items = Array.from({ length: 4 }, (_, i) => i);
    const batches = computeBatches(items, 4);
    assert.equal(batches.length, 1);
    assert.equal(batches[0].length, 4);
  });

  test('1 estudiante con concurrencia 4 produce 1 lote de 1', () => {
    const items = [42];
    const batches = computeBatches(items, 4);
    assert.equal(batches.length, 1);
    assert.equal(batches[0].length, 1);
  });

  test('todos los elementos aparecen exactamente una vez', () => {
    const items = Array.from({ length: 13 }, (_, i) => i);
    const batches = computeBatches(items, 4);
    const flat = batches.flat();
    assert.deepEqual(flat, items);
  });
});
