import type { AcademicPeriod } from '../types';

const collator = new Intl.Collator('es', { sensitivity: 'base' });

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
  /** Apellido del estudiante; usado para desempate por orden alfabético. */
  apellido?: string;
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
 * (promedio, luego apellido, luego nombre, luego id) para que el orden no
 * cambie entre renders.
 */
function compareByPromedio(a: AcademicStatus, b: AcademicStatus): number {
  const pa = a.promedio ?? 0;
  const pb = b.promedio ?? 0;
  if (pa !== pb) return pa - pb;
  const byApellido = collator.compare(a.apellido ?? '', b.apellido ?? '');
  if (byApellido !== 0) return byApellido;
  const byNombre = collator.compare(a.nombre, b.nombre);
  if (byNombre !== 0) return byNombre;
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

export type AcademicTrackingStatus =
  | 'Buen rendimiento'
  | 'En seguimiento'
  | 'Requiere atención'
  | 'Sin notas';

/**
 * Helper centralizado para determinar el estado académico de un estudiante
 * respetando la escala de la institución (escala_maxima y nota_minima_aprobacion).
 */
export function getStudentAcademicStatus(
  promedio: number | null | undefined,
  escalaMaxima: number = 5,
  notaMinima?: number
): AcademicTrackingStatus {
  if (promedio === null || promedio === undefined || !Number.isFinite(promedio)) {
    return 'Sin notas';
  }
  const maxScale = Number(escalaMaxima) || 5;
  const k = maxScale / 5;
  const minPassing =
    notaMinima !== undefined && Number.isFinite(notaMinima)
      ? Number(notaMinima)
      : 3.0 * k;
  const highThreshold = Math.max(4.0 * k, minPassing + 0.5 * k);

  if (promedio >= highThreshold) {
    return 'Buen rendimiento';
  }
  if (promedio >= minPassing) {
    return 'En seguimiento';
  }
  return 'Requiere atención';
}

/** Devuelve las clases CSS del badge correspondiente al estado académico. */
export function academicStatusBadgeClass(status: AcademicTrackingStatus): string {
  switch (status) {
    case 'Buen rendimiento':
      return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    case 'En seguimiento':
      return 'bg-amber-100 text-amber-700 border border-amber-200';
    case 'Requiere atención':
      return 'bg-red-100 text-red-700 border border-red-200';
    case 'Sin notas':
    default:
      return 'bg-gray-100 text-gray-600 border border-gray-200';
  }
}

