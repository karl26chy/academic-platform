import { HttpError } from '../shared/http-error.js';
import { findRaw } from '../repositories/resource.repository.js';
import * as repo from '../repositories/certificate.repository.js';
import { esCorporacion } from '../shared/corporacion.js';

/**
 * Certificados PDF (solo corporaciones): el admin de la corporación los sube
 * a cada estudiante y el estudiante descarga los suyos.
 */

export const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB

/** Estudiante de una corporación; lanza 404 si no existe o no es estudiante. */
async function estudianteDeCorporacion(estudianteId) {
  const estudiante = await findRaw('users', estudianteId);
  if (!estudiante || estudiante.rol !== 'student') throw new HttpError(404, 'Estudiante no encontrado.');
  const institucion = await findRaw('institutions', estudiante.institucion_id);
  if (!esCorporacion(institucion)) {
    throw new HttpError(400, 'Los certificados solo están disponibles para corporaciones.');
  }
  return estudiante;
}

const esAdminDe = (user, institucionId) =>
  user.rol === 'super_admin' || (user.rol === 'admin' && user.institucion_id === institucionId);

/** El admin de su corporación (o super admin) o el propio estudiante. */
function exigirLectura(user, estudiante) {
  if (esAdminDe(user, estudiante.institucion_id)) return;
  if (user.rol === 'student' && user.sub === estudiante.id) return;
  // Mismo mensaje que si no existiera: no se revela que hay certificados ajenos.
  throw new HttpError(404, 'Estudiante no encontrado.');
}

export async function upload(user, estudianteId, tituloCrudo, archivo) {
  const estudiante = await estudianteDeCorporacion(estudianteId);
  if (!esAdminDe(user, estudiante.institucion_id)) {
    throw new HttpError(403, 'Solo el administrador de la corporación puede subir certificados.');
  }
  const titulo = String(tituloCrudo ?? '').replace(/\s+/g, ' ').trim();
  if (!titulo) throw new HttpError(400, 'Escribe el título del certificado.');
  if (titulo.length > 150) throw new HttpError(400, 'El título no puede superar 150 caracteres.');
  if (!Buffer.isBuffer(archivo) || archivo.length === 0) throw new HttpError(400, 'Adjunta el archivo PDF.');
  if (archivo.length > TAMANO_MAXIMO) throw new HttpError(413, 'El certificado no puede superar 10 MB.');
  // Un PDF real empieza con "%PDF-": evita guardar otros archivos renombrados.
  if (archivo.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new HttpError(400, 'El archivo debe ser un PDF.');
  }
  return repo.insertCertificate({
    institucionId: estudiante.institucion_id, estudianteId, titulo, archivo, subidoPor: user.sub,
  });
}

export async function listOfStudent(user, estudianteId) {
  const estudiante = await estudianteDeCorporacion(estudianteId);
  exigirLectura(user, estudiante);
  return repo.certificatesOfStudent(estudianteId);
}

async function certificadoAutorizado(user, id, { soloAdmin = false } = {}) {
  const meta = await repo.certificateMeta(id);
  if (!meta) throw new HttpError(404, 'Certificado no encontrado.');
  const propio = user.rol === 'student' && user.sub === meta.estudiante_id;
  if (esAdminDe(user, meta.institucion_id) || (!soloAdmin && propio)) return meta;
  throw new HttpError(404, 'Certificado no encontrado.');
}

export async function download(user, id) {
  await certificadoAutorizado(user, id);
  return repo.certificateFile(id);
}

export async function remove(user, id) {
  await certificadoAutorizado(user, id, { soloAdmin: true });
  await repo.deleteCertificate(id);
  return { ok: true };
}
