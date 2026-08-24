import React, { useState } from 'react';
import { Edit3, Loader2, Lock, Plus, Trash2, Unlock } from 'lucide-react';
import { Badge, Card, CardTitle, EmptyMessage, Modal, TableWrapper, TableHead, TableBody } from '../../ui';
import { PeriodForm } from './PeriodForm';
import { PeriodConfirmModal } from './PeriodConfirmModal';
import { useAcademicPeriods, type PeriodFormData } from './useAcademicPeriods';
import { useApp } from '../../../context/useApp';
import { periodLabel } from '../../../lib/periods';
import type { AcademicPeriod } from '../../../types';

/** "2026-08-10" → "10/08/2026" (sin depender de zona horaria). */
function formatFecha(fecha?: string | null): string {
  if (!fecha) return '—';
  const [y, m, d] = fecha.split('-');
  return y && m && d ? `${d}/${m}/${y}` : fecha;
}

type ConfirmAction =
  | { kind: 'open' | 'close' | 'delete'; period: AcademicPeriod }
  | null;

/** Gestión de periodos académicos de la institución del administrador. */
export const PeriodsTab: React.FC = () => {
  const { user } = useApp();
  const {
    periods, loading, error,
    create, update, openPeriod, closePeriod, remove, reload,
  } = useAcademicPeriods();

  const [formVersion, setFormVersion] = useState(0);
  const [editing, setEditing] = useState<AcademicPeriod | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [busy, setBusy] = useState(false);

  const institucionId = user?.institucion_id ?? null;

  if (!institucionId) {
    return (
      <Card>
        <EmptyMessage>No se pudo determinar tu institución.</EmptyMessage>
      </Card>
    );
  }

  const handleCreate = async (data: PeriodFormData) => {
    setBusy(true);
    const ok = await create(data, institucionId);
    setBusy(false);
    if (ok) setFormVersion(v => v + 1);
  };

  const handleEditSubmit = async (data: PeriodFormData) => {
    if (!editing) return;
    setBusy(true);
    const ok = await update(editing.id, data);
    setBusy(false);
    if (ok) setEditing(null);
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    const { kind, period } = confirmAction;
    setBusy(true);
    if (kind === 'open') await openPeriod(period);
    if (kind === 'close') await closePeriod(period);
    if (kind === 'delete') await remove(period.id);
    setBusy(false);
    setConfirmAction(null);
  };

  const openCount = periods.filter(p => p.activo).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {error && (
        <div className="p-4 rounded-xl border text-sm flex items-center justify-between gap-2 bg-red-50 border-red-200 text-red-600">
          <span>{error}</span>
          <button
            onClick={reload}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="h-fit">
          <CardTitle icon={<Plus className="h-5 w-5 text-q10-600" />} className="mb-6">
            Crear Periodo
          </CardTitle>
          <PeriodForm
            key={formVersion}
            submitLabel="Guardar Periodo"
            onSubmit={handleCreate}
            busy={busy}
          />
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <CardTitle className="">Periodos Académicos</CardTitle>
            {openCount > 0 && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                {openCount === 1 ? '1 periodo abierto' : `${openCount} periodos abiertos`}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Cargando periodos...
            </div>
          ) : !error && periods.length === 0 ? (
            <EmptyMessage className="text-sm text-gray-500 flex items-center gap-2 justify-center py-8">
              <Lock className="h-4 w-4" />
              Todavía no existen periodos académicos para esta institución. Crea el primero con el formulario.
            </EmptyMessage>
          ) : (
            <TableWrapper>
              <TableHead uppercase>
                <th className="pb-3">Nombre</th>
                <th className="pb-3">Nº</th>
                <th className="pb-3">Año</th>
                <th className="pb-3">Inicio</th>
                <th className="pb-3">Fin</th>
                <th className="pb-3 text-center">Estado</th>
                <th className="pb-3 text-right">Acciones</th>
              </TableHead>
              <TableBody>
                {periods.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="py-3 font-semibold text-gray-900">
                      {periodLabel(p)}
                    </td>
                    <td className="py-3 text-gray-500">{p.numero}</td>
                    <td className="py-3 text-gray-500">{p.anio}</td>
                    <td className="py-3 text-gray-500">{formatFecha(p.fecha_inicio)}</td>
                    <td className="py-3 text-gray-500">{formatFecha(p.fecha_fin)}</td>
                    <td className="py-3 text-center">
                      {p.activo ? (
                        <Badge className="bg-emerald-100 text-emerald-600">ABIERTO</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-500">CERRADO</Badge>
                      )}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {!p.activo && (
                          <button
                            onClick={() => setConfirmAction({ kind: 'open', period: p })}
                            title="Abrir periodo"
                            className="px-2.5 py-1 rounded text-xs border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors flex items-center gap-1"
                          >
                            <Unlock className="h-3 w-3" /> Abrir
                          </button>
                        )}
                        {p.activo && (
                          <button
                            onClick={() => setConfirmAction({ kind: 'close', period: p })}
                            title="Cerrar periodo"
                            className="px-2.5 py-1 rounded text-xs border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors flex items-center gap-1"
                          >
                            <Lock className="h-3 w-3" /> Cerrar
                          </button>
                        )}
                        <button
                          onClick={() => setEditing(p)} title="Editar periodo"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setConfirmAction({ kind: 'delete', period: p })}
                          title="Eliminar periodo"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </TableBody>
            </TableWrapper>
          )}
        </Card>
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)} size="lg">
          <CardTitle className="mb-4">Editar Periodo</CardTitle>
          <PeriodForm
            initial={editing}
            submitLabel="Guardar Cambios"
            onSubmit={handleEditSubmit}
            onCancel={() => setEditing(null)}
            busy={busy}
          />
        </Modal>
      )}

      {confirmAction && (
        <PeriodConfirmModal
          title={
            confirmAction.kind === 'open' ? 'Abrir periodo'
              : confirmAction.kind === 'close' ? 'Cerrar periodo'
              : 'Eliminar periodo'
          }
          message={
            confirmAction.kind === 'open'
              ? 'Al abrir este periodo, cualquier otro periodo abierto de esta institución será cerrado automáticamente. ¿Deseas continuar?'
              : confirmAction.kind === 'close'
              ? 'Al cerrar este periodo no quedará ningún periodo abierto en la institución. Los docentes no podrán crear evaluaciones hasta que abras otro. ¿Deseas continuar?'
              : '¿Eliminar este periodo? Si tiene evaluaciones o notas asociadas, el sistema lo rechazará.'
          }
          confirmLabel={
            confirmAction.kind === 'open' ? 'Abrir'
              : confirmAction.kind === 'close' ? 'Cerrar'
              : 'Eliminar'
          }
          danger={confirmAction.kind === 'delete'}
          busy={busy}
          onCancel={() => setConfirmAction(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
};
