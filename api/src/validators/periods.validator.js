import { HttpError } from '../shared/http-error.js';
import {
  institutionById,
  countPeriodDependencies,
  periodDuplicateOf,
} from '../repositories/resource.repository.js';

/** Rango razonable del año académico (configurable, no asume 4 períodos). */
const ANIO_MIN = 2000;
const ANIO_MAX = 2100;

/**
 * Reglas de períodos académicos:
 *  · institucion_id obligatorio y existente;
 *  · numero: entero mayor que 0 (el orden vive en su propio campo);
 *  · anio: entero válido;
 *  · fecha_inicio anterior a fecha_fin;
 *  · no pueden existir dos períodos con la misma institución + año + número;
 *  · protección del historial: un período con evaluaciones, notas o asistencia
 *    no puede cambiar su año ni su número. El nombre y las fechas siguen
 *    siendo editables; abrir/cerrar (activo) también.
 */
export async function validatePeriod(data, existingRow) {
  const institucionId = data.institucion_id ?? existingRow?.institucion_id;
  if (!institucionId) throw new HttpError(400, 'Falta institucion_id.');

  const institution = await institutionById(institucionId);
  if (!institution) throw new HttpError(400, 'La institución no existe.');

  if (data.numero !== undefined) {
    const numero = Number(data.numero);
    if (!Number.isInteger(numero) || numero <= 0) {
      throw new HttpError(400, 'El número del período debe ser un entero mayor que 0.');
    }
    data.numero = numero;
  }

  if (data.anio !== undefined) {
    const anio = Number(data.anio);
    if (!Number.isInteger(anio) || anio < ANIO_MIN || anio > ANIO_MAX) {
      throw new HttpError(400, 'El año del período no es válido.');
    }
    data.anio = anio;
  }

  const inicio = data.fecha_inicio ?? existingRow?.fecha_inicio;
  const fin = data.fecha_fin ?? existingRow?.fecha_fin;
  if (inicio && fin && String(inicio) >= String(fin)) {
    throw new HttpError(400, 'La fecha de inicio debe ser anterior a la fecha de fin.');
  }

  const numero = Number(data.numero ?? existingRow?.numero);
  const anio = Number(data.anio ?? existingRow?.anio);
  if (numero && anio) {
    const duplicado = await periodDuplicateOf({
      institucion_id: institucionId,
      anio,
      numero,
      excludeId: existingRow?.id ?? null,
    });
    if (duplicado) {
      throw new HttpError(
        409,
        'Ya existe un período con el mismo número para esta institución y año.'
      );
    }
  }

  if (existingRow) {
    const cambiaAnio = data.anio !== undefined && Number(data.anio) !== Number(existingRow.anio);
    const cambiaNumero =
      data.numero !== undefined && Number(data.numero) !== Number(existingRow.numero);
    if (cambiaAnio || cambiaNumero) {
      const deps = await countPeriodDependencies(existingRow.id);
      if (deps.evaluaciones + deps.notas + deps.asistencias > 0) {
        throw new HttpError(
          409,
          'No se puede cambiar el año o el número de un período que ya tiene evaluaciones, notas o asistencia.'
        );
      }
    }
  }
}
