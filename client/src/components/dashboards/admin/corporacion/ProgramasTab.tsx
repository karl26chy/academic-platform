import React, { useMemo, useState } from 'react';
import { ClipboardPaste, Edit3, Layers, Plus, Power, Trash2 } from 'lucide-react';
import { programs as programsApi } from '../../../../services/api';
import { Badge, Card, CardTitle, EmptyMessage, Field, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON, Modal, toast } from '../../../ui';
import { ConfirmDeleteModal } from '../../super-admin/ConfirmDeleteModal';
import { useApp } from '../../../../context/useApp';
import { TIPOS_PROGRAMA, leerListaPegada } from '../../../../lib/corporacion';
import { usePrograms } from './usePrograms';
import type { Program, TipoPrograma } from '../../../../types';

const mensaje = (err: unknown, otro: string) => (err instanceof Error ? err.message : otro);

/**
 * Catálogo de programas técnicos y cursos cortos de la corporación. Es la
 * única fuente de nombres: grupos y matrículas se eligen de aquí, así no hay
 * duplicados escritos a mano.
 */
export const ProgramasTab: React.FC = () => {
  const { user, grades, refreshData } = useApp();
  const instId = user?.institucion_id ?? '';
  const { programs, loading, reload } = usePrograms();

  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoPrograma>('tecnico');
  const [pegarTipo, setPegarTipo] = useState<TipoPrograma>('tecnico');
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [nombreEdit, setNombreEdit] = useState('');
  const [deleting, setDeleting] = useState<Program | null>(null);

  const vistaPrevia = useMemo(() => leerListaPegada(texto, programs.map(p => p.nombre)), [texto, programs]);
  const nuevos = vistaPrevia.filter(l => !l.repetido);
  const gruposDe = (id: string) => grades.filter(g => g.programa_id === id).length;

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    try {
      await programsApi.create({ institucion_id: instId, nombre: nombre.trim(), tipo });
      setNombre('');
      toast.success('Programa creado.');
      await reload();
    } catch (err) {
      toast.error(mensaje(err, 'Error al crear el programa.'));
    }
  };

  const guardarLista = async () => {
    setGuardando(true);
    let creados = 0;
    const fallos: string[] = [];
    for (const linea of nuevos) {
      try {
        await programsApi.create({ institucion_id: instId, nombre: linea.nombre, tipo: pegarTipo });
        creados++;
      } catch (err) {
        fallos.push(`${linea.nombre}: ${mensaje(err, 'error')}`);
      }
    }
    setGuardando(false);
    await reload();
    if (creados) toast.success(creados === 1 ? '1 programa agregado.' : `${creados} programas agregados.`);
    if (fallos.length) toast.error(`No se agregaron: ${fallos.join('; ')}`);
    else setTexto('');
  };

  const renombrar = async () => {
    if (!editing || !nombreEdit.trim()) return;
    try {
      await programsApi.update(editing.id, { nombre: nombreEdit.trim() });
      setEditing(null);
      toast.success('Programa actualizado. Sus grupos tomaron el nombre nuevo.');
      await Promise.all([reload(), refreshData()]);
    } catch (err) {
      toast.error(mensaje(err, 'Error al actualizar el programa.'));
    }
  };

  const alternarActivo = async (p: Program) => {
    try {
      await programsApi.update(p.id, { activo: !p.activo });
      toast.success(p.activo ? 'Programa desactivado.' : 'Programa activado.');
      await reload();
    } catch (err) {
      toast.error(mensaje(err, 'Error al cambiar el estado.'));
    }
  };

  const eliminar = async () => {
    if (!deleting) return;
    try {
      await programsApi.remove(deleting.id);
      toast.success('Programa eliminado.');
      await reload();
    } catch (err) {
      toast.error(mensaje(err, 'Error al eliminar el programa.'));
    } finally {
      setDeleting(null);
    }
  };

  const seccion = (t: TipoPrograma, titulo: string) => {
    const lista = programs.filter(p => p.tipo === t);
    return (
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          {titulo} ({lista.length})
        </h4>
        {lista.length === 0 ? (
          <EmptyMessage className="text-sm text-gray-500 py-3">Ninguno todavía.</EmptyMessage>
        ) : (
          <div className="space-y-2">
            {lista.map(p => {
              const n = gruposDe(p.id);
              return (
                <div key={p.id} className="flex flex-wrap justify-between items-center gap-2 p-3 bg-white rounded-xl border border-gray-200">
                  <div className="min-w-0">
                    <span className={`text-sm font-semibold block truncate ${p.activo ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                      {p.nombre}
                    </span>
                    <span className="text-xs text-gray-400">
                      {n === 1 ? '1 grupo' : `${n} grupos`}{!p.activo && ' · inactivo'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => { setEditing(p); setNombreEdit(p.nombre); }} title="Cambiar nombre"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => alternarActivo(p)} title={p.activo ? 'Desactivar' : 'Activar'}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-q10-600 hover:bg-q10-50 transition-colors"
                    >
                      <Power className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleting(p)} title="Eliminar programa"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
      <div className="space-y-8">
        <Card className="h-fit">
          <CardTitle icon={<Plus className="h-5 w-5 text-q10-600" />} className="mb-6">Agregar programa</CardTitle>
          <form onSubmit={crear} className="space-y-4">
            <Field label="Nombre">
              <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Auxiliar en Farmacia" className={INPUT} />
            </Field>
            <Field label="Tipo">
              <select value={tipo} onChange={e => setTipo(e.target.value as TipoPrograma)} className={INPUT}>
                {Object.entries(TIPOS_PROGRAMA).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <button type="submit" className={`w-full ${PRIMARY_BUTTON}`}>Guardar programa</button>
          </form>
        </Card>

        <Card className="h-fit">
          <CardTitle icon={<ClipboardPaste className="h-5 w-5 text-q10-600" />} className="mb-2">Pegar lista</CardTitle>
          <p className="text-xs text-gray-500 mb-4">
            Uno por línea. La numeración ("1.", "2.") se quita sola y los repetidos se saltan.
          </p>
          <div className="space-y-4">
            <Field label="Tipo de todos">
              <select value={pegarTipo} onChange={e => setPegarTipo(e.target.value as TipoPrograma)} className={INPUT}>
                {Object.entries(TIPOS_PROGRAMA).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <textarea
              value={texto} onChange={e => setTexto(e.target.value)} rows={7}
              placeholder={'1. Auxiliar Administrativo\n2. Recursos Humanos\n3. Belleza'}
              className={`${INPUT} font-mono text-xs`}
            />
            {vistaPrevia.length > 0 && (
              <div className="rounded-xl border border-gray-200 p-3 space-y-1 max-h-48 overflow-y-auto">
                {vistaPrevia.map((l, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-xs">
                    <span className={l.repetido ? 'text-gray-400 line-through' : 'text-gray-800'}>{l.nombre}</span>
                    {l.repetido ? <Badge className="bg-gray-100 text-gray-500">repetido</Badge> : <Badge className="bg-emerald-100 text-emerald-600">nuevo</Badge>}
                  </div>
                ))}
              </div>
            )}
            <button
              type="button" disabled={guardando || nuevos.length === 0} onClick={guardarLista}
              className={`w-full ${PRIMARY_BUTTON} disabled:opacity-50`}
            >
              {guardando ? 'Guardando…' : nuevos.length ? `Agregar ${nuevos.length} programa(s)` : 'Agregar'}
            </button>
          </div>
        </Card>
      </div>

      <Card className="lg:col-span-2">
        <CardTitle icon={<Layers className="h-5 w-5 text-q10-600" />} className="mb-6">Programas</CardTitle>
        {loading ? (
          <p className="text-sm text-gray-500 py-6">Cargando programas…</p>
        ) : (
          <div className="space-y-6">
            {seccion('tecnico', 'Programas técnicos')}
            {seccion('curso_corto', 'Cursos cortos')}
          </div>
        )}
      </Card>

      {editing && (
        <Modal onClose={() => setEditing(null)} size="sm">
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Cambiar nombre del programa</h3>
            <Field label="Nombre">
              <input type="text" value={nombreEdit} onChange={e => setNombreEdit(e.target.value)} className={INPUT} />
            </Field>
            <p className="text-xs text-gray-500">Los grupos de este programa se renombran solos.</p>
            <div className="flex gap-2">
              <button type="button" onClick={renombrar} className={`flex-1 ${PRIMARY_BUTTON}`}>Guardar</button>
              <button type="button" onClick={() => setEditing(null)} className={SECONDARY_BUTTON}>Cancelar</button>
            </div>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDeleteModal
          title="Eliminar programa"
          message={<>¿Eliminar el programa <strong>{deleting.nombre}</strong>? Si ya tiene grupos no se podrá; desactívalo en su lugar.</>}
          onCancel={() => setDeleting(null)}
          onConfirm={eliminar}
        />
      )}
    </div>
  );
};
