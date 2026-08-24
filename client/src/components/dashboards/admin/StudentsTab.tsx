import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Edit3, Eye, FileText, Filter, Search, UserPlus, X } from 'lucide-react';
import { Card, EmptyMessage, Field, INPUT, toast } from '../../ui';
import { useClickOutside } from '../../../hooks/useClickOutside';
import { getAge } from '../../../lib/people';
import { documentoCompleto } from '../../../lib/documentTypes';
import { applyStudentFilters, countActiveFilters } from '../../../lib/studentFilters';
import { StudentDetail } from './StudentDetail';
import { StudentFormModal } from './StudentFormModal';
import { BoletinModal } from './BoletinModal';
import type { Attendance, Grade, Institution, Mark, StudentGrade, Subject, User } from '../../../types';

interface StudentsTabProps {
  students: User[];
  grades: Grade[];
  studentGrades: StudentGrade[];
  subjects: Subject[];
  marks: Mark[];
  attendance: Attendance[];
  institution: Institution | null;
  getSubjectName: (subjectId: string) => string;
  getStudentGradeLabel: (studentId: string) => string;
  getStudentAverage: (studentId: string) => number;
  getStudentAttendanceRate: (studentId: string) => number;
  onChanged: () => Promise<void>;
}

/** Buscador, filtros, ficha detallada y gestión de estudiantes de la institución. */
export const StudentsTab: React.FC<StudentsTabProps> = ({
  students, grades, studentGrades, subjects, marks, attendance, institution,
  getSubjectName, getStudentGradeLabel, getStudentAverage, getStudentAttendanceRate,
  onChanged,
}) => {
  const [genero, setGenero] = useState('');
  const [edadMin, setEdadMin] = useState(0);
  const [edadMax, setEdadMax] = useState(99);
  const [gradoId, setGradoId] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<User | null>(null);
  const [query, setQuery] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  const showMsg = (type: 'success' | 'error', text: string) => (type === 'success' ? toast.success(text) : toast.error(text));
  const [formMode, setFormMode] = useState<'new' | User | null>(null);
  const [reportStudent, setReportStudent] = useState<User | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const closeAutocomplete = useCallback(() => setShowAutocomplete(false), []);
  useClickOutside(searchRef, closeAutocomplete);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return students
      .filter(s =>
        `${s.nombre} ${s.apellido}`.toLowerCase().includes(q) ||
        (s.identificacion && s.identificacion.toLowerCase().includes(q)) ||
        s.email.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, students]);

  const activeFilterCount = countActiveFilters({ genero, edadMin, edadMax, gradoId });

  const filteredStudents = useMemo(
    () =>
      applyStudentFilters(students, studentGrades, { genero, edadMin, edadMax, gradoId }),
    [students, studentGrades, genero, edadMin, edadMax, gradoId]
  );

  const limpiarFiltros = () => {
    setGenero('');
    setEdadMin(0);
    setEdadMax(99);
    setGradoId('');
  };

  const selectStudent = (s: User) => {
    setSelected(s);
    setShowAutocomplete(false);
    setQuery('');
  };

  return (
    <div className="animate-fade-in space-y-6">
      <Card className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div ref={searchRef} className="relative flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowAutocomplete(true); }}
              onFocus={() => setShowAutocomplete(true)}
              placeholder="Buscar estudiante por nombre, identificación o email..."
              className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-q10-500/50"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setShowAutocomplete(false); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {showAutocomplete && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-72 overflow-y-auto">
              {searchResults.map(s => (
                <button
                  key={s.id}
                  onClick={() => selectStudent(s)}
                  className="w-full text-left px-4 py-3 hover:bg-q10-50 border-b border-gray-100 last:border-0 flex items-center gap-3 transition-colors"
                >
                  <div className="h-8 w-8 bg-q10-100 rounded-full flex items-center justify-center text-q10-600 font-bold text-xs">
                    {s.nombre[0]}{s.apellido[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-gray-900 text-sm block truncate">
                      {s.nombre} {s.apellido}
                    </span>
                    <span className="text-xs text-gray-500 block truncate">
                      {documentoCompleto(s.tipo_documento, s.identificacion)} · {getStudentGradeLabel(s.id)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => setFormMode('new')}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-q10-600 hover:bg-q10-700 text-white font-semibold rounded-xl text-sm transition-colors shrink-0 w-full sm:w-auto"
        >
          <UserPlus className="h-4 w-4" /> Crear Estudiante
        </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen(o => !o)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Filter className="h-4 w-4 text-q10-600" />
            {activeFilterCount > 0 ? `Filtros (${activeFilterCount})` : 'Filtros'}
            {filtersOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>
        </div>

        {filtersOpen && (
          <div className="space-y-3 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <Field label="Género">
                <select value={genero} onChange={e => setGenero(e.target.value)} className={INPUT}>
                  <option value="">Todos</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                  <option value="otro">Otro</option>
                </select>
              </Field>
              <Field label="Edad Mínima">
                <input
                  type="number" min="0" max="99" value={edadMin}
                  onChange={e => setEdadMin(Number(e.target.value))} className={INPUT}
                />
              </Field>
              <Field label="Edad Máxima">
                <input
                  type="number" min="0" max="99" value={edadMax}
                  onChange={e => setEdadMax(Number(e.target.value))} className={INPUT}
                />
              </Field>
              <Field label="Grado">
                <select value={gradoId} onChange={e => setGradoId(e.target.value)} className={INPUT}>
                  <option value="">Todos</option>
                  {grades.map(g => (
                    <option key={g.id} value={g.id}>{g.nombre} "{g.tipo_grado}"</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={limpiarFiltros}
                disabled={activeFilterCount === 0}
                className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Limpiar filtros
              </button>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <h3 className="text-sm font-bold text-gray-900 mb-4">
            Estudiantes ({filteredStudents.length})
          </h3>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredStudents.length === 0 ? (
              <EmptyMessage>Sin resultados.</EmptyMessage>
            ) : (
              filteredStudents.map(s => (
                <div
                  key={s.id}
                  className={`flex items-center gap-1 p-3 rounded-xl border text-sm transition-all ${
                    selected?.id === s.id
                      ? 'bg-q10-50 border-q10-500'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <button
                    onClick={() => setSelected(selected?.id === s.id ? null : s)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <span className="font-semibold block">{s.nombre} {s.apellido}</span>
                    <span className="text-xs text-gray-500 block mt-0.5">
                      {getStudentGradeLabel(s.id)} · {getAge(s.fecha_nacimiento)} años · {s.genero || 'N/E'}
                    </span>
                  </button>
                  <button
                    onClick={() => setReportStudent(s)}
                    title="Generar boletín"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-q10-600 hover:bg-q10-50 transition-colors shrink-0"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setFormMode(s)}
                    title="Editar estudiante"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors shrink-0"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          {!selected ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Eye className="h-12 w-12 mb-3" />
              <p className="text-sm font-medium">
                Selecciona un estudiante para ver su información y rendimiento
              </p>
            </div>
          ) : (
            <StudentDetail
              student={selected}
              institution={institution}
              subjects={subjects}
              marks={marks}
              attendance={attendance}
              gradeLabel={getStudentGradeLabel(selected.id)}
              average={getStudentAverage(selected.id)}
              attendanceRate={getStudentAttendanceRate(selected.id)}
              getSubjectName={getSubjectName}
              onGenerateReport={s => setReportStudent(s)}
            />
          )}
        </Card>
      </div>

      {formMode && (
        <StudentFormModal
          institution={institution}
          student={formMode === 'new' ? null : formMode}
          onClose={() => setFormMode(null)}
          onSaved={onChanged}
          showMsg={showMsg}
        />
      )}

      {reportStudent && (
        <BoletinModal student={reportStudent} onClose={() => setReportStudent(null)} />
      )}
    </div>
  );
};
