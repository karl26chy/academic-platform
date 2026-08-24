import type { Mark } from '../types';

/**
 * Cálculo de promedios académicos.
 *
 * Regla de negocio: el promedio es ponderado por el porcentaje de cada
 * evaluación — Σ(nota × porcentaje) / Σ(porcentaje). Si ninguna evaluación
 * tiene porcentaje se cae al promedio aritmético simple.
 */

export interface WeightedMark {
  nota: number;
  porcentaje?: number;
}

export function weightedAverage(marks: WeightedMark[]): number {
  if (marks.length === 0) return 0;

  const totalWeighted = marks.reduce((acc, m) => acc + m.nota * (m.porcentaje || 0), 0);
  const totalWeight = marks.reduce((acc, m) => acc + (m.porcentaje || 0), 0);

  const avg =
    totalWeight > 0
      ? totalWeighted / totalWeight
      : marks.reduce((acc, m) => acc + m.nota, 0) / marks.length;

  return Number(avg.toFixed(2));
}

/** Agrupa notas por materia conservando el orden de aparición. */
export function groupBySubject(marks: Mark[]): Map<string, Mark[]> {
  const grouped = new Map<string, Mark[]>();
  for (const mark of marks) {
    const bucket = grouped.get(mark.materia_id);
    if (bucket) {
      bucket.push(mark);
    } else {
      grouped.set(mark.materia_id, [mark]);
    }
  }
  return grouped;
}

export interface SubjectAverage {
  materiaId: string;
  promedio: number;
  evaluaciones: number;
}

/** Promedio ponderado por materia, en el orden en que aparecen las notas. */
export function averageBySubject(marks: Mark[]): SubjectAverage[] {
  return [...groupBySubject(marks)].map(([materiaId, subjectMarks]) => ({
    materiaId,
    promedio: weightedAverage(subjectMarks),
    evaluaciones: subjectMarks.length,
  }));
}

export const isPassing = (promedio: number, notaMinima: number): boolean =>
  promedio >= notaMinima;

/** Escala de calificación de una institución (tope máximo de la nota). */
export const maxScoreFor = (institution?: { escala_maxima?: number; tipo?: string } | null): number => {
  if (institution?.escala_maxima) return Number(institution.escala_maxima);
  return institution?.tipo === 'universidad' ? 5 : 10;
};

/** Etiqueta de la escala, p. ej. "1-10". */
export const scaleLabel = (escala?: number | null): string =>
  `1-${escala ?? 10}`;
