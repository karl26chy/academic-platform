import type { Grade, User } from '../types';

/** Edad cumplida a día de hoy; 0 si no hay fecha de nacimiento registrada. */
export function getAge(fechaNacimiento?: string): number {
  if (!fechaNacimiento) return 0;

  const birth = new Date(fechaNacimiento);
  const today = new Date();

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export const fullName = (user?: Pick<User, 'nombre' | 'apellido'> | null): string =>
  user ? `${user.nombre} ${user.apellido}` : '';

export const initials = (user: Pick<User, 'nombre' | 'apellido'>): string =>
  `${user.nombre[0] ?? ''}${user.apellido[0] ?? ''}`;

/** Etiqueta legible de un grado: 6to "A". */
export const gradeLabel = (grade?: Grade | null): string =>
  grade ? `${grade.nombre} "${grade.tipo_grado}"` : '';

/** Nombre de archivo seguro a partir del nombre de una persona. */
export const fileSlug = (user: Pick<User, 'nombre' | 'apellido'>): string =>
  `${user.nombre}_${user.apellido}`
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

// ---------------------------------------------------------------------------
// Comparador centralizado de estudiantes: apellido → nombre → id.
// Insensible a mayúsculas/minúsculas y tildes (sensitivity: "base").
// ---------------------------------------------------------------------------

const collator = new Intl.Collator('es', { sensitivity: 'base' });

/** Compara dos estudiantes por apellido, nombre e id. */
export function compareStudents(
  a: Pick<User, 'apellido' | 'nombre' | 'id'>,
  b: Pick<User, 'apellido' | 'nombre' | 'id'>,
): number {
  const byApellido = collator.compare(a.apellido, b.apellido);
  if (byApellido !== 0) return byApellido;
  const byNombre = collator.compare(a.nombre, b.nombre);
  if (byNombre !== 0) return byNombre;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Devuelve una NUEVA copia del array ordenada sin mutar el original. */
export function sortStudents<T extends Pick<User, 'apellido' | 'nombre' | 'id'>>(
  students: T[],
): T[] {
  return [...students].sort(compareStudents);
}
