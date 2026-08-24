import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../../context/useApp';
import { api } from '../../../services/api';
import { gradeLabel } from '../../../lib/people';
import {
  academicYearFromPeriods,
  selectBestPerCourse,
  selectWorstPerCourse,
  type AcademicStatus,
  type GradeGroup,
} from '../../../lib/academicStatus';

const CONCURRENCIA = 6;

/** Aplica `fn` sobre `items` con un límite de ejecuciones simultáneas,
 *  preservando el orden de entrada. */
async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Estado académico institucional para el resumen del admin.
 *
 * El promedio acumulado (promedioGeneralDefinitivo) y la banda de desempeño
 * (desempenoGlobal) vienen EXCLUSIVAMENTE de `getStudentYearReport` (misma
 * lógica del boletín anual: períodos cerrados + período actual, sin inventar
 * ceros). La asistencia se muestra como indicador, sin determinar el riesgo.
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

  /** Solo estudiantes con al menos una nota: sin notas no hay clasificación. */
  const conNotas = useMemo(
    () => students.filter(s => marks.some(m => m.estudiante_id === s.id)),
    [students, marks]
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
      const reports = await mapWithLimit(conNotas, CONCURRENCIA, async s =>
        api.getStudentYearReport(s.id, anio)
      );
      const lista: AcademicStatus[] = reports.map((rep, idx) => {
        const st = conNotas[idx];
        const enrollment = studentGrades.find(sg => sg.estudiante_id === st.id);
        const grade = enrollment ? grades.find(g => g.id === enrollment.grado_id) : null;
        return {
          studentId: st.id,
          nombre: `${st.nombre} ${st.apellido}`.trim(),
          gradeId: grade?.id ?? null,
          gradeNombre: grade ? gradeLabel(grade) : 'Sin asignar',
          promedio: rep.summary.promedioGeneralDefinitivo,
          desempeno: rep.summary.desempenoGlobal,
          asistenciaTasa: rep.attendance.tasa,
          ausentes: rep.attendance.ausente,
        };
      });
      setStatuses(lista);
    } catch {
      setError('No se pudo calcular el estado académico institucional.');
    } finally {
      setLoading(false);
    }
  }, [instId, anio, conNotas, studentGrades, grades]);

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
