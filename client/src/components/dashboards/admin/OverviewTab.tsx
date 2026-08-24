import React from 'react';
import { AlertTriangle, Award, BarChart3, Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardTitle, EmptyMessage, StatCard, TableWrapper, TableHead, TableBody } from '../../ui';
import { SubjectPerformanceChart } from '../../charts/SubjectPerformanceChart';
import { useAcademicRisk } from './useAcademicRisk';
import { maxScoreFor } from '../../../lib/grades';
import type { Institution } from '../../../types';

interface LowPerfSubject {
  id: string;
  nombre: string;
  promedio: number;
  deficit: boolean;
}

interface OverviewTabProps {
  institution: Institution | null;
  totals: { students: number; teachers: number; grades: number };
  subjectData: { name: string; Promedio: number }[];
  lowPerfSubjects: LowPerfSubject[];
}

/** Resumen institucional: métricas, rendimiento, riesgo y destacados. */
export const OverviewTab: React.FC<OverviewTabProps> = ({
  institution, totals, subjectData, lowPerfSubjects,
}) => {
  const { anio, riskByGrade, topByGrade, loading, error } = useAcademicRisk();

  const yearBadge = (clase: string) =>
    anio ? <span className={`text-[11px] font-semibold ${clase} px-2 py-0.5 rounded-full`}>{anio}</span> : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Estudiantes" value={totals.students} valueClassName="text-blue-600" />
        <StatCard label="Total Profesores" value={totals.teachers} valueClassName="text-emerald-600" />
        <StatCard label="Total Grados" value={totals.grades} valueClassName="text-purple-400" />
        <StatCard
          label="Nota Mín. Aprobación"
          value={institution?.nota_minima_aprobacion.toFixed(1)}
        />
      </div>

      {/* Rendimiento general por materia — ancho completo */}
      <Card>
        <CardTitle icon={<BarChart3 className="h-5 w-5 text-q10-600" />}>
          Rendimiento General por Materia
        </CardTitle>
        {subjectData.length === 0 ? (
          <EmptyMessage className="text-sm text-gray-500 py-8 text-center">
            No hay datos de rendimiento aún.
          </EmptyMessage>
        ) : (
          <div style={{ width: '100%', minHeight: 260 }}>
            <SubjectPerformanceChart
              data={subjectData}
              dataKey="Promedio"
              maxScore={maxScoreFor(institution)}
              notaMinima={institution?.nota_minima_aprobacion}
              referenceLabel={`Mín (${institution?.nota_minima_aprobacion})`}
            />
          </div>
        )}
      </Card>

      {/* Riesgo académico y destacados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle icon={<AlertTriangle className="h-5 w-5 text-red-500" />} className="items-center">
            Estudiantes en riesgo académico
            {yearBadge('bg-red-50 text-red-500')}
          </CardTitle>
          <p className="text-xs text-gray-400 -mt-1 mb-3">3 promedios más bajos de cada curso</p>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Calculando estado académico...
            </div>
          ) : error ? (
            <EmptyMessage className="text-red-500 text-sm">{error}</EmptyMessage>
          ) : riskByGrade.length === 0 ? (
            <EmptyMessage className="text-sm text-gray-500 py-6">
              No hay estudiantes con promedio válido en ningún curso.
            </EmptyMessage>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-4 pr-1">
              {riskByGrade.map(g => (
                <div key={g.gradeId ?? 'sin-grado'}>
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                    {g.gradeNombre}
                  </p>
                  <ul className="space-y-1.5">
                    {g.items.map((s, i) => (
                      <li key={s.studentId} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-5 w-5 shrink-0 rounded-full bg-red-100 text-red-600 text-[11px] font-bold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{s.nombre}</p>
                            <p className="text-xs text-gray-500 truncate">Asistencia: {s.asistenciaTasa}% · {s.gradeNombre}</p>
                          </div>
                        </div>
                        <span className="shrink-0 font-bold text-red-600">{s.promedio?.toFixed(1) ?? '—'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-gray-400 mt-3">
            Se muestran los 3 promedios más bajos de cada curso. La asistencia es un indicador informativo.
          </p>
        </Card>

        <Card>
          <CardTitle icon={<Award className="h-5 w-5 text-emerald-600" />} className="items-center">
            Estudiantes destacados
            {yearBadge('bg-emerald-50 text-emerald-600')}
          </CardTitle>
          <p className="text-xs text-gray-400 -mt-1 mb-3">3 promedios más altos de cada curso</p>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Calculando estado académico...
            </div>
          ) : error ? (
            <EmptyMessage className="text-red-500 text-sm">{error}</EmptyMessage>
          ) : topByGrade.length === 0 ? (
            <EmptyMessage className="text-sm text-gray-500 py-6">
              No hay estudiantes con promedio válido en ningún curso todavía.
            </EmptyMessage>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-4 pr-1">
              {topByGrade.map(g => (
                <div key={g.gradeId ?? 'sin-grado'}>
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                    {g.gradeNombre}
                  </p>
                  <ul className="space-y-1.5">
                    {g.items.map((s, i) => (
                      <li key={s.studentId} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-5 w-5 shrink-0 rounded-full bg-emerald-100 text-emerald-600 text-[11px] font-bold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{s.nombre}</p>
                            <p className="text-xs text-gray-500 truncate">Asistencia: {s.asistenciaTasa}% · {s.gradeNombre}</p>
                          </div>
                        </div>
                        <span className="shrink-0 font-bold text-emerald-600">{s.promedio?.toFixed(1) ?? '—'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-gray-400 mt-3">
            Se muestran los 3 promedios más altos de cada curso.
          </p>
        </Card>
      </div>

      <Card>
        <div className="mb-4">
          <CardTitle icon={<ShieldAlert className="h-5 w-5 text-amber-500" />} className="">
            Materias con Rendimiento Deficiente
          </CardTitle>
        </div>

        {lowPerfSubjects.length === 0 ? (
          <EmptyMessage className="text-gray-500 text-sm">
            No hay registros de notas para calcular el rendimiento.
          </EmptyMessage>
        ) : (
          <TableWrapper>
            <TableHead>
              <th className="pb-2">Materia</th>
              <th className="pb-2 text-center">Promedio General</th>
              <th className="pb-2 text-center">Estado</th>
            </TableHead>
            <TableBody>
              {lowPerfSubjects.map(subj => (
                <tr key={subj.id} className="hover:bg-gray-50">
                  <td className="py-3 font-medium text-gray-900">{subj.nombre}</td>
                  <td className="py-3 text-center text-gray-600 font-semibold">{subj.promedio}</td>
                  <td className="py-3 text-center">
                    {subj.deficit ? (
                      <span className="px-2.5 py-0.5 rounded bg-red-100 text-red-400 border border-red-100 text-xs font-medium">
                        Bajo la Mínima ({institution?.nota_minima_aprobacion})
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-600 border border-emerald-100 text-xs font-medium">
                        Aceptable
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </TableBody>
          </TableWrapper>
        )}
      </Card>
    </div>
  );
};
