import * as XLSX from 'xlsx';
import type { AcademicYearReportData, ReportConfig } from '../types';
import { mergeConfig, reportFileName } from '../template';

/** Plantilla DEFAULT del boletín anual en Excel (genérica, datos dinámicos). */
export function renderBoletinExcel(data: AcademicYearReportData, config: ReportConfig | null) {
  const opts = mergeConfig(config);
  const gradeLabel = data.grade ? `${data.grade.nombre} "${data.grade.tipo_grado}"` : 'Sin asignar';

  const aoa: (string | number)[][] = [
    [`Boletín de Calificaciones - ${data.institution.nombre}`],
    [`Año: ${data.year}`],
    [],
    ['Estudiante', `${data.student.nombre} ${data.student.apellido}`],
    ['Documento', `${data.student.tipo_documento || ''} ${data.student.identificacion || ''}`],
    ['Grado', gradeLabel],
    ['Género', data.student.genero || 'N/E'],
    ['Edad', data.student.edad ?? '—'],
    [],
  ];

  const head: string[] = ['Materia'];
  if (opts.showTeacher) head.push('Docente');
  for (const p of data.periods) head.push(`P${p.period.numero} (V/D)`);
  head.push('Definitiva');
  aoa.push(head);

  for (const s of data.subjects) {
    const row: (string | number)[] = [s.materia];
    if (opts.showTeacher) row.push(s.docente || '—');
    for (const b of s.porPeriodo) {
      row.push(b.valoracion === null ? '—' : `${b.valoracion} ${b.desempeno || ''}`.trim());
    }
    row.push(s.definitiva === null ? '—' : `${s.definitiva} ${s.desempenoDefinitiva || ''}`.trim());
    aoa.push(row);
  }

  aoa.push(
    [],
    ['Promedio General Definitivo', data.summary.promedioGeneralDefinitivo ?? '—'],
    ['Desempeño Global', data.summary.desempenoGlobal || 'Sin notas'],
    ['Escala de calificación', `0 - ${data.summary.escalaMaxima}`],
    ['Nota mínima de aprobación', data.summary.notaMinimaAprobacion],
    [],
    ['Asistencia'],
    ['Presente', data.attendance.presente],
    ['Ausente', data.attendance.ausente],
    ['Inasist. justificadas', data.attendance.justificada],
    ['Total', data.attendance.total],
    ['Tasa (%)', data.attendance.tasa],
  );

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 30 }, { wch: 24 }, { wch: 14 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Boletín');
  XLSX.writeFile(wb, reportFileName(data, 'xlsx'));
}
