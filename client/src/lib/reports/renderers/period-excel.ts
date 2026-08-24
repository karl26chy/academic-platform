import * as XLSX from 'xlsx';
import type { AcademicReportData } from '../types';

/**
 * Boletín POR PERÍODO en Excel (SheetJS).
 * Consume exactamente AcademicReportData; no recalcula nada.
 */
export function renderBoletinPeriodExcel(data: AcademicReportData) {
  const per = data.period;
  const gradeLabel = data.grade ? `${data.grade.nombre} "${data.grade.tipo_grado}"` : 'Sin asignar';
  const ident = `${data.student.tipo_documento || ''} ${data.student.identificacion || ''}`.trim() || 'N/R';
  const num = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v);

  const aoa: (string | number)[][] = [
    [`Boletín de Calificaciones - ${data.institution.nombre}`],
    [`Período ${per.numero}${per.nombre ? ` (${per.nombre})` : ''} - Año ${per.anio}`],
    [],
    ['Estudiante', `${data.student.nombre} ${data.student.apellido}`],
    ['Identificación', ident],
    ['Grado', gradeLabel],
    [],
    ['Materia', 'Docente', 'Evaluaciones', 'Promedio', 'Estado'],
    ...data.subjects.map(s => [
      s.materia,
      s.docente || '—',
      s.evaluaciones?.length ?? 0,
      num(s.promedio),
      s.estado,
    ]),
    [],
    ['Promedio General', num(data.summary.promedioGeneral)],
    ['Estado Global', data.summary.estadoGlobal],
    ['Escala Máxima', data.summary.escalaMaxima],
    ['Nota Mínima de Aprobación', data.summary.notaMinimaAprobacion],
    [],
    ['Asistencia'],
    ['Presentes', data.attendance.presente],
    ['Ausentes', data.attendance.ausente],
    ['Inasistencias Justificadas', data.attendance.justificada],
    ['Total', data.attendance.total],
    ['Tasa (%)', data.attendance.tasa],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 30 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Boletín');

  const base = `${data.student.nombre}_${data.student.apellido}`.replace(/\s+/g, '_');
  XLSX.writeFile(wb, `${base}_Periodo_${per.numero}_${per.anio}.xlsx`);
}
