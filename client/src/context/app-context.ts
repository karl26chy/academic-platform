import { createContext } from 'react';
import type { DataError } from '../hooks/usePlatformData';
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

/** Contrato del estado global que consumen todas las pantallas. */
export interface AppContextValue {
  user: User | null;
  loading: boolean;
  /** Intento de autenticación rechazado; lo muestra el formulario de login. */
  authError: string | null;
  /** Fallo al cargar las colecciones; nunca bloquea el acceso al login. */
  dataError: DataError | null;

  institutions: Institution[];
  users: User[];
  grades: Grade[];
  subjects: Subject[];
  assignments: Assignment[];
  studentGrades: StudentGrade[];
  attendance: Attendance[];
  marks: Mark[];
  citations: Citation[];
  messages: Message[];
  evaluations: Evaluation[];

  activeSubdomain: string | null;
  setSimulatedSubdomain: (subdomain: string | null) => void;

  login: (identifier: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshData: () => Promise<void>;

  currentInstitution: Institution | null;
  navigateToTab: string | null;
  setNavigateToTab: (tab: string | null) => void;
}

export const AppContext = createContext<AppContextValue | undefined>(undefined);
