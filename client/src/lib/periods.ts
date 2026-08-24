/**
 * Etiqueta canónica de un periodo académico: el número siempre visible y el
 * nombre descriptivo separado del número.
 *
 *   periodLabel({ numero: 1, nombre: 'Primer periodo', anio: 2026 })
 *   → "Periodo 1 — Primer periodo — 2026"
 *
 * Si el nombre es simplemente "Periodo X" y X coincide con `numero`, no se
 * repite:
 *
 *   periodLabel({ numero: 1, nombre: 'Periodo 1', anio: 2026 })
 *   → "Periodo 1 — 2026"
 */
export interface PeriodLike {
  id?: string;
  numero?: number | null;
  nombre?: string;
  anio?: number | string | null;
  activo?: boolean;
}

export function periodLabel(p?: PeriodLike | null): string {
  if (!p) return '';
  const partes: string[] = [];
  if (p.numero !== undefined && p.numero !== null) {
    partes.push(`Periodo ${p.numero}`);
  }
  if (p.nombre) {
    const nombreLimpio = String(p.nombre).trim();
    // No repetir "Periodo X" cuando X coincide con el número del periodo.
    const esRedundante =
      p.numero !== undefined &&
      p.numero !== null &&
      nombreLimpio.toLowerCase() === `periodo ${p.numero}`.toLowerCase();
    if (!esRedundante) partes.push(nombreLimpio);
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
    label:
      p.nombre && p.nombre.trim().toLowerCase() !== `periodo ${p.numero}`.toLowerCase()
        ? `${p.nombre} (${p.numero})`
        : `Período ${p.numero}`,
  }));
  choices.push({ type: 'all', label: `Todos los períodos — ${anio}` });
  return choices;
}
