/**
 * Reglas propias de las CORPORACIONES (programas técnicos y cursos cortos).
 * Los colegios no usan nada de este archivo.
 */

export const TIPOS_PROGRAMA = ['tecnico', 'curso_corto'];

/** Jornadas: el valor que se guarda y cómo se muestra. */
export const JORNADAS = {
  manana: 'Mañana',
  tarde: 'Tarde',
  noche: 'Noche',
  fin_de_semana: 'Fin de semana',
};

export const esCorporacion = (institucion) => institucion?.tipo === 'corporacion';

/**
 * Nombre del grupo, armado siempre igual para que no haya variantes:
 * "Auxiliar en Enfermería · Noche · Nivel 2" (los cursos cortos no tienen nivel).
 */
export function nombreGrupo(programa, jornada, nivel) {
  const partes = [programa.nombre, JORNADAS[jornada] ?? jornada];
  if (nivel) partes.push(`Nivel ${nivel}`);
  return partes.join(' · ');
}

/** Nombre comparable: sin numeración, tildes, mayúsculas ni espacios de más. */
export function normalizarNombre(nombre) {
  return String(nombre ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}
