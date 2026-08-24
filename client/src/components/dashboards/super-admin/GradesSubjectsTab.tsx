import React, { useState } from 'react';
import { BookOpen, Edit3, GraduationCap, Trash2 } from 'lucide-react';
import { api } from '../../../services/api';
import { Card, CardTitle, EmptyMessage, Field, INPUT } from '../../ui';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { EditGradeModal } from './EditGradeModal';
import { EditSubjectModal } from './EditSubjectModal';
import type { Grade, Institution, StudentGrade, Subject } from '../../../types';
import type { Feedback } from './useSuperAdmin';

interface GradesSubjectsTabProps {
  institutions: Institution[];
  grades: Grade[];
  subjects: Subject[];
  studentGrades: StudentGrade[];
  showMsg: (type: Feedback['type'], text: string) => void;
  onChanged: () => Promise<void>;
}

/** Catálogo de grados y materias por institución. */
export const GradesSubjectsTab: React.FC<GradesSubjectsTabProps> = ({
  institutions, grades, subjects, studentGrades, showMsg, onChanged,
}) => {
  const [instId, setInstId] = useState('');
  const [gradeName, setGradeName] = useState('');
  const [gradeType, setGradeType] = useState('A');
  const [subjectName, setSubjectName] = useState('');
  const [subjectDesc, setSubjectDesc] = useState('');

  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [deletingGrade, setDeletingGrade] = useState<Grade | null>(null);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [deletingSubject, setDeletingSubject] = useState<Subject | null>(null);

  const handleCreateGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradeName || !instId) return;
    try {
      await api.createGrade({
        institucion_id: instId,
        nombre: gradeName,
        tipo_grado: gradeType,
      });
      setGradeName('');
      showMsg('success', 'Grado creado.');
      await onChanged();
    } catch {
      showMsg('error', 'Error al crear grado.');
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName || !instId) {
      showMsg('error', 'Selecciona la institución y el nombre de la materia.');
      return;
    }
    try {
      await api.createSubject({ nombre: subjectName, descripcion: subjectDesc, institucion_id: instId });
      setSubjectName('');
      setSubjectDesc('');
      showMsg('success', 'Materia creada.');
      await onChanged();
    } catch {
      showMsg('error', 'Error al crear materia.');
    }
  };

  const handleDeleteGrade = async () => {
    if (!deletingGrade) return;
    try {
      await api.deleteGrade(deletingGrade.id);
      setDeletingGrade(null);
      showMsg('success', 'Grado eliminado.');
      await onChanged();
    } catch (err) {
      setDeletingGrade(null);
      showMsg('error', err instanceof Error ? err.message : 'Error al eliminar grado.');
    }
  };

  const handleDeleteSubject = async () => {
    if (!deletingSubject) return;
    try {
      await api.deleteSubject(deletingSubject.id);
      setDeletingSubject(null);
      showMsg('success', 'Materia eliminada.');
      await onChanged();
    } catch (err) {
      setDeletingSubject(null);
      showMsg('error', err instanceof Error ? err.message : 'Error al eliminar materia.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
      <Card>
        <CardTitle icon={<GraduationCap className="h-5 w-5 text-q10-600" />} className="mb-6">
          Grados / Cursos
        </CardTitle>

        <Field label="Institución" className="mb-4">
          <select required value={instId} onChange={e => setInstId(e.target.value)} className={INPUT}>
            <option value="">-- Seleccionar --</option>
            {institutions.map(inst => <option key={inst.id} value={inst.id}>{inst.nombre}</option>)}
          </select>
        </Field>

        <form onSubmit={handleCreateGrade} className="flex flex-col sm:flex-row gap-2 mb-6">
          <input
            type="text" required value={gradeName} onChange={e => setGradeName(e.target.value)}
            placeholder="6to, 10mo..."
            className="flex-1 min-w-0 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none"
          />
          <input
            type="text" required value={gradeType} onChange={e => setGradeType(e.target.value)}
            placeholder="A"
            className="w-full sm:w-14 px-2 py-2 bg-white border border-gray-200 rounded-xl text-sm text-center focus:outline-none"
          />
          <button type="submit" className="px-4 py-2 bg-q10-600 hover:bg-q10-700 text-white font-semibold rounded-xl text-sm shrink-0">
            Agregar
          </button>
        </form>

        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {instId ? (
            grades.filter(g => g.institucion_id === instId).map(g => {
              const enrolled = studentGrades.filter(sg => sg.grado_id === g.id).length;
              return (
                <div key={g.id} className="flex flex-wrap justify-between items-center gap-2 p-3 bg-white rounded-xl border border-gray-200">
                  <span className="text-sm font-semibold text-gray-900 min-w-0 truncate">
                    Grado {g.nombre} - "{g.tipo_grado}"
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600">
                      {enrolled} estudiantes matriculados
                    </span>
                    <button
                      onClick={() => setEditingGrade(g)} title="Editar grado"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeletingGrade(g)} title="Eliminar grado"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyMessage>Selecciona una institución.</EmptyMessage>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle icon={<BookOpen className="h-5 w-5 text-q10-600" />} className="mb-6">
          Materias Académicas
        </CardTitle>

        <form onSubmit={handleCreateSubject} className="space-y-4 mb-6">
          <input
            type="text" required value={subjectName} onChange={e => setSubjectName(e.target.value)}
            placeholder="Nombre de la materia" className={INPUT}
          />
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text" value={subjectDesc} onChange={e => setSubjectDesc(e.target.value)}
              placeholder="Descripción..."
              className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none"
            />
            <button type="submit" className="px-4 py-2 bg-q10-600 hover:bg-q10-700 text-white font-semibold rounded-xl text-sm w-full sm:w-auto">
              Agregar
            </button>
          </div>
          {!instId && (
            <p className="text-xs text-amber-600">Selecciona una institución para asignar la materia.</p>
          )}
        </form>

        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {instId ? (
            subjects.filter(s => s.institucion_id === instId).map(s => (
              <div key={s.id} className="flex justify-between items-center gap-2 p-3 bg-white rounded-xl border border-gray-200">
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-gray-900 block">{s.nombre}</span>
                  <span className="text-xs text-gray-400">{s.descripcion}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setEditingSubject(s)} title="Editar materia"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeletingSubject(s)} title="Eliminar materia"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <EmptyMessage>Selecciona una institución.</EmptyMessage>
          )}
        </div>
      </Card>

      {editingGrade && (
        <EditGradeModal
          grade={editingGrade}
          showMsg={showMsg}
          onClose={() => setEditingGrade(null)}
          onChanged={onChanged}
        />
      )}

      {deletingGrade && (
        <ConfirmDeleteModal
          title="Eliminar Grado"
          message={<>¿Estás seguro de eliminar el grado <strong>{deletingGrade.nombre} "{deletingGrade.tipo_grado}"</strong>?</>}
          onCancel={() => setDeletingGrade(null)}
          onConfirm={handleDeleteGrade}
        />
      )}

      {editingSubject && (
        <EditSubjectModal
          subject={editingSubject}
          institutions={institutions}
          showMsg={showMsg}
          onClose={() => setEditingSubject(null)}
          onChanged={onChanged}
        />
      )}

      {deletingSubject && (
        <ConfirmDeleteModal
          title="Eliminar Materia"
          message={<>¿Estás seguro de eliminar la materia <strong>{deletingSubject.nombre}</strong>?</>}
          onCancel={() => setDeletingSubject(null)}
          onConfirm={handleDeleteSubject}
        />
      )}
    </div>
  );
};
