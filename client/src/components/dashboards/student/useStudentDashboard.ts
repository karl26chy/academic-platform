import { useEffect, useState } from 'react';
import { useApp } from '../../../context/useApp';
import { api } from '../../../services/api';
import { averageBySubject } from '../../../lib/grades';
import { periodLabel } from '../../../lib/periods';
import { countByStatus, attendanceRateWithJustified } from '../../../lib/attendance';
import { fullName } from '../../../lib/people';
import type { AcademicPeriod } from '../../../types';

/** Datos derivados del portal del estudiante: su grado, notas y asistencia. */
export function useStudentDashboard() {
  const {
    user, currentInstitution, studentGrades, grades, subjects,
    assignments, attendance, marks, citations, users,
  } = useApp();

  // Periodos de la institución del estudiante (para mostrar el número junto al nombre).
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  useEffect(() => {
    let activo = true;
    if (user?.institucion_id) {
      api.getAcademicPeriods()
        .then(list => {
          if (!activo) return;
          setPeriods(list.filter(p => p.institucion_id === user.institucion_id));
        })
        .catch(() => {});
    }
    return () => { activo = false; };
  }, [user?.institucion_id]);

  const periodOf = (id?: string | null): AcademicPeriod | null =>
    periods.find(p => p.id === id) || null;

  /** Etiqueta "Periodo N — nombre — año" desde el id; si falta, el texto dado. */
  const periodLabelOf = (id?: string | null, fallback?: string): string => {
    const p = periodOf(id);
    return p ? periodLabel(p) : (fallback || '');
  };

  // Grado en el que está matriculado y materias que se dictan en él.
  const myGradeLink = studentGrades.find(sg => sg.estudiante_id === user?.id);
  const myGrade = myGradeLink ? grades.find(g => g.id === myGradeLink.grado_id) : null;
  const myGradeAssignments = myGrade ? assignments.filter(a => a.grado_id === myGrade.id) : [];

  const myTeacherIds = myGradeAssignments.map(a => a.profesor_id);
  const myTeachers = users.filter(u => myTeacherIds.includes(u.id));

  const getSubjectName = (subjId: string) => subjects.find(s => s.id === subjId)?.nombre || 'Materia';
  const getTeacherName = (teacherId: string) =>
    fullName(users.find(u => u.id === teacherId)) || 'Docente';

  const myMarks = marks.filter(m => m.estudiante_id === user?.id);

  const chartData = averageBySubject(myMarks).map(({ materiaId, promedio }) => ({
    name: getSubjectName(materiaId),
    'Nota Promedio': promedio,
  }));

  const myAttendance = attendance.filter(a => a.estudiante_id === user?.id);
  const attendanceCounts = countByStatus(myAttendance);
  const presenceRate = attendanceRateWithJustified(myAttendance);

  const myCitations = citations.filter(c => c.estudiante_id === user?.id);
  const pendingCitations = myCitations.filter(c => c.estado === 'pendiente');

  return {
    user,
    currentInstitution,
    myGrade,
    myGradeAssignments,
    myTeachers,
    getSubjectName,
    getTeacherName,
    myMarks,
    chartData,
    myAttendance,
    attendanceCounts,
    presenceRate,
    myCitations,
    pendingCitations,
    periods,
    periodOf,
    periodLabelOf,
  };
}
