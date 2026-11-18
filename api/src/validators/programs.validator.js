import { HttpError } from '../shared/http-error.js';
import { findRaw, programNamesOf } from '../repositories/resource.repository.js';
import { TIPOS_PROGRAMA, esCorporacion, normalizarNombre } from '../shared/corporacion.js';

/**
 * Catálogo de programas (técnicos y cursos cortos). Solo existe en
 * corporaciones; el nombre no puede repetirse dentro de la misma corporación
 * (sin importar tildes, mayúsculas ni espacios), para evitar duplicados.
 */
export async function validateProgram(data, existingRow) {
  const institucionId = data.institucion_id ?? existingRow?.institucion_id;
  const institucion = institucionId ? await findRaw('institutions', institucionId) : null;
  if (!institucion) throw new HttpError(400, 'La institución no existe.');
  if (!esCorporacion(institucion)) {
    throw new HttpError(400, 'Los programas solo existen en las corporaciones.');
  }

  if (data.nombre !== undefined) {
    data.nombre = String(data.nombre).replace(/\s+/g, ' ').trim();
    if (!data.nombre) throw new HttpError(400, 'El nombre del programa es obligatorio.');
  }
  if (!existingRow && data.nombre === undefined) throw new HttpError(400, 'El nombre del programa es obligatorio.');

  if (data.tipo !== undefined && !TIPOS_PROGRAMA.includes(data.tipo)) {
    throw new HttpError(400, 'El tipo debe ser programa técnico o curso corto.');
  }
  if (!existingRow && data.tipo === undefined) throw new HttpError(400, 'Elige si es programa técnico o curso corto.');

  const nombre = data.nombre ?? existingRow?.nombre;
  const otros = await programNamesOf(institucionId, existingRow?.id ?? null);
  if (otros.some(n => normalizarNombre(n) === normalizarNombre(nombre))) {
    throw new HttpError(409, `Ya existe un programa llamado "${nombre}".`);
  }
}
