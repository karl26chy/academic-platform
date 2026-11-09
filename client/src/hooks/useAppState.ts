import { useCallback, useEffect, useState } from 'react';
import { usePlatformData, describirFallo } from './usePlatformData';
import { useAuthSession } from './useAuthSession';
import type { AppContextValue } from '../context/app-context';

/**
 * Compone el estado global de la aplicación: datos de la plataforma y
 * sesión del usuario.
 */
export function useAppState(): AppContextValue {
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
    loadEverything,
    resetSessionCollections,
    clearDataError,
  });

  const [navigateToTab, setNavigateToTab] = useState<string | null>(null);

  // Arranque: sesión previa y datos iniciales.
  useEffect(() => {
    const restoreSession = async () => {
      try {
        setLoading(true);
        setDataError(null);

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
    restoreUser,
    fetchInstitutions,
    fetchSessionCollections,
    setLoading,
    setDataError,
  ]);

  // La institución es la de la cuenta del usuario (el super admin no tiene).
  const currentInstitution = user?.institucion_id
    ? collections.institutions.find(inst => inst.id === user.institucion_id) ?? null
    : null;

  return {
    user,
    loading,
    authError,
    dataError,
    ...collections,
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
