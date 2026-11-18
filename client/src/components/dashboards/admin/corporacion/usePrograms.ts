import { useCallback, useEffect, useState } from 'react';
import { programs as programsApi } from '../../../../services/api';
import { toast } from '../../../ui';
import type { Program } from '../../../../types';

const collator = new Intl.Collator('es', { sensitivity: 'base' });

/**
 * Catálogo de programas de la corporación (lo filtra el API por institución).
 * `activo = false` no pide nada: así los colegios no hacen la petición.
 */
export function usePrograms(activo = true) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!activo) return setLoading(false);
    try {
      const list = await programsApi.list();
      setPrograms([...list].sort((a, b) => collator.compare(a.nombre, b.nombre)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudieron cargar los programas.');
    } finally {
      setLoading(false);
    }
  }, [activo]);

  useEffect(() => { void reload(); }, [reload]);

  return { programs, loading, reload };
}
