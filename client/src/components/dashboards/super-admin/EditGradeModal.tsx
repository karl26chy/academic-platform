import React, { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../../services/api';
import type { Grade } from '../../../types';
import type { Feedback } from './useSuperAdmin';

const FIELD = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none';
const LABEL = 'block text-xs font-medium text-gray-600 mb-1';

interface EditGradeModalProps {
  grade: Grade;
  showMsg: (type: Feedback['type'], text: string) => void;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

/** Edición de un grado/curso. La institución no se modifica. */
export const EditGradeModal: React.FC<EditGradeModalProps> = ({
  grade, showMsg, onClose, onChanged,
}) => {
  const [nombre, setNombre] = useState(grade.nombre || '');
  const [tipoGrado, setTipoGrado] = useState(grade.tipo_grado || '');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre) return;

    try {
      await api.updateGrade(grade.id, {
        nombre,
        tipo_grado: tipoGrado,
      });
      onClose();
      showMsg('success', 'Grado actualizado.');
      await onChanged();
    } catch (err) {
      showMsg('error', err instanceof Error ? err.message : 'Error al actualizar grado.');
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
            <h3 className="text-lg font-bold">Editar Grado</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className={LABEL}>Nombre</label>
            <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} className={FIELD} />
          </div>

          <div>
            <label className={LABEL}>Tipo</label>
            <input type="text" required value={tipoGrado} onChange={e => setTipoGrado(e.target.value)} className={FIELD} />
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
