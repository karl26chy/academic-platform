export type Role = 'super_admin' | 'admin' | 'teacher' | 'student';

export interface ContactoEmergencia {
  nombre: string;
  telefono: string;
  relacion: string;
}

export interface Institution {
  id: string;
  nombre: string;
  subdominio: string;
  tipo: 'colegio' | 'corporacion' | 'universidad';
  escala_maxima: number;
  nota_minima_aprobacion: number;
  activa: boolean;
}

export interface User {
  id: string;
  email: string;
  rol: Role;
  nombre: string;
  apellido: string;
  identificacion?: string;
  tipo_documento?: string;
  genero?: string;
  fecha_nacimiento?: string;
  eps?: string;
  tipo_sangre?: string;
  contacto_emergencia?: ContactoEmergencia;
  discapacidad?: string;
  institucion_id: string | null;
  activo: boolean;
}

export interface Grade {
  id: string;
  institucion_id: string;
  nombre: string;
  tipo_grado: string;
}

export interface Subject {
  id: string;
  institucion_id: string;
  nombre: string;
  descripcion: string;
}

export interface Assignment {
  id: string;
  profesor_id: string;
  materia_id: string;
  grado_id: string;
  institucion_id: string;
}

export interface StudentGrade {
  id: string;
  estudiante_id: string;
  grado_id: string;
}

export interface Attendance {
  id: string;
  estudiante_id: string;
  materia_id: string;
  grado_id: string;
  fecha: string;
  estado: 'presente' | 'ausente' | 'justificada';
  periodo_id?: string | null;
  registrado_por: string;
}

export interface Mark {
  id: string;
  estudiante_id: string;
  materia_id: string;
  grado_id: string;
  evaluacion_id: string;
  tipo_evaluacion: string;
  fecha_evaluacion: string;
  porcentaje: number;
  nota: number;
  periodo: string;
  anio?: string;
  periodo_id?: string | null;
  registrado_por: string;
}

export interface Citation {
  id: string;
  estudiante_id: string;
  materia_id: string;
  fecha_citacion: string;
  motivo: string;
  estado: 'pendiente' | 'realizada' | 'cancelada';
  creado_por: string;
}

export interface Message {
  id: string;
  remitente_id: string;
  destinatario_id: string;
  materia_id: string | null;
  asunto: string;
  cuerpo: string;
  leido: boolean;
  created_at: string;
}

export interface Evaluation {
  id: string;
  institucion_id: string;
  materia_id: string;
  grado_id: string;
  nombre: string;
  fecha_evaluacion: string;
  porcentaje: number;
  periodo: string;
  anio?: string;
  periodo_id?: string | null;
  creado_por: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

/** Catálogo de periodos académicos de una institución (fase 2: administración). */
export interface AcademicPeriod {
  id: string;
  institucion_id: string;
  nombre: string;
  numero: number;
  anio: number;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
}

export interface AcademicHistoryEvaluation {
  evaluacion_id: string;
  tipo_evaluacion: string;
  fecha_evaluacion: string | null;
  nota: number;
  porcentaje: number | null;
}

export interface AcademicHistorySubject {
  materia_id: string;
  subject: string;
  evaluations: AcademicHistoryEvaluation[];
}

export interface AcademicHistoryPeriod {
  period: string;
  periodo_id?: string | null;
  numero?: number | null;
  nombre?: string | null;
  anio?: number | null;
  grade: { id: string; label: string } | null;
  subjects: AcademicHistorySubject[];
}

export interface AcademicHistoryYear {
  year: string;
  periods: AcademicHistoryPeriod[];
}

export interface AcademicHistory {
  student: {
    id: string;
    email: string;
    nombre: string;
    apellido: string;
    identificacion: string | null;
    tipo_documento: string | null;
  };
  years: AcademicHistoryYear[];
}


