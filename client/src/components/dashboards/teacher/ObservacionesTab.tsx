import React, { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { Card, EmptyMessage, PRIMARY_BUTTON, TableWrapper, TableHead, TableBody, toast } from '../../ui';
import type { AcademicPeriod, User } from '../../../types';

interface ObservacionesTabProps {
  students: User[];
  period: AcademicPeriod | null;
}

export const ObservacionesTab: React.FC<ObservacionesTabProps> = ({ students, period }) => {
  const [records, setRecords] = useState<Record<string, string>>({});
  const [initial, setInitial] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const closed = period ? !period.activo : true;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!period || students.length === 0) return;
      setLoading(true);
      const token = localStorage.getItem('edu_platform_token');
      const next: Record<string, string> = {};
      await Promise.all(students.map(async s => {
        try {
          const res = await fetch(`/api/students/${s.id}/observations?periodo_id=${period.id}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const data = await res.json().catch(() => null);
          next[s.id] = data?.texto || '';
        } catch {
          next[s.id] = '';
        }
      }));
      if (!cancelled) {
        setRecords(next);
        setInitial({ ...next });
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [period?.id, students.map(s=>s.id).join(',')]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!period || closed) return;
    const changed = students.filter(s => (records[s.id]||'') !== (initial[s.id]||''));
    if (changed.length === 0) { toast.success('Sin cambios'); return; }
    for (const s of changed) {
      const txt = (records[s.id]||'').trim();
      if (txt.length === 0) continue;
      if (txt.length > 1000) { toast.error(`Observación de ${s.nombre} excede 1000 caracteres`); return; }
    }
    setSaving(true);
    try {
      const token = localStorage.getItem('edu_platform_token');
      await Promise.all(changed.map(s => {
        const txt = (records[s.id]||'').trim();
        if (!txt) return Promise.resolve();
        return fetch(`/api/students/${s.id}/observations?periodo_id=${period.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ texto: txt }),
        }).then(async res => {
          if (!res.ok) {
            const err = await res.json().catch(()=>({}));
            throw new Error(err.error || `Error en ${s.nombre}`);
          }
        });
      }));
      setInitial({ ...records });
      toast.success('Observaciones guardadas');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (closed) {
    return (
      <Card>
        <EmptyMessage className="text-sm text-gray-500 flex items-center gap-2 justify-center py-6">
          <Lock className="h-4 w-4" /> El periodo está cerrado; no se pueden editar observaciones.
        </EmptyMessage>
      </Card>
    );
  }

  if (students.length === 0) {
    return <Card><EmptyMessage className="text-gray-500 text-sm py-4">No hay estudiantes matriculados.</EmptyMessage></Card>;
  }

  return (
    <Card>
      <h3 className="text-lg font-bold text-gray-900 mb-1">Observaciones por estudiante</h3>
      <p className="text-xs text-gray-500 mb-4">Una observación por estudiante+período. Si otro docente la reemplaza, se sobrescribe.</p>
      <form onSubmit={handleSave} className="space-y-4">
        <TableWrapper>
          <TableHead uppercase>
            <th className="pb-3">Estudiante</th>
            <th className="pb-3">Observación</th>
          </TableHead>
          <TableBody>
            {students.map(student => (
              <tr key={student.id} className="hover:bg-gray-50">
                <td className="py-3.5 font-medium text-gray-900 align-top pt-4">{student.nombre} {student.apellido}</td>
                <td className="py-2">
                  <textarea
                    value={records[student.id] || ''}
                    onChange={e => setRecords(prev => ({ ...prev, [student.id]: e.target.value }))}
                    maxLength={1000}
                    rows={2}
                    placeholder="Observación..."
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-q10-500"
                    disabled={loading}
                  />
                  <span className="text-[11px] text-gray-400">{(records[student.id]||'').length}/1000</span>
                </td>
              </tr>
            ))}
          </TableBody>
        </TableWrapper>
        <div className="flex justify-end pt-4">
          <button type="submit" disabled={saving || loading} className={`px-6 ${PRIMARY_BUTTON} disabled:opacity-50`}>
            {saving ? 'Guardando...' : 'Guardar observaciones'}
          </button>
        </div>
      </form>
    </Card>
  );
};
