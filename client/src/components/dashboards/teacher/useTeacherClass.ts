import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../context/useApp';
import { api } from '../../../services/api';
import { fullName, gradeLabel } from '../../../lib/people';
import { maxScoreFor } from '../../../lib/grades';
import type { AcademicPeriod } from '../../../types';

/** Clase activa del docente: la asignación materia-grado seleccionada. */
export function useTeacherClass(selectedAssignId: string) {
  const {
    user, grades, subjects, assignments, studentGrades,
    users, evaluations, marks, currentInstitution,
  } = useApp();

  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');

  const teacherAssignments = assignments.filter(a => a.profesor_id === user?.id);
  const activeAssignment = teacherAssignments.find(a => a.id === selectedAssignId);
  const activeGrade = activeAssignment ? grades.find(g => g.id === activeAssignment.grado_id) : null;
  const activeSubject = activeAssignment ? subjects.find(s => s.id === activeAssignment.materia_id) : null;

  const enrolledStudentIds = activeGrade
    ? studentGrades.filter(sg => sg.grado_id === activeGrade.id).map(sg => sg.estudiante_id)
    : [];
  const gradeStudents = users.filter(u => enrolledStudentIds.includes(u.id) && u.activo);

  const getSubjectName = (subjId: string) => subjects.find(s => s.id === subjId)?.nombre || 'Materia';
  const getGradeName = (gradeId: string) => gradeLabel(grades.find(g => g.id === gradeId)) || 'Grado';
  const getStudentName = (studId: string) => fullName(users.find(u => u.id === studId)) || 'Estudiante';

  // Periodos de la institución del docente, ordenados por año y número.
  useEffect(() => {
    let activo = true;
    if (user?.institucion_id) {
      api.getAcademicPeriods().then(list => {
        if (!activo) return;
        const propios = list
          .filter(p => p.institucion_id === user.institucion_id)
          .sort((a, b) => (b.anio - a.anio) || (a.numero - b.numero));
        setPeriods(propios);
        // Selecciona el primer periodo abierto por defecto.
        const abierto = propios.find(p => p.activo);
        setSelectedPeriodId(prev => prev || (abierto ? abierto.id : propios[0]?.id || ''));
      }).catch(() => {});
    }
    return () => { activo = false; };
  }, [user?.institucion_id]);

  // Al cambiar de clase se conserva el periodo elegido; si ya no aplica, se usa el abierto.
  useEffect(() => {
    setSelectedPeriodId(prev => {
      const sigue = periods.some(p => p.id === prev);
      if (sigue) return prev;
      const abierto = periods.find(p => p.activo);
      return abierto ? abierto.id : periods[0]?.id || '';
    });
  }, [periods, activeAssignment?.id]);

  const activePeriod = useMemo(
    () => periods.find(p => p.id === selectedPeriodId) || null,
    [periods, selectedPeriodId]
  );

  /** Evaluaciones de la clase activa, filtradas por el periodo seleccionado. */
  const activePeriodEvals = useMemo(() => {
    if (!activeAssignment || !activePeriod) return [];
    return evaluations.filter(
      e =>
        e.materia_id === activeAssignment.materia_id &&
        e.grado_id === activeAssignment.grado_id &&
        e.periodo_id === activePeriod.id
    );
  }, [evaluations, activeAssignment, activePeriod]);

  const selectPeriod = useCallback((id: string) => setSelectedPeriodId(id), []);

  return {
    user,
    currentInstitution,
    teacherAssignments,
    activeAssignment,
    activeGrade,
    activeSubject,
    gradeStudents,
    activeEvals: activePeriodEvals,
    marks,
    notaMax: maxScoreFor(currentInstitution),
    periods,
    selectedPeriodId,
    activePeriod,
    selectPeriod,
    getSubjectName,
    getGradeName,
    getStudentName,
  };
}
