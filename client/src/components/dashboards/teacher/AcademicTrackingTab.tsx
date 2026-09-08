import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Eye } from 'lucide-react';
import { Card, EmptyMessage, StatCard, TableWrapper, TableHead, TableBody, Modal, ModalCloseButton } from '../../ui';
import { studentFullName } from '../../../lib/people';
import { weightedAverage } from '../../../lib/grades';
import { periodLabel } from '../../../lib/periods';
import {
  getStudentAcademicStatus,
  academicStatusBadgeClass,
} from '../../../lib/academicStatus';
import type { Assignment, Evaluation, Grade, Mark, Subject, User, AcademicPeriod } from '../../../types';

interface AcademicTrackingTabProps {
  assignment: Assignment;
  subject?: Subject | null;
  grade?: Grade | null;
  students: User[];
  evaluations: Evaluation[];
  marks: Mark[];
  periods: AcademicPeriod[];
  activePeriod: AcademicPeriod | null;
  escalaMaxima: number;
  notaMinima: number;
}

export const AcademicTrackingTab: React.FC<AcademicTrackingTabProps> = ({
  assignment,
  subject,
  grade,
  students,
  evaluations,
  marks,
  periods,
  activePeriod,
  escalaMaxima,
  notaMinima,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);

  // Períodos ordenados cronológicamente por año y número de período
  const sortedPeriods = useMemo(() => {
    return [...periods].sort((a, b) => a.anio - b.anio || a.numero - b.numero);
  }, [periods]);

  // Mapa de notas por estudiante en el período activo
  const studentData = useMemo(() => {
    return students.map(student => {
      // Filtrar notas de este estudiante para el grado y materia seleccionados
      const studentMarksForSubject = marks.filter(
        m =>
          m.estudiante_id === student.id &&
          m.materia_id === assignment.materia_id &&
          m.grado_id === assignment.grado_id
      );

      // Notas del período activo
      const activePeriodMarks = activePeriod
        ? studentMarksForSubject.filter(
            m => m.periodo_id === activePeriod.id || m.periodo === activePeriod.nombre
          )
        : [];

      const evalCount = activePeriodMarks.length;
      const promedio =
        evalCount > 0
          ? weightedAverage(activePeriodMarks.map(m => ({ nota: m.nota, porcentaje: m.porcentaje })))
          : null;

      const status = getStudentAcademicStatus(promedio, escalaMaxima, notaMinima);

      return {
        student,
        activePeriodMarks,
        evalCount,
        promedio,
        status,
        studentMarksForSubject,
      };
    });
  }, [students, marks, assignment, activePeriod, escalaMaxima, notaMinima]);

  // Resumen general del grupo para el período activo
  const summaryMetrics = useMemo(() => {
    const totalStudents = students.length;
    const studentsWithMarks = studentData.filter(s => s.promedio !== null);

    const groupAverage =
      studentsWithMarks.length > 0
        ? Number(
            (
              studentsWithMarks.reduce((acc, s) => acc + (s.promedio ?? 0), 0) /
              studentsWithMarks.length
            ).toFixed(2)
          )
        : null;

    const requiringAttention = studentData.filter(s => s.status === 'Requiere atención').length;

    return {
      totalStudents,
      groupAverage,
      requiringAttention,
    };
  }, [students.length, studentData]);

  // Filtrado de la lista según el filtro seleccionado
  const filteredStudents = useMemo(() => {
    if (statusFilter === 'Todos') return studentData;
    return studentData.filter(s => s.status === statusFilter);
  }, [studentData, statusFilter]);

  // Cálculo del detalle del estudiante seleccionado
  const selectedStudentDetails = useMemo(() => {
    if (!selectedStudent) return null;

    const sData = studentData.find(s => s.student.id === selectedStudent.id);
    if (!sData) return null;

    // Evolución por períodos
    const periodEvolution = sortedPeriods.map(p => {
      const pMarks = sData.studentMarksForSubject.filter(
        m => m.periodo_id === p.id || m.periodo === p.nombre
      );
      const pAvg =
        pMarks.length > 0
          ? weightedAverage(pMarks.map(m => ({ nota: m.nota, porcentaje: m.porcentaje })))
          : null;

      return {
        period: p,
        average: pAvg,
        evalCount: pMarks.length,
      };
    });

    // Indicador de tendencia si hay período activo y período previo con notas
    let trend: 'Mejorando' | 'Estable' | 'Bajando' | null = null;

    if (activePeriod) {
      const activeIdx = periodEvolution.findIndex(item => item.period.id === activePeriod.id);
      if (activeIdx > 0) {
        const currentAvg = periodEvolution[activeIdx]?.average;
        // Buscar el período previo más cercano que tenga notas
        const prevItem = periodEvolution
          .slice(0, activeIdx)
          .reverse()
          .find(item => item.average !== null);

        if (currentAvg !== null && prevItem && prevItem.average !== null) {
          if (currentAvg > prevItem.average) trend = 'Mejorando';
          else if (currentAvg === prevItem.average) trend = 'Estable';
          else trend = 'Bajando';
        }
      }
    }

    return {
      ...sData,
      periodEvolution,
      trend,
    };
  }, [selectedStudent, studentData, sortedPeriods, activePeriod]);

  if (!assignment) {
    return (
      <Card className="p-6 text-center">
        <EmptyMessage className="text-sm text-gray-500">
          Selecciona una materia y grado para consultar el seguimiento académico.
        </EmptyMessage>
      </Card>
    );
  }

  if (students.length === 0) {
    return (
      <Card className="p-6 text-center">
        <EmptyMessage className="text-sm text-gray-500">
          No hay estudiantes matriculados en {grade?.nombre || 'este grado'}.
        </EmptyMessage>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen del Grupo Compacto */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Promedio del Grupo"
          value={summaryMetrics.groupAverage !== null ? summaryMetrics.groupAverage.toFixed(2) : '—'}
          valueClassName="text-q10-600"
        />
        <StatCard
          label="Estudiantes"
          value={summaryMetrics.totalStudents}
          valueClassName="text-gray-900"
        />
        <StatCard
          label="Requieren Atención"
          value={summaryMetrics.requiringAttention}
          valueClassName={summaryMetrics.requiringAttention > 0 ? 'text-red-600' : 'text-emerald-600'}
        />
      </div>

      {/* Tabla con Filtro de Estado */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Seguimiento Académico - {subject?.nombre} ({grade?.nombre})
            </h3>
            <p className="text-xs text-gray-500">
              Desempeño del grupo en el período seleccionado. Escala máxima: {escalaMaxima}
            </p>
          </div>

          {/* Filtro por estado */}
          <div className="flex flex-wrap items-center gap-1.5 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
            {['Todos', 'Requiere atención', 'En seguimiento', 'Buen rendimiento', 'Sin notas'].map(
              f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                    statusFilter === f
                      ? 'bg-white text-q10-600 shadow-xs border border-gray-200'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {f}
                </button>
              )
            )}
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <EmptyMessage className="py-8 text-sm text-gray-500">
            No se encontraron estudiantes con el estado "{statusFilter}".
          </EmptyMessage>
        ) : (
          <TableWrapper>
            <TableHead>
              <tr>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Estudiante
                </th>
                <th className="py-3 px-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Promedio
                </th>
                <th className="py-3 px-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Evaluaciones
                </th>
                <th className="py-3 px-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Estado
                </th>
                <th className="py-3 px-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Acción
                </th>
              </tr>
            </TableHead>
            <TableBody>
              {filteredStudents.map(({ student, evalCount, promedio, status }) => (
                <tr key={student.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="py-3 px-4 text-sm font-medium text-gray-900">
                    {studentFullName(student)}
                  </td>
                  <td className="py-3 px-4 text-sm font-bold text-center text-gray-900">
                    {promedio !== null ? promedio.toFixed(2) : '—'}
                  </td>
                  <td className="py-3 px-4 text-xs text-center text-gray-500">
                    {evalCount} {evalCount === 1 ? 'registrada' : 'registradas'}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${academicStatusBadgeClass(
                        status
                      )}`}
                    >
                      {status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedStudent(student)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-q10-600 bg-q10-50 hover:bg-q10-100 rounded-lg transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" /> Ver detalle
                    </button>
                  </td>
                </tr>
              ))}
            </TableBody>
          </TableWrapper>
        )}
      </Card>

      {/* Modal / Drawer de Detalle del Estudiante */}
      {selectedStudent && selectedStudentDetails && (
        <Modal onClose={() => setSelectedStudent(null)} size="lg">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {studentFullName(selectedStudent)}
              </h3>
              <p className="text-xs text-gray-500">
                Detalle académico — {subject?.nombre} ({grade?.nombre})
              </p>
            </div>
            <ModalCloseButton onClose={() => setSelectedStudent(null)} />
          </div>

          {/* Resumen del estudiante */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <div>
              <span className="text-[11px] font-semibold text-gray-500 block uppercase">
                Promedio Actual
              </span>
              <span className="text-xl font-bold text-gray-900">
                {selectedStudentDetails.promedio !== null
                  ? selectedStudentDetails.promedio.toFixed(2)
                  : '—'}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-gray-500 block uppercase">
                Estado Académico
              </span>
              <span
                className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${academicStatusBadgeClass(
                  selectedStudentDetails.status
                )}`}
              >
                {selectedStudentDetails.status}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[11px] font-semibold text-gray-500 block uppercase">
                Tendencia
              </span>
              {selectedStudentDetails.trend ? (
                <span
                  className={`inline-flex items-center gap-1 mt-1 text-xs font-semibold ${
                    selectedStudentDetails.trend === 'Mejorando'
                      ? 'text-emerald-700'
                      : selectedStudentDetails.trend === 'Estable'
                      ? 'text-blue-700'
                      : 'text-red-700'
                  }`}
                >
                  {selectedStudentDetails.trend === 'Mejorando' && <TrendingUp className="h-3.5 w-3.5" />}
                  {selectedStudentDetails.trend === 'Estable' && <Minus className="h-3.5 w-3.5" />}
                  {selectedStudentDetails.trend === 'Bajando' && <TrendingDown className="h-3.5 w-3.5" />}
                  {selectedStudentDetails.trend}
                </span>
              ) : (
                <span className="text-xs text-gray-500 mt-1 block">Sin datos suficientes</span>
              )}
            </div>
          </div>

          {/* Evaluaciones del período activo */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Evaluaciones en el período seleccionado
            </h4>

            {selectedStudentDetails.activePeriodMarks.length === 0 ? (
              <p className="text-xs text-gray-500 py-3 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                Sin notas registradas en este período.
              </p>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                {selectedStudentDetails.activePeriodMarks.map(m => (
                  <div key={m.id} className="p-3 flex items-center justify-between bg-white text-xs">
                    <div>
                      <span className="font-semibold text-gray-900 block">
                        {m.tipo_evaluacion || 'Evaluación'}
                      </span>
                      {m.fecha_evaluacion && (
                        <span className="text-gray-500 text-[11px]">{m.fecha_evaluacion}</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-sm text-gray-900 block">
                        {Number(m.nota).toFixed(1)} / {escalaMaxima}
                      </span>
                      {m.porcentaje > 0 && (
                        <span className="text-gray-500 text-[11px]">{m.porcentaje}% del período</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evolución por períodos */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600">
              Evolución por períodos ({subject?.nombre})
            </h4>

            {selectedStudentDetails.periodEvolution.length === 0 ? (
              <p className="text-xs text-gray-500 py-2">No hay información de períodos disponible.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {selectedStudentDetails.periodEvolution.map(({ period, average }) => (
                  <div
                    key={period.id}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      activePeriod?.id === period.id
                        ? 'bg-q10-50 border-q10-300'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <span className="text-[11px] font-semibold text-gray-500 block truncate">
                      {periodLabel(period)}
                    </span>
                    <span className="text-sm font-bold text-gray-900 block mt-0.5">
                      {average !== null ? average.toFixed(2) : 'Sin notas'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
