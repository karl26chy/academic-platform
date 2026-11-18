import React, { useMemo, useState } from 'react';
import { Plus, Trash2, UsersRound } from 'lucide-react';
import { api } from '../../../../services/api';
import { Card, CardTitle, EmptyMessage, Field, INPUT, PRIMARY_BUTTON, toast } from '../../../ui';
import { ConfirmDeleteModal } from '../../super-admin/ConfirmDeleteModal';
import { useApp } from '../../../../context/useApp';
import { JORNADAS, NIVEL_MAXIMO, TIPOS_PROGRAMA, nombreGrupo, ordenarGrupos } from '../../../../lib/corporacion';
import { usePrograms } from './usePrograms';
import type { Grade, Jornada, TipoPrograma } from '../../../../types';

const SEMESTRES = Array.from({ length: NIVEL_MAXIMO }, (_, i) => i + 1);

/**
 * Grupos de la corporación: programa + jornada + semestre. El mismo programa en
 * dos jornadas son grupos distintos; los cursos cortos no tienen semestre. El
 * nombre lo arma la plataforma, nadie lo escribe a mano.
 */
export const GruposTab: React.FC = () => {
  const { user, grades, studentGrades, refreshData } = useApp();
  const instId = user?.institucion_id ?? '';
  const { programs } = usePrograms();

  const [programaId, setProgramaId] = useState('');
  const [jornada, setJornada] = useState<Jornada>('manana');
  const [nivel, setNivel] = useState('1');
  const [filtro, setFiltro] = useState('');
  const [deleting, setDeleting] = useState<Grade | null>(null);

  const programa = programs.find(p => p.id === programaId);
  const misGrupos = useMemo(
    () => ordenarGrupos(grades.filter(g => g.institucion_id === instId && g.programa_id)),
    [grades, instId],
  );
  const visibles = filtro ? misGrupos.filter(g => g.programa_id === filtro) : misGrupos;
  const activosPorTipo = (t: TipoPrograma) => programs.filter(p => p.tipo === t && p.activo);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programa) return;
    try {
      await api.createGrade({
        institucion_id: instId,
        programa_id: programa.id,
        jornada,
        nivel: programa.tipo === 'tecnico' ? Number(nivel) : null,
      });
      toast.success('Grupo creado.');
      await refreshData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear el grupo.');
    }
  };

  const eliminar = async () => {
    if (!deleting) return;
    try {
      await api.deleteGrade(deleting.id);
      toast.success('Grupo eliminado.');
      await refreshData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar el grupo.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
      <Card className="h-fit">
        <CardTitle icon={<Plus className="h-5 w-5 text-q10-600" />} className="mb-6">Crear grupo</CardTitle>
        {programs.length === 0 ? (
          <p className="text-sm text-gray-500">Primero agrega los programas en la pestaña Programas.</p>
        ) : (
          <form onSubmit={crear} className="space-y-4">
            <Field label="Programa">
              <select required value={programaId} onChange={e => setProgramaId(e.target.value)} className={INPUT}>
                <option value="">-- Seleccionar --</option>
                {(['tecnico', 'curso_corto'] as TipoPrograma[]).map(t => (
                  <optgroup key={t} label={TIPOS_PROGRAMA[t]}>
                    {activosPorTipo(t).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label="Jornada">
              <select value={jornada} onChange={e => setJornada(e.target.value as Jornada)} className={INPUT}>
                {Object.entries(JORNADAS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            {programa?.tipo === 'tecnico' && (
              <Field label="Semestre">
                <select value={nivel} onChange={e => setNivel(e.target.value)} className={INPUT}>
                  {SEMESTRES.map(n => <option key={n} value={n}>Semestre {n}</option>)}
                </select>
              </Field>
            )}
            {programa && (
              <p className="text-xs text-gray-500">
                Se llamará: <strong className="text-gray-800">
                  {nombreGrupo(programa, jornada, programa.tipo === 'tecnico' ? Number(nivel) : null)}
                </strong>
              </p>
            )}
            <button type="submit" className={`w-full ${PRIMARY_BUTTON}`}>Guardar grupo</button>
          </form>
        )}
      </Card>

      <Card className="lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <CardTitle icon={<UsersRound className="h-5 w-5 text-q10-600" />} className="">Grupos</CardTitle>
          <select value={filtro} onChange={e => setFiltro(e.target.value)} className={`${INPUT} sm:w-64`}>
            <option value="">Todos los programas</option>
            {programs.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        {visibles.length === 0 ? (
          <EmptyMessage className="text-sm text-gray-500 py-8">Aún no hay grupos.</EmptyMessage>
        ) : (
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {visibles.map(g => {
              const n = studentGrades.filter(sg => sg.grado_id === g.id).length;
              return (
                <div key={g.id} className="flex flex-wrap justify-between items-center gap-2 p-3 bg-white rounded-xl border border-gray-200">
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-gray-900 block truncate">{g.nombre}</span>
                    <span className="text-xs text-gray-400">{n === 1 ? '1 estudiante' : `${n} estudiantes`}</span>
                  </div>
                  <button
                    onClick={() => setDeleting(g)} title="Eliminar grupo"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {deleting && (
        <ConfirmDeleteModal
          title="Eliminar grupo"
          message={<>¿Eliminar el grupo <strong>{deleting.nombre}</strong>? Si tiene estudiantes o notas, no se podrá.</>}
          onCancel={() => setDeleting(null)}
          onConfirm={eliminar}
        />
      )}
    </div>
  );
};
