import { useCallback, useRef, useState } from 'react';
import { api, getAuthToken, ApiError } from '../services/api';
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
} from '../types';

const ERROR_CONEXION =
  'No se pudo conectar con el servidor API. Verifica que el backend esté activo.';

/**
 * Fallo al cargar las colecciones.
 *
 * `esFalloDeRed` separa "el backend no responde" (no se puede hacer nada, ni
 * siquiera iniciar sesión) de "el API respondió con un error" (la sesión sigue
 * siendo utilizable). Mezclarlos hacía que cualquier fallo se presentara como
 * un problema de infraestructura.
 */
export interface DataError {
  message: string;
  esFalloDeRed: boolean;
}

/** Traduce una excepción a un fallo presentable sin perder su naturaleza. */
function describirFallo(err: unknown): DataError {
  if (err instanceof ApiError) {
    return { message: err.esFalloDeRed ? ERROR_CONEXION : err.message, esFalloDeRed: err.esFalloDeRed };
  }
  return { message: err instanceof Error ? err.message : ERROR_CONEXION, esFalloDeRed: false };
}

/**
 * Colecciones de datos de la plataforma y sus cargadores.
 * El API acota cada listado al alcance del usuario autenticado, así que el
 * cliente puede quedarse con el conjunto completo que le devuelven.
 */
export function usePlatformData() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [studentGrades, setStudentGrades] = useState<StudentGrade[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);

  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<DataError | null>(null);

  // Contador de versión de carga: invalida respuestas rezagadas de sesiones anteriores.
  const loadSeqRef = useRef(0);

  /** Vacía lo que pertenece a la sesión; las instituciones son públicas. */
  const resetSessionCollections = useCallback(() => {
    loadSeqRef.current += 1;
    setUsers([]);
    setGrades([]);
    setSubjects([]);
    setAssignments([]);
    setStudentGrades([]);
    setAttendance([]);
    setMarks([]);
    setCitations([]);
    setMessages([]);
    setEvaluations([]);
  }, []);

  /** Solo instituciones: es la única lectura pública, necesaria para el login. */
  const fetchInstitutions = useCallback(async () => {
    const list = await api.getInstitutions();
    setInstitutions(list);
    return list;
  }, []);

  /** El resto de colecciones, que requieren sesión iniciada. */
  const fetchSessionCollections = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    const [userList, gradeList, subList, assignList, sgList, attList, markList, citList, msgList, evalList] =
      await Promise.all([
        api.getUsers(),
        api.getGrades(),
        api.getSubjects(),
        api.getAssignments(),
        api.getStudentGrades(),
        api.getAttendance(),
        api.getMarks(),
        api.getCitations(),
        api.getMessages(),
        api.getEvaluations(),
      ]);

    if (seq !== loadSeqRef.current) return;

    setUsers(userList);
    setGrades(gradeList);
    setSubjects(subList);
    setAssignments(assignList);
    setStudentGrades(sgList);
    setAttendance(attList);
    setMarks(markList);
    setCitations(citList);
    setMessages(msgList);
    setEvaluations(evalList);
  }, []);

  /** Recarga completa: instituciones y colecciones de sesión en paralelo.
   *  No toca el flag global `loading`: así el refresh tras una operación CRUD
   *  actualiza las colecciones en segundo plano sin desmontar el dashboard
   *  (el loading de pantalla completa solo lo controla el arranque inicial). */
  const loadEverything = useCallback(async (): Promise<Institution[] | undefined> => {
    const seq = ++loadSeqRef.current;
    try {
      setDataError(null);

      // Sin token no hay nada protegido que pedir. El reintento de la pantalla
      // de error llega hasta aquí estando deslogueado, y pedir las colecciones
      // provocaba una cascada de 401 que volvía a levantar el mismo error.
      if (!getAuthToken()) {
        resetSessionCollections();
        const instList = await api.getInstitutions();
        if (seq !== loadSeqRef.current) return;
        setInstitutions(instList);
        return instList;
      }

      const [instList, userList, gradeList, subList, assignList, sgList, attList, markList, citList, msgList, evalList] =
        await Promise.all([
          api.getInstitutions(),
          api.getUsers(),
          api.getGrades(),
          api.getSubjects(),
          api.getAssignments(),
          api.getStudentGrades(),
          api.getAttendance(),
          api.getMarks(),
          api.getCitations(),
          api.getMessages(),
          api.getEvaluations(),
        ]);

      if (seq !== loadSeqRef.current) return;

      setInstitutions(instList);
      setUsers(userList);
      setGrades(gradeList);
      setSubjects(subList);
      setAssignments(assignList);
      setStudentGrades(sgList);
      setAttendance(attList);
      setMarks(markList);
      setCitations(citList);
      setMessages(msgList);
      setEvaluations(evalList);
      return instList;
    } catch (err: unknown) {
      if (seq === loadSeqRef.current) {
        console.error('Failed to load initial data:', err);
        setDataError(describirFallo(err));
      }
    }
  }, [resetSessionCollections]);

  return {
    collections: {
      institutions,
      users,
      grades,
      subjects,
      assignments,
      studentGrades,
      attendance,
      marks,
      citations,
      messages,
      evaluations,
    },
    loading,
    dataError,
    setLoading,
    setDataError,
    resetSessionCollections,
    fetchInstitutions,
    fetchSessionCollections,
    loadEverything,
  };
}

export { ERROR_CONEXION, describirFallo };
