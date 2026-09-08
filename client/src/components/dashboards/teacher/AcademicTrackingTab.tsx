import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Eye } from 'lucide-react';
import { EmptyMessage, Modal, ModalCloseButton } from '../../ui';
import { studentFullName } from '../../../lib/people';
import { weightedAverage } from '../../../lib/grades';
import { periodLabel } from '../../../lib/periods';
import {
  getStudentAcademicStatus,
  type AcademicTrackingStatus,
} from '../../../lib/academicStatus';
import type { Assignment, Grade, Mark, Subject, User, AcademicPeriod } from '../../../types';

interface AcademicTrackingTabProps {
  assignment: Assignment;
  subject?: Subject | null;
  grade?: Grade | null;
  students: User[];
  marks: Mark[];
  periods: AcademicPeriod[];
  activePeriod: AcademicPeriod | null;
  escalaMaxima: number;
  notaMinima: number;
}

const STATUS_FILTERS: Array<{ label: string; value: string }> = [
  { label: 'Ver Todos', value: 'Todos' },
  { label: 'Requiere Atención', value: 'Requiere atención' },
  { label: 'En Seguimiento', value: 'En seguimiento' },
  { label: 'Buen Rendimiento', value: 'Buen rendimiento' },
  { label: 'Sin Notas', value: 'Sin notas' },
];

export const AcademicTrackingTab: React.FC<AcademicTrackingTabProps> = ({
  assignment,
  subject,
  grade,
  students,
  marks,
  periods,
  activePeriod,
  escalaMaxima,
  notaMinima,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);

  // Períodos ordenados cronológicamente
  const sortedPeriods = useMemo(
    () => [...periods].sort((a, b) => a.anio - b.anio || a.numero - b.numero),
    [periods]
  );

  // Datos por estudiante para el período activo
  const studentData = useMemo(() => {
    return students.map(student => {
      const allSubjectMarks = marks.filter(
        m =>
          m.estudiante_id === student.id &&
          m.materia_id === assignment.materia_id &&
          m.grado_id === assignment.grado_id
      );

      const periodMarks = activePeriod
        ? allSubjectMarks.filter(
            m => m.periodo_id === activePeriod.id || m.periodo === activePeriod.nombre
          )
        : [];

      const promedio =
        periodMarks.length > 0
          ? weightedAverage(periodMarks.map(m => ({ nota: m.nota, porcentaje: m.porcentaje })))
          : null;

      return {
        student,
        periodMarks,
        evalCount: periodMarks.length,
        promedio,
        status: getStudentAcademicStatus(promedio, escalaMaxima, notaMinima),
        allSubjectMarks,
      };
    });
  }, [students, marks, assignment, activePeriod, escalaMaxima, notaMinima]);

  // Lista filtrada
  const filteredStudents = useMemo(
    () =>
      statusFilter === 'Todos'
        ? studentData
        : studentData.filter(s => s.status === statusFilter),
    [studentData, statusFilter]
  );

  // Detalle del estudiante seleccionado
  const selectedDetail = useMemo(() => {
    if (!selectedStudent) return null;
    const sData = studentData.find(s => s.student.id === selectedStudent.id);
    if (!sData) return null;

    const periodEvolution = sortedPeriods.map(p => {
      const pMarks = sData.allSubjectMarks.filter(
        m => m.periodo_id === p.id || m.periodo === p.nombre
      );
      return {
        period: p,
        average:
          pMarks.length > 0
            ? weightedAverage(pMarks.map(m => ({ nota: m.nota, porcentaje: m.porcentaje })))
            : null,
        evalCount: pMarks.length,
      };
    });

    let trend: 'Mejorando' | 'Estable' | 'Bajando' | null = null;
    if (activePeriod) {
      const activeIdx = periodEvolution.findIndex(x => x.period.id === activePeriod.id);
      if (activeIdx > 0) {
        const cur = periodEvolution[activeIdx]?.average;
        const prev = periodEvolution.slice(0, activeIdx).reverse().find(x => x.average !== null);
        if (cur !== null && prev?.average !== null && prev?.average !== undefined) {
          trend = cur > prev.average ? 'Mejorando' : cur === prev.average ? 'Estable' : 'Bajando';
        }
      }
    }

    return { ...sData, periodEvolution, trend };
  }, [selectedStudent, studentData, sortedPeriods, activePeriod]);

  if (!assignment) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        Selecciona una materia y grado para consultar el seguimiento académico.
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        No hay estudiantes matriculados en {grade?.nombre || 'este grado'}.
      </div>
    );
  }

  const periodDesc = activePeriod ? periodLabel(activePeriod) : 'Periodo Actual';
  const subjectName = subject?.nombre ?? 'Materia';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 pt-5 pb-4 border-b border-gray-100">
        <div>
          <h3 className="text-base font-bold text-gray-900">
            {subjectName} — {periodDesc}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Total: {students.length} estudiante{students.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Filtros inline */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${
                statusFilter === f.value
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      {filteredStudents.length === 0 ? (
        <EmptyMessage className="py-12 text-sm text-gray-400">
          No hay estudiantes con el estado "{statusFilter}".
        </EmptyMessage>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Estudiante
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Promedio
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Evaluaciones Registradas
              </th>
              <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Estado
              </th>
              <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                Acción
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredStudents.map(({ student, evalCount, promedio, status }) => (
              <tr key={student.id} className="hover:bg-gray-50/60 transition-colors">
                <td className="px-6 py-3.5 text-sm font-medium text-gray-800">
                  {studentFullName(student)}
                </td>
                <td className="px-4 py-3.5 text-sm font-semibold text-right text-gray-900">
                  {promedio !== null ? promedio.toFixed(2) : '—'}
                </td>
                <td className="px-4 py-3.5 text-sm text-center text-gray-500">
                  {evalCount}
                </td>
                <td className="px-4 py-3.5 text-center">
                  <StatusPill status={status} />
                </td>
                <td className="px-6 py-3.5 text-right">
                  <button
                    onClick={() => setSelectedStudent(student)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal de detalle */}
      {selectedStudent && selectedDetail && (
        <Modal onClose={() => setSelectedStudent(null)} size="lg">
          <div className="flex items-start justify-between pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {studentFullName(selectedStudent)}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {subjectName}
              </p>
            </div>
            <ModalCloseButton onClose={() => setSelectedStudent(null)} />
          </div>

          {/* Métricas del estudiante */}
          <div className="flex flex-wrap gap-6 py-4 border-b border-gray-100">
            <div>
              <p className="text-[11px] font-semibold uppercase text-gray-400">Promedio actual</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">
                {selectedDetail.promedio !== null ? selectedDetail.promedio.toFixed(2) : '—'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase text-gray-400">Estado</p>
              <div className="mt-1">
                <StatusPill status={selectedDetail.status} />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase text-gray-400">Tendencia</p>
              <TrendBadge trend={selectedDetail.trend} />
            </div>
          </div>

          {/* Notas del período */}
          <div>
            <p className="text-[11px] font-semibold uppercase text-gray-400 mb-3">
              Notas del período seleccionado
            </p>
            {selectedDetail.periodMarks.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                Sin notas registradas en este período.
              </p>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                {selectedDetail.periodMarks.map(m => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-2.5 bg-white text-xs">
                    <div>
                      <span className="font-semibold text-gray-800 block">
                        {m.tipo_evaluacion || 'Evaluación'}
                      </span>
                      {m.fecha_evaluacion && (
                        <span className="text-gray-400 text-[11px]">{m.fecha_evaluacion}</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-sm text-gray-900 block">
                        {Number(m.nota).toFixed(1)} / {escalaMaxima}
                      </span>
                      {m.porcentaje > 0 && (
                        <span className="text-gray-400 text-[11px]">{m.porcentaje}%</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evolución por períodos */}
          {selectedDetail.periodEvolution.some(x => x.average !== null) && (
            <div>
              <p className="text-[11px] font-semibold uppercase text-gray-400 mb-3">
                Evolución por períodos
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {selectedDetail.periodEvolution.map(({ period, average }) => (
                  <div
                    key={period.id}
                    className={`px-3 py-2.5 rounded-xl border text-center ${
                      activePeriod?.id === period.id
                        ? 'bg-gray-900 border-gray-900 text-white'
                        : 'bg-gray-50 border-gray-100 text-gray-700'
                    }`}
                  >
                    <span
                      className={`text-[11px] font-semibold block truncate ${
                        activePeriod?.id === period.id ? 'text-gray-300' : 'text-gray-400'
                      }`}
                    >
                      {periodLabel(period)}
                    </span>
                    <span className="text-sm font-bold block mt-0.5">
                      {average !== null ? average.toFixed(2) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

// ── Componentes auxiliares ──────────────────────────────────────────────────

const PILL_CLASSES: Record<AcademicTrackingStatus, string> = {
  'Buen rendimiento': 'bg-emerald-100 text-emerald-700',
  'En seguimiento': 'bg-amber-100 text-amber-700',
  'Requiere atención': 'bg-red-100 text-red-600',
  'Sin notas': 'bg-gray-100 text-gray-500',
};

const PILL_LABELS: Record<AcademicTrackingStatus, string> = {
  'Buen rendimiento': 'Buen Rendimiento',
  'En seguimiento': 'En Seguimiento',
  'Requiere atención': 'Requiere Atención',
  'Sin notas': 'Sin Notas',
};

const StatusPill: React.FC<{ status: AcademicTrackingStatus }> = ({ status }) => (
  <span
    className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-semibold ${PILL_CLASSES[status]}`}
  >
    {PILL_LABELS[status]}
  </span>
);

const TrendBadge: React.FC<{
  trend: 'Mejorando' | 'Estable' | 'Bajando' | null;
}> = ({ trend }) => {
  if (!trend) return <span className="text-xs text-gray-400 mt-1 block">Sin datos</span>;
  const cfg = {
    Mejorando: { icon: <TrendingUp className="h-3.5 w-3.5" />, cls: 'text-emerald-700' },
    Estable: { icon: <Minus className="h-3.5 w-3.5" />, cls: 'text-blue-600' },
    Bajando: { icon: <TrendingDown className="h-3.5 w-3.5" />, cls: 'text-red-600' },
  }[trend];
  return (
    <span className={`inline-flex items-center gap-1 mt-1 text-xs font-semibold ${cfg.cls}`}>
      {cfg.icon} {trend}
    </span>
  );
};
