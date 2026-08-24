import { HttpError } from '../shared/http-error.js';

/** Tipos de institución soportados. */
export const INSTITUTION_TYPES = ['colegio', 'corporacion', 'universidad'];

/** Escalas de calificación permitidas (tope máximo de la nota). */
export const ALLOWED_SCALES = [5, 10, 100];

/** Default inicial (editable, no una regla rígida) según el tipo. */
const DEFAULT_SCALE_BY_TYPE = { universidad: 5, colegio: 10, corporacion: 10 };

export async function validateInstitution(data, existingRow) {
  const creando = !existingRow;

  if (data.tipo !== undefined && !INSTITUTION_TYPES.includes(data.tipo)) {
    throw new HttpError(400, 'Tipo de institución inválido.');
  }

  // Escala efectiva: la enviada, el default por tipo al crear, o la guardada.
  let escala = data.escala_maxima ?? (creando ? DEFAULT_SCALE_BY_TYPE[data.tipo] : existingRow?.escala_maxima);
  if (escala !== undefined) {
    escala = Number(escala);
    if (!ALLOWED_SCALES.includes(escala)) {
      throw new HttpError(400, 'La escala de calificación debe ser 1 a 5, 1 a 10 o 1 a 100.');
    }
    data.escala_maxima = escala;
  }

  if (data.nota_minima_aprobacion !== undefined) {
    const notaMinima = Number(data.nota_minima_aprobacion);
    if (Number.isNaN(notaMinima)) {
      throw new HttpError(400, 'La nota mínima de aprobación debe ser un número.');
    }
    // Al crear y sin valor, se propone el 60% de la escala como valor inicial editable.
    const escalaFinal = escala ?? (creando ? DEFAULT_SCALE_BY_TYPE[data.tipo] : existingRow?.escala_maxima);
    const minimo = 1;
    const maximo = Number(escalaFinal ?? (data.tipo === 'universidad' ? 5 : 10));
    if (notaMinima < minimo || notaMinima > maximo) {
      throw new HttpError(400, `La nota mínima de aprobación debe estar entre 1 y ${maximo}.`);
    }
    data.nota_minima_aprobacion = notaMinima;
  } else if (creando && data.nota_minima_aprobacion === undefined) {
    const escalaFinal = Number(escala ?? DEFAULT_SCALE_BY_TYPE[data.tipo]);
    const porDefecto = Math.round(escalaFinal * 0.6);
    data.nota_minima_aprobacion = porDefecto;
  }
}
