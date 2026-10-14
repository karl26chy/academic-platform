import { useCallback, useEffect, useState } from 'react';
import { useSubdomain } from './useSubdomain';
import { usePlatformData, describirFallo } from './usePlatformData';
import { useAuthSession } from './useAuthSession';
import type { AppContextValue } from '../context/app-context';

/**
 * Compone el estado global de la aplicación a partir de sus tres piezas:
 * subdominio activo, datos de la plataforma y sesión del usuario.
 */
export function useAppState(): AppContextValue {
  const { realSubdomain, activeSubdomain, setSimulatedSubdomain, restoreSavedSubdomain } = useSubdomain();
  const {
    collections,
    loading,
    dataError,
    setLoading,
    setDataError,
    resetSessionCollections,
    fetchInstitutions,
    fetchSessionCollections,
    loadEverything,
  } = usePlatformData();

  const clearDataError = useCallback(() => setDataError(null), [setDataError]);

  const { user, authError, login, logout, restoreUser } = useAuthSession({
    institutions: collections.institutions,
    realSubdomain,
    setSimulatedSubdomain,
    loadEverything,
    resetSessionCollections,
    clearDataError,
  });

  const [navigateToTab, setNavigateToTab] = useState<string | null>(null);

  // Arranque: subdominio guardado, sesión previa y datos iniciales.
  useEffect(() => {
    const restoreSession = async () => {
      try {
        setLoading(true);
        setDataError(null);

        restoreSavedSubdomain();

        const hasSession = await restoreUser();

        await fetchInstitutions();

        if (hasSession) {
          await fetchSessionCollections();
        }
      } catch (err: unknown) {
        console.error('Failed to load data from API:', err);
        setDataError(describirFallo(err));
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, [
    restoreSavedSubdomain,
    restoreUser,
    fetchInstitutions,
    fetchSessionCollections,
    setLoading,
    setDataError,
  ]);

  // La institución del usuario autenticado es la fuente de verdad prioritaria.
  // Solo se recurre a la resolución por subdominio cuando el usuario no tiene
  // institución fija o no hay sesión iniciada (pantalla de login).
  const currentInstitution =
    (user?.institucion_id
      ? collections.institutions.find(inst => inst.id === user.institucion_id)
      : null) ??
    collections.institutions.find(inst => inst.subdominio === activeSubdomain) ??
    null;

  return {
    user,
    loading,
    authError,
    dataError,
    ...collections,
    activeSubdomain,
    setSimulatedSubdomain,
    login,
    logout,
    refreshData: async () => {
      await loadEverything();
    },
    currentInstitution,
    navigateToTab,
    setNavigateToTab,
  };
}
