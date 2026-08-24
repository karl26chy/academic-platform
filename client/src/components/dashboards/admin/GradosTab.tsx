import React, { useState } from 'react';
import { Edit3, GraduationCap, Plus, Trash2 } from 'lucide-react';
import { api } from '../../../services/api';
import { Card, CardTitle, EmptyMessage, Field, INPUT, toast } from '../../ui';
import { ConfirmDeleteModal } from '../super-admin/ConfirmDeleteModal';
import { EditGradeModal } from '../super-admin/EditGradeModal';
import { useApp } from '../../../context/useApp';
import type { Grade } from '../../../types';

/** Gestión de los grados de la institución del administrador. */
export const GradosTab: React.FC = () => {
  const { user, grades, studentGrades, currentInstitution, refreshData } = useApp();
  const [nombre, setNombre] = useState('');
  const [tipoGrado, setTipoGrado] = useState('A');

  const showMsg = (type: 'success' | 'error', text: string) => (type === 'success' ? toast.success(text) : toast.error(text));
  const [editing, setEditing] = useState<Grade | null>(null);
  const [deleting, setDeleting] = useState<Grade | null>(null);

  const instId = user?.institucion_id;
  const misGrados = grades.filter(g => g.institucion_id === instId);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !instId) return;
    try {
      await api.createGrade({ institucion_id: instId, nombre: nombre.trim(), tipo_grado: tipoGrado });
      setNombre('');
      setTipoGrado('A');
      toast.success('Grado creado.');
      await refreshData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear grado.');
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.deleteGrade(deleting.id);
      setDeleting(null);
      toast.success('Grado eliminado.');
      await refreshData();
    } catch (err) {
      setDeleting(null);
      toast.error(err instanceof Error ? err.message : 'Error al eliminar grado.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
      <Card className="h-fit">
        <CardTitle icon={<Plus className="h-5 w-5 text-q10-600" />} className="mb-6">
          Crear Grado
        </CardTitle>
        <form onSubmit={handleCreate} className="space-y-4">
          <Field label="Nombre">
            <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} placeholder="6to, 10mo..." className={INPUT} />
          </Field>
          <Field label="Tipo">
            <input type="text" required value={tipoGrado} onChange={e => setTipoGrado(e.target.value)} placeholder="A" className={INPUT} />
          </Field>
          <button
            type="submit"
            className="w-full py-3 bg-q10-600 hover:bg-q10-700 text-white font-semibold rounded-xl transition-colors"
          >
            Guardar Grado
          </button>
          {!instId && <p className="text-xs text-amber-600">No se pudo determinar tu institución.</p>}
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle icon={<GraduationCap className="h-5 w-5 text-q10-600" />} className="mb-6">
          Grados de {currentInstitution?.nombre || 'mi institución'}
        </CardTitle>

        {misGrados.length === 0 ? (
          <EmptyMessage className="text-sm text-gray-500 py-8">
            Aún no hay grados creados en tu institución.
          </EmptyMessage>
        ) : (
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {misGrados.map(g => {
              const enrolled = studentGrades.filter(sg => sg.grado_id === g.id).length;
              return (
                <div key={g.id} className="flex flex-wrap justify-between items-center gap-2 p-3 bg-white rounded-xl border border-gray-200">
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-gray-900 block truncate">
                      Grado {g.nombre} - "{g.tipo_grado}"
                    </span>
                    <span className="text-xs text-gray-400">{enrolled} estudiantes matriculados</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setEditing(g)} title="Editar grado"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleting(g)} title="Eliminar grado"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {editing && (
        <EditGradeModal
          grade={editing}
          showMsg={showMsg}
          onClose={() => setEditing(null)}
          onChanged={refreshData}
        />
      )}

      {deleting && (
        <ConfirmDeleteModal
          title="Eliminar Grado"
          message={<>¿Estás seguro de eliminar el grado <strong>{deleting.nombre} "{deleting.tipo_grado}"</strong>?</>}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
};
