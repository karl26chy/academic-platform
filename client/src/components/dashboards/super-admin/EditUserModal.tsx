import React, { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../../services/api';
import { DOCUMENT_TYPES } from '../../../lib/documentTypes';
import type { Role, User } from '../../../types';
import type { Feedback } from './useSuperAdmin';

const FIELD = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none';
const FIELD_FOCUS = `${FIELD} focus:ring-2 focus:ring-amber-500/50`;
const LABEL = 'block text-xs font-medium text-gray-600 mb-1';
const TIPOS_SANGRE = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

type EditForm = Partial<User & { password: string }>;

interface EditUserModalProps {
  user: User;
  showMsg: (type: Feedback['type'], text: string) => void;
  rememberPassword: (userId: string, password: string) => void;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

/** Edición de un usuario existente; la contraseña solo cambia si se escribe. */
export const EditUserModal: React.FC<EditUserModalProps> = ({
  user, showMsg, rememberPassword, onClose, onChanged,
}) => {
  const [form, setForm] = useState<EditForm>({
    nombre: user.nombre,
    apellido: user.apellido,
    email: user.email,
    rol: user.rol,
    password: '',
    identificacion: user.identificacion || '',
    tipo_documento: user.tipo_documento || '',
    genero: user.genero || '',
    fecha_nacimiento: user.fecha_nacimiento || '',
    eps: user.eps || '',
    tipo_sangre: user.tipo_sangre || '',
    discapacidad: user.discapacidad || '',
    contacto_emergencia: user.contacto_emergencia,
  });

  const esEstudiante = user.rol === 'student' || form.rol === 'student';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre || !form.apellido) return;
    if (esEstudiante && !form.tipo_documento) {
      showMsg('error', 'Selecciona el tipo de documento.');
      return;
    }
    if (esEstudiante && !(form.identificacion || '').trim()) {
      showMsg('error', 'El número de identificación es obligatorio para estudiantes.');
      return;
    }

    try {
      const data: EditForm = {
        nombre: form.nombre,
        apellido: form.apellido,
        email: form.email || undefined,
        rol: form.rol as Role,
      };
      if (form.password) data.password = form.password;

      if (esEstudiante) {
        data.identificacion = form.identificacion || undefined;
        data.tipo_documento = form.tipo_documento || undefined;
        data.genero = form.genero || undefined;
        data.fecha_nacimiento = form.fecha_nacimiento || undefined;
        data.eps = form.eps || undefined;
        data.tipo_sangre = form.tipo_sangre || undefined;
        data.discapacidad = form.discapacidad || undefined;
        if (form.contacto_emergencia && form.contacto_emergencia.nombre) {
          data.contacto_emergencia = form.contacto_emergencia;
        }
      }

      await api.updateUser(user.id, data);
      if (form.password) rememberPassword(user.id, form.password);

      onClose();
      showMsg('success', 'Usuario actualizado.');
      await onChanged();
    } catch {
      showMsg('error', 'Error al actualizar usuario.');
    }
  };

  const update = (patch: EditForm) => setForm(p => ({ ...p, ...patch }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-t-2xl p-4 sm:p-6 text-white">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Editar Usuario</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Nombre</label>
              <input type="text" required value={form.nombre || ''} onChange={e => update({ nombre: e.target.value })} className={FIELD_FOCUS} />
            </div>
            <div>
              <label className={LABEL}>Apellido</label>
              <input type="text" required value={form.apellido || ''} onChange={e => update({ apellido: e.target.value })} className={FIELD_FOCUS} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Email (opcional)</label>
            <input type="email" value={form.email || ''} onChange={e => update({ email: e.target.value })} className={FIELD_FOCUS} />
          </div>

          <div>
            <label className={LABEL}>Nueva Contraseña (dejar vacío para no cambiar)</label>
            <input type="password" value={form.password || ''} onChange={e => update({ password: e.target.value })} className={FIELD_FOCUS} />
          </div>

          <div>
            <label className={LABEL}>Rol</label>
            <select value={form.rol || 'student'} onChange={e => update({ rol: e.target.value as Role })} className={FIELD_FOCUS}>
              <option value="student">Estudiante</option>
              <option value="teacher">Profesor</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          {esEstudiante && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Tipo de documento</label>
                  <select
                    required value={form.tipo_documento || ''}
                    onChange={e => update({ tipo_documento: e.target.value })}
                    className={FIELD}
                  >
                    <option value="">-- Seleccionar --</option>
                    {Object.entries(DOCUMENT_TYPES).map(([code, label]) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Número de documento</label>
                  <input type="text" required value={form.identificacion || ''} onChange={e => update({ identificacion: e.target.value })} className={FIELD} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Género</label>
                  <select value={form.genero || ''} onChange={e => update({ genero: e.target.value })} className={FIELD}>
                    <option value="">--</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Fecha Nac.</label>
                  <input type="date" value={form.fecha_nacimiento || ''} onChange={e => update({ fecha_nacimiento: e.target.value })} className={FIELD} />
                </div>
                <div>
                  <label className={LABEL}>EPS</label>
                  <input type="text" value={form.eps || ''} onChange={e => update({ eps: e.target.value })} className={FIELD} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Tipo Sangre</label>
                  <select value={form.tipo_sangre || ''} onChange={e => update({ tipo_sangre: e.target.value })} className={FIELD}>
                    <option value="">--</option>
                    {TIPOS_SANGRE.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Discapacidad</label>
                  <input type="text" value={form.discapacidad || ''} onChange={e => update({ discapacidad: e.target.value })} className={FIELD} />
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
