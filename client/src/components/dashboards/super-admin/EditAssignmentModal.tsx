import React, { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../../services/api';
import type { Assignment, Grade, Institution, Subject, User } from '../../../types';
import type { Feedback } from './useSuperAdmin';

const FIELD = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none';
const LABEL = 'block text-xs font-medium text-gray-600 mb-1';

interface EditAssignmentModalProps {
  assignment: Assignment;
  institutions: Institution[];
  users: User[];
  grades: Grade[];
  subjects: Subject[];
  showMsg: (type: Feedback['type'], text: string) => void;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

/** Edición de una asignación docente→materia. El institucion_id no se cambia. */
export const EditAssignmentModal: React.FC<EditAssignmentModalProps> = ({
  assignment, institutions, users, grades, subjects, showMsg, onClose, onChanged,
}) => {
  const [profesorId, setProfesorId] = useState(assignment.profesor_id);
  const [materiaId, setMateriaId] = useState(assignment.materia_id);
  const [gradoId, setGradoId] = useState(assignment.grado_id);

  const institution = institutions.find(i => i.id === assignment.institucion_id);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profesorId || !materiaId || !gradoId) return;

    try {
      await api.updateAssignment(assignment.id, {
        profesor_id: profesorId,
        materia_id: materiaId,
        grado_id: gradoId,
        institucion_id: assignment.institucion_id,
      });
      onClose();
      showMsg('success', 'Asignación actualizada.');
      await onChanged();
    } catch (err) {
      showMsg('error', err instanceof Error ? err.message : 'Error al actualizar asignación.');
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
            <h3 className="text-lg font-bold">Editar Asignación</h3>
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
            <label className={LABEL}>Profesor</label>
            <select required value={profesorId} onChange={e => setProfesorId(e.target.value)} className={FIELD}>
              <option value="">-- Seleccionar --</option>
              {users
                .filter(u => u.rol === 'teacher' && u.institucion_id === assignment.institucion_id)
                .map(t => <option key={t.id} value={t.id}>{t.nombre} {t.apellido}</option>)}
            </select>
          </div>

          <div>
            <label className={LABEL}>Materia</label>
            <select required value={materiaId} onChange={e => setMateriaId(e.target.value)} className={FIELD}>
              <option value="">-- Seleccionar --</option>
              {subjects
                .filter(s => s.institucion_id === assignment.institucion_id)
                .map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className={LABEL}>Grado</label>
            <select required value={gradoId} onChange={e => setGradoId(e.target.value)} className={FIELD}>
              <option value="">-- Seleccionar --</option>
              {grades
                .filter(g => g.institucion_id === assignment.institucion_id)
                .map(g => <option key={g.id} value={g.id}>{g.nombre} "{g.tipo_grado}"</option>)}
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
