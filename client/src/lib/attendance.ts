import type { Attendance } from '../types';

/**
 * Métricas de asistencia.
 *
 * Estados: presente, ausente, justificada (Inasistencia justificada; la
 * antigua "tardanza" ya no existe).
 */

export type Estado = 'presente' | 'ausente' | 'justificada';

export const ESTADOS: { value: Estado; label: string }[] = [
  { value: 'presente', label: 'Presente' },
  { value: 'ausente', label: 'Ausente' },
  { value: 'justificada', label: 'Inasistencia justificada' },
];

/** Formato YYYY-MM-DD local sin desfase UTC. */
export function getLocalTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Filtra los registros de asistencia correspondientes a una clase y fecha. */
export function filterAttendanceByDateAndClass(
  records: Attendance[],
  materiaId: string,
  gradoId: string,
  fecha: string,
): Attendance[] {
  return records.filter(
    a => a.materia_id === materiaId && a.grado_id === gradoId && a.fecha === fecha
  );
}

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
