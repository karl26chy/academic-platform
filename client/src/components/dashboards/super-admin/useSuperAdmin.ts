import { useCallback } from 'react';
import { useApp } from '../../../context/useApp';
import { toast } from '../../ui';
import { fullName, gradeLabel } from '../../../lib/people';

export interface Feedback {
  type: 'success' | 'error';
  text: string;
}

/** Etiquetas y avisos compartidos por las pestañas de la consola global. */
export function useSuperAdmin() {
  const { institutions, users, grades, subjects, studentGrades, assignments, refreshData } = useApp();

const showMsg = useCallback((type: Feedback['type'], text: string) => {
    if (type === 'success') toast.success(text);
    else toast.error(text);
  }, []);

  const getGradeLabel = (gradeId: string) =>
    gradeLabel(grades.find(g => g.id === gradeId)) || 'Desconocido';

  const getSubjectLabel = (subjectId: string) =>
    subjects.find(s => s.id === subjectId)?.nombre || 'Desconocida';

  const getUserLabel = (userId: string) =>
    fullName(users.find(u => u.id === userId)) || 'Desconocido';

  const getInstName = (instId: string | null) => {
    if (!instId) return 'Sin institución';
    return institutions.find(i => i.id === instId)?.nombre || 'Desconocida';
  };

  return {
    institutions,
    users,
    grades,
    subjects,
    assignments,
    studentGrades,
    refreshData,
    showMsg,
    getGradeLabel,
    getSubjectLabel,
    getUserLabel,
    getInstName,
  };
}