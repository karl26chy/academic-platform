export type Row = (string | number | boolean)[];

export interface ExportTable {
  title: string;
  headers: string[];
  rows: Row[];
  fileName: string;
}

export interface BoletinMateria {
  nombre: string;
  evaluaciones: number;
  promedio: number;
  estado: string;
}

export interface BoletinData {
  institucion: string;
  estudiante: string;
  identificacion: string;
  documento: string;
  grado: string;
  edad: number | string;
  genero: string;
  materias: BoletinMateria[];
  promedioGeneral: number | string;
  notaMinima: number;
  asistenciaTasa: number;
  ausencias: number;
  justificadas: number;
  fileName: string;
}

export const formatRows = (rows: Row[]): string[][] =>
  rows.map(r => r.map(cell => String(cell)));
