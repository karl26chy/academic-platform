import { useCallback, useMemo } from 'react';
import { useApp } from '../../../context/useApp';
import { averageBySubject, weightedAverage } from '../../../lib/grades';
import { attendanceRateStrict, countByStatus } from '../../../lib/attendance';
import { fileSlug, fullName, getAge, gradeLabel } from '../../../lib/people';
import { documentoCompleto } from '../../../lib/documentTypes';
import type { BoletinData } from '../../../services/export';
import type { User } from '../../../types';

/** Datos derivados de la consola institucional del administrador. */
export function useAdminDashboard() {
  const { currentInstitution, users, grades, subjects, studentGrades, marks, attendance } = useApp();

  const instUsers = users.filter(u => u.institucion_id === currentInstitution?.id);
  const instGrades = grades.filter(g => g.institucion_id === currentInstitution?.id);
  const studentUsers = instUsers.filter(u => u.rol === 'student');
  const teacherUsers = instUsers.filter(u => u.rol === 'teacher');

  const getSubjectName = useCallback(
    (subjId: string) => subjects.find(s => s.id === subjId)?.nombre || 'Materia',
    [subjects]
  );

  const studentIds = studentUsers.map(s => s.id);
  const instMarks = marks.filter(m => studentIds.includes(m.estudiante_id));

  /** Las cinco materias con menor promedio de la institución. */
  const lowPerfSubjects = useMemo(() => {
    if (!currentInstitution) return [];
    const conMateria = instMarks.filter(m => subjects.some(s => s.id === m.materia_id));
    return averageBySubject(conMateria)
      .map(({ materiaId, promedio }) => ({
        id: materiaId,
        nombre: getSubjectName(materiaId),
        promedio,
        deficit: promedio < currentInstitution.nota_minima_aprobacion,
      }))
      .sort((a, b) => a.promedio - b.promedio)
      .slice(0, 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentInstitution, marks, studentUsers, subjects, getSubjectName]);

  const overallSubjectData = useMemo(
    () =>
      averageBySubject(instMarks).map(({ materiaId, promedio }) => ({
        name: getSubjectName(materiaId),
        Promedio: promedio,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [marks, studentUsers, getSubjectName]
  );

  const getStudentGradeLabel = (studId: string) => {
    const enrollment = studentGrades.find(sg => sg.estudiante_id === studId);
    if (!enrollment) return 'Sin asignar';
    const grade = grades.find(g => g.id === enrollment.grado_id);
    return grade ? gradeLabel(grade) : 'Desconocido';
  };

  const marksOf = (studId: string, subjId?: string) =>
    marks.filter(m => m.estudiante_id === studId && (!subjId || m.materia_id === subjId));

  const getStudentAverage = (studId: string, subjId?: string) =>
    weightedAverage(marksOf(studId, subjId));

  const attendanceOf = (studId: string) => attendance.filter(a => a.estudiante_id === studId);

  const getStudentAttendanceRate = (studId: string) => attendanceRateStrict(attendanceOf(studId));

  /** Arma el boletín informativo de un estudiante para exportarlo. */
  const buildBoletinData = (student: User): BoletinData => {
    const studentMarks = marksOf(student.id);

    const materias = subjects
      .map(subj => {
        const subjMarks = studentMarks.filter(m => m.materia_id === subj.id);
        if (subjMarks.length === 0) return null;
        const promedio = weightedAverage(subjMarks);
        const passing = currentInstitution
          ? promedio >= currentInstitution.nota_minima_aprobacion
          : true;
        return {
          nombre: subj.nombre,
          evaluaciones: subjMarks.length,
          promedio,
          estado: passing ? 'Aprobado' : 'Reprobado',
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);

    const counts = countByStatus(attendanceOf(student.id));

    return {
      institucion: currentInstitution?.nombre || '',
      estudiante: fullName(student),
      identificacion: student.identificacion || 'N/R',
      documento: documentoCompleto(student.tipo_documento, student.identificacion),
      grado: getStudentGradeLabel(student.id),
      edad: getAge(student.fecha_nacimiento),
      genero: student.genero || 'N/E',
      materias,
      promedioGeneral: getStudentAverage(student.id),
      notaMinima: currentInstitution?.nota_minima_aprobacion ?? 0,
      asistenciaTasa: getStudentAttendanceRate(student.id),
      ausencias: counts.ausente,
      justificadas: counts.justificada,
      fileName: `boletin_${fileSlug(student)}`,
    };
  };

  return {
    currentInstitution,
    instGrades,
    studentUsers,
    teacherUsers,
    subjects,
    marks,
    attendance,
    studentGrades,
    getSubjectName,
    lowPerfSubjects,
    overallSubjectData,
    getStudentGradeLabel,
    getStudentAverage,
    getStudentAttendanceRate,
    buildBoletinData,
    marksOf,
    attendanceOf,
  };
}
