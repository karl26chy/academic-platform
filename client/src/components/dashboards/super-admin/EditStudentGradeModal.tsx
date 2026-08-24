import React, { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../../services/api';
import type { Grade, Institution, StudentGrade, User } from '../../../types';
import type { Feedback } from './useSuperAdmin';

const FIELD = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none';
const LABEL = 'block text-xs font-medium text-gray-600 mb-1';

interface EditStudentGradeModalProps {
  studentGrade: StudentGrade;
  institutions: Institution[];
  users: User[];
  grades: Grade[];
  studentGrades: StudentGrade[];
  showMsg: (type: Feedback['type'], text: string) => void;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

/** Edición de una matrícula. El estudiante no puede duplicarse en el mismo grado. */
export const EditStudentGradeModal: React.FC<EditStudentGradeModalProps> = ({
  studentGrade, institutions, users, grades, studentGrades, showMsg, onClose, onChanged,
}) => {
  const [estudianteId, setEstudianteId] = useState(studentGrade.estudiante_id);
  const [gradoId, setGradoId] = useState(studentGrade.grado_id);

  const student = users.find(u => u.id === studentGrade.estudiante_id);
  const institution = institutions.find(i => i.id === student?.institucion_id);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!estudianteId || !gradoId) return;

    const duplicado = studentGrades.some(
      sg => sg.id !== studentGrade.id && sg.estudiante_id === estudianteId && sg.grado_id === gradoId
    );
    if (duplicado) {
      showMsg('error', 'El estudiante ya está matriculado en este grado.');
      return;
    }

    try {
      await api.updateStudentGrade(studentGrade.id, {
        estudiante_id: estudianteId,
        grado_id: gradoId,
      });
      onClose();
      showMsg('success', 'Matrícula actualizada.');
      await onChanged();
    } catch (err) {
      showMsg('error', err instanceof Error ? err.message : 'Error al actualizar matrícula.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-q10-500 to-indigo-600 rounded-t-2xl p-4 sm:p-6 text-white">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Editar Matrícula</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className={LABEL}>Institución</label>
            <input value={institution?.nombre || ''} disabled className={FIELD} />
          </div>

          <div>
            <label className={LABEL}>Estudiante</label>
            <select required value={estudianteId} onChange={e => setEstudianteId(e.target.value)} className={FIELD}>
              <option value="">-- Seleccionar --</option>
              {users
                .filter(u => u.rol === 'student' && u.institucion_id === institution?.id)
                .map(s => <option key={s.id} value={s.id}>{s.nombre} {s.apellido}</option>)}
            </select>
          </div>

          <div>
            <label className={LABEL}>Grado</label>
            <select required value={gradoId} onChange={e => setGradoId(e.target.value)} className={FIELD}>
              <option value="">-- Seleccionar --</option>
              {grades.filter(g => g.institucion_id === institution?.id).map(g => (
                <option key={g.id} value={g.id}>
                  {g.nombre} "{g.tipo_grado}"
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-q10-600 hover:bg-q10-700 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
