import type { LoginPayload } from '../services/api/auth.api';

/**
 * Construye el payload de login normalizando el identificador:
 *  · elimina espacios al inicio y al final
 *  · mantiene la contraseña exactamente como la escribió el usuario
 * La distinción email/identificación depende de la presencia de '@'.
 */
export function buildLoginPayload(identifier: string, password: string): LoginPayload {
  const clean = identifier.trim();
  return clean.includes('@')
    ? { password, email: clean }
    : { password, identificacion: clean };
}