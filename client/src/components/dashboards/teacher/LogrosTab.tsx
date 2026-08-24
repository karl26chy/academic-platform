import React, { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { Card, EmptyMessage, Field, PRIMARY_BUTTON, toast } from '../../ui';
import type { AcademicPeriod, Assignment } from '../../../types';

interface LogrosTabProps {
  assignment: Assignment;
  period: AcademicPeriod | null;
}

export const LogrosTab: React.FC<LogrosTabProps> = ({ assignment, period }) => {
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const closed = period ? !period.activo : true;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!period) return;
      setLoading(true);
      try {
        const token = localStorage.getItem('edu_platform_token');
        const res = await fetch(`/api/assignments/${assignment.id}/achievements?periodo_id=${period.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json().catch(() => null);
        if (!cancelled) setTexto(data?.texto || '');
      } catch {
        if (!cancelled) setTexto('');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [assignment.id, period?.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!period || closed) return;
    if (!texto.trim()) { toast.error('El logro no puede estar vacío.'); return; }
    if (texto.length > 1000) { toast.error('Máximo 1000 caracteres.'); return; }
    setSaving(true);
    try {
      const token = localStorage.getItem('edu_platform_token');
      const res = await fetch(`/api/assignments/${assignment.id}/achievements?periodo_id=${period.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ texto }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al guardar logro');
      }
      toast.success('Logro guardado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar logro');
    } finally {
      setSaving(false);
    }
  };

  if (closed) {
    return (
      <Card>
        <EmptyMessage className="text-sm text-gray-500 flex items-center gap-2 justify-center py-6">
          <Lock className="h-4 w-4" /> El periodo está cerrado; no se pueden editar logros.
        </EmptyMessage>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-lg font-bold text-gray-900 mb-1">Logros del periodo</h3>
      <p className="text-xs text-gray-500 mb-4">Un texto por materia+grado+período, visible para todos los estudiantes del grupo.</p>
      <form onSubmit={handleSave} className="space-y-4">
        <Field label={`Logro (${texto.length}/1000)`}>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="Ej: Reconoce la importancia de..."
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-q10-500"
            disabled={loading}
          />
        </Field>
        <div className="flex justify-end">
          <button type="submit" disabled={saving || loading} className={`px-6 ${PRIMARY_BUTTON} disabled:opacity-50`}>
            {saving ? 'Guardando...' : 'Guardar logro'}
          </button>
        </div>
      </form>
    </Card>
  );
};
