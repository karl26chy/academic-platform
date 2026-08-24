import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';
import config from '../config/index.js';
import { compare } from '../shared/password.js';
import { HttpError } from '../shared/http-error.js';

/** Nunca dejamos salir la contraseña, ni siquiera hasheada. */
const sinPassword = (user) => {
  if (!user) return user;
  const { password, ...rest } = user;
  return rest;
};

function firmarToken(user) {
  return jwt.sign(
    { sub: user.id, rol: user.rol, email: user.email, institucion_id: user.institucion_id },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

async function findUserByEmail(email) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  );
  return rows[0] || null;
}

/**
 * La identificación es GLOBALMENTE ÚNICA por regla de negocio: se busca al
 * estudiante sin institución ni subdominio y su institucion_id sale del
 * usuario encontrado. No existe lógica de colisión: la unicidad es asumida.
 */
async function findUserByIdentificacion(identificacion) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE LOWER(identificacion) = LOWER($1)',
    [identificacion]
  );
  return rows[0] || null;
}

export async function login({ email, identificacion, password } = {}) {
  // El identificador se normaliza solo para la autenticación: espacios al
  // inicio/final no deben impedir encontrar al usuario. La contraseña se
  // respeta tal cual (sensible a mayúsculas y espacios).
  const normalizedEmail = email ? email.trim() : '';
  const normalizedIdentificacion = identificacion ? identificacion.trim() : '';

  if (!password || (!normalizedEmail && !normalizedIdentificacion)) {
    throw new HttpError(400, 'Correo o identificación y contraseña son requeridos.');
  }

  const canal = normalizedEmail ? 'email' : 'identificacion';
  const user = canal === 'email'
    ? await findUserByEmail(normalizedEmail)
    : await findUserByIdentificacion(normalizedIdentificacion);

  if (!user || !(await compare(password, user.password))) {
    throw new HttpError(401, 'Credenciales inválidas. Inténtalo de nuevo.');
  }

  // Regla definitiva de autenticación por rol:
  //  · estudiante → solo identificación (el correo puede no existir)
  //  · admin / docente / super admin → solo correo
  if (user.rol === 'student' && canal !== 'identificacion') {
    throw new HttpError(403, 'Los estudiantes deben iniciar sesión con su número de identificación.');
  }
  if (user.rol !== 'student' && canal !== 'email') {
    throw new HttpError(403, 'Este rol debe iniciar sesión con su correo electrónico.');
  }

  if (!user.activo) {
    throw new HttpError(403, 'Tu cuenta está desactivada. Contacta al administrador.');
  }

  return { token: firmarToken(user), user: sinPassword(user) };
}

export async function currentUser(userId) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  if (!rows[0]) throw new HttpError(404, 'Usuario no encontrado.');
  return sinPassword(rows[0]);
}
