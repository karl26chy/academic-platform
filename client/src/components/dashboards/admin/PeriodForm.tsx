import React, { useState } from 'react';
import { Field, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../ui';
import type { AcademicPeriod } from '../../../types';
import type { PeriodFormData } from './useAcademicPeriods';

const ANIO_ACTUAL = new Date().getFullYear();

/** El año escolar tiene 4 periodos: el número define su columna en el boletín. */
const NUMEROS_PERIODO = [1, 2, 3, 4];

/** Corporaciones: el año tiene dos semestres, "2027-1" y "2027-2". */
const NUMEROS_SEMESTRE = [1, 2];

interface PeriodFormProps {
  /** Si se pasa, el formulario trabaja en modo edición con esos valores. */
  initial?: AcademicPeriod | null;
  submitLabel: string;
  onSubmit: (data: PeriodFormData) => void;
  onCancel?: () => void;
  busy?: boolean;
  /** Corporación: semestres 1 y 2 en lugar de periodos 1 a 4. */
  semestre?: boolean;
}

/**
 * Formulario de periodo académico. El periodo se identifica solo por número
 * y año; el nombre se guarda siempre como "Periodo N". La regla de "abrir
 * cierra los demás" la impone el backend: aquí solo se decide si el periodo
 * nace/queda abierto.
 */
export const PeriodForm: React.FC<PeriodFormProps> = ({
  initial = null,
  submitLabel,
  onSubmit,
  onCancel,
  busy = false,
  semestre = false,
}) => {
  const [numero, setNumero] = useState(initial ? String(initial.numero) : '');
  const [anio, setAnio] = useState(initial ? String(initial.anio) : String(ANIO_ACTUAL));
  const [fechaInicio, setFechaInicio] = useState(initial?.fecha_inicio || '');
  const [fechaFin, setFechaFin] = useState(initial?.fecha_fin || '');
  const [activo, setActivo] = useState(initial?.activo ?? false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Un periodo antiguo con número fuera de 1–4 sigue apareciendo al editarlo.
  const numeros = semestre ? NUMEROS_SEMESTRE : NUMEROS_PERIODO;
  const opcionesNumero = initial && !numeros.includes(Number(initial.numero))
    ? [...numeros, Number(initial.numero)]
    : numeros;
  const palabra = semestre ? 'semestre' : 'periodo';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(numero);
    if (!numero || !Number.isInteger(num) || num <= 0) return setLocalError(`Selecciona el número del ${palabra}.`);
    const year = Number(anio);
    if (!anio || Number.isNaN(year)) return setLocalError('El año debe ser un número.');
    if (!fechaInicio) return setLocalError('La fecha de inicio es obligatoria.');
    if (!fechaFin) return setLocalError('La fecha de fin es obligatoria.');
    setLocalError(null);
    onSubmit({
      // La API arma el nombre del semestre ("2027-1"); se envía igual por claridad.
      nombre: semestre ? `${year}-${num}` : `Periodo ${num}`,
      numero: num,
      anio: year,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      activo,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label={semestre ? 'Semestre' : 'Periodo'}>
          <select
            required value={numero}
            onChange={e => setNumero(e.target.value)}
            className={INPUT}
          >
            <option value="" disabled>Selecciona…</option>
            {opcionesNumero.map(n => (
              <option key={n} value={n}>{semestre ? `Semestre ${anio || '____'}-${n}` : `Periodo ${n}`}</option>
            ))}
          </select>
        </Field>
        <Field label="Año">
          <input
            type="number" min="2000" required value={anio}
            onChange={e => setAnio(e.target.value)}
            className={INPUT}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Fecha de inicio">
          <input
            type="date" required value={fechaInicio}
            onChange={e => setFechaInicio(e.target.value)}
            className={INPUT}
          />
        </Field>
        <Field label="Fecha de fin">
          <input
            type="date" required value={fechaFin}
            onChange={e => setFechaFin(e.target.value)}
            className={INPUT}
          />
        </Field>
      </div>

      <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
        <input
          type="checkbox" checked={activo}
          onChange={e => setActivo(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="font-semibold text-gray-900">{semestre ? 'Abrir semestre' : 'Abrir periodo'}</span>
          <span className="block text-xs text-gray-500">
            {activo
              ? `Al guardar, este ${palabra} quedará abierto y cualquier otro ${palabra} abierto de la institución se cerrará.`
              : `Si no lo marcas, el ${palabra} se guarda cerrado.`}
          </span>
        </span>
      </label>

      {localError && <p className="text-sm text-red-500">{localError}</p>}

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={busy} className={`flex-1 ${PRIMARY_BUTTON} disabled:opacity-60`}>
          {busy ? 'Guardando...' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={SECONDARY_BUTTON}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
};
