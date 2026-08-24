import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, GraduationCap, History, Loader2 } from 'lucide-react';
import { api } from '../../../services/api';
import { Card, CardTitle, EmptyMessage, ExportButtons } from '../../ui';
import { weightedAverage } from '../../../lib/grades';
import { periodLabel } from '../../../lib/periods';
import { documentoCompleto } from '../../../lib/documentTypes';
import type { AcademicHistory, AcademicHistorySubject, AcademicHistoryPeriod } from '../../../types';

interface AcademicHistoryViewProps {
  /** ID del estudiante cuyo historial se consulta. */
  studentId: string;
  /** Estudiante opcional para el encabezado (se muestra el nombre/documento). */
  student?: { nombre?: string; apellido?: string; identificacion?: string; tipo_documento?: string } | null;
  /** Oculta el botón de exportación (PDF/Excel); el portal del estudiante no lo muestra. */
  hideExport?: boolean;
}

/** "2026-08-10" → "10/08/2026" (sin depender de zona horaria). */
function formatFecha(fecha?: string | null): string {
  if (!fecha) return '';
  const [y, m, d] = fecha.split('-');
  return y && m && d ? `${d}/${m}/${y}` : fecha;
}

const promedioMateria = (subject: AcademicHistorySubject): number =>
  weightedAverage(subject.evaluations.map(ev => ({ nota: ev.nota, porcentaje: ev.porcentaje ?? 0 })));

/** "Periodo N — nombre — año" cuando el backend trae los datos del periodo. */
const historyPeriodLabel = (p: AcademicHistoryPeriod): string => {
  if (p.numero || p.nombre || p.anio) {
    return periodLabel({ numero: p.numero ?? null, nombre: p.nombre || p.period, anio: p.anio ?? null });
  }
  return p.period;
};

/**
 * Historial académico individual por estudiante: Año → Periodo → Grado →
 * Materias → Evaluaciones. Se reutiliza en el portal del estudiante y en el
 * panel del administrador. Consulta el backend con el token de la sesión.
 */
export const AcademicHistoryView: React.FC<AcademicHistoryViewProps> = ({ studentId, student, hideExport = false }) => {
  const [data, setData] = useState<AcademicHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [openYears, setOpenYears] = useState<Record<string, boolean>>({});
  const [openPeriods, setOpenPeriods] = useState<Record<string, boolean>>({});

  const load = useCallback(async (anio?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getStudentAcademicHistory(studentId, anio && anio !== 'all' ? { anio } : undefined);
      setData(result);
      // Abre el primer año por defecto.
      setOpenYears(prev => {
        const next = { ...prev };
        result.years.forEach((y, i) => { next[y.year] = prev[y.year] ?? i === 0; });
        return next;
      });
      setOpenPeriods({});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al consultar el historial.');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { load(selectedYear); }, [load, selectedYear]);

  const years = useMemo(() => data?.years ?? [], [data]);

  const toggleYear = (year: string) => setOpenYears(prev => ({ ...prev, [year]: !prev[year] }));
  const togglePeriod = (key: string) => setOpenPeriods(prev => ({ ...prev, [key]: !prev[key] }));

  const exportTable = () => {
    const rows: (string | number)[][] = [];
    for (const y of years) {
      for (const p of y.periods) {
        for (const s of p.subjects) {
          const avg = promedioMateria(s);
          rows.push([y.year, historyPeriodLabel(p), p.grade?.label ?? '', s.subject, 'Promedio', avg]);
          for (const ev of s.evaluations) {
            rows.push([y.year, historyPeriodLabel(p), p.grade?.label ?? '', s.subject, ev.tipo_evaluacion, ev.nota]);
          }
        }
      }
    }
    return {
      title: 'Historial Académico',
      headers: ['Año', 'Periodo', 'Grado', 'Materia', 'Evaluación', 'Nota'],
      rows,
      fileName: `historial_${student?.nombre || studentId}`,
    };
  };

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <History className="h-5 w-5 text-q10-600 shrink-0" />
          <div className="min-w-0">
            <CardTitle className="">Historial Académico</CardTitle>
            {student && (
              <p className="text-xs text-gray-500 truncate">
                {student.nombre} {student.apellido} · {documentoCompleto(student.tipo_documento, student.identificacion)}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none"
          >
            <option value="all">Todos los años</option>
            {years.map(y => <option key={y.year} value={y.year}>{y.year}</option>)}
          </select>
          {!hideExport && <ExportButtons build={exportTable} />}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Cargando historial...
        </div>
      ) : error ? (
        <EmptyMessage className="text-red-500 text-sm py-6 text-center">{error}</EmptyMessage>
      ) : years.length === 0 ? (
        <EmptyMessage className="text-gray-500 text-sm py-8 text-center">
          No hay notas registradas en el historial de este estudiante.
        </EmptyMessage>
      ) : (
        <div className="space-y-4">
          {years.map(year => (
            <div key={year.year} className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleYear(year.year)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <span className="flex items-center gap-2 font-bold text-gray-900">
                  <GraduationCap className="h-4 w-4 text-q10-600" /> Año {year.year}
                </span>
                {openYears[year.year] ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
              </button>

              {openYears[year.year] && (
                <div className="p-4 space-y-3">
                  {year.periods.map(period => {
                    const periodKey = `${year.year}:${period.period}`;
                    const open = openPeriods[periodKey];
                    return (
                      <div key={periodKey} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <button
                          onClick={() => togglePeriod(periodKey)}
                          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <span>
                            {historyPeriodLabel(period)}
                            {period.grade && (
                              <span className="ml-2 text-xs font-medium text-gray-400">Grado: {period.grade.label}</span>
                            )}
                          </span>
                          {open ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                        </button>

                        {open && (
                          <div className="px-4 pb-4 space-y-4">
                            {period.subjects.map(subject => {
                              const avg = promedioMateria(subject);
                              return (
                                <div key={subject.materia_id}>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-sm font-semibold text-gray-900">{subject.subject}</span>
                                    <span className="text-xs font-semibold text-q10-600">Promedio: {avg.toFixed(1)}</span>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="text-left text-gray-400 border-b border-gray-100">
                                          <th className="pb-1 pr-2 font-medium">Evaluación</th>
                                          <th className="pb-1 pr-2 font-medium">Fecha</th>
                                          <th className="pb-1 pr-2 font-medium">%</th>
                                          <th className="pb-1 text-right font-medium">Nota</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {subject.evaluations.map(ev => (
                                          <tr key={ev.evaluacion_id} className="border-b border-gray-50 last:border-0">
                                            <td className="py-1 pr-2 text-gray-700">{ev.tipo_evaluacion}</td>
                                            <td className="py-1 pr-2 text-gray-500">{formatFecha(ev.fecha_evaluacion)}</td>
                                            <td className="py-1 pr-2 text-gray-500">{ev.porcentaje ?? '—'}</td>
                                            <td className="py-1 text-right font-bold text-gray-900">{ev.nota.toFixed(1)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
