/**
 * Colores por materia: asociación GLOBAL y determinística nombre → color.
 *
 * La normalización (minúsculas, sin acentos, sin espacios extra) hace que
 * "Matemáticas", "MATEMÁTICAS" y "  matemáticas  " resuelvan al mismo color,
 * sin cambiar el nombre real almacenado.
 *
 * Las materias conocidas se mapean a la paleta; las desconocidas reciben un
 * color estable calculado con un hash determinístico del nombre normalizado
 * (nunca aleatorio) y se cachean, de modo que conservan el mismo color entre
 * renders.
 */

export const SUBJECT_PALETTE = [
  '#2563eb', // azul
  '#dc2626', // rojo
  '#16a34a', // verde
  '#9333ea', // morado
  '#ea580c', // naranja
  '#ca8a04', // amarillo
  '#db2777', // rosado
  '#0d9488', // turquesa
  '#4f46e5', // índigo
  '#0891b2', // cian
  '#65a30d', // lima
  '#c026d3', // fucsia
] as const;

/** Reglas de materias conocidas. El orden importa: las más específicas van
 *  primero (p. ej. "ciencias sociales" antes que "ciencias"). */
const SUBJECT_RULES: ReadonlyArray<{ keywords: string[]; color: string }> = [
  { keywords: ['ciencias sociales', 'sociales', 'historia', 'geografia'], color: '#ea580c' },
  { keywords: ['educacion fisica', 'ed fisica', 'deporte'], color: '#ca8a04' },
  { keywords: ['matematica'], color: '#2563eb' },
  { keywords: ['lengua', 'castellano', 'espanol'], color: '#dc2626' },
  { keywords: ['ciencia', 'biologia', 'fisica', 'quimica'], color: '#16a34a' },
  { keywords: ['ingles'], color: '#9333ea' },
  { keywords: ['artistica', 'arte'], color: '#db2777' },
  { keywords: ['tecnologia', 'informatica', 'tic', 'sistemas', 'computacion'], color: '#0d9488' },
];

/** Normaliza el nombre de la materia para resolver su color de forma estable. */
export function normalizeSubjectName(name: string): string {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Hash determinístico (djb2) sobre el nombre ya normalizado. */
function hashString(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Resuelve el color a partir de un nombre YA normalizado. */
export function subjectColorOf(normalized: string): string {
  for (const rule of SUBJECT_RULES) {
    if (rule.keywords.some(k => normalized.includes(k))) return rule.color;
  }
  return SUBJECT_PALETTE[hashString(normalized) % SUBJECT_PALETTE.length];
}

/** Caché por nombre normalizado: garantiza el mismo color entre llamadas. */
const cache = new Map<string, string>();

/**
 * Color de una materia. Siempre devuelve el mismo color para el mismo nombre
 * (tolerando mayúsculas, acentos y espacios), tanto para materias conocidas
 * como para materias nuevas (determinístico, sin aleatoriedad).
 */
export function getSubjectColor(name: string): string {
  const normalized = normalizeSubjectName(name);
  if (!normalized) return SUBJECT_PALETTE[0];

  const cached = cache.get(normalized);
  if (cached) return cached;

  const color = subjectColorOf(normalized);
  cache.set(normalized, color);
  return color;
}
