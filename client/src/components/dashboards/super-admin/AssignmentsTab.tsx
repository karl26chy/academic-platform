import React, { useState } from 'react';
import { BookOpenCheck, Edit3, GraduationCap, Trash2 } from 'lucide-react';
import { api } from '../../../services/api';
import { Card, CardTitle, EmptyMessage, Field, INPUT, PRIMARY_BUTTON } from '../../ui';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { EditAssignmentModal } from './EditAssignmentModal';
import { EditStudentGradeModal } from './EditStudentGradeModal';
import type { Assignment, Grade, Institution, StudentGrade, Subject, User } from '../../../types';
import type { Feedback } from './useSuperAdmin';

interface AssignmentsTabProps {
  institutions: Institution[];
  users: User[];
  grades: Grade[];
  subjects: Subject[];
  assignments: Assignment[];
  studentGrades: StudentGrade[];
  getUserLabel: (userId: string) => string;
  getSubjectLabel: (subjectId: string) => string;
  getGradeLabel: (gradeId: string) => string;
  showMsg: (type: Feedback['type'], text: string) => void;
  onChanged: () => Promise<void>;
}

/** Asignación de materias a profesores y matrícula de estudiantes en grados. */
export const AssignmentsTab: React.FC<AssignmentsTabProps> = ({
  institutions, users, grades, subjects, assignments, studentGrades,
  getUserLabel, getSubjectLabel, getGradeLabel, showMsg, onChanged,
}) => {
  const [assignInstId, setAssignInstId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [gradeId, setGradeId] = useState('');

  const [studInstId, setStudInstId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studGradeId, setStudGradeId] = useState('');

  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [deletingAssignment, setDeletingAssignment] = useState<Assignment | null>(null);
  const [editingStudentGrade, setEditingStudentGrade] = useState<StudentGrade | null>(null);
  const [deletingStudentGrade, setDeletingStudentGrade] = useState<StudentGrade | null>(null);

  const filteredAssignments = assignments.filter(a => a.institucion_id === assignInstId);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId || !subjectId || !gradeId || !assignInstId) return;

    const exists = assignments.some(
      a => a.profesor_id === teacherId && a.materia_id === subjectId && a.grado_id === gradeId
    );
    if (exists) {
      showMsg('error', 'Esta asignación ya existe.');
      return;
    }

    try {
      await api.createAssignment({
        profesor_id: teacherId,
        materia_id: subjectId,
        grado_id: gradeId,
        institucion_id: assignInstId,
      });
      setTeacherId(''); setSubjectId(''); setGradeId('');
      showMsg('success', 'Asignación guardada.');
      await onChanged();
    } catch {
      showMsg('error', 'Error al crear asignación.');
    }
  };

  /** Matricular (o trasladar) a un estudiante a un grado. */
  const handleAssignStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !studGradeId) return;

    const existing = studentGrades.find(sg => sg.estudiante_id === studentId);

    try {
      if (existing) await api.deleteStudentGrade(existing.id);
      await api.createStudentGrade({ estudiante_id: studentId, grado_id: studGradeId });
      setStudentId(''); setStudGradeId('');
      showMsg('success', 'Estudiante matriculado.');
      await onChanged();
    } catch {
      showMsg('error', 'Error al matricular.');
    }
  };

  const handleDeleteAssignment = async () => {
    if (!deletingAssignment) return;
    try {
      await api.deleteAssignment(deletingAssignment.id);
      setDeletingAssignment(null);
      showMsg('success', 'Asignación eliminada.');
      await onChanged();
    } catch (err) {
      setDeletingAssignment(null);
      showMsg('error', err instanceof Error ? err.message : 'Error al eliminar asignación.');
    }
  };

  const handleDeleteStudentGrade = async () => {
    if (!deletingStudentGrade) return;
    try {
      await api.deleteStudentGrade(deletingStudentGrade.id);
      setDeletingStudentGrade(null);
      showMsg('success', 'Matrícula eliminada.');
      await onChanged();
    } catch (err) {
      setDeletingStudentGrade(null);
      showMsg('error', err instanceof Error ? err.message : 'Error al eliminar matrícula.');
    }
  };

  const institutionOptions = institutions.map(inst => (
    <option key={inst.id} value={inst.id}>{inst.nombre}</option>
  ));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
      <Card>
        <CardTitle icon={<BookOpenCheck className="h-5 w-5 text-q10-600" />}>
          Asignar Materia a Profesor
        </CardTitle>

        <Field label="Institución" className="mb-4">
          <select
            required value={assignInstId}
            onChange={e => { setAssignInstId(e.target.value); setTeacherId(''); setSubjectId(''); setGradeId(''); }}
            className={INPUT}
          >
            <option value="">-- Seleccionar --</option>
            {institutionOptions}
          </select>
        </Field>

        {assignInstId && (
          <form onSubmit={handleCreateAssignment} className="space-y-4 mb-6">
            <Field label="Profesor">
              <select required value={teacherId} onChange={e => setTeacherId(e.target.value)} className={INPUT}>
                <option value="">-- Seleccionar --</option>
                {users
                  .filter(u => u.rol === 'teacher' && u.institucion_id === assignInstId)
                  .map(t => <option key={t.id} value={t.id}>{t.nombre} {t.apellido}</option>)}
              </select>
            </Field>

            <Field label="Materia">
              <select required value={subjectId} onChange={e => setSubjectId(e.target.value)} className={INPUT}>
                <option value="">-- Seleccionar --</option>
                {subjects
                  .filter(s => s.institucion_id === assignInstId)
                  .map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </Field>

            <Field label="Grado">
              <select required value={gradeId} onChange={e => setGradeId(e.target.value)} className={INPUT}>
                <option value="">-- Seleccionar --</option>
                {grades
                  .filter(g => g.institucion_id === assignInstId)
                  .map(g => <option key={g.id} value={g.id}>{g.nombre} "{g.tipo_grado}"</option>)}
              </select>
            </Field>

            <button type="submit" className={`w-full ${PRIMARY_BUTTON}`}>Guardar Asignación</button>
          </form>
        )}

        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Asignaciones Activas
        </h4>
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {filteredAssignments.map(a => (
            <div key={a.id} className="p-3 bg-white rounded-xl border border-gray-200 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-gray-900 min-w-0 truncate">{getUserLabel(a.profesor_id)}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setEditingAssignment(a)} title="Editar asignación"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeletingAssignment(a)} title="Eliminar asignación"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-1 text-gray-500 flex justify-between">
                <span>{getSubjectLabel(a.materia_id)}</span>
                <span>{getGradeLabel(a.grado_id)}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle icon={<GraduationCap className="h-5 w-5 text-q10-600" />}>
          Matricular Estudiante
        </CardTitle>

        <Field label="Institución" className="mb-4">
          <select
            required value={studInstId}
            onChange={e => { setStudInstId(e.target.value); setStudentId(''); setStudGradeId(''); }}
            className={INPUT}
          >
            <option value="">-- Seleccionar --</option>
            {institutionOptions}
          </select>
        </Field>

        {studInstId && (
          <form onSubmit={handleAssignStudent} className="space-y-4 mb-6">
            <Field label="Estudiante">
              <select required value={studentId} onChange={e => setStudentId(e.target.value)} className={INPUT}>
                <option value="">-- Seleccionar --</option>
                {users
                  .filter(
                    u =>
                      u.rol === 'student' &&
                      u.institucion_id === studInstId &&
                      !studentGrades.some(sg => sg.estudiante_id === u.id)
                  )
                  .map(s => <option key={s.id} value={s.id}>{s.nombre} {s.apellido}</option>)}
              </select>
            </Field>

            <Field label="Grado">
              <select required value={studGradeId} onChange={e => setStudGradeId(e.target.value)} className={INPUT}>
                <option value="">-- Seleccionar --</option>
                {grades.filter(g => g.institucion_id === studInstId).map(g => (
                  <option key={g.id} value={g.id}>
                    {g.nombre} "{g.tipo_grado}"
                  </option>
                ))}
              </select>
            </Field>

            <button type="submit" className={`w-full ${PRIMARY_BUTTON}`}>Matricular</button>
          </form>
        )}

        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Matrículas</h4>
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {studInstId ? (
            studentGrades
              .filter(sg =>
                users.some(u => u.rol === 'student' && u.institucion_id === studInstId && u.id === sg.estudiante_id)
              )
              .map(sg => (
                <div key={sg.id} className="flex flex-wrap justify-between items-center gap-2 p-3 bg-white rounded-xl border border-gray-200 text-xs">
                  <span className="font-semibold text-gray-900 min-w-0 truncate">{getUserLabel(sg.estudiante_id)}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded bg-q10-50 text-q10-600 font-medium">
                      {getGradeLabel(sg.grado_id)}
                    </span>
                    <button
                      onClick={() => setEditingStudentGrade(sg)} title="Editar matrícula"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeletingStudentGrade(sg)} title="Eliminar matrícula"
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

      {editingAssignment && (
        <EditAssignmentModal
          assignment={editingAssignment}
          institutions={institutions}
          users={users}
          grades={grades}
          subjects={subjects}
          showMsg={showMsg}
          onClose={() => setEditingAssignment(null)}
          onChanged={onChanged}
        />
      )}

      {deletingAssignment && (
        <ConfirmDeleteModal
          title="Eliminar Asignación"
          message={<>¿Estás seguro de eliminar la asignación de <strong>{getUserLabel(deletingAssignment.profesor_id)}</strong> a <strong>{getSubjectLabel(deletingAssignment.materia_id)}</strong>?</>}
          onCancel={() => setDeletingAssignment(null)}
          onConfirm={handleDeleteAssignment}
        />
      )}

      {editingStudentGrade && (
        <EditStudentGradeModal
          studentGrade={editingStudentGrade}
          institutions={institutions}
          users={users}
          grades={grades}
          studentGrades={studentGrades}
          showMsg={showMsg}
          onClose={() => setEditingStudentGrade(null)}
          onChanged={onChanged}
        />
      )}

      {deletingStudentGrade && (
        <ConfirmDeleteModal
          title="Eliminar Matrícula"
          message={<>¿Estás seguro de eliminar la matrícula de <strong>{getUserLabel(deletingStudentGrade.estudiante_id)}</strong>?</>}
          onCancel={() => setDeletingStudentGrade(null)}
          onConfirm={handleDeleteStudentGrade}
        />
      )}
    </div>
  );
};
