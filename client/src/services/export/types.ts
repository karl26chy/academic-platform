export type Row = (string | number | boolean)[];

export interface ExportTable {
  title: string;
  headers: string[];
  rows: Row[];
  fileName: string;
}

export const formatRows = (rows: Row[]): string[][] =>
  rows.map(r => r.map(cell => String(cell)));
