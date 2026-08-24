import React, { useState } from 'react';
import { BookOpen, Edit3, Plus, Trash2 } from 'lucide-react';
import { api } from '../../../services/api';
import { Card, CardTitle, EmptyMessage, Field, INPUT, toast } from '../../ui';
import { ConfirmDeleteModal } from '../super-admin/ConfirmDeleteModal';
import { EditSubjectModal } from '../super-admin/EditSubjectModal';
import { useApp } from '../../../context/useApp';
import type { Subject } from '../../../types';

/** Gestión de las materias de la institución del administrador. */
export const MateriasTab: React.FC = () => {
  const { user, subjects, currentInstitution, refreshData } = useApp();
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const showMsg = (type: 'success' | 'error', text: string) => (type === 'success' ? toast.success(text) : toast.error(text));
  const [editing, setEditing] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState<Subject | null>(null);

  const instId = user?.institucion_id;
  const misMaterias = subjects.filter(s => s.institucion_id === instId);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !instId) return;
    try {
      await api.createSubject({ nombre: nombre.trim(), descripcion: descripcion || undefined, institucion_id: instId });
      setNombre('');
      setDescripcion('');
      toast.success('Materia creada.');
      await refreshData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear materia.');
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.deleteSubject(deleting.id);
      setDeleting(null);
      toast.success('Materia eliminada.');
      await refreshData();
    } catch (err) {
      setDeleting(null);
      toast.error(err instanceof Error ? err.message : 'Error al eliminar materia.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
      <Card className="h-fit">
        <CardTitle icon={<Plus className="h-5 w-5 text-q10-600" />} className="mb-6">
          Crear Materia
        </CardTitle>
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label="Nombre">
            <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Matemáticas" className={INPUT} />
          </Field>
          <Field label="Descripción">
            <input type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="..." className={INPUT} />
          </Field>
          <button
            type="submit"
            className="w-full py-3 bg-q10-600 hover:bg-q10-700 text-white font-semibold rounded-xl transition-colors"
          >
            Guardar Materia
          </button>
          {!instId && (
            <p className="text-xs text-amber-600">No se pudo determinar tu institución.</p>
          )}
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle icon={<BookOpen className="h-5 w-5 text-q10-600" />} className="mb-6">
          Materias de {currentInstitution?.nombre || 'mi institución'}
        </CardTitle>

        {misMaterias.length === 0 ? (
          <EmptyMessage className="text-sm text-gray-500 py-8">
            Aún no hay materias creadas en tu institución.
          </EmptyMessage>
        ) : (
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {misMaterias.map(s => (
              <div key={s.id} className="flex justify-between items-center gap-2 p-3 bg-white rounded-xl border border-gray-200">
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-gray-900 block">{s.nombre}</span>
                  <span className="text-xs text-gray-400">{s.descripcion}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setEditing(s)} title="Editar materia"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleting(s)} title="Eliminar materia"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editing && (
        <EditSubjectModal
          subject={editing}
          institutions={currentInstitution ? [currentInstitution] : []}
          showMsg={showMsg}
          onClose={() => setEditing(null)}
          onChanged={refreshData}
        />
      )}

      {deleting && (
        <ConfirmDeleteModal
          title="Eliminar Materia"
          message={<>¿Estás seguro de eliminar la materia <strong>{deleting.nombre}</strong>?</>}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
};
