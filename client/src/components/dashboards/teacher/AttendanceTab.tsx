import React, { useState } from 'react';
import { AlertTriangle, Lock } from 'lucide-react';
import { api } from '../../../services/api';
import { Card, EmptyMessage, ExportButtons, PRIMARY_BUTTON, TableWrapper, TableHead, TableBody, toast } from '../../ui';
import { periodLabel } from '../../../lib/periods';
import type { AcademicPeriod, Assignment, Subject, Grade, User } from '../../../types';

type Estado = 'presente' | 'ausente' | 'justificada';
const ESTADOS: { value: Estado; label: string }[] = [
  { value: 'presente', label: 'Presente' },
  { value: 'ausente', label: 'Ausente' },
  { value: 'justificada', label: 'Inasistencia justificada' },
];

interface AttendanceTabProps {
  assignment: Assignment;
  subject?: Subject | null;
  grade?: Grade | null;
  students: User[];
  teacherId: string;
  periods: AcademicPeriod[];
  /** Periodo actualmente seleccionado en el contexto académico del docente. */
  period: AcademicPeriod | null;
  onSaved: () => Promise<void>;
}

/** Razón por la que no se puede registrar asistencia, o null si sí se puede. */
function blockedReason(periods: AcademicPeriod[], period: AcademicPeriod | null): string | null {
  const openCount = periods.filter(p => p.activo).length;
  if (periods.length === 0) {
    return 'No hay periodos académicos definidos para esta institución.';
  }
  if (openCount === 0) {
    return 'No hay un periodo académico abierto. No puedes registrar asistencia hasta que el administrador abra un periodo.';
  }
  if (openCount > 1) {
    return 'Hay más de un periodo académico abierto; revisa la configuración de periodos. No puedes registrar asistencia.';
  }
  if (!period) {
    return 'No hay un periodo académico seleccionado.';
  }
  if (!period.activo) {
    return 'El periodo seleccionado está cerrado. No puedes registrar asistencia.';
  }
  return null;
}

/** Toma de asistencia de la clase activa para una fecha concreta. */
export const AttendanceTab: React.FC<AttendanceTabProps> = ({
  assignment, subject, grade, students, teacherId, periods, period, onSaved,
}) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState<Record<string, Estado>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reason = blockedReason(periods, period);
  const openPeriod = periods.find(p => p.activo) ?? null;
  const periodoId = openPeriod?.id ?? null;

  const estadoDe = (studentId: string): Estado => records[studentId] || 'presente';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason || !periodoId) {
      setError(reason || 'No hay un periodo académico abierto.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await Promise.all(students.map(student =>
        api.createAttendance({
          estudiante_id: student.id,
          materia_id: assignment.materia_id,
          grado_id: assignment.grado_id,
          fecha: date,
          estado: estadoDe(student.id),
          periodo_id: periodoId,
          registrado_por: teacherId,
        })
      ));
      await onSaved();
      setRecords({});
      toast.success('Asistencia registrada con éxito');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar asistencia');
    } finally {
      setSaving(false);
    }
  };

  const exportTable = () => ({
    title: `Asistencia ${subject?.nombre}`,
    headers: ['Estudiante', 'Estado'],
    rows: students.map(s => [`${s.nombre} ${s.apellido}`, estadoDe(s.id)]),
    fileName: `asistencia_${subject?.nombre?.toLowerCase().replace(/\s+/g, '_')}`,
  });

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            Asistencia - {subject?.nombre} ({grade?.nombre})
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {period
              ? <>Periodo: <span className="font-semibold text-gray-700">{periodLabel(period)}</span></>
              : 'Selecciona un periodo en el contexto académico.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons build={exportTable} />
          <span className="text-xs text-gray-500 font-medium">Fecha:</span>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg text-sm text-gray-900 px-3 py-1.5 focus:outline-none"
          />
        </div>
      </div>

      {reason && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {reason.includes('periodo académico abierto') || reason.includes('más de un periodo')
            ? <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            : <Lock className="h-4 w-4 mt-0.5 shrink-0" />}
          <span>{reason}</span>
        </div>
      )}

      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {students.length === 0 ? (
        <EmptyMessage className="text-gray-500 text-sm py-4">No hay estudiantes matriculados.</EmptyMessage>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <TableWrapper>
            <TableHead uppercase>
              <th className="pb-3">Estudiante</th>
              <th className="pb-3 text-center">Presente</th>
              <th className="pb-3 text-center">Ausente</th>
              <th className="pb-3 text-center">Inasistencia justificada</th>
            </TableHead>
            <TableBody>
              {students.map(student => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="py-3.5 font-medium text-gray-900">
                    {student.nombre} {student.apellido}
                  </td>
                  {ESTADOS.map(estado => (
                    <td key={estado.value} className="py-3.5 text-center">
                      <input
                        type="radio"
                        name={`att-${student.id}`}
                        checked={estadoDe(student.id) === estado.value}
                        onChange={() => setRecords(prev => ({ ...prev, [student.id]: estado.value }))}
                        disabled={!!reason}
                        className="h-4 w-4 text-q10-600 focus:ring-q10-500 bg-white border-gray-300 disabled:opacity-40"
                        title={estado.label}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </TableBody>
          </TableWrapper>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={!!reason || saving}
              className={`px-6 ${PRIMARY_BUTTON} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {saving ? 'Guardando...' : 'Guardar Asistencia'}
            </button>
          </div>
        </form>
      )}
    </Card>
  );
};
