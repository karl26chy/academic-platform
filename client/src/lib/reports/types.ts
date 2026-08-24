/**
 * Fuente única de datos del boletín académico (AcademicReportData).
 * El backend la produce (validando institución, estudiante y período) y tanto
 * el renderer PDF como el de Excel la consumen tal cual, sin recálculos.
 */

export interface ReportStudent {
  id: string;
  nombre: string;
  apellido: string;
  identificacion: string | null;
  tipo_documento: string | null;
  edad: number | null;
  genero: string | null;
}

export interface ReportConfigPayload {
  template?: string;
  primaryColor?: string;
  secondaryColor?: string;
  showLogo?: boolean;
  showAttendance?: boolean;
  showEvaluations?: boolean;
  showTeacher?: boolean;
  [key: string]: unknown;
}

export interface ReportConfig {
  template: string;
  logo_url: string | null;
  config: ReportConfigPayload;
}

export interface ReportInstitution {
  id: string;
  nombre: string;
  tipo: string;
  escala_maxima: number;
  nota_minima_aprobacion: number;
  reportConfig: ReportConfig | null;
}

export interface ReportPeriod {
  id: string;
  numero: number;
  nombre: string;
  anio: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  activo: boolean;
}

export interface ReportGrade {
  id: string;
  nombre: string;
  tipo_grado: string;
}

export interface ReportEvaluation {
  evaluacion_id: string;
  nombre: string;
  porcentaje: number | null;
  fecha: string | null;
  nota: number | null;
}

export interface ReportSubject {
  materia_id: string;
  materia: string;
  docente: string | null;
  evaluaciones: ReportEvaluation[];
  /** Promedio de la materia en el período (null = sin datos). */
  promedio: number | null;
  /** S/A/B/Z (escala institucional) o "Sin notas". */
  desempeno: string | null;
  estado: string;
  /** Fallas (inasistencias) de la materia en el período; null = sin registros. */
  fallas: number | null;
  /** Inasistencias justificadas de la materia; null = sin registros. */
  justificadas: number | null;
}

export interface ReportAttendance {
  presente: number;
  ausente: number;
  justificada: number;
  total: number;
  tasa: number;
}

export interface ReportSummary {
  promedioGeneral: number | null;
  estadoGlobal: string;
  escalaMaxima: number;
  notaMinimaAprobacion: number;
}

export interface AcademicReportData {
  student: ReportStudent;
  institution: ReportInstitution;
  period: ReportPeriod;
  grade: ReportGrade | null;
  subjects: ReportSubject[];
  attendance: ReportAttendance;
  summary: ReportSummary;
}

// ---- Reporte anual (dinámico: N períodos, M materias) ----------------------

/** Bloque de una materia dentro de UN período (F/V/D por período). */
export interface ReportPeriodBlock {
  period_id: string;
  numero: number;
  valoracion: number | null;
  desempeno: string | null;
  fallas: number | null;
  justificadas: number | null;
}

/** Materia en el boletín anual, con su definitiva. */
export interface ReportYearSubject {
  materia_id: string;
  materia: string;
  docente: string | null;
  porPeriodo: ReportPeriodBlock[];
  definitiva: number | null;
  desempenoDefinitiva: string | null;
}

export interface AcademicYearReportData {
  student: ReportStudent;
  institution: ReportInstitution;
  grade: ReportGrade | null;
  year: number;
  /** Reportes por período (los que existan en el año), ordenados por número. */
  periods: AcademicReportData[];
  /** Materias del estudiante (de su grado), dinámicas. */
  subjects: ReportYearSubject[];
  attendance: ReportAttendance;
  summary: {
    promediosPeriodo: (number | null)[];
    desempenosPeriodo: (string | null)[];
    promedioGeneralDefinitivo: number | null;
    desempenoGlobal: string | null;
    escalaMaxima: number;
    notaMinimaAprobacion: number;
  };
}
