import { http } from '../http';
import type { AcademicReportData, AcademicYearReportData } from '../../lib/reports/types';

/** Estado académico anual de un estudiante, calculado por el API. */
export interface InstitutionStudentStatus {
  studentId: string;
  promedio: number | null;
  desempeno: 'S' | 'A' | 'B' | 'Z' | null;
  asistenciaTasa: number;
  ausentes: number;
}

export const reportApi = {
  /** Reporte académico individual de un estudiante para un período concreto. */
  getStudentReport: (studentId: string, periodId: string) =>
    http.get<AcademicReportData>(
      `/students/${encodeURIComponent(studentId)}/report?period_id=${encodeURIComponent(periodId)}`
    ),
  /**
   * Estado académico anual de todos los estudiantes (con notas) de una
   * institución, en una sola petición: promedio, desempeño y asistencia con
   * la misma regla del boletín anual.
   */
  getInstitutionStatus: (institutionId: string, anio: number) =>
    http.get<InstitutionStudentStatus[]>(
      `/institutions/${encodeURIComponent(institutionId)}/academic-status?anio=${encodeURIComponent(String(anio))}`
    ),
  /** Reporte ANUAL de un estudiante (períodos y materias dinámicos). */
  getStudentYearReport: (studentId: string, anio: number) =>
    http.get<AcademicYearReportData>(
      `/students/${encodeURIComponent(studentId)}/report?anio=${encodeURIComponent(String(anio))}`
    ),
};
