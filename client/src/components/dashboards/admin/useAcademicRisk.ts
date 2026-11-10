import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../context/useApp';
import { api } from '../../../services/api';
import { gradeLabel, studentFullName } from '../../../lib/people';
import {
  academicYearFromPeriods,
  selectBestPerCourse,
  selectWorstPerCourse,
  type AcademicStatus,
  type GradeGroup,
} from '../../../lib/academicStatus';

/**
 * Estado académico institucional para el resumen del admin.
 *
 * El promedio acumulado y la banda de desempeño los calcula el API para toda
 * la institución en UNA petición (`getInstitutionStatus`), con la misma
 * lógica del boletín anual. Antes se pedía el boletín de cada estudiante por
 * separado: con cientos de estudiantes eran cientos de peticiones.
 * La asistencia se muestra como indicador, sin determinar el riesgo.
 *
 * Se recalcula cuando cambian las colecciones del contexto (tras `refreshData`),
 * así el resumen se actualiza conforme se registran/cierran períodos.
 */
export function useAcademicRisk() {
  const { currentInstitution, users, grades, studentGrades, marks } = useApp();

  const instId = currentInstitution?.id;

  const [anio, setAnio] = useState<number | null>(null);
  const [statuses, setStatuses] = useState<AcademicStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const students = useMemo(
    () => users.filter(u => u.rol === 'student' && u.institucion_id === instId),
    [users, instId]
  );

  // Resuelve el año académico desde los períodos reales de la institución.
  useEffect(() => {
    let activo = true;
    if (!instId) {
      setAnio(null);
      return;
    }
    api
      .getAcademicPeriods()
      .then(list => {
        if (!activo) return;
        const propios = list.filter(p => p.institucion_id === instId);
        setAnio(academicYearFromPeriods(propios) ?? new Date().getFullYear());
      })
      .catch(() => {
        if (activo) setAnio(new Date().getFullYear());
      });
    return () => {
      activo = false;
    };
  }, [instId, marks, students]);

  const loadStatus = useCallback(async () => {
    if (!instId || anio === null) return;
    setLoading(true);
    setError(null);
    try {
      // Solo llegan estudiantes con al menos una nota: sin notas no hay clasificación.
      const estados = await api.getInstitutionStatus(instId, anio);
      const porId = new Map(students.map(s => [s.id, s]));
      const lista: AcademicStatus[] = estados.flatMap(est => {
        const st = porId.get(est.studentId);
        if (!st) return [];
        const enrollment = studentGrades.find(sg => sg.estudiante_id === st.id);
        const grade = enrollment ? grades.find(g => g.id === enrollment.grado_id) : null;
        return [{
          studentId: st.id,
          nombre: studentFullName(st),
          apellido: st.apellido,
          gradeId: grade?.id ?? null,
          gradeNombre: grade ? gradeLabel(grade) : 'Sin asignar',
          promedio: est.promedio,
          desempeno: est.desempeno,
          asistenciaTasa: est.asistenciaTasa,
          ausentes: est.ausentes,
        }];
      });
      setStatuses(lista);
    } catch {
      setError('No se pudo calcular el estado académico institucional.');
    } finally {
      setLoading(false);
    }
    // `marks` como dependencia: tras registrar notas el resumen se recalcula.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instId, anio, students, studentGrades, grades, marks]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  /** Los 3 peores y los 3 mejores promedios de CADA curso (por gradeId). */
  const riskByGrade: GradeGroup<AcademicStatus>[] = useMemo(
    () => selectWorstPerCourse(statuses),
    [statuses]
  );

  const topByGrade: GradeGroup<AcademicStatus>[] = useMemo(
    () => selectBestPerCourse(statuses),
    [statuses]
  );

  return { anio, riskByGrade, topByGrade, loading, error };
}
