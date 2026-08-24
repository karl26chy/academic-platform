import * as XLSX from 'xlsx';
import { formatRows, type BoletinData, type ExportTable } from './types';

export function exportToExcel({ title, headers, rows, fileName }: ExportTable) {
  const data = [headers, ...formatRows(rows)];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = headers.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export function exportBoletinToExcel(data: BoletinData) {
  const aoa: (string | number)[][] = [
    [`Boletín Informativo - ${data.institucion}`],
    [],
    ['Estudiante', data.estudiante],
    ['Documento', data.documento],
    ['Grado', data.grado],
    ['Edad', data.edad],
    ['Género', data.genero],
    [],
    ['Materia', 'Evaluaciones', 'Promedio', 'Estado'],
    ...data.materias.map(m => [m.nombre, m.evaluaciones, m.promedio, m.estado]),
    [],
    ['Promedio General', data.promedioGeneral],
    [],
    ['Asistencia'],
    ['Tasa de Asistencia (%)', data.asistenciaTasa],
    ['Ausencias', data.ausencias],
    ['Inasist. Justificadas', data.justificadas],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 12 }, { wch: 22 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Boletín');
  XLSX.writeFile(wb, `${data.fileName}.xlsx`);
}
