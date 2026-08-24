import React, { useEffect, useState } from 'react';
import { Edit3, Plus, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { api } from '../../../services/api';
import { http } from '../../../services/http';
import { Card, CardTitle, INPUT_LARGE, Modal, TableWrapper, TableHead, TableBody } from '../../ui';
import { DeleteInstitutionModal } from './DeleteInstitutionModal';
import { scaleLabel } from '../../../lib/grades';
import type { Institution } from '../../../types';
import type { Feedback } from './useSuperAdmin';

interface InstitutionsTabProps {
  institutions: Institution[];
  showMsg: (type: Feedback['type'], text: string) => void;
  onChanged: () => Promise<void>;
}

type Tipo = Institution['tipo'];
const TIPOS: { value: Tipo; label: string }[] = [
  { value: 'colegio', label: 'Colegio' },
  { value: 'corporacion', label: 'Corporación' },
  { value: 'universidad', label: 'Universidad' },
];

const ESCALAS = [5, 10, 100];

/** Valor inicial editable (no una regla rígida): el 60% de la escala. */
const defaultNotaMinima = (escala: number) => Math.round(escala * 0.6);

const clampNotaMinima = (nota: number, escala: number) =>
  Math.min(Math.max(nota, 1), escala);

/** Alta de instituciones, activación/desactivación y edición de configuración. */
export const InstitutionsTab: React.FC<InstitutionsTabProps> = ({
  institutions, showMsg, onChanged,
}) => {
  const [nombre, setNombre] = useState('');
  const [subdominio, setSubdominio] = useState('');
  const [tipo, setTipo] = useState<Tipo>('colegio');
  const [escala, setEscala] = useState(10);
  const [notaMinima, setNotaMinima] = useState(6.0);
  const [reportTemplateId, setReportTemplateId] = useState('default');
  const [reportActivo, setReportActivo] = useState(true);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([{ id: 'default', name: 'Formato por defecto' }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await http.get<{ id: string; name: string }[]>('/report-templates');
        if (!cancelled && Array.isArray(data) && data.length > 0) setTemplates(data);
      } catch {
        // fallback default ya está
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const [deleting, setDeleting] = useState<Institution | null>(null);
  const [editing, setEditing] = useState<Institution | null>(null);

  // Al cambiar la escala se revalida la nota mínima: si se sale de la nueva
  // escala se ajusta al 60% (valor inicial editable); si no, se conserva.
  const changeEscala = (
    next: number,
    setNota: React.Dispatch<React.SetStateAction<number>>,
    setEsc: React.Dispatch<React.SetStateAction<number>>,
  ) => {
    setEsc(next);
    setNota(prev => (prev < 1 || prev > next ? defaultNotaMinima(next) : prev));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !subdominio) return;

    const exists = institutions.some(i => i.subdominio.toLowerCase() === subdominio.toLowerCase());
    if (exists) {
      showMsg('error', 'El subdominio ya existe.');
      return;
    }

    try {
      setLoading(true);
      const newInst = (await api.createInstitution({
        nombre,
        subdominio: subdominio.toLowerCase().replace(/[^a-z0-9]/g, ''),
        tipo,
        escala_maxima: escala,
        nota_minima_aprobacion: clampNotaMinima(Number(notaMinima), escala),
        activa: true,
      })) as unknown as Institution;

      // Formato de boletín: selector versionado
      try {
        await http.post(`/institutions/${newInst.id}/report-config`, {
          tipo_documento: 'boletin',
          template_id: reportTemplateId,
          logo_url: null,
          activo: reportActivo,
        });
      } catch (err) {
        showMsg('error', err instanceof Error ? err.message : 'Institución creada pero no se pudo guardar el formato de boletín.');
      }

      setNombre('');
      setSubdominio('');
      setEscala(10);
      setNotaMinima(6.0);
      setReportTemplateId('default');
      setReportActivo(true);
      showMsg('success', 'Institución creada.');
      await onChanged();
    } catch {
      showMsg('error', 'Error al crear institución.');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (inst: Institution) => {
    try {
      await api.updateInstitution(inst.id, { ...inst, activa: !inst.activa });
      await onChanged();
      showMsg('success', `Estado de ${inst.nombre} actualizado.`);
    } catch {
      showMsg('error', 'No se pudo actualizar.');
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.deleteInstitution(deleting.id);
      setDeleting(null);
      showMsg('success', `Institución "${deleting.nombre}" eliminada.`);
      await onChanged();
    } catch (err) {
      setDeleting(null);
      showMsg('error', err instanceof Error ? err.message : 'Error al eliminar institución.');
    }
  };

  const handleEditSubmit = async (data: { nombre: string; tipo: Tipo; escala_maxima: number; nota_minima_aprobacion: number }) => {
    if (!editing) return;
    try {
      setLoading(true);
      await api.updateInstitution(editing.id, {
        ...editing,
        ...data,
        nota_minima_aprobacion: clampNotaMinima(Number(data.nota_minima_aprobacion), data.escala_maxima),
      });
      setEditing(null);
      showMsg('success', 'Institución actualizada.');
      await onChanged();
    } catch (err) {
      showMsg('error', err instanceof Error ? err.message : 'No se pudo actualizar la institución.');
    } finally {
      setLoading(false);
    }
  };

  const badgeTipo = (t: Tipo) =>
    t === 'universidad' ? 'bg-purple-100 text-purple-600' : t === 'corporacion' ? 'bg-teal-100 text-teal-600' : 'bg-blue-100 text-blue-600';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <Card className="h-fit">
        <CardTitle icon={<Plus className="h-5 w-5 text-q10-600" />} className="mb-6">
          Crear Institución
        </CardTitle>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
            <input
              type="text" required value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Colegio San Ignacio" className={INPUT_LARGE}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Subdominio</label>
            <div className="relative">
              <input
                type="text" required value={subdominio} onChange={e => setSubdominio(e.target.value)}
                placeholder="colegiosanignacio"
                className="w-full pl-4 pr-4 sm:pr-32 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-q10-500/50"
              />
              <span className="hidden sm:block absolute right-3 top-2.5 text-xs text-gray-500 font-semibold">
                .plataforma.com
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de institución</label>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value as Tipo)}
              className={INPUT_LARGE}
            >
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Escala de calificación</label>
            <select
              value={escala}
              onChange={e => changeEscala(Number(e.target.value), setNotaMinima, setEscala)}
              className={INPUT_LARGE}
            >
              {ESCALAS.map(es => <option key={es} value={es}>1 a {es}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Nota mínima de aprobación (1 a {escala})
            </label>
            <input
              type="number" step="0.1" min="1" max={escala} required
              value={notaMinima} onChange={e => setNotaMinima(Number(e.target.value))}
              className={INPUT_LARGE}
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Las notas desde este valor se consideran aprobadas.
            </p>
          </div>

          <div className="border-t border-gray-200 pt-4 mt-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Formato de boletín</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Plantilla</label>
                <select value={reportTemplateId} onChange={e => setReportTemplateId(e.target.value)} className={INPUT_LARGE}>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={reportActivo} onChange={e => setReportActivo(e.target.checked)} className="rounded border-gray-300 text-q10-600 focus:ring-q10-500" />
                Activo
              </label>
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full py-3 bg-q10-600 hover:bg-q10-700 text-white font-semibold rounded-xl transition-colors mt-2"
          >
            {loading ? 'Creando...' : 'Guardar Institución'}
          </button>
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle className="mb-6">Instituciones Registradas</CardTitle>
        <TableWrapper>
          <TableHead uppercase>
            <th className="pb-3">Nombre</th>
            <th className="pb-3">Subdominio</th>
            <th className="pb-3 text-center">Tipo</th>
            <th className="pb-3 text-center">Escala</th>
            <th className="pb-3 text-center">Nota Mín.</th>
            <th className="pb-3 text-center">Estado</th>
            <th className="pb-3 text-right">Acción</th>
          </TableHead>
          <TableBody>
            {institutions.map(inst => (
              <tr key={inst.id} className="hover:bg-gray-50 transition-colors">
                <td className="py-3.5 font-medium text-gray-900">{inst.nombre}</td>
                <td className="py-3.5 text-gray-500">{inst.subdominio}.plataforma.com</td>
                <td className="py-3.5 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${badgeTipo(inst.tipo)}`}>
                    {inst.tipo}
                  </span>
                </td>
                <td className="py-3.5 text-center text-gray-600">{scaleLabel(inst.escala_maxima)}</td>
                <td className="py-3.5 text-center text-gray-600 font-semibold">
                  {Number(inst.nota_minima_aprobacion).toFixed(1)}
                </td>
                <td className="py-3.5 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    inst.activa ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {inst.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td className="py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => setEditing(inst)}
                      title="Editar institución"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => toggleStatus(inst)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${
                        inst.activa
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-600 border-amber-200'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200'
                      }`}
                    >
                      {inst.activa
                        ? <><ToggleLeft className="h-4 w-4" /> Desactivar</>
                        : <><ToggleRight className="h-4 w-4" /> Activar</>}
                    </button>
                    <button
                      onClick={() => setDeleting(inst)} title="Eliminar institución"
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
      </Card>

      {editing && (
        <EditInstitutionModal
          institution={editing}
          busy={loading}
          onCancel={() => setEditing(null)}
          onSubmit={handleEditSubmit}
        />
      )}

      {deleting && (
        <DeleteInstitutionModal
          institution={deleting}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
};

/** Modal de edición de una institución (config de escala, nota mínima y formato de boletín). */
const EditInstitutionModal: React.FC<{
  institution: Institution;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (data: { nombre: string; tipo: Tipo; escala_maxima: number; nota_minima_aprobacion: number }) => void;
}> = ({ institution, busy, onCancel, onSubmit }) => {
  const [nombre, setNombre] = useState(institution.nombre);
  const [tipo, setTipo] = useState<Tipo>(institution.tipo || 'colegio');
  const [escala, setEscala] = useState(institution.escala_maxima || 10);
  const [notaMinima, setNotaMinima] = useState(Number(institution.nota_minima_aprobacion));
  const [reportTemplateId, setReportTemplateId] = useState('default');
  const [reportActivo, setReportActivo] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([{ id: 'default', name: 'Formato por defecto' }]);

  const changeEscala = (next: number) => {
    setEscala(next);
    setNotaMinima(prev => (prev < 1 || prev > next ? defaultNotaMinima(next) : prev));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await http.get<{ id: string; name: string }[]>('/report-templates');
        if (!cancelled && Array.isArray(data) && data.length > 0) setTemplates(data);
      } catch {}
      try {
        const cfg = await http.get<{
          config?: { template_id?: string };
          activo?: boolean;
        }>(`/institutions/${institution.id}/report-config?tipo_documento=boletin`);
        if (!cancelled && cfg?.config?.template_id) {
          setReportTemplateId(cfg.config.template_id);
        }
        if (!cancelled && typeof cfg?.activo === 'boolean') setReportActivo(cfg.activo);
      } catch {
        // sin config previa
      }
    })();
    return () => { cancelled = true; };
  }, [institution.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ nombre: nombre.trim(), tipo, escala_maxima: escala, nota_minima_aprobacion: notaMinima });
    setReportLoading(true);
    try {
      await http.post(`/institutions/${institution.id}/report-config`, {
        tipo_documento: 'boletin',
        template_id: reportTemplateId,
        logo_url: null,
        activo: reportActivo,
      });
    } catch {
      // el error de formato no bloquea la actualización de la institución
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <Modal onClose={onCancel} size="lg">
      <CardTitle className="mb-4">Editar Institución</CardTitle>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
          <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} className={INPUT_LARGE} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Subdominio</label>
          <input type="text" value={institution.subdominio} disabled className={`${INPUT_LARGE} opacity-60 cursor-not-allowed`} />
          <p className="text-[11px] text-gray-400 mt-1">El subdominio no se puede cambiar; identifica la institución.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de institución</label>
          <select value={tipo} onChange={e => setTipo(e.target.value as Tipo)} className={INPUT_LARGE}>
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Escala de calificación</label>
          <select value={escala} onChange={e => changeEscala(Number(e.target.value))} className={INPUT_LARGE}>
            {ESCALAS.map(es => <option key={es} value={es}>1 a {es}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Nota mínima de aprobación (1 a {escala})
          </label>
          <input
            type="number" step="0.1" min="1" max={escala} required
            value={notaMinima} onChange={e => setNotaMinima(Number(e.target.value))}
            className={INPUT_LARGE}
          />
        </div>
        <div className="border-t border-gray-200 pt-4 mt-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Formato de boletín</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Plantilla</label>
              <select value={reportTemplateId} onChange={e => setReportTemplateId(e.target.value)} className={INPUT_LARGE}>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={reportActivo} onChange={e => setReportActivo(e.target.checked)} className="rounded border-gray-300 text-q10-600 focus:ring-q10-500" />
              Activo
            </label>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={busy || reportLoading} className={`flex-1 py-3 bg-q10-600 hover:bg-q10-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-60`}>
            {busy || reportLoading ? 'Guardando...' : 'Guardar Cambios'}
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
};
