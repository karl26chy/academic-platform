import React, { useState } from 'react';
import { BookOpenCheck, Edit3, GraduationCap, Trash2 } from 'lucide-react';
import { api } from '../../../services/api';
import { Card, CardTitle, EmptyMessage, Field, INPUT, PRIMARY_BUTTON, toast } from '../../ui';
import { ConfirmDeleteModal } from '../super-admin/ConfirmDeleteModal';
import { EditAssignmentModal } from '../super-admin/EditAssignmentModal';
import { EditStudentGradeModal } from '../super-admin/EditStudentGradeModal';
import { useApp } from '../../../context/useApp';
import { fullName, gradeLabel } from '../../../lib/people';
import type { Assignment, StudentGrade } from '../../../types';

/** Asignaciones (docente + materia + grado) y matrículas de la institución del admin. */
export const AsignacionesTab: React.FC = () => {
  const { user, users, grades, subjects, assignments, studentGrades, currentInstitution, refreshData } = useApp();

  const showMsg = (type: 'success' | 'error', text: string) => (type === 'success' ? toast.success(text) : toast.error(text));
  const [teacherId, setTeacherId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studGradeId, setStudGradeId] = useState('');

  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [deletingAssignment, setDeletingAssignment] = useState<Assignment | null>(null);
  const [editingStudentGrade, setEditingStudentGrade] = useState<StudentGrade | null>(null);
  const [deletingStudentGrade, setDeletingStudentGrade] = useState<StudentGrade | null>(null);

  const instId = user?.institucion_id;

  const misDocentes = users.filter(u => u.rol === 'teacher' && u.institucion_id === instId);
  const misEstudiantes = users.filter(
    u => u.rol === 'student' && u.institucion_id === instId && !studentGrades.some(sg => sg.estudiante_id === u.id)
  );
  const misMaterias = subjects.filter(s => s.institucion_id === instId);
  const misGrados = grades.filter(g => g.institucion_id === instId);
  const misAsignaciones = assignments.filter(a => a.institucion_id === instId);
  const misMatriculas = studentGrades.filter(sg => misEstudiantes.some(s => s.id === sg.estudiante_id));

  const teacherName = (id: string) => fullName(users.find(u => u.id === id));
  const studentName = (id: string) => fullName(users.find(u => u.id === id));
  const subjectName = (id: string) => subjects.find(s => s.id === id)?.nombre || 'Materia';
  const gradeName = (id: string) => gradeLabel(grades.find(g => g.id === id));

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId || !subjectId || !gradeId || !instId) return;
    const exists = assignments.some(a => a.profesor_id === teacherId && a.materia_id === subjectId && a.grado_id === gradeId);
    if (exists) {
      toast.error('Esta asignación ya existe.');
      return;
    }
    try {
      await api.createAssignment({ profesor_id: teacherId, materia_id: subjectId, grado_id: gradeId, institucion_id: instId });
      setTeacherId(''); setSubjectId(''); setGradeId('');
      toast.success('Asignación guardada.');
      await refreshData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear asignación.');
    }
  };

  const handleDeleteAssignment = async () => {
    if (!deletingAssignment) return;
    try {
      await api.deleteAssignment(deletingAssignment.id);
      setDeletingAssignment(null);
      toast.success('Asignación eliminada.');
      await refreshData();
    } catch (err) {
      setDeletingAssignment(null);
      toast.error(err instanceof Error ? err.message : 'Error al eliminar asignación.');
    }
  };

  const handleAssignStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !studGradeId) return;
    try {
      await api.createStudentGrade({ estudiante_id: studentId, grado_id: studGradeId });
      setStudentId(''); setStudGradeId('');
      toast.success('Estudiante matriculado.');
      await refreshData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al matricular.');
    }
  };

  const handleDeleteStudentGrade = async () => {
    if (!deletingStudentGrade) return;
    try {
      await api.deleteStudentGrade(deletingStudentGrade.id);
      setDeletingStudentGrade(null);
      toast.success('Matrícula eliminada.');
      await refreshData();
    } catch (err) {
      setDeletingStudentGrade(null);
      toast.error(err instanceof Error ? err.message : 'Error al eliminar matrícula.');
    }
  };

  const institutions = currentInstitution ? [currentInstitution] : [];

  return (
    <div className="animate-fade-in space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardTitle icon={<BookOpenCheck className="h-5 w-5 text-q10-600" />}>
            Asignar Materia a Docente
          </CardTitle>
          <form onSubmit={handleCreateAssignment} className="space-y-4 mt-4">
            <Field label="Docente">
              <select required value={teacherId} onChange={e => setTeacherId(e.target.value)} className={INPUT}>
                <option value="">-- Seleccionar --</option>
                {misDocentes.map(t => <option key={t.id} value={t.id}>{t.nombre} {t.apellido}</option>)}
              </select>
            </Field>
            <Field label="Materia">
              <select required value={subjectId} onChange={e => setSubjectId(e.target.value)} className={INPUT}>
                <option value="">-- Seleccionar --</option>
                {misMaterias.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </Field>
            <Field label="Grado">
              <select required value={gradeId} onChange={e => setGradeId(e.target.value)} className={INPUT}>
                <option value="">-- Seleccionar --</option>
                {misGrados.map(g => <option key={g.id} value={g.id}>{gradeName(g.id)}</option>)}
              </select>
            </Field>
            <button type="submit" className={`w-full ${PRIMARY_BUTTON}`}>Guardar Asignación</button>
          </form>

          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-6 mb-3">
            Asignaciones Activas
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {misAsignaciones.length === 0 ? (
              <EmptyMessage className="text-sm text-gray-500 py-4">Sin asignaciones.</EmptyMessage>
            ) : (
              misAsignaciones.map(a => (
                <div key={a.id} className="p-3 bg-white rounded-xl border border-gray-200 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-gray-900 min-w-0 truncate">{teacherName(a.profesor_id)}</span>
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
                    <span>{subjectName(a.materia_id)}</span>
                    <span>{gradeName(a.grado_id)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardTitle icon={<GraduationCap className="h-5 w-5 text-q10-600" />}>
            Matricular Estudiante
          </CardTitle>
          <form onSubmit={handleAssignStudent} className="space-y-4 mt-4">
            <Field label="Estudiante">
              <select required value={studentId} onChange={e => setStudentId(e.target.value)} className={INPUT}>
                <option value="">-- Seleccionar --</option>
                {misEstudiantes.map(s => <option key={s.id} value={s.id}>{s.nombre} {s.apellido}</option>)}
              </select>
            </Field>
            <Field label="Grado">
              <select required value={studGradeId} onChange={e => setStudGradeId(e.target.value)} className={INPUT}>
                <option value="">-- Seleccionar --</option>
                {misGrados.map(g => <option key={g.id} value={g.id}>{gradeName(g.id)}</option>)}
              </select>
            </Field>
            <button type="submit" className={`w-full ${PRIMARY_BUTTON}`}>Matricular</button>
          </form>

          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-6 mb-3">Matrículas</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {misMatriculas.length === 0 ? (
              <EmptyMessage className="text-sm text-gray-500 py-4">Sin matrículas.</EmptyMessage>
            ) : (
              misMatriculas.map(sg => (
                <div key={sg.id} className="flex flex-wrap justify-between items-center gap-2 p-3 bg-white rounded-xl border border-gray-200 text-xs">
                  <span className="font-semibold text-gray-900 min-w-0 truncate">{studentName(sg.estudiante_id)}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded bg-q10-50 text-q10-600 font-medium">{gradeName(sg.grado_id)}</span>
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
            )}
          </div>
        </Card>
      </div>

      {editingAssignment && (
        <EditAssignmentModal
          assignment={editingAssignment}
          institutions={institutions}
          users={users}
          grades={grades}
          subjects={subjects}
          showMsg={showMsg}
          onClose={() => setEditingAssignment(null)}
          onChanged={refreshData}
        />
      )}

      {deletingAssignment && (
        <ConfirmDeleteModal
          title="Eliminar Asignación"
          message={<>¿Eliminar la asignación de <strong>{teacherName(deletingAssignment.profesor_id)}</strong> a <strong>{subjectName(deletingAssignment.materia_id)}</strong>?</>}
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
          onChanged={refreshData}
        />
      )}

      {deletingStudentGrade && (
        <ConfirmDeleteModal
          title="Eliminar Matrícula"
          message={<>¿Eliminar la matrícula de <strong>{studentName(deletingStudentGrade.estudiante_id)}</strong>?</>}
          onCancel={() => setDeletingStudentGrade(null)}
          onConfirm={handleDeleteStudentGrade}
        />
      )}
    </div>
  );
};
