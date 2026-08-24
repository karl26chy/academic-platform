import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, ShieldAlert } from 'lucide-react';
import { api } from '../../../services/api';
import { API_BASE, getAuthToken } from '../../../services/http';
import { useApp } from '../../../context/useApp';
import { fullName } from '../../../lib/people';
import { gradeLabel } from '../../../lib/people';
import { yearsOf } from '../../../lib/periods';
import { Modal, Field, INPUT } from '../../ui';
import type { AcademicPeriod, User } from '../../../types';

interface BoletinModalProps {
  student: User;
  onClose: () => void;
}

export const BoletinModal: React.FC<BoletinModalProps> = ({ student, onClose }) => {
  const { user, grades, studentGrades } = useApp();
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const instId = user?.institucion_id;

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
        })
        .catch(() => setError('No se pudieron cargar los períodos académicos.'));
    }
    return () => { activo = false; };
  }, [instId]);

  const years = useMemo(() => yearsOf(periods), [periods]);

  const onYearChange = (anio: number) => {
    setSelectedYear(anio);
  };

  const grade = studentGrades.find(sg => sg.estudiante_id === student.id);
  const gradeNombre = grade ? gradeLabel(grades.find(g => g.id === grade.grado_id)) : 'Sin asignar';

  const descargarPDF = async () => {
    if (selectedYear === null) return setError('Selecciona un año académico.');
    setBusy(true);
    setError(null);
    try {
      const url = `${API_BASE}/students/${encodeURIComponent(student.id)}/report/pdf?anio=${encodeURIComponent(selectedYear)}`;
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
        } catch {
          // ignore json parse error
        }
        throw new Error(msg);
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      let filename = `boletin_${selectedYear}.pdf`;
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
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} size="lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Generar Boletín</h3>
        <span className="text-xs text-gray-400">Documento anual en PDF</span>
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
      )}

      {selectedYear !== null && (
        <p className="text-sm text-gray-600 mb-5">
          ¿Estás seguro de que deseas descargar el boletín anual de{' '}
          <strong>{fullName(student)}</strong> correspondiente al año <strong>{selectedYear}</strong>?
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
          disabled={selectedYear === null || busy}
          onClick={() => descargarPDF()}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-q10-600 hover:bg-q10-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Generar PDF
        </button>
      </div>
    </Modal>
  );
};
