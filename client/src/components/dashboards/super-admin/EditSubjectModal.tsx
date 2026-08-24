import React, { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../../services/api';
import type { Institution, Subject } from '../../../types';
import type { Feedback } from './useSuperAdmin';

const FIELD = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none';
const LABEL = 'block text-xs font-medium text-gray-600 mb-1';

interface EditSubjectModalProps {
  subject: Subject;
  institutions: Institution[];
  showMsg: (type: Feedback['type'], text: string) => void;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

/** Edición de una materia académica; la institución no se cambia aquí. */
export const EditSubjectModal: React.FC<EditSubjectModalProps> = ({
  subject, institutions, showMsg, onClose, onChanged,
}) => {
  const [nombre, setNombre] = useState(subject.nombre || '');
  const [descripcion, setDescripcion] = useState(subject.descripcion || '');

  const institution = institutions.find(i => i.id === subject.institucion_id);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre) return;

    try {
      await api.updateSubject(subject.id, {
        nombre,
        descripcion: descripcion || undefined,
        institucion_id: subject.institucion_id,
      });
      onClose();
      showMsg('success', 'Materia actualizada.');
      await onChanged();
    } catch (err) {
      showMsg('error', err instanceof Error ? err.message : 'Error al actualizar materia.');
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
            <h3 className="text-lg font-bold">Editar Materia</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className={LABEL}>Institución</label>
            <input value={institution?.nombre || '—'} disabled className={FIELD} />
          </div>

          <div>
            <label className={LABEL}>Nombre</label>
            <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} className={FIELD} />
          </div>

          <div>
            <label className={LABEL}>Descripción</label>
            <input type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)} className={FIELD} />
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
