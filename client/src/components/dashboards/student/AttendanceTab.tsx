import React from 'react';
import { Card, CardTitle, EmptyMessage, StatCard, TableWrapper, TableHead, TableBody } from '../../ui';
import { periodLabel } from '../../../lib/periods';
import type { AttendanceCounts } from '../../../lib/attendance';
import type { AcademicPeriod, Attendance } from '../../../types';

interface AttendanceTabProps {
  records: Attendance[];
  counts: AttendanceCounts;
  presenceRate: number;
  periods: AcademicPeriod[];
  getSubjectName: (subjectId: string) => string;
  getTeacherName: (teacherId: string) => string;
}

const ESTADO_STYLE: Record<string, string> = {
  presente: 'bg-emerald-100 text-emerald-600',
  ausente: 'bg-red-100 text-red-600',
  justificada: 'bg-amber-100 text-amber-600',
};

const ESTADO_LABEL: Record<string, string> = {
  presente: 'Asistencia',
  ausente: 'Inasistencia',
  justificada: 'Inasistencia justificada',
};

/** Métricas y bitácora de asistencia del estudiante, agrupada por periodo. */
export const AttendanceTab: React.FC<AttendanceTabProps> = ({
  records,
  counts,
  presenceRate,
  periods,
  getSubjectName,
  getTeacherName,
}) => {
  const periodLabelOf = (id?: string | null): string => {
    const p = periods.find(per => per.id === id);
    return p ? periodLabel(p) : 'Sin periodo';
  };

  const grouped = records.reduce<Record<string, Attendance[]>>((acc, a) => {
    const key = a.periodo_id || '__sin_periodo__';
    (acc[key] = acc[key] || []).push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <StatCard label="Tasa de Asistencia" value={`${presenceRate}%`} />
        <StatCard label="Asistencias" value={counts.presente} valueClassName="text-emerald-600" />
        <StatCard label="Inasistencias" value={counts.ausente} valueClassName="text-red-600" />
        <StatCard label="Inasist. justificadas" value={counts.justificada} valueClassName="text-amber-600" />
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="">Bitácora de Asistencia</CardTitle>
        </div>

        {records.length === 0 ? (
          <EmptyMessage className="text-gray-500 text-sm">
            No cuentas con registros de asistencia.
          </EmptyMessage>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([periodoId, atts]) => (
              <div key={periodoId}>
                <h4 className="text-xs font-bold uppercase tracking-wider text-q10-600 mb-2">
                  {periodLabelOf(periodoId)}
                </h4>
                <TableWrapper>
                  <TableHead>
                    <th className="pb-3">Fecha</th>
                    <th className="pb-3">Materia</th>
                    <th className="pb-3">Docente</th>
                    <th className="pb-3 text-right">Estado</th>
                  </TableHead>
                  <TableBody>
                    {atts.map(att => (
                      <tr key={att.id} className="hover:bg-gray-50">
                        <td className="py-3 text-gray-600 font-medium">{att.fecha}</td>
                        <td className="py-3 text-gray-600">{getSubjectName(att.materia_id)}</td>
                        <td className="py-3 text-gray-500">{getTeacherName(att.registrado_por)}</td>
                        <td className="py-3 text-right">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${ESTADO_STYLE[att.estado]}`}>
                            {ESTADO_LABEL[att.estado] || att.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </TableBody>
                </TableWrapper>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
