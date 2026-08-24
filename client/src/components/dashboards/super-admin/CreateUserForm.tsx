import React, { useState } from 'react';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import { api } from '../../../services/api';
import { Card, CardTitle, Field, INPUT } from '../../ui';
import { DOCUMENT_TYPES } from '../../../lib/documentTypes';
import type { ContactoEmergencia, Institution } from '../../../types';
import type { Feedback } from './useSuperAdmin';

const TIPOS_SANGRE = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENEROS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'femenino', label: 'Femenino' },
  { value: 'otro', label: 'Otro' },
];

const CONTACTO_VACIO: ContactoEmergencia = { nombre: '', telefono: '', relacion: '' };

interface CreateUserFormProps {
  institutions: Institution[];
  selectedInstId: string;
  onSelectInst: (id: string) => void;
  showMsg: (type: Feedback['type'], text: string) => void;
  /** Guarda la contraseña en claro para poder mostrarla en la ficha. */
  rememberPassword: (userId: string, password: string) => void;
  onChanged: () => Promise<void>;
}

/** Alta de usuarios; los campos de ficha solo aplican a estudiantes. */
export const CreateUserForm: React.FC<CreateUserFormProps> = ({
  institutions, selectedInstId, onSelectInst, showMsg, rememberPassword, onChanged,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rol, setRol] = useState<'admin' | 'teacher' | 'student'>('student');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [genero, setGenero] = useState('');
  const [fechaNac, setFechaNac] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('');
  const [identificacion, setIdentificacion] = useState('');
  const [eps, setEps] = useState('');
  const [tipoSangre, setTipoSangre] = useState('');
  const [discapacidad, setDiscapacidad] = useState('');
  const [contacto, setContacto] = useState<ContactoEmergencia>(CONTACTO_VACIO);

  const reset = () => {
    setEmail(''); setNombre(''); setApellido('');
    setGenero(''); setFechaNac(''); setIdentificacion('');
    setEps(''); setTipoSangre(''); setDiscapacidad('');
    setContacto(CONTACTO_VACIO);
    setPassword('');
    setTipoDocumento('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !apellido || !selectedInstId || !password) return;
    if (rol === 'student' && !tipoDocumento) {
      showMsg('error', 'Selecciona el tipo de documento.');
      return;
    }
    if (rol === 'student' && !identificacion.trim()) {
      showMsg('error', 'El número de identificación es obligatorio para estudiantes.');
      return;
    }

    try {
      const created = await api.createUser({
        email: email || undefined,
        password, rol, nombre, apellido,
        identificacion: identificacion || undefined,
        tipo_documento: rol === 'student' ? tipoDocumento : undefined,
        genero: genero || undefined,
        fecha_nacimiento: fechaNac || undefined,
        eps: eps || undefined,
        tipo_sangre: tipoSangre || undefined,
        discapacidad: discapacidad || undefined,
        contacto_emergencia: contacto.nombre ? contacto : undefined,
        institucion_id: selectedInstId,
        activo: true,
      });
      rememberPassword(created.id, password);
      reset();
      showMsg('success', 'Usuario creado.');
      await onChanged();
    } catch {
      showMsg('error', 'Error al crear usuario.');
    }
  };

  return (
    <Card className="h-fit">
      <CardTitle icon={<UserPlus className="h-5 w-5 text-q10-600" />} className="mb-6">
        Crear Usuario
      </CardTitle>

      <Field label="Institución" className="mb-4">
        <select required value={selectedInstId} onChange={e => onSelectInst(e.target.value)} className={INPUT}>
          <option value="">-- Seleccionar --</option>
          {institutions.map(inst => (
            <option key={inst.id} value={inst.id}>{inst.nombre}</option>
          ))}
        </select>
      </Field>

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
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="usuario@colegio.com" className={INPUT}
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Obligatorio para que el estudiante pueda iniciar sesión por correo; siempre puede hacerlo por identificación.
          </p>
        </Field>

        <Field label="Contraseña">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'} required
              value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 pr-10 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none"
            />
            <button
              type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <Field label="Rol">
          <select
            value={rol}
            onChange={e => setRol(e.target.value as 'admin' | 'teacher' | 'student')}
            className={INPUT}
          >
            <option value="student">Estudiante</option>
            <option value="teacher">Profesor</option>
            <option value="admin">Administrador</option>
          </select>
        </Field>

        {rol === 'student' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Tipo de documento">
                <select required value={tipoDocumento} onChange={e => setTipoDocumento(e.target.value)} className={INPUT}>
                  <option value="">-- Seleccionar --</option>
                  {Object.entries(DOCUMENT_TYPES).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Número de documento">
                <input
                  type="text" required value={identificacion} onChange={e => setIdentificacion(e.target.value)}
                  placeholder="CC/TI" className={INPUT}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Género">
                <select value={genero} onChange={e => setGenero(e.target.value)} className={INPUT}>
                  <option value="">--</option>
                  {GENEROS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </Field>
              <Field label="Fecha Nac.">
                <input type="date" value={fechaNac} onChange={e => setFechaNac(e.target.value)} className={INPUT} />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="EPS">
                <input
                  type="text" value={eps} onChange={e => setEps(e.target.value)}
                  placeholder="Sura, Coomeva..." className={INPUT}
                />
              </Field>
              <Field label="Tipo Sangre">
                <select value={tipoSangre} onChange={e => setTipoSangre(e.target.value)} className={INPUT}>
                  <option value="">--</option>
                  {TIPOS_SANGRE.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>

            <div>
              <Field label="Discapacidad">
                <input
                  type="text" value={discapacidad} onChange={e => setDiscapacidad(e.target.value)}
                  placeholder="Ninguna, visual, etc." className={INPUT}
                />
              </Field>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-500 mb-2">Contacto de Emergencia</p>
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
                      placeholder={campo === 'relacion' ? 'Madre/Padre' : undefined}
                      className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <button
          type="submit"
          className="w-full py-2.5 bg-q10-600 hover:bg-q10-700 text-white font-semibold rounded-xl text-sm transition-colors"
        >
          Registrar Usuario
        </button>
      </form>
    </Card>
  );
};
