import type { StudentGrade, User } from '../types';
import { getAge } from './people.ts';

/**
 * Filtros de la sección "Estudiantes" del panel de ADMIN.
 *
 * Criterios acumulativos (AND): género, rango de edad (sobre la fecha de
 * nacimiento, con `getAge`) y grado/curso (matrícula → grado_id real).
 * La lógica es la misma que usaba la pantalla; aquí vive centralizada y pura
 * para poder probarla y reutilizarla sin duplicar reglas.
 */

export interface StudentFilters {
  genero: string;
  edadMin: number;
  edadMax: number;
  gradoId: string;
}

export const EMPTY_FILTERS: StudentFilters = {
  genero: '',
  edadMin: 0,
  edadMax: 99,
  gradoId: '',
};

/**
 * Nº de criterios activos (0-3): género, edad, grado. La edad cuenta como un
 * solo criterio aunque estén activos el mínimo y el máximo.
 */
export function countActiveFilters(f: StudentFilters): number {
  let n = 0;
  if (f.genero) n += 1;
  if (f.edadMin > 0 || f.edadMax < 99) n += 1;
  if (f.gradoId) n += 1;
  return n;
}

export function hasActiveFilters(f: StudentFilters): boolean {
  return countActiveFilters(f) > 0;
}

/** Filtros acumulativos (AND) sobre la lista de estudiantes. */
export function applyStudentFilters(
  students: User[],
  studentGrades: StudentGrade[],
  filters: StudentFilters
): User[] {
  return students.filter(s => {
    if (filters.genero && s.genero !== filters.genero) return false;

    const age = getAge(s.fecha_nacimiento);
    if (filters.edadMin > 0 && age < filters.edadMin) return false;
    if (filters.edadMax < 99 && age > filters.edadMax) return false;

    if (filters.gradoId) {
      const enrollment = studentGrades.find(sg => sg.estudiante_id === s.id);
      if (!enrollment || enrollment.grado_id !== filters.gradoId) return false;
    }

    return true;
  });
}
