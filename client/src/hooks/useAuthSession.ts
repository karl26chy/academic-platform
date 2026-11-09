import { useCallback, useEffect, useState } from 'react';
import { api, getAuthToken, setAuthToken, UNAUTHORIZED_EVENT } from '../services/api';
import { buildLoginPayload } from '../lib/loginPayload';
import type { Institution, User } from '../types';

const USER_KEY = 'edu_platform_user';

interface SessionDeps {
  /** Instituciones ya cargadas, para comprobar que la del usuario esté activa. */
  institutions: Institution[];
  /** Recarga completa tras un login correcto. */
  loadEverything: () => Promise<Institution[] | undefined>;
  /** Descarta los datos de la sesión que termina. */
  resetSessionCollections: () => void;
  /** Limpia el fallo de carga: no debe sobrevivir al cambio de sesión. */
  clearDataError: () => void;
}

/**
 * Sesión del usuario: restauración desde el token guardado, inicio y cierre.
 *
 * El error de autenticación es suyo y no se mezcla con el de carga de datos:
 * un login rechazado lo pinta el formulario, no la pantalla de conexión.
 *
 * Toda la plataforma vive en un solo dominio: la institución de cada persona
 * sale de su cuenta (institucion_id), nunca de la dirección del navegador.
 * Tras autenticar contra el API, una institución desactivada bloquea el
 * acceso de sus usuarios.
 */
export function useAuthSession({
  institutions,
  loadEverything,
  resetSessionCollections,
  clearDataError,
}: SessionDeps) {
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      localStorage.removeItem(USER_KEY);
      resetSessionCollections();
    };
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [resetSessionCollections]);

  /** Intenta recuperar la sesión guardada; indica si quedó una activa. */
  const restoreUser = useCallback(async (): Promise<boolean> => {
    const savedToken = getAuthToken();
    if (!savedToken) return false;

    try {
      const me = await api.getMe();
      setUser(me);
      localStorage.setItem(USER_KEY, JSON.stringify(me));
      return true;
    } catch {
      setAuthToken(null);
      localStorage.removeItem(USER_KEY);
      setUser(null);
      return false;
    }
  }, []);

  const rechazar = (mensaje: string) => {
    setAuthError(mensaje);
    setAuthToken(null);
    setUser(null);
    resetSessionCollections();
    return false;
  };

  /**
   * El estudiante entra con su número de identificación (la institución la
   * resuelve el backend desde el usuario encontrado); el resto de roles entra
   * con su correo.
   */
  const login = async (identifier: string, password: string): Promise<boolean> => {
    try {
      setAuthError(null);
      clearDataError();
      resetSessionCollections();

      const payload = buildLoginPayload(identifier, password);

      const { token, user: authenticated } = await api.login(payload);
      setAuthToken(token);

      // Resolver la institución del usuario con datos frescos si es necesario
      let currentInsts = institutions;
      let userInstitution = currentInsts.find(inst => inst.id === authenticated.institucion_id);
      if (!userInstitution && authenticated.institucion_id) {
        try {
          const freshInsts = await api.getInstitutions();
          currentInsts = freshInsts;
          userInstitution = freshInsts.find(inst => inst.id === authenticated.institucion_id);
        } catch {
          // Continúa con la validación estándar
        }
      }

      if (authenticated.rol !== 'super_admin' && userInstitution && !userInstitution.activa) {
        return rechazar('La institución asociada está desactivada.');
      }

      // Cargar todas las colecciones correspondientes al nuevo usuario antes de activar el dashboard
      const loaded = await loadEverything();
      if (!loaded) {
        resetSessionCollections();
        setAuthToken(null);
        setUser(null);
        localStorage.removeItem(USER_KEY);
        setAuthError('No se pudieron cargar los datos de la cuenta. Intente nuevamente.');
        return false;
      }

      setUser(authenticated);
      localStorage.setItem(USER_KEY, JSON.stringify(authenticated));
      return true;
    } catch (err: unknown) {
      // El mensaje del API llega intacto: "Credenciales inválidas", "Tu cuenta
      // está desactivada"... Solo se generaliza si no hay nada que mostrar.
      setAuthError(err instanceof Error ? err.message : 'Error al intentar iniciar sesión.');
      setAuthToken(null);
      setUser(null);
      resetSessionCollections();
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setAuthToken(null);
    localStorage.removeItem(USER_KEY);
    // Nada de la sesión que termina debe sobrevivir: ni los datos cargados ni
    // un error previo, que dejaría inalcanzable el formulario de login.
    resetSessionCollections();
    clearDataError();
    setAuthError(null);
  };

  return { user, authError, login, logout, restoreUser };
}
