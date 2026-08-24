import React, { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, Loader2, ShieldAlert } from 'lucide-react';
import { api } from '../../../services/api';
import { API_BASE, getAuthToken } from '../../../services/http';
import { useApp } from '../../../context/useApp';
import { fullName } from '../../../lib/people';
import { gradeLabel } from '../../../lib/people';
import { boletinChoices, periodLabel, periodsOfYear, yearsOf } from '../../../lib/periods';
import { renderBoletinPeriodExcel } from '../../../lib/reports/renderers/period-excel';
import { renderBoletinExcel } from '../../../lib/reports/renderers/excel';
import { Modal, Field, INPUT } from '../../ui';
import type { AcademicPeriod, User } from '../../../types';

interface BoletinModalProps {
  student: User;
  onClose: () => void;
}

type Selection = { mode: 'period'; periodId: string } | { mode: 'all'; anio: number };

/** Generación de boletín por período o anual (solo Excel). El sistema PDF fue eliminado. */
export const BoletinModal: React.FC<BoletinModalProps> = ({ student, onClose }) => {
  const { user, grades, studentGrades } = useApp();
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [busy, setBusy] = useState<'pdf' | 'excel' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const instId = user?.institucion_id;

  /** Selección por defecto de un año: el período abierto, el primero, o "Todos". */
  const defaultSelection = (lista: AcademicPeriod[], año: number): Selection => {
    const delAño = periodsOfYear(lista, año);
    const abierto = delAño.find(p => p.activo && p.id);
    if (abierto?.id) return { mode: 'period', periodId: abierto.id };
    const primero = delAño[0];
    if (primero?.id) return { mode: 'period', periodId: primero.id };
    return { mode: 'all', anio: año };
  };

  useEffect(() => {
    let activo = true;
    if (instId) {
      api.getAcademicPeriods()
        .then(list => {
          if (!activo) return;
          const propios = list.filter(p => p.institucion_id === instId);
          setPeriods(propios);
          const años = yearsOf(propios);
          const inicial = años[0] ?? null;
          setSelectedYear(inicial);
          if (inicial !== null) setSelection(defaultSelection(propios, inicial));
        })
        .catch(() => setError('No se pudieron cargar los períodos académicos.'));
    }
    return () => { activo = false; };
  }, [instId]);

  const years = useMemo(() => yearsOf(periods), [periods]);

  const onYearChange = (anio: number) => {
    setSelectedYear(anio);
    setSelection(defaultSelection(periods, anio));
  };

  const choices = useMemo(
    () => (selectedYear === null ? [] : boletinChoices(periods, selectedYear)),
    [periods, selectedYear]
  );

  const selectedPeriod = useMemo(() => {
    if (!selection || selection.mode !== 'period') return null;
    return periods.find(p => p.id === selection.periodId) || null;
  }, [periods, selection]);

  const grade = studentGrades.find(sg => sg.estudiante_id === student.id);
  const gradeNombre = grade ? gradeLabel(grades.find(g => g.id === grade.grado_id)) : 'Sin asignar';

  const generar = async () => {
    if (!selection || selectedYear === null) return setError('Selecciona un período académico.');
    setBusy('excel');
    setError(null);
    try {
      if (selection.mode === 'period') {
        const data = await api.getStudentReport(student.id, selection.periodId);
        renderBoletinPeriodExcel(data);
      } else {
        const data = await api.getStudentYearReport(student.id, selection.anio);
        renderBoletinExcel(data, data.institution.reportConfig ?? null);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el boletín.');
    } finally {
      setBusy(null);
    }
  };

  const descargarPDF = async () => {
    if (!selection) return setError('Selecciona un período académico para el PDF.');
    const anio = selection.mode === 'all' ? selection.anio : selectedYear || new Date().getFullYear();
    if (!anio) return setError('Selecciona un año para el PDF.');
    setBusy('pdf');
    setError(null);
    try {
      const url = `${API_BASE}/students/${encodeURIComponent(student.id)}/report/pdf?anio=${encodeURIComponent(anio)}`;
      const token = getAuthToken();
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { Authorization: token ? `Bearer ${token}` : '' },
          cache: 'no-store',
        });
      } catch {
        throw new Error('No se pudo conectar con el servidor API.');
      }
      if (!response.ok) {
        let msg = `API error: ${response.status}`;
        try {
          const data = await response.json();
          if (data?.error) msg = String(data.error);
        } catch {}
        throw new Error(msg);
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      let filename = `boletin_${anio}.pdf`;
      if (disposition) {
        const m = /filename\*=(?:UTF-8''|")([^";]+)"/i.exec(disposition) || /filename=([^;]+)/i.exec(disposition);
        if (m) filename = m[1].replace(/^"|"$/g, '');
      }
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el PDF.');
    } finally {
      setBusy(null);
    }
  };

  const resumen = (() => {
    if (!selection) return null;
    if (selection.mode === 'all') return `Todos los períodos — ${selection.anio}`;
    return selectedPeriod ? periodLabel(selectedPeriod) : null;
  })();

  return (
    <Modal onClose={onClose} size="lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Generar Boletín</h3>
        <span className="text-xs text-gray-400">Documento individual por período o anual</span>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 mb-5">
        <p className="text-sm text-gray-500">
          Estudiante: <span className="font-bold text-gray-900">{fullName(student)}</span>
        </p>
        <p className="text-sm text-gray-500">
          Identificación: <span className="font-medium text-gray-700">{student.identificacion || 'N/R'}</span>
        </p>
        <p className="text-sm text-gray-500">
          Grado: <span className="font-medium text-gray-700">{gradeNombre}</span>
        </p>
      </div>

      {years.length === 0 ? (
        <p className="text-sm text-amber-600">
          Esta institución aún no tiene períodos académicos definidos. Crea períodos en la sección Periodos.
        </p>
      ) : (
        <>
          <Field label="Año académico" className="mb-5">
            <select
              value={selectedYear ?? ''}
              onChange={e => onYearChange(Number(e.target.value))}
              className={INPUT}
            >
              {years.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </Field>

          <Field label="Boletín" className="mb-5">
            <select
              value={
                selection?.mode === 'period'
                  ? `period:${selection.periodId}`
                  : selection?.mode === 'all'
                    ? `all:${selection.anio}`
                    : ''
              }
              onChange={e => {
                const [mode, id] = e.target.value.split(':');
                if (mode === 'period') {
                  setSelection({ mode: 'period', periodId: id });
                } else if (mode === 'all') {
                  setSelection({ mode: 'all', anio: Number(id) });
                }
              }}
              className={INPUT}
            >
              {choices.map((c, i) => (
                <option key={c.type === 'period' ? `p-${c.periodId}` : `a-${i}`} value={c.type === 'period' ? `period:${c.periodId}` : `all:${selectedYear}`}>
                  {c.label}{c.type === 'period' && selectedPeriod?.activo ? ' (activo)' : ''}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}

      {resumen && (
        <p className="text-sm text-gray-600 mb-5">
          ¿Estás seguro de que deseas descargar el boletín de{' '}
          <strong>{fullName(student)}</strong> correspondiente al <strong>{resumen}</strong>?
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-5">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm w-full sm:w-auto"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!selection || busy !== null}
          onClick={() => descargarPDF()}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-q10-600 hover:bg-q10-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
        >
          {busy === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Descargar PDF
        </button>
        <button
          type="button"
          disabled={!selection || busy !== null}
          onClick={() => generar()}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
        >
          {busy === 'excel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
          Descargar Excel
        </button>
      </div>
    </Modal>
  );
};
