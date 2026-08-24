import { validateMark } from './marks.validator.js';
import { validateUser } from './users.validator.js';
import { validateStudentGrade } from './student_grades.validator.js';
import { validateEvaluation } from './evaluations.validator.js';
import { validateInstitution } from './institutions.validator.js';
import { validateAttendance } from './attendance.validator.js';
import { validateSubject } from './subjects.validator.js';
import { validateAssignment } from './assignments.validator.js';
import { validatePeriod } from './periods.validator.js';

/** Un validador por recurso; los que no aparecen no tienen reglas propias. */
const validatorByResource = {
  marks: validateMark,
  users: validateUser,
  student_grades: validateStudentGrade,
  evaluations: validateEvaluation,
  institutions: validateInstitution,
  attendance: validateAttendance,
  subjects: validateSubject,
  assignments: validateAssignment,
  academic_periods: validatePeriod,
};

export async function validateRow(resource, data, existingRow) {
  const validate = validatorByResource[resource];
  if (validate) await validate(data, existingRow);
}
