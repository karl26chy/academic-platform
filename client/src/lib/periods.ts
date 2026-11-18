/**
 * Etiqueta canónica de un periodo académico: solo número y año. El nombre
 * guardado no se muestra (un periodo es siempre "Periodo N").
 *
 *   periodLabel({ numero: 4, nombre: 'Cuarto periodo', anio: 2026 })
 *   → "Periodo 4 — 2026"
 *
 * Solo si falta el número (datos heredados) se usa el nombre como respaldo.
 */
export interface PeriodLike {
  id?: string;
  numero?: number | null;
  nombre?: string;
  anio?: number | string | null;
  activo?: boolean;
}

/**
 * Semestre de una corporación: la API lo guarda con nombre "2027-1"
 * (año-número). Un periodo de colegio se llama "Periodo N", nunca así.
 */
export function esSemestre(p?: PeriodLike | null): boolean {
  return !!p && p.numero != null && p.anio != null && p.nombre === `${p.anio}-${p.numero}`;
}

export function periodLabel(p?: PeriodLike | null): string {
  if (!p) return '';
  if (esSemestre(p)) return `Semestre ${p.nombre}`;
  const partes: string[] = [];
  if (p.numero !== undefined && p.numero !== null) {
    partes.push(`Periodo ${p.numero}`);
  } else if (p.nombre) {
    partes.push(String(p.nombre).trim());
  }
  if (p.anio !== undefined && p.anio !== null && p.anio !== '') {
    partes.push(String(p.anio));
  }
  return partes.join(' — ');
}

/** Años académicos reales presentes en la lista, ordenados descendente. */
export function yearsOf(periods: PeriodLike[]): number[] {
  const años = new Set<number>();
  for (const p of periods) {
    const a = Number(p.anio);
    if (Number.isFinite(a) && a > 0) años.add(a);
  }
  return [...años].sort((a, b) => b - a);
}

/** Períodos de un año concreto, ordenados por número (nunca alfabético). */
export function periodsOfYear(periods: PeriodLike[], anio: number): PeriodLike[] {
  return periods
    .filter(p => Number(p.anio) === Number(anio))
    .sort((a, b) => Number(a.numero ?? 0) - Number(b.numero ?? 0));
}

/** Opción del selector de boletín: un período concreto o "Todos los períodos". */
export interface BoletinChoice {
  type: 'period' | 'all';
  periodId?: string;
  label: string;
}

/**
 * Opciones del selector de boletín para un año: los períodos realmente
 * existentes (sin asumir 4) + "Todos los períodos — {año}".
 */
export function boletinChoices(periods: PeriodLike[], anio: number): BoletinChoice[] {
  const delAnio = periodsOfYear(periods, anio);
  const choices: BoletinChoice[] = delAnio.map(p => ({
    type: 'period',
    periodId: p.id,
    label: `Período ${p.numero}`,
  }));
  choices.push({ type: 'all', label: `Todos los períodos — ${anio}` });
  return choices;
}
