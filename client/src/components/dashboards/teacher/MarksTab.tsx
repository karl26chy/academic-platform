import React, { useState } from 'react';
import { api } from '../../../services/api';
import { Card, EmptyMessage, ExportButtons, INPUT, PRIMARY_BUTTON, TableWrapper, TableHead, TableBody, toast } from '../../ui';
import type { Assignment, Evaluation, Grade, Mark, Subject, User } from '../../../types';

interface MarksTabProps {
  assignment: Assignment;
  subject?: Subject | null;
  grade?: Grade | null;
  students: User[];
  evaluations: Evaluation[];
  marks: Mark[];
  teacherId: string;
  notaMax: number;
  /** Etiqueta del periodo activo, p. ej. "Periodo 1 — Primer periodo — 2026". */
  periodLabel?: string;
  onSaved: () => Promise<void>;
}

/**
 * Calificación por evaluación. Guardar hace upsert: si el estudiante ya tenía
 * nota en esa evaluación se actualiza, no se duplica.
 */
export const MarksTab: React.FC<MarksTabProps> = ({
  assignment, subject, grade, students, evaluations, marks, teacherId, notaMax, periodLabel, onSaved,
}) => {
  const [selectedEvalId, setSelectedEvalId] = useState('');
  const [drafts, setDrafts] = useState<Record<string, number>>({});

  const existingForEval = marks.filter(m => selectedEvalId && m.evaluacion_id === selectedEvalId);

  const savedByStudent: Record<string, Mark> = {};
  existingForEval.forEach(m => { savedByStudent[m.estudiante_id] = m; });

  /** Valor mostrado en el campo: borrador, nota guardada o vacío. */
  const inputValue = (studentId: string): number | '' =>
    drafts[studentId] ?? savedByStudent[studentId]?.nota ?? '';

  /** Valor efectivo al guardar o exportar: 0 si no hay nada. */
  const effectiveValue = (studentId: string): number =>
    drafts[studentId] ?? savedByStudent[studentId]?.nota ?? 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvalId) return;

    const selectedEval = evaluations.find(ev => ev.id === selectedEvalId);

    try {
      await Promise.all(students.map(async student => {
        const data = {
          estudiante_id: student.id,
          materia_id: assignment.materia_id,
          grado_id: assignment.grado_id,
          evaluacion_id: selectedEvalId,
          tipo_evaluacion: selectedEval?.nombre || '',
          fecha_evaluacion: selectedEval?.fecha_evaluacion || '',
          porcentaje: selectedEval?.porcentaje || 0,
          nota: Number(effectiveValue(student.id)),
          periodo: selectedEval?.periodo || 'Periodo 1',
          anio: selectedEval?.anio,
          periodo_id: selectedEval?.periodo_id ?? null,
          registrado_por: teacherId,
        };

        const existing = savedByStudent[student.id];
        if (existing) {
          await api.updateMark(existing.id, data);
        } else {
          await api.createMark(data);
        }
      }));
      await onSaved();
      toast.success('Notas registradas con éxito');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar notas');
    }
  };

  const exportTable = () => ({
    title: `Notas ${subject?.nombre}`,
    headers: ['Estudiante', 'Nota'],
    rows: students.map(s => [`${s.nombre} ${s.apellido}`, effectiveValue(s.id)]),
    fileName: `notas_${subject?.nombre?.toLowerCase().replace(/\s+/g, '_')}`,
  });

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h3 className="text-lg font-bold text-gray-900 break-words">
          Calificaciones - {subject?.nombre} ({grade?.nombre})
        </h3>
        <div className="shrink-0"><ExportButtons build={exportTable} /></div>
      </div>

      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <label className="block text-xs font-semibold text-gray-500 mb-2">
          Seleccionar Evaluación para Calificar
        </label>
        <select
          required
          value={selectedEvalId}
          onChange={e => { setSelectedEvalId(e.target.value); setDrafts({}); }}
          className={INPUT}
        >
          <option value="">-- Seleccionar Evaluación --</option>
          {evaluations.map(ev => (
            <option key={ev.id} value={ev.id}>
              {ev.nombre} ({ev.fecha_evaluacion}) - {ev.porcentaje}% - {periodLabel || ev.periodo}
            </option>
          ))}
        </select>
      </div>

      {students.length === 0 ? (
        <EmptyMessage className="text-gray-500 text-sm py-4">No hay estudiantes matriculados.</EmptyMessage>
      ) : !selectedEvalId ? (
        <EmptyMessage className="text-gray-500 text-sm py-4 text-center">
          Selecciona una evaluación para comenzar a calificar.
        </EmptyMessage>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <TableWrapper>
            <TableHead uppercase>
              <th className="pb-3">Estudiante</th>
              <th className="pb-3 w-32 text-right">Calificación</th>
            </TableHead>
            <TableBody>
              {students.map(student => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="py-3.5 font-medium text-gray-900">
                    {student.nombre} {student.apellido}
                  </td>
                  <td className="py-2 text-right">
                    <input
                      type="number" step="0.1" min="0" max={notaMax} required
                      value={inputValue(student.id)}
                      onChange={e => setDrafts(prev => ({ ...prev, [student.id]: Number(e.target.value) }))}
                      placeholder="0.0"
                      className="w-24 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-right text-sm focus:outline-none focus:ring-1 focus:ring-q10-500"
                    />
                  </td>
                </tr>
              ))}
            </TableBody>
          </TableWrapper>

          <div className="flex justify-end pt-4">
            <button type="submit" className={`px-6 ${PRIMARY_BUTTON}`}>
              Guardar Calificaciones
            </button>
          </div>
        </form>
      )}
    </Card>
  );
};
