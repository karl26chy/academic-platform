import React from 'react';
import { Card, CardTitle, EmptyMessage, TableWrapper, TableHead, TableBody } from '../../ui';
import { SubjectPerformanceChart, type SubjectChartDatum } from '../../charts/SubjectPerformanceChart';
import { maxScoreFor } from '../../../lib/grades';
import type { Institution, Mark } from '../../../types';

interface GradesTabProps {
  chartData: SubjectChartDatum[];
  marks: Mark[];
  institution: Institution | null;
  getSubjectName: (subjectId: string) => string;
  /** Resuelve "Periodo N — nombre — año" desde periodo_id (fallback al texto). */
  periodLabelOf?: (periodoId?: string | null, fallback?: string) => string;
}

/** "2026-08-10" → "10/08/2026" (sin depender de zona horaria). */
function formatFecha(fecha?: string): string {
  if (!fecha) return '';
  const [y, m, d] = fecha.split('-');
  return y && m && d ? `${d}/${m}/${y}` : fecha;
}

/** Rendimiento académico: gráfica por materia y boleta detallada. */
export const GradesTab: React.FC<GradesTabProps> = ({
  chartData,
  marks,
  institution,
  getSubjectName,
  periodLabelOf,
}) => {
  const periodOf = (m: Mark): string =>
    periodLabelOf ? periodLabelOf(m.periodo_id, m.periodo) : (m.periodo || '');

  return (
    <div className="space-y-6 animate-fade-in">
      <Card>
        <CardTitle>Rendimiento Académico por Materia</CardTitle>
        {chartData.length === 0 ? (
          <EmptyMessage className="text-sm text-gray-500 py-6">
            Aún no cuentas con calificaciones registradas.
          </EmptyMessage>
        ) : (
          <SubjectPerformanceChart
            data={chartData}
            dataKey="Nota Promedio"
            maxScore={maxScoreFor(institution)}
            notaMinima={institution?.nota_minima_aprobacion}
            referenceLabel={`Mínima (${institution?.nota_minima_aprobacion.toFixed(1)})`}
            referenceLabelPosition="insideBottomRight"
            height="h-80"
            gridStroke="#1e293b"
            showActiveDot
            highlightTooltipLabel
          />
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="">Boleta de Calificaciones Detallada</CardTitle>
        </div>

        {marks.length === 0 ? (
          <EmptyMessage className="text-gray-500 text-sm py-2">
            No hay calificaciones individuales guardadas.
          </EmptyMessage>
        ) : (
          <TableWrapper>
            <TableHead>
              <th className="pb-3">Materia</th>
              <th className="pb-3">Evaluación</th>
              <th className="pb-3">Periodo</th>
              <th className="pb-3">Fecha</th>
              <th className="pb-3 text-right">Nota Obtenida</th>
            </TableHead>
            <TableBody>
              {marks.map(m => {
                const isPassing = institution ? m.nota >= institution.nota_minima_aprobacion : true;
                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="py-3 font-semibold text-gray-900">{getSubjectName(m.materia_id)}</td>
                    <td className="py-3 text-gray-600">{m.tipo_evaluacion}</td>
                    <td className="py-3 text-gray-500">{periodOf(m)}</td>
                    <td className="py-3 text-gray-500">{formatFecha(m.fecha_evaluacion)}</td>
                    <td className="py-3 text-right">
                      <span
                        className={`font-bold text-base px-2.5 py-0.5 rounded ${
                          isPassing ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'
                        }`}
                      >
                        {m.nota.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </TableBody>
          </TableWrapper>
        )}
      </Card>
    </div>
  );
};
