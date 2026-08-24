import type { AcademicYearReportData, ReportConfig } from './types';

/**
 * Helpers compartidos para el reporte académico.
 * El contenido académico SIEMPRE viene de AcademicYearReportData.
 * El sistema de plantillas PDF fue eliminado — solo quedan helpers para Excel.
 */

/** Defaults razonables que el JSON de configuración puede sobrescribir. */
export function mergeConfig(config: ReportConfig | null): {
  primary: [number, number, number];
  secondary: [number, number, number];
  showLogo: boolean;
  showAttendance: boolean;
  showEvaluations: boolean;
  showTeacher: boolean;
} {
  const raw = config?.config || {};
  const parseColor = (value: unknown, fallback: [number, number, number]): [number, number, number] => {
    if (typeof value === 'string' && /^#?([0-9a-f]{6})$/i.test(value)) {
      const hex = value.replace('#', '');
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    }
    return fallback;
  };
  return {
    primary: parseColor(raw.primaryColor, [136, 112, 48]),
    secondary: parseColor(raw.secondaryColor, [48, 48, 48]),
    showLogo: raw.showLogo !== false,
    showAttendance: raw.showAttendance !== false,
    showEvaluations: raw.showEvaluations !== false,
    showTeacher: raw.showTeacher !== false,
  };
}

/** Texto institucional del config (rectora, director, etc.), con fallback. */
export function configText(config: ReportConfig | null, key: string, fallback = ''): string {
  const v = config?.config?.[key];
  return typeof v === 'string' && v.trim() ? v : fallback;
}

/** Nombre de archivo individual del boletín (anual). */
export function reportFileName(data: AcademicYearReportData, extension: string): string {
  const nombre = `${data.student.nombre}_${data.student.apellido}`.replace(/\s+/g, '_');
  return `${nombre}_Ano_${data.year}.${extension}`;
}
