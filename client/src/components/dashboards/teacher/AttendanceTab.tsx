import React, { useState } from 'react';
import { AlertTriangle, ArrowLeft, Calendar, History, Lock, Search } from 'lucide-react';
import { api } from '../../../services/api';
import { useApp } from '../../../context/useApp';
import { Card, EmptyMessage, ExportButtons, PRIMARY_BUTTON, SECONDARY_BUTTON, TableWrapper, TableHead, TableBody, toast } from '../../ui';
import { periodLabel } from '../../../lib/periods';
import { compareStudents, studentFullName } from '../../../lib/people';
import { ESTADOS, type Estado, getLocalTodayString, filterAttendanceByDateAndClass } from '../../../lib/attendance';
import type { AcademicPeriod, Assignment, Subject, Grade, User, Attendance } from '../../../types';

export { ESTADOS, type Estado, getLocalTodayString };

interface AttendanceTabProps {
  assignment: Assignment;
  subject?: Subject | null;
  grade?: Grade | null;
  students: User[];
  teacherId: string;
  periods: AcademicPeriod[];
  /** Periodo actualmente seleccionado en el contexto académico del docente. */
  period: AcademicPeriod | null;
  onSaved: () => Promise<void>;
}

/** Razón por la que no se puede registrar asistencia, o null si sí se puede. */
function blockedReason(periods: AcademicPeriod[], period: AcademicPeriod | null): string | null {
  const openCount = periods.filter(p => p.activo).length;
  if (periods.length === 0) {
    return 'No hay periodos académicos definidos para esta institución.';
  }
  if (openCount === 0) {
    return 'No hay un periodo académico abierto. No puedes registrar asistencia hasta que el administrador abra un periodo.';
  }
  if (openCount > 1) {
    return 'Hay más de un periodo académico abierto; revisa la configuración de periodos. No puedes registrar asistencia.';
  }
  if (!period) {
    return 'No hay un periodo académico seleccionado.';
  }
  if (!period.activo) {
    return 'El periodo seleccionado está cerrado. No puedes registrar asistencia.';
  }
  return null;
}

interface HistoryRow {
  student: User;
  record: Attendance;
}

/** Toma de asistencia y consulta/edición histórica de la clase activa. */
export const AttendanceTab: React.FC<AttendanceTabProps> = ({
  assignment, subject, grade, students, teacherId, periods, period, onSaved,
}) => {
  const { users } = useApp();
  const todayStr = getLocalTodayString();

  // Modo de vista: 'take' (tomar asistencia actual) | 'history' (historial y edición)
  const [mode, setMode] = useState<'take' | 'history'>('take');

  // --- Estado de toma de asistencia actual ---
  const [date, setDate] = useState(todayStr);
  const [records, setRecords] = useState<Record<string, Estado>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Estado de historial de asistencia ---
  const [historyDate, setHistoryDate] = useState(todayStr);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [editedStates, setEditedStates] = useState<Record<string, Estado>>({});
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const reason = blockedReason(periods, period);
  const openPeriod = periods.find(p => p.activo) ?? null;
  const periodoId = openPeriod?.id ?? null;

  const estadoDe = (studentId: string): Estado => records[studentId] || 'presente';

  // Guardar toma de asistencia habitual
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason || !periodoId) {
      setError(reason || 'No hay un periodo académico abierto.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await Promise.all(students.map(student =>
        api.createAttendance({
          estudiante_id: student.id,
          materia_id: assignment.materia_id,
          grado_id: assignment.grado_id,
          fecha: date,
          estado: estadoDe(student.id),
          periodo_id: periodoId,
          registrado_por: teacherId,
        })
      ));
      await onSaved();
      setRecords({});
      toast.success('Asistencia registrada con éxito');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar asistencia');
    } finally {
      setSaving(false);
    }
  };

  // Consultar registros históricos para una fecha seleccionada
  const handleConsultar = async () => {
    if (!historyDate) {
      setHistoryError('Por favor selecciona una fecha válida.');
      return;
    }
    if (historyDate > todayStr) {
      setHistoryError('No se puede consultar ni registrar asistencia para fechas futuras.');
      return;
    }

    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const allAtt = await api.getAttendance();
      const filtered = filterAttendanceByDateAndClass(
        allAtt,
        assignment.materia_id,
        assignment.grado_id,
        historyDate
      );

      // Mapear cada registro a su estudiante correspondiente
      const mappedRows: HistoryRow[] = [];
      const seenStudents = new Set<string>();

      for (const rec of filtered) {
        if (!rec.estudiante_id || seenStudents.has(rec.estudiante_id)) continue;
        seenStudents.add(rec.estudiante_id);

        const student = users.find(u => u.id === rec.estudiante_id)
          || students.find(s => s.id === rec.estudiante_id)
          || {
            id: rec.estudiante_id,
            nombre: 'Estudiante',
            apellido: '',
            email: '',
            rol: 'student' as const,
            activo: true,
          };

        mappedRows.push({ student, record: rec });
      }

      // Ordenamiento global estricto: apellido ASC, nombre ASC, id ASC
      mappedRows.sort((a, b) => compareStudents(a.student, b.student));

      setHistoryRows(mappedRows);
      const initialMap: Record<string, Estado> = {};
      mappedRows.forEach(r => {
        initialMap[r.record.id] = (r.record.estado as Estado) || 'presente';
      });
      setEditedStates(initialMap);
      setHasQueried(true);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Error al consultar historial de asistencia.');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Guardar cambios en el historial de asistencia
  const handleSaveHistory = async () => {
    // Filtrar únicamente los registros que cambiaron de estado
    const changedRows = historyRows.filter(row => {
      const nuevo = editedStates[row.record.id];
      return nuevo && nuevo !== row.record.estado;
    });

    if (changedRows.length === 0) {
      toast.success('Asistencia actualizada correctamente.');
      return;
    }

    setSavingHistory(true);
    setHistoryError(null);
    try {
      await Promise.all(
        changedRows.map(row =>
          api.updateAttendance(row.record.id, {
            ...row.record,
            estado: editedStates[row.record.id],
          })
        )
      );

      // Actualizar el estado local para reflejar los cambios
      setHistoryRows(prev =>
        prev.map(row => {
          const nuevo = editedStates[row.record.id];
          return nuevo ? { ...row, record: { ...row.record, estado: nuevo } } : row;
        })
      );

      await onSaved();
      toast.success('Asistencia actualizada correctamente.');
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Error al guardar los cambios en la asistencia.');
      toast.error(err instanceof Error ? err.message : 'Error al actualizar asistencia.');
    } finally {
      setSavingHistory(false);
    }
  };

  const exportTable = () => ({
    title: `Asistencia ${subject?.nombre}`,
    headers: ['Estudiante', 'Estado'],
    rows: students.map(s => [studentFullName(s), estadoDe(s.id)]),
    fileName: `asistencia_${subject?.nombre?.toLowerCase().replace(/\s+/g, '_')}`,
  });

  const exportHistoryTable = () => ({
    title: `Historial Asistencia ${subject?.nombre} - ${historyDate}`,
    headers: ['Estudiante', 'Estado'],
    rows: historyRows.map(r => [
      studentFullName(r.student),
      ESTADOS.find(e => e.value === (editedStates[r.record.id] || r.record.estado))?.label || r.record.estado,
    ]),
    fileName: `historial_asistencia_${subject?.nombre?.toLowerCase().replace(/\s+/g, '_')}_${historyDate}`,
  });

  return (
    <Card>
      {/* Encabezado con navegación entre Tomar Asistencia e Historial */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-gray-900">
              {mode === 'take' ? 'Asistencia' : 'Historial de asistencia'} - {subject?.nombre} ({grade?.nombre})
            </h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {mode === 'take'
              ? (period
                  ? <>Periodo: <span className="font-semibold text-gray-700">{periodLabel(period)}</span></>
                  : 'Selecciona un periodo en el contexto académico.')
              : 'Consulta y modifica los registros de asistencia de clases pasadas.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mode === 'take' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setMode('history');
                  setHasQueried(false);
                  setHistoryRows([]);
                  setHistoryError(null);
                }}
                className={`px-3.5 py-1.5 ${SECONDARY_BUTTON} text-xs font-semibold flex items-center gap-1.5`}
                id="btn-ver-historial-asistencia"
              >
                <History className="h-4 w-4" />
                Historial de asistencia
              </button>
              <ExportButtons build={exportTable} />
              <span className="text-xs text-gray-500 font-medium ml-1">Fecha:</span>
              <input
                type="date"
                value={date}
                max={todayStr}
                onChange={e => setDate(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg text-sm text-gray-900 px-3 py-1.5 focus:outline-none"
              />
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMode('take')}
                className={`px-3.5 py-1.5 ${SECONDARY_BUTTON} text-xs font-semibold flex items-center gap-1.5`}
                id="btn-volver-tomar-asistencia"
              >
                <ArrowLeft className="h-4 w-4" />
                Tomar asistencia
              </button>
              {historyRows.length > 0 && <ExportButtons build={exportHistoryTable} />}
            </>
          )}
        </div>
      </div>

      {/* --- MODO: TOMAR ASISTENCIA (Funcionalidad actual conservada intacta) --- */}
      {mode === 'take' && (
        <>
          {reason && (
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {reason.includes('periodo académico abierto') || reason.includes('más de un periodo')
                ? <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                : <Lock className="h-4 w-4 mt-0.5 shrink-0" />}
              <span>{reason}</span>
            </div>
          )}

          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {students.length === 0 ? (
            <EmptyMessage className="text-gray-500 text-sm py-4">No hay estudiantes matriculados.</EmptyMessage>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <TableWrapper>
                <TableHead uppercase>
                  <th className="pb-3">Estudiante</th>
                  <th className="pb-3 text-center">Presente</th>
                  <th className="pb-3 text-center">Ausente</th>
                  <th className="pb-3 text-center">Inasistencia justificada</th>
                </TableHead>
                <TableBody>
                  {students.map(student => (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="py-3.5 font-medium text-gray-900">
                        {studentFullName(student)}
                      </td>
                      {ESTADOS.map(estado => (
                        <td key={estado.value} className="py-3.5 text-center">
                          <input
                            type="radio"
                            name={`att-${student.id}`}
                            checked={estadoDe(student.id) === estado.value}
                            onChange={() => setRecords(prev => ({ ...prev, [student.id]: estado.value }))}
                            disabled={!!reason}
                            className="h-4 w-4 text-q10-600 focus:ring-q10-500 bg-white border-gray-300 disabled:opacity-40"
                            title={estado.label}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </TableBody>
              </TableWrapper>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={!!reason || saving}
                  className={`px-6 ${PRIMARY_BUTTON} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {saving ? 'Guardando...' : 'Guardar Asistencia'}
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {/* --- MODO: HISTORIAL Y EDICIÓN DE ASISTENCIA --- */}
      {mode === 'history' && (
        <div className="space-y-5">
          {/* Barra de selección de fecha histórica */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-gray-500" />
                Fecha:
              </span>
              <input
                type="date"
                value={historyDate}
                max={todayStr}
                onChange={e => {
                  setHistoryDate(e.target.value);
                  setHasQueried(false);
                }}
                className="bg-white border border-gray-300 rounded-lg text-sm text-gray-900 px-3 py-1.5 focus:ring-2 focus:ring-q10-500 focus:outline-none"
                id="input-fecha-historial"
              />
              <button
                type="button"
                onClick={handleConsultar}
                disabled={loadingHistory || !historyDate}
                className={`px-4 py-1.5 ${PRIMARY_BUTTON} text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50`}
                id="btn-consultar-historial"
              >
                <Search className="h-3.5 w-3.5" />
                {loadingHistory ? 'Consultando...' : 'Consultar'}
              </button>
            </div>
            <span className="text-xs text-gray-500">
              Selecciona una fecha y presiona Consultar para ver o editar registros.
            </span>
          </div>

          {historyError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{historyError}</span>
            </div>
          )}

          {/* Resultados de la consulta */}
          {!hasQueried ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              Selecciona una fecha y haz clic en <strong>Consultar</strong> para ver los registros de asistencia.
            </div>
          ) : historyRows.length === 0 ? (
            <EmptyMessage className="text-gray-500 text-sm py-6">
              No hay registros de asistencia para esta fecha.
            </EmptyMessage>
          ) : (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                <span>Total de estudiantes con registro: <strong className="text-gray-800">{historyRows.length}</strong></span>
                <span>Los cambios se guardan al hacer clic en <strong>Guardar cambios</strong>.</span>
              </div>

              <TableWrapper>
                <TableHead uppercase>
                  <th className="pb-3">Estudiante</th>
                  <th className="pb-3 text-right">Estado</th>
                </TableHead>
                <TableBody>
                  {historyRows.map(({ student, record }) => {
                    const currentState = editedStates[record.id] || record.estado;
                    const hasChanged = currentState !== record.estado;

                    return (
                      <tr key={record.id} className={`hover:bg-gray-50 transition-colors ${hasChanged ? 'bg-amber-50/50' : ''}`}>
                        <td className="py-3.5 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <span>{studentFullName(student)}</span>
                            {hasChanged && (
                              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">
                                Modificado
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 text-right">
                          <select
                            value={currentState}
                            onChange={e => {
                              const val = e.target.value as Estado;
                              setEditedStates(prev => ({ ...prev, [record.id]: val }));
                            }}
                            disabled={savingHistory}
                            className="bg-white border border-gray-300 rounded-lg text-sm text-gray-800 px-3 py-1.5 focus:ring-2 focus:ring-q10-500 focus:outline-none"
                            id={`select-estado-${student.id}`}
                          >
                            {ESTADOS.map(st => (
                              <option key={st.value} value={st.value}>
                                {st.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </TableBody>
              </TableWrapper>

              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <span className="text-xs text-gray-500">
                  {historyRows.filter(r => (editedStates[r.record.id] || r.record.estado) !== r.record.estado).length} estudiante(s) con cambios pendientes.
                </span>
                <button
                  type="button"
                  onClick={handleSaveHistory}
                  disabled={savingHistory}
                  className={`px-6 ${PRIMARY_BUTTON} disabled:opacity-50 disabled:cursor-not-allowed`}
                  id="btn-guardar-cambios-historial"
                >
                  {savingHistory ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
