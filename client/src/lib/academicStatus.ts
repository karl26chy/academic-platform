import type { AcademicPeriod } from '../types';

/**
 * Clasificación académica del resumen institucional (admin).
 *
 * NO calcula promedios: el promedio acumulado (promedioGeneralDefinitivo) y la
 * banda de desempeño (desempenoGlobal) provienen SIEMPRE del reporte anual del
 * backend (getStudentYearReport), que respeta la lógica acumulativa de períodos
 * cerrados + período actual sin inventar ceros. Aquí solo se clasifica y se
 * agrupa con los mismos criterios del boletín.
 *
 * Selección POR CURSO (gradeId): cada curso (1A, 1B, 1C…) tiene sus propios
 * 3 peores y 3 mejores promedios. No se mezclan cursos, no se filtra por nota
 * mínima ni por banda de desempeño; solo por promedioGeneralDefinitivo.
 */

export interface AcademicStatus {
  studentId: string;
  nombre: string;
  gradeId: string | null;
  gradeNombre: string;
  /** Promedio acumulado del año (promedioGeneralDefinitivo); null = sin datos. */
  promedio: number | null;
  /** Banda S/A/B/Z del boletín (desempenoGlobal); null = sin datos. */
  desempeno: string | null;
  /** Asistencia como indicador informativo (no determina riesgo). */
  asistenciaTasa: number | null;
  ausentes: number;
}

/** Año académico a analizar: el del período abierto, si no el mayor existente. */
export function academicYearFromPeriods(periods: AcademicPeriod[]): number | null {
  if (periods.length === 0) return null;
  const abierto = periods.find(p => p.activo);
  if (abierto) return Number(abierto.anio);
  const años = periods
    .map(p => Number(p.anio))
    .filter(a => Number.isFinite(a));
  return años.length ? Math.max(...años) : null;
}

export interface GradeGroup<T> {
  gradeId: string | null;
  gradeNombre: string;
  items: T[];
}

/** Agrupa por grado real (etiqueta existente, sin hardcodear grados). */
export function groupByGrade<T extends Pick<AcademicStatus, 'gradeId' | 'gradeNombre'>>(
  items: T[]
): GradeGroup<T>[] {
  const map = new Map<string, GradeGroup<T>>();
  for (const item of items) {
    const key = item.gradeId ?? '__sin_grado__';
    let group = map.get(key);
    if (!group) {
      group = { gradeId: item.gradeId, gradeNombre: item.gradeNombre || 'Sin asignar', items: [] };
      map.set(key, group);
    }
    group.items.push(item);
  }
  return [...map.values()].sort((a, b) =>
    a.gradeNombre.localeCompare(b.gradeNombre, 'es', { numeric: true })
  );
}

/**
 * Comparador de estudiantes por promedio con desempate DETERMINÍSTICO
 * (promedio, luego nombre, luego id) para que el orden no cambie entre renders.
 */
function compareByPromedio(a: AcademicStatus, b: AcademicStatus): number {
  const pa = a.promedio ?? 0;
  const pb = b.promedio ?? 0;
  if (pa !== pb) return pa - pb;
  if (a.nombre !== b.nombre) return a.nombre.localeCompare(b.nombre, 'es');
  return (a.studentId ?? '').localeCompare(b.studentId ?? '');
}

/** Agrupa, filtra promedios válidos, ordena y corta a `limit` por curso. */
function selectPerCourse(
  statuses: AcademicStatus[],
  limit: number,
  sortFn: (a: AcademicStatus, b: AcademicStatus) => number
): GradeGroup<AcademicStatus>[] {
  return groupByGrade(statuses)
    .map(g => ({
      ...g,
      items: g.items
        .filter(s => s.promedio !== null && s.promedio !== undefined)
        .sort(sortFn)
        .slice(0, limit),
    }))
    .filter(g => g.items.length > 0);
}

/**
 * Los `limit` estudiantes con MENOR promedio de cada curso (gradeId).
 * Excluye promedios null. NO usa nota_minima_aprobacion.
 */
export function selectWorstPerCourse(
  statuses: AcademicStatus[],
  limit = 3
): GradeGroup<AcademicStatus>[] {
  return selectPerCourse(statuses, limit, compareByPromedio);
}

/**
 * Los `limit` estudiantes con MAYOR promedio de cada curso (gradeId).
 * Excluye promedios null. NO depende de la banda de desempeño.
 */
export function selectBestPerCourse(
  statuses: AcademicStatus[],
  limit = 3
): GradeGroup<AcademicStatus>[] {
  return selectPerCourse(statuses, limit, (a, b) => compareByPromedio(b, a));
}
