import pool from '../db/pool.js';

/**
 * Estado vigente de un usuario (rol, institución, activo) para validar cada
 * petición. Se guarda unos segundos para no consultar la base en cada una;
 * editar o borrar al usuario lo invalida al instante.
 */

const CACHE_MS = 10 * 1000;
const cache = new Map(); // id → { estado, vence }

export async function currentUserState(userId) {
  const hit = cache.get(userId);
  if (hit && hit.vence > Date.now()) return hit.estado;
  const { rows } = await pool.query(
    'SELECT rol, institucion_id, activo FROM users WHERE id = $1',
    [userId]
  );
  const estado = rows[0] || null;
  cache.set(userId, { estado, vence: Date.now() + CACHE_MS });
  return estado;
}

export function forgetUserState(userId) {
  cache.delete(userId);
}
