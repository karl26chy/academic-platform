import * as XLSX from 'xlsx';
import { formatRows, type ExportTable } from './types';

export function exportToExcel({ title, headers, rows, fileName }: ExportTable) {
  const data = [headers, ...formatRows(rows)];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = headers.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

