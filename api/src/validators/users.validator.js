import { HttpError } from '../shared/http-error.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['super_admin', 'admin', 'teacher', 'student'];
const PASSWORD_MIN = 8;

/** Catálogo oficial de tipos de documento. Los códigos se guardan en la BD. */
export const DOCUMENT_TYPES = ['CC', 'TI', 'CE', 'PA', 'PPT'];

export async function validateUser(data, existingRow) {
  if (data.email !== undefined) {
    const email = String(data.email).trim();
    if (!EMAIL.test(email)) throw new HttpError(400, 'Email inválido.');
    data.email = email;
  }

  // Vacía en una edición = no cambiarla (se descarta al hashear).
  if (data.password !== undefined && data.password !== null && data.password !== '') {
    const largo = String(data.password).length;
    if (largo < PASSWORD_MIN) {
      throw new HttpError(400, `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`);
    }
    // bcrypt ignora lo que pase de 72 bytes: más largo daría una falsa sensación de seguridad.
    if (Buffer.byteLength(String(data.password)) > 72) {
      throw new HttpError(400, 'La contraseña no puede superar 72 caracteres.');
    }
  }

  if (data.rol !== undefined && !ROLES.includes(data.rol)) {
    throw new HttpError(400, 'Rol inválido.');
  }

  if (data.tipo_documento !== undefined) {
    if (!DOCUMENT_TYPES.includes(data.tipo_documento)) {
      throw new HttpError(400, 'Tipo de documento inválido.');
    }
  }

  // Al crear, el estudiante debe declarar su tipo de documento y su
  // identificación. El correo es opcional (se valida solo si se envía).
  const esEstudiante = (data.rol ?? existingRow?.rol) === 'student';
  const creando = !existingRow;
  if (creando && esEstudiante && !data.tipo_documento) {
    throw new HttpError(400, 'Tipo de documento requerido.');
  }
  if (creando && esEstudiante && !data.identificacion) {
    throw new HttpError(400, 'Identificación requerida para estudiantes.');
  }
  if (esEstudiante && data.identificacion === '') {
    throw new HttpError(400, 'La identificación no puede estar vacía.');
  }
}
