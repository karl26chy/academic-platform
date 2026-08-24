import React, { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../../services/api';
import { DOCUMENT_TYPES } from '../../../lib/documentTypes';
import type { ContactoEmergencia, Institution, User } from '../../../types';

const FIELD = 'w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-q10-500';
const LABEL = 'block text-xs font-medium text-gray-500 mb-1';
const TIPOS_SANGRE = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const CONTACTO_VACIO: ContactoEmergencia = { nombre: '', telefono: '', relacion: '' };

interface StudentFormModalProps {
  institution: Institution | null;
  /** Si se pasa, edita; si no, crea. */
  student?: User | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  showMsg: (type: 'success' | 'error', text: string) => void;
}

/** Alta/edición de un estudiante de la institución del administrador. */
export const StudentFormModal: React.FC<StudentFormModalProps> = ({
  institution, student, onClose, onSaved, showMsg,
}) => {
  const esEdicion = !!student;
  const [nombre, setNombre] = useState(student?.nombre || '');
  const [apellido, setApellido] = useState(student?.apellido || '');
  const [email, setEmail] = useState(student?.email || '');
  const [password, setPassword] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState(student?.tipo_documento || '');
  const [identificacion, setIdentificacion] = useState(student?.identificacion || '');
  const [genero, setGenero] = useState(student?.genero || '');
  const [fechaNac, setFechaNac] = useState(student?.fecha_nacimiento || '');
  const [eps, setEps] = useState(student?.eps || '');
  const [tipoSangre, setTipoSangre] = useState(student?.tipo_sangre || '');
  const [discapacidad, setDiscapacidad] = useState(student?.discapacidad || '');
  const [contacto, setContacto] = useState<ContactoEmergencia>(
    student?.contacto_emergencia || CONTACTO_VACIO
  );
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !apellido.trim()) return;
    if (!tipoDocumento) return showMsg('error', 'Selecciona el tipo de documento.');
    if (!identificacion.trim()) return showMsg('error', 'El número de identificación es obligatorio.');
    if (!esEdicion && !password) return showMsg('error', 'La contraseña es obligatoria.');
    if (!institution) return showMsg('error', 'No se pudo determinar tu institución.');

    const data = {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      email: email || undefined,
      password: esEdicion ? (password || undefined) : password,
      rol: 'student' as const,
      tipo_documento: tipoDocumento,
      identificacion: identificacion.trim(),
      genero: genero || undefined,
      fecha_nacimiento: fechaNac || undefined,
      eps: eps || undefined,
      tipo_sangre: tipoSangre || undefined,
      discapacidad: discapacidad || undefined,
      contacto_emergencia: contacto.nombre ? contacto : undefined,
      institucion_id: institution.id,
      activo: true,
    };

    setBusy(true);
    try {
      if (esEdicion && student) {
        await api.updateUser(student.id, data);
        showMsg('success', 'Estudiante actualizado.');
      } else {
        await api.createUser(data);
        showMsg('success', 'Estudiante creado.');
      }
      onClose();
      await onSaved();
    } catch (err) {
      showMsg('error', err instanceof Error ? err.message : 'Error al guardar estudiante.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-q10-500 to-indigo-600 rounded-t-2xl p-4 sm:p-6 text-white">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">{esEdicion ? 'Editar Estudiante' : 'Crear Estudiante'}</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Nombre</label>
              <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} className={FIELD} />
            </div>
            <div>
              <label className={LABEL}>Apellido</label>
              <input type="text" required value={apellido} onChange={e => setApellido(e.target.value)} className={FIELD} />
            </div>
          </div>

          <div>
            <label className={LABEL}>Email (opcional)</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@colegio.com" className={FIELD} />
          </div>

          <div>
            <label className={LABEL}>{esEdicion ? 'Nueva Contraseña (opcional)' : 'Contraseña'}</label>
            <input type="password" required={!esEdicion} value={password} onChange={e => setPassword(e.target.value)} className={FIELD} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Tipo de documento</label>
              <select required value={tipoDocumento} onChange={e => setTipoDocumento(e.target.value)} className={FIELD}>
                <option value="">-- Seleccionar --</option>
                {Object.entries(DOCUMENT_TYPES).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Número de identificación</label>
              <input type="text" required value={identificacion} onChange={e => setIdentificacion(e.target.value)} className={FIELD} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Género</label>
              <select value={genero} onChange={e => setGenero(e.target.value)} className={FIELD}>
                <option value="">--</option>
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Fecha Nac.</label>
              <input type="date" value={fechaNac} onChange={e => setFechaNac(e.target.value)} className={FIELD} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>EPS (opcional)</label>
              <input type="text" value={eps} onChange={e => setEps(e.target.value)} className={FIELD} />
            </div>
            <div>
              <label className={LABEL}>Tipo Sangre (opcional)</label>
              <select value={tipoSangre} onChange={e => setTipoSangre(e.target.value)} className={FIELD}>
                <option value="">--</option>
                {TIPOS_SANGRE.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL}>Discapacidad (opcional)</label>
            <input type="text" value={discapacidad} onChange={e => setDiscapacidad(e.target.value)} className={FIELD} />
          </div>

          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">Contacto de Emergencia (opcional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(['nombre', 'telefono', 'relacion'] as const).map(campo => (
                <div key={campo}>
                  <label className="block text-[10px] text-gray-400 mb-1">
                    {campo === 'nombre' ? 'Nombre' : campo === 'telefono' ? 'Teléfono' : 'Relación'}
                  </label>
                  <input
                    type="text"
                    value={contacto[campo]}
                    onChange={e => setContacto(p => ({ ...p, [campo]: e.target.value }))}
                    className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={busy} className="flex-1 py-2.5 bg-q10-600 hover:bg-q10-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-60">
              {busy ? 'Guardando...' : esEdicion ? 'Guardar Cambios' : 'Crear Estudiante'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
