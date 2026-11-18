import type { Grade, Institution, Jornada, Program, TipoPrograma } from '../types';

/**
 * Corporaciones (programas técnicos y cursos cortos). Todo lo de este archivo
 * aplica SOLO cuando la institución es una corporación; los colegios siguen
 * con su vocabulario y pantallas de siempre.
 */

export const esCorporacion = (inst?: Pick<Institution, 'tipo'> | null): boolean => inst?.tipo === 'corporacion';

export const JORNADAS: Record<Jornada, string> = {
  manana: 'Mañana',
  tarde: 'Tarde',
  noche: 'Noche',
  fin_de_semana: 'Fin de semana',
};

export const TIPOS_PROGRAMA: Record<TipoPrograma, string> = {
  tecnico: 'Programa técnico',
  curso_corto: 'Curso corto',
};

export const NIVEL_MAXIMO = 20;
export const SEMESTRE_MAXIMO = 20;

/** Vocabulario de la institución: los colegios conservan exactamente el de siempre. */
export interface Vocabulario {
  corporacion: boolean;
  materia: string;
  materias: string;
  grado: string;
  grados: string;
  periodo: string;
  periodos: string;
}

export function vocabulario(inst?: Pick<Institution, 'tipo'> | null): Vocabulario {
  return esCorporacion(inst)
    ? { corporacion: true, materia: 'Módulo', materias: 'Módulos', grado: 'Grupo', grados: 'Grupos', periodo: 'Semestre', periodos: 'Semestres' }
    : { corporacion: false, materia: 'Materia', materias: 'Materias', grado: 'Grado', grados: 'Grados', periodo: 'Periodo', periodos: 'Periodos' };
}

/** Mismo nombre que arma la API: "Auxiliar en Enfermería · Noche · Semestre 2". */
export function nombreGrupo(programa: Pick<Program, 'nombre'>, jornada: Jornada, nivel?: number | null): string {
  return [programa.nombre, JORNADAS[jornada], nivel ? `Semestre ${nivel}` : null].filter(Boolean).join(' · ');
}

/** Compara nombres sin tildes, mayúsculas ni espacios de más (igual que la API). */
export function normalizarNombre(nombre: string): string {
  return nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export interface LineaPegada {
  nombre: string;
  /** Ya existe en el catálogo o se repite dentro de lo pegado. */
  repetido: boolean;
}

/**
 * Convierte una lista pegada (una por línea) en nombres de programa:
 * quita la numeración ("1.", "2)", "- "), ignora líneas vacías y marca los
 * repetidos contra el catálogo y dentro de la misma lista.
 */
export function leerListaPegada(texto: string, existentes: string[]): LineaPegada[] {
  const vistos = new Set(existentes.map(normalizarNombre));
  const resultado: LineaPegada[] = [];
  for (const linea of texto.split(/\r?\n/)) {
    const nombre = linea
      .replace(/^\s*(?:\d+\s*[.)-]|[-*•])\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!nombre) continue;
    const clave = normalizarNombre(nombre);
    resultado.push({ nombre, repetido: vistos.has(clave) });
    vistos.add(clave);
  }
  return resultado;
}

/** Grupos de un programa ordenados por jornada y nivel. */
export function ordenarGrupos(grupos: Grade[]): Grade[] {
  const orden = Object.keys(JORNADAS);
  return [...grupos].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es') ||
    orden.indexOf(a.jornada ?? '') - orden.indexOf(b.jornada ?? '') ||
    Number(a.nivel ?? 0) - Number(b.nivel ?? 0));
}

/** Tamaño legible de un certificado. */
export const formatoTamano = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** Fecha corta: "11 nov 2026". */
export const formatoFecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
