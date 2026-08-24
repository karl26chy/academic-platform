import { authApi } from './auth.api';
import { reportApi } from './report.api';
import { createResourceApi } from './resource.api';
import { http } from '../http';

export { getAuthToken, setAuthToken, UNAUTHORIZED_EVENT, ApiError } from '../http';
import type {
  User,
  Institution,
  Grade,
  Subject,
  Assignment,
  StudentGrade,
  Attendance,
  Mark,
  Citation,
  Message,
  Evaluation,
  AcademicHistory,
  AcademicPeriod,
} from '../../types';

export const institutions = createResourceApi<Institution>('institutions');
export const users = createResourceApi<User & { password?: string }>('users');
export const grades = createResourceApi<Grade>('grades');
export const subjects = createResourceApi<Subject>('subjects');
export const assignments = createResourceApi<Assignment>('assignments');
export const studentGrades = createResourceApi<StudentGrade>('student_grades');
export const attendance = createResourceApi<Attendance>('attendance');
export const marks = createResourceApi<Mark>('marks');
export const citations = createResourceApi<Citation>('citations');
export const messages = createResourceApi<Message>('messages');
export const evaluations = createResourceApi<Evaluation>('evaluations');
export const academicPeriods = createResourceApi<AcademicPeriod>('academic_periods');

/**
 * Fachada estable del API. Mantiene la forma que consumen los componentes
 * mientras por debajo todo se apoya en los clientes por recurso.
 */
export const api = {
  // Auth
  login: authApi.login,
  getMe: authApi.getMe,

  // Reportes / boletines (JSON para Excel)
  getStudentReport: reportApi.getStudentReport,
  getStudentYearReport: reportApi.getStudentYearReport,

  // Academic history
  getStudentAcademicHistory: (
    studentId: string,
    filtros?: { anio?: string; periodo?: string; grado_id?: string; materia_id?: string }
  ) => {
    const params = new URLSearchParams();
    if (filtros?.anio) params.set('anio', filtros.anio);
    if (filtros?.periodo) params.set('periodo', filtros.periodo);
    if (filtros?.grado_id) params.set('grado_id', filtros.grado_id);
    if (filtros?.materia_id) params.set('materia_id', filtros.materia_id);
    const qs = params.toString();
    return http.get<AcademicHistory>(`/students/${studentId}/academic-history${qs ? `?${qs}` : ''}`);
  },

  // Institutions
  getInstitutions: institutions.list,
  getInstitution: institutions.get,
  createInstitution: institutions.create,
  updateInstitution: institutions.update,
  deleteInstitution: institutions.remove,

  // Users
  getUsers: users.list,
  createUser: users.create,
  updateUser: users.update,
  deleteUser: users.remove,

  // Grades
  getGrades: grades.list,
  createGrade: grades.create,
  updateGrade: grades.update,
  deleteGrade: grades.remove,

  // Subjects
  getSubjects: subjects.list,
  createSubject: subjects.create,
  updateSubject: subjects.update,
  deleteSubject: subjects.remove,

  // Assignments
  getAssignments: assignments.list,
  createAssignment: assignments.create,
  updateAssignment: assignments.update,
  deleteAssignment: assignments.remove,

  // Student Grades Mapping
  getStudentGrades: studentGrades.list,
  createStudentGrade: studentGrades.create,
  updateStudentGrade: studentGrades.update,
  deleteStudentGrade: studentGrades.remove,

  // Attendance
  getAttendance: attendance.list,
  createAttendance: attendance.create,

  // Marks
  getMarks: marks.list,
  createMark: marks.create,
  updateMark: marks.update,

  // Citations
  getCitations: citations.list,
  createCitation: citations.create,
  updateCitation: citations.update,

  // Messages
  getMessages: messages.list,
  createMessage: messages.create,
  updateMessage: messages.patch,

  // Evaluations
  getEvaluations: evaluations.list,
  createEvaluation: evaluations.create,
  updateEvaluation: evaluations.update,
  deleteEvaluation: evaluations.remove,

  // Academic periods
  getAcademicPeriods: academicPeriods.list,
  createAcademicPeriod: academicPeriods.create,
  updateAcademicPeriod: academicPeriods.update,
  deleteAcademicPeriod: academicPeriods.remove,
};
