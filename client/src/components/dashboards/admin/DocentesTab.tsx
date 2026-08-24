import React, { useState } from 'react';
import { Edit3, Plus, Users } from 'lucide-react';
import { api } from '../../../services/api';
import { Card, CardTitle, EmptyMessage, Field, INPUT, toast } from '../../ui';
import { useApp } from '../../../context/useApp';
import type { User } from '../../../types';

const FIELD = 'w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-q10-500';
const LABEL = 'block text-xs font-medium text-gray-500 mb-1';

/** Gestión de los docentes de la institución del administrador. */
export const DocentesTab: React.FC = () => {
  const { user, users, currentInstitution, refreshData } = useApp();
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [editing, setEditing] = useState<User | null>(null);

  const instId = user?.institucion_id;
  const misDocentes = users.filter(u => u.rol === 'teacher' && u.institucion_id === instId);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !apellido.trim() || !instId || !password) return;
    try {
      await api.createUser({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email || undefined,
        password,
        rol: 'teacher',
        institucion_id: instId,
        activo: true,
      });
      setNombre(''); setApellido(''); setEmail(''); setPassword('');
      toast.success('Docente creado.');
      await refreshData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear docente.');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.nombre?.trim() || !editing.apellido?.trim()) return;
    try {
      await api.updateUser(editing.id, {
        nombre: editing.nombre,
        apellido: editing.apellido,
        email: editing.email || undefined,
      });
      setEditing(null);
      toast.success('Docente actualizado.');
      await refreshData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar docente.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
      <Card className="h-fit">
        <CardTitle icon={<Plus className="h-5 w-5 text-q10-600" />} className="mb-6">
          Crear Docente
        </CardTitle>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nombre">
              <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} className={INPUT} />
            </Field>
            <Field label="Apellido">
              <input type="text" required value={apellido} onChange={e => setApellido(e.target.value)} className={INPUT} />
            </Field>
          </div>
          <Field label="Email (opcional)">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="docente@colegio.com" className={INPUT} />
          </Field>
          <Field label="Contraseña">
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className={INPUT} />
          </Field>
          <button
            type="submit"
            className="w-full py-3 bg-q10-600 hover:bg-q10-700 text-white font-semibold rounded-xl transition-colors"
          >
            Guardar Docente
          </button>
          {!instId && <p className="text-xs text-amber-600">No se pudo determinar tu institución.</p>}
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle icon={<Users className="h-5 w-5 text-q10-600" />} className="mb-6">
          Docentes de {currentInstitution?.nombre || 'mi institución'}
        </CardTitle>

        {misDocentes.length === 0 ? (
          <EmptyMessage className="text-sm text-gray-500 py-8">
            Aún no hay docentes en tu institución.
          </EmptyMessage>
        ) : (
          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {misDocentes.map(d => (
              <div key={d.id} className="flex justify-between items-center gap-2 p-3 bg-white rounded-xl border border-gray-200">
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-gray-900 block">{d.nombre} {d.apellido}</span>
                  <span className="text-xs text-gray-400">{d.email || 'Sin correo registrado'}</span>
                </div>
                <button
                  onClick={() => setEditing(d)} title="Editar docente"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors shrink-0"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-q10-500 to-indigo-600 rounded-t-2xl p-4 sm:p-6 text-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Editar Docente</h3>
                <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10">✕</button>
              </div>
            </div>
            <form onSubmit={handleEdit} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Nombre</label>
                  <input type="text" required value={editing.nombre || ''} onChange={e => setEditing(p => p ? { ...p, nombre: e.target.value } : p)} className={FIELD} />
                </div>
                <div>
                  <label className={LABEL}>Apellido</label>
                  <input type="text" required value={editing.apellido || ''} onChange={e => setEditing(p => p ? { ...p, apellido: e.target.value } : p)} className={FIELD} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Email (opcional)</label>
                <input type="email" value={editing.email || ''} onChange={e => setEditing(p => p ? { ...p, email: e.target.value } : p)} className={FIELD} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 py-2.5 bg-q10-600 hover:bg-q10-700 text-white font-semibold rounded-xl text-sm transition-colors">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
