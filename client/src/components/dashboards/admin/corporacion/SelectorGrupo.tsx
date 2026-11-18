import React, { useState } from 'react';
import { Field, INPUT } from '../../../ui';
import { JORNADAS, TIPOS_PROGRAMA, ordenarGrupos } from '../../../../lib/corporacion';
import type { Grade, Program, TipoPrograma } from '../../../../types';

interface Props {
  grupos: Grade[];
  programs: Program[];
  value: string;
  onChange: (gradeId: string) => void;
}

/**
 * Elegir un grupo existente filtrando tipo → programa → jornada → nivel.
 * Nada se escribe a mano: solo se escoge de lo que ya existe.
 */
export const SelectorGrupo: React.FC<Props> = ({ grupos, programs, value, onChange }) => {
  const [tipo, setTipo] = useState<TipoPrograma | ''>('');
  const [programaId, setProgramaId] = useState('');
  const [jornada, setJornada] = useState('');
  const [nivel, setNivel] = useState('');

  const tipoDe = (g: Grade) => programs.find(p => p.id === g.programa_id)?.tipo;
  const coinciden = ordenarGrupos(grupos.filter(g =>
    (!tipo || tipoDe(g) === tipo) &&
    (!programaId || g.programa_id === programaId) &&
    (!jornada || g.jornada === jornada) &&
    (!nivel || String(g.nivel) === nivel)));

  // Solo programas que ya tienen grupos: no tiene sentido filtrar por uno vacío.
  const programasVisibles = programs.filter(p =>
    (!tipo || p.tipo === tipo) && grupos.some(g => g.programa_id === p.id));
  const niveles = [...new Set(grupos
    .filter(g => (!programaId || g.programa_id === programaId) && g.nivel)
    .map(g => Number(g.nivel)))].sort((a, b) => a - b);
  const esCorto = programs.find(p => p.id === programaId)?.tipo === 'curso_corto' || tipo === 'curso_corto';

  /** Cambiar un filtro limpia el grupo elegido si ya no coincide. */
  const filtrar = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    set(e.target.value);
    onChange('');
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo">
          <select value={tipo} onChange={filtrar(v => { setTipo(v as TipoPrograma | ''); setProgramaId(''); setNivel(''); })} className={INPUT}>
            <option value="">Todos</option>
            {Object.entries(TIPOS_PROGRAMA).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Programa">
          <select value={programaId} onChange={filtrar(v => { setProgramaId(v); setNivel(''); })} className={INPUT}>
            <option value="">Todos</option>
            {programasVisibles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Field>
        <Field label="Jornada">
          <select value={jornada} onChange={filtrar(setJornada)} className={INPUT}>
            <option value="">Todas</option>
            {Object.entries(JORNADAS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        {!esCorto && (
          <Field label="Semestre">
            <select value={nivel} onChange={filtrar(setNivel)} className={INPUT}>
              <option value="">Todos</option>
              {niveles.map(n => <option key={n} value={n}>Semestre {n}</option>)}
            </select>
          </Field>
        )}
      </div>
      <Field label={`Grupo (${coinciden.length})`}>
        <select required value={value} onChange={e => onChange(e.target.value)} className={INPUT}>
          <option value="">-- Seleccionar --</option>
          {coinciden.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
        </select>
      </Field>
    </div>
  );
};
