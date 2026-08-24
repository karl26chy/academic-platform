import type { Attendance } from '../types';

/**
 * Métricas de asistencia.
 *
 * Estados: presente, ausente, justificada (Inasistencia justificada; la
 * antigua "tardanza" ya no existe).
 */

export interface AttendanceCounts {
  presente: number;
  ausente: number;
  justificada: number;
  total: number;
}

export function countByStatus(records: Attendance[]): AttendanceCounts {
  return {
    presente: records.filter(a => a.estado === 'presente').length,
    ausente: records.filter(a => a.estado === 'ausente').length,
    justificada: records.filter(a => a.estado === 'justificada').length,
    total: records.length,
  };
}

/**
 * Tasa usada en el panel del administrador y en el boletín:
 * solo cuenta las asistencias efectivas y devuelve 0 si no hay registros.
 */
export function attendanceRateStrict(records: Attendance[]): number {
  if (records.length === 0) return 0;
  const { presente } = countByStatus(records);
  return Math.round((presente / records.length) * 100);
}

/**
 * Tasa usada en el portal del estudiante: cuenta también las inasistencias
 * justificadas como asistencia y devuelve 100 cuando todavía no hay registros.
 */
export function attendanceRateWithJustified(records: Attendance[]): number {
  if (records.length === 0) return 100;
  const { presente, justificada } = countByStatus(records);
  return Math.round(((presente + justificada) / records.length) * 100);
}
