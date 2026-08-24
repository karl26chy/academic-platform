import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../../services/api';
import { toast } from '../../ui';
import type { AcademicPeriod } from '../../../types';

export interface Feedback {
  type: 'success' | 'error';
  text: string;
}

/** Datos del formulario de periodo que se envían al backend. */
export interface PeriodFormData {
  nombre: string;
  numero: number;
  anio: number;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
}

/** Traduce un error del API a un mensaje legible, sin detalles técnicos. */
export function mensajeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.esFalloDeRed) return 'No se pudo conectar con el servidor API.';
    if (err.status === 403) return 'No tienes permiso para realizar esta operación.';
    if (err.status === 400 || err.status === 409) return err.message;
    return 'Ocurrió un error al realizar la operación.';
  }
  return 'Ocurrió un error al realizar la operación.';
}

/**
 * Datos de los periodos académicos de la institución del administrador.
 * El backend ya acota el listado a su institución; aquí no se reimplementa
 * el aislamiento, solo se ordena para la vista.
 */
export function useAcademicPeriods() {
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

const showMsg = useCallback((type: Feedback['type'], text: string) => {
    if (type === 'success') toast.success(text);
    else toast.error(text);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.getAcademicPeriods();
      setPeriods([...list].sort((a, b) => (b.anio - a.anio) || (a.numero - b.numero)));
    } catch (err: unknown) {
      setError(mensajeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (data: PeriodFormData, institucionId: string) => {
    try {
      await api.createAcademicPeriod({ ...data, institucion_id: institucionId });
      showMsg('success', data.activo ? 'Periodo creado y abierto.' : 'Periodo creado.');
      await load();
      return true;
    } catch (err: unknown) {
      showMsg('error', mensajeError(err));
      return false;
    }
  };

  const update = async (id: string, data: PeriodFormData) => {
    try {
      await api.updateAcademicPeriod(id, data);
      showMsg('success', data.activo ? 'Periodo abierto y actualizado.' : 'Periodo actualizado.');
      await load();
      return true;
    } catch (err: unknown) {
      showMsg('error', mensajeError(err));
      return false;
    }
  };

  const openPeriod = async (period: AcademicPeriod) => {
    try {
      await api.updateAcademicPeriod(period.id, { ...period, activo: true });
      showMsg('success', 'Periodo abierto. Los demás periodos abiertos quedaron cerrados.');
      await load();
      return true;
    } catch (err: unknown) {
      showMsg('error', mensajeError(err));
      return false;
    }
  };

  const closePeriod = async (period: AcademicPeriod) => {
    try {
      await api.updateAcademicPeriod(period.id, { ...period, activo: false });
      showMsg('success', 'Periodo cerrado.');
      await load();
      return true;
    } catch (err: unknown) {
      showMsg('error', mensajeError(err));
      return false;
    }
  };

  const remove = async (id: string) => {
    try {
      await api.deleteAcademicPeriod(id);
      showMsg('success', 'Periodo eliminado.');
      await load();
      return true;
    } catch (err: unknown) {
      showMsg('error', mensajeError(err));
      return false;
    }
  };

  return {
    periods,
    loading,
    error,
    create,
    update,
    openPeriod,
    closePeriod,
    remove,
    reload: load,
  };
}