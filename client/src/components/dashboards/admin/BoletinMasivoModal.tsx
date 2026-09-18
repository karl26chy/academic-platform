import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, CheckCircle2, ChevronRight, Loader2, ShieldAlert, XCircle } from 'lucide-react';
import { API_BASE, getAuthToken } from '../../../services/http';
import { useApp } from '../../../context/useApp';
import { api } from '../../../services/api';
import { gradeLabel } from '../../../lib/people';
import { yearsOf } from '../../../lib/periods';
import { Modal, Field, INPUT } from '../../ui';
import type { AcademicPeriod, Grade } from '../../../types';

interface BoletinMasivoModalProps {
  grades: Grade[];
  onClose: () => void;
}

type Step = 'select' | 'generating' | 'done' | 'error';

interface BulkResult {
  ok: boolean;
  zipBlob?: Blob;
  zipName?: string;
  errorMsg?: string;
}

/**
 * Modal de generación masiva de boletines por grado.
 *
 * Flujo:
 *   1. select     → el usuario elige grado y año
 *   2. generating → muestra progreso (el proceso es opaco: el ZIP llega completo)
 *   3. done       → descarga automática del ZIP + mensaje de éxito
 *   4. error      → mensaje claro + opción de reintentar
 *
 * La generación ocurre completamente en el backend (streaming ZIP).
 * El frontend dispara una petición fetch GET y espera el blob.
 */
export const BoletinMasivoModal: React.FC<BoletinMasivoModalProps> = ({ grades, onClose }) => {
  const { user } = useApp();

  const [step, setStep] = useState<Step>('select');
  const [periods, setPeriods] = useState<AcademicPeriod[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number | ''>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);

  const instId = user?.institucion_id;

  // Cargar períodos para obtener los años disponibles.
  useEffect(() => {
    let active = true;
    if (instId) {
      api.getAcademicPeriods()
        .then(list => {
          if (!active) return;
          const propios = list.filter(p => p.institucion_id === instId);
          setPeriods(propios);
          const años = yearsOf(propios);
          if (años.length > 0) setSelectedYear(años[0]);
        })
        .catch(() => {
          // Si falla, el selector de año mostrará "sin períodos definidos"
        });
    }
    return () => { active = false; };
  }, [instId]);

  // Inicializar grado con el primer grado disponible.
  useEffect(() => {
    if (grades.length > 0 && !selectedGradeId) {
      setSelectedGradeId(grades[0].id);
    }
  }, [grades, selectedGradeId]);

  const years = useMemo(() => yearsOf(periods), [periods]);

  const selectedGrade = useMemo(
    () => grades.find(g => g.id === selectedGradeId) ?? null,
    [grades, selectedGradeId]
  );

  const isGenerating = step === 'generating';

  /** Construye el nombre del ZIP a partir del grado y año seleccionados. */
  const buildZipName = useCallback((grade: Grade | null, year: number | '') => {
    if (!grade || year === '') return 'Boletines.zip';
    const slug = `${grade.nombre}_${grade.tipo_grado}`
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '');
    return `Boletines_${slug}_${year}.zip`;
  }, []);

  const handleContinue = async () => {
    setValidationError(null);

    if (!selectedGradeId) {
      setValidationError('Selecciona un grado.');
      return;
    }
    if (selectedYear === '') {
      setValidationError('Selecciona un año académico.');
      return;
    }
    if (isGenerating) return; // Protección contra doble clic

    setStep('generating');

    try {
      const url = `${API_BASE}/grades/${encodeURIComponent(selectedGradeId)}/bulk-report/pdf?anio=${encodeURIComponent(String(selectedYear))}`;
      const token = getAuthToken();

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'GET',
          headers: { Authorization: token ? `Bearer ${token}` : '' },
          cache: 'no-store',
        });
      } catch {
        throw new Error('No se pudo conectar con el servidor. Verifica tu conexión.');
      }

      if (!response.ok) {
        let msg = `Error del servidor: ${response.status}`;
        try {
          const data = await response.json();
          if (data?.error) msg = String(data.error);
        } catch {
          // ignorar error de parsing JSON
        }
        throw new Error(msg);
      }

      const blob = await response.blob();
      const zipName = buildZipName(selectedGrade, selectedYear);

      // Descarga automática del ZIP.
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = zipName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 2000);

      setResult({ ok: true, zipBlob: blob, zipName });
      setStep('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
      setResult({ ok: false, errorMsg: msg });
      setStep('error');
    }
  };

  const handleRetry = () => {
    setResult(null);
    setStep('select');
  };

  // --- Pasos del modal ---

  const renderSelect = () => (
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-q10-100 flex items-center justify-center shrink-0">
          <Archive className="h-5 w-5 text-q10-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Generar boletines</h3>
          <p className="text-xs text-gray-400">Descarga todos los boletines de un grado en un solo archivo ZIP</p>
        </div>
      </div>

      <p className="text-sm text-gray-600 mb-5">
        Selecciona el grado y el período académico para continuar.
      </p>

      {grades.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 mb-5">
          No hay grados registrados en tu institución.
        </div>
      ) : (
        <div className="space-y-4 mb-5">
          <Field label="Grado">
            <select
              id="boletin-masivo-grado"
              value={selectedGradeId}
              onChange={e => setSelectedGradeId(e.target.value)}
              className={INPUT}
              disabled={isGenerating}
            >
              <option value="">-- Selecciona un grado --</option>
              {grades.map(g => (
                <option key={g.id} value={g.id}>{gradeLabel(g)}</option>
              ))}
            </select>
          </Field>

          <Field label="Año académico">
            {years.length === 0 ? (
              <p className="text-sm text-amber-600">
                No hay períodos académicos definidos. Crea períodos en la sección Períodos.
              </p>
            ) : (
              <select
                id="boletin-masivo-anio"
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className={INPUT}
                disabled={isGenerating}
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
          </Field>
        </div>
      )}

      {validationError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-5">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500 mb-5 leading-relaxed">
        <strong>Nota:</strong> Una vez iniciada la generación no puede cancelarse. El archivo ZIP
        se descargará automáticamente cuando todos los boletines estén listos.
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm w-full sm:w-auto"
        >
          Cancelar
        </button>
        <button
          id="boletin-masivo-continuar"
          type="button"
          disabled={!selectedGradeId || selectedYear === '' || years.length === 0}
          onClick={handleContinue}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-q10-600 hover:bg-q10-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
        >
          Continuar
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </>
  );

  const renderGenerating = () => (
    <div className="flex flex-col items-center py-8 px-4 text-center">
      <div className="relative mb-6">
        <div className="h-16 w-16 rounded-full bg-q10-100 flex items-center justify-center">
          <Archive className="h-8 w-8 text-q10-600" />
        </div>
        <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-sm">
          <Loader2 className="h-4 w-4 text-q10-500 animate-spin" />
        </div>
      </div>

      <h3 className="text-lg font-bold text-gray-900 mb-2">Generando boletines...</h3>

      <p className="text-sm text-gray-500 mb-5">
        Preparando los boletines del grado{' '}
        <span className="font-semibold text-gray-700">{gradeLabel(selectedGrade)}</span>{' '}
        — año <span className="font-semibold text-gray-700">{selectedYear}</span>.
      </p>

      {/* Barra de progreso indeterminada */}
      <div className="w-full max-w-xs h-1.5 bg-gray-200 rounded-full overflow-hidden mb-5">
        <div
          className="h-full bg-q10-500 rounded-full"
          style={{ animation: 'boletinSlide 1.6s ease-in-out infinite' }}
        />
      </div>

      <p className="text-xs text-gray-400 max-w-xs">
        Por favor espera. Este proceso puede tardar varios minutos para grados con
        muchos estudiantes. No cierres esta ventana.
      </p>

      <style>{`
        @keyframes boletinSlide {
          0%   { width: 0%;   margin-left: 0; }
          50%  { width: 55%;  margin-left: 22%; }
          100% { width: 0%;   margin-left: 100%; }
        }
      `}</style>
    </div>
  );

  const renderDone = () => (
    <div className="flex flex-col items-center py-8 px-4 text-center">
      <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-5">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
      </div>

      <h3 className="text-lg font-bold text-gray-900 mb-2">¡Boletines generados!</h3>

      <p className="text-sm text-gray-600 mb-2">
        El archivo <span className="font-semibold text-gray-800">{result?.zipName}</span> se
        ha descargado automáticamente.
      </p>

      <p className="text-xs text-gray-400 mb-6">
        Si la descarga no comenzó, verifica que tu navegador no la haya bloqueado.
      </p>

      <button
        type="button"
        onClick={onClose}
        className="px-6 py-2.5 rounded-xl bg-q10-600 hover:bg-q10-700 text-white font-semibold text-sm transition-colors"
      >
        Cerrar
      </button>
    </div>
  );

  const renderError = () => (
    <div className="flex flex-col items-center py-8 px-4 text-center">
      <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-5">
        <XCircle className="h-8 w-8 text-red-500" />
      </div>

      <h3 className="text-lg font-bold text-gray-900 mb-3">No se pudieron generar los boletines</h3>

      <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6 text-left w-full max-w-sm">
        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{result?.errorMsg ?? 'Error desconocido.'}</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm"
        >
          Cerrar
        </button>
        <button
          id="boletin-masivo-reintentar"
          type="button"
          onClick={handleRetry}
          className="px-4 py-2.5 rounded-xl bg-q10-600 hover:bg-q10-700 text-white font-semibold text-sm transition-colors"
        >
          Reintentar
        </button>
      </div>
    </div>
  );

  return (
    // Durante la generación, el modal no puede cerrarse al hacer clic en el fondo.
    <Modal onClose={isGenerating ? () => {} : onClose} size="lg">
      {step === 'select'     && renderSelect()}
      {step === 'generating' && renderGenerating()}
      {step === 'done'       && renderDone()}
      {step === 'error'      && renderError()}
    </Modal>
  );
};
