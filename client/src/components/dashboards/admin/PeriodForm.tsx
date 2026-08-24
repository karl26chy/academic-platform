import React, { useState } from 'react';
import { Field, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../ui';
import type { AcademicPeriod } from '../../../types';
import type { PeriodFormData } from './useAcademicPeriods';

const ANIO_ACTUAL = new Date().getFullYear();

interface PeriodFormProps {
  /** Si se pasa, el formulario trabaja en modo edición con esos valores. */
  initial?: AcademicPeriod | null;
  submitLabel: string;
  onSubmit: (data: PeriodFormData) => void;
  onCancel?: () => void;
  busy?: boolean;
}

/**
 * Formulario de periodo académico. La regla de "abrir cierra los demás" la
 * impone el backend: aquí solo se decide si el periodo nace/queda abierto.
 */
export const PeriodForm: React.FC<PeriodFormProps> = ({
  initial = null,
  submitLabel,
  onSubmit,
  onCancel,
  busy = false,
}) => {
  const [nombre, setNombre] = useState(initial?.nombre || '');
  const [numero, setNumero] = useState(initial ? String(initial.numero) : '');
  const [anio, setAnio] = useState(initial ? String(initial.anio) : String(ANIO_ACTUAL));
  const [fechaInicio, setFechaInicio] = useState(initial?.fecha_inicio || '');
  const [fechaFin, setFechaFin] = useState(initial?.fecha_fin || '');
  const [activo, setActivo] = useState(initial?.activo ?? false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return setLocalError('El nombre es obligatorio.');
    const num = Number(numero);
    if (!numero || Number.isNaN(num) || num <= 0) return setLocalError('El número debe ser un entero positivo.');
    const year = Number(anio);
    if (!anio || Number.isNaN(year)) return setLocalError('El año debe ser un número.');
    if (!fechaInicio) return setLocalError('La fecha de inicio es obligatoria.');
    if (!fechaFin) return setLocalError('La fecha de fin es obligatoria.');
    setLocalError(null);
    onSubmit({
      nombre: nombre.trim(),
      numero: num,
      anio: year,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      activo,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Nombre del periodo">
        <input
          type="text" required value={nombre}
          onChange={e => setNombre(e.target.value)}
          className={INPUT} placeholder="Ej: Primer periodo"
        />
      </Field>
      <p className="-mt-2 text-[11px] text-gray-400">
        Solo el nombre descriptivo. El número del periodo va en el campo «Número».
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Número">
          <input
            type="number" min="1" required value={numero}
            onChange={e => setNumero(e.target.value)}
            className={INPUT}
          />
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
          <span className="font-semibold text-gray-900">Abrir periodo</span>
          <span className="block text-xs text-gray-500">
            {activo
              ? 'Al guardar, este periodo quedará abierto y cualquier otro periodo abierto de la institución se cerrará.'
              : 'Si no lo marcas, el periodo se guarda cerrado.'}
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
