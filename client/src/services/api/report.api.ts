import { http } from '../http';
import type { AcademicReportData, AcademicYearReportData } from '../../lib/reports/types';

export const reportApi = {
  /** Reporte académico individual de un estudiante para un período concreto. */
  getStudentReport: (studentId: string, periodId: string) =>
    http.get<AcademicReportData>(
      `/students/${encodeURIComponent(studentId)}/report?period_id=${encodeURIComponent(periodId)}`
    ),
  /** Reporte ANUAL de un estudiante (períodos y materias dinámicos). */
  getStudentYearReport: (studentId: string, anio: number) =>
    http.get<AcademicYearReportData>(
      `/students/${encodeURIComponent(studentId)}/report?anio=${encodeURIComponent(String(anio))}`
    ),
};
