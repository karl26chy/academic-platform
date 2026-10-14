import { useCallback, useEffect, useState } from 'react';
import { api, getAuthToken, setAuthToken, UNAUTHORIZED_EVENT } from '../services/api';
import { buildLoginPayload } from '../lib/loginPayload';
import type { Institution, User } from '../types';

const USER_KEY = 'edu_platform_user';

interface SessionDeps {
  /** Instituciones ya cargadas, para validar el acceso por subdominio. */
  institutions: Institution[];
  /** Subdominio real del host (p. ej. "alegria" en alegria.dominio.com). */
  realSubdomain: string | null;
  setSimulatedSubdomain: (subdomain: string | null) => void;
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
 * Reglas de acceso que se aplican tras autenticar contra el API:
 *  · un usuario de institución no puede entrar por el subdominio de otra
 *  · una institución desactivada bloquea el acceso de sus usuarios
 *  · el super admin solo entra por el portal general (sin subdominio)
 */
export function useAuthSession({
  institutions,
  realSubdomain,
  setSimulatedSubdomain,
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

      // Sincronizar subdominio simulado con la institución del usuario restaurado
      if (!realSubdomain && me.institucion_id) {
        api.getInstitutions().then(instList => {
          const inst = instList.find(i => i.id === me.institucion_id);
          if (inst) setSimulatedSubdomain(inst.subdominio);
        }).catch(() => {});
      } else if (!realSubdomain && me.rol === 'super_admin') {
        setSimulatedSubdomain(null);
      }

      return true;
    } catch {
      setAuthToken(null);
      localStorage.removeItem(USER_KEY);
      setUser(null);
      return false;
    }
  }, [realSubdomain, setSimulatedSubdomain]);

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
   * con su correo. El frontend nunca pide ni envía subdominio.
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

      if (authenticated.rol !== 'super_admin') {
        // Solo el subdominio REAL del hostname valida el acceso; el valor simulado
        // de localStorage nunca participa en esta comparación.
        if (realSubdomain && userInstitution?.subdominio !== realSubdomain) {
          return rechazar(
            `Este usuario pertenece a ${userInstitution?.nombre || 'otra institución'} y no al subdominio actual.`
          );
        }
        if (userInstitution && !userInstitution.activa) {
          return rechazar('La institución asociada está desactivada.');
        }
        // Portal general (sin subdominio real): sincroniza la simulación con la
        // institución del usuario que acaba de autenticarse.
        if (!realSubdomain && userInstitution) {
          setSimulatedSubdomain(userInstitution.subdominio);
        }
      } else {
        if (realSubdomain) {
          return rechazar('El Super Administrador solo puede iniciar sesión en el portal general/administración.');
        }
        // Super admin no pertenece a ninguna institución: limpiar simulación previa
        if (!realSubdomain) {
          setSimulatedSubdomain(null);
        }
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
