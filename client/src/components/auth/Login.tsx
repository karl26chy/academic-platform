import React, { useState } from 'react';
import { Eye, EyeOff, GraduationCap, Key, Mail } from 'lucide-react';
import { useApp } from '../../context/useApp';

const FIELD =
  'block w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-q10-500/50 focus:border-q10-500 transition-colors';

export const Login: React.FC = () => {
  const { login, authError } = useApp();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) return;
    setLoading(true);
    await login(identifier, password);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-6 sm:py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-q10-900 via-q10-800 to-q10-950">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center">
          <div className="p-3 bg-q10-50 border border-q10-200 rounded-2xl text-q10-600">
            <GraduationCap className="h-12 w-12" />
          </div>
        </div>
        <h2 className="mt-6 text-3xl font-extrabold text-gray-900 tracking-tight">
          Plataforma Educativa
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Inicia sesión para acceder a tu panel institucional
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white border border-gray-200 rounded-2xl py-8 px-4 shadow-sm sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {authError && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-sm text-red-600">
                {authError}
              </div>
            )}

            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-gray-700">
                Correo o Identificación
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  id="identifier" name="identifier" type="text" required
                  value={identifier} onChange={e => setIdentifier(e.target.value)}
                  className={FIELD}
                  placeholder="correo@plataforma.com o número de identificación"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Los estudiantes inician sesión con su número de identificación.
              </p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Key className="h-5 w-5" />
                </div>
                <input
                  id="password" name="password" type={showPassword ? 'text' : 'password'} required
                  value={password} onChange={e => setPassword(e.target.value)}
                  className={`${FIELD} pr-10`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-q10-600 hover:bg-q10-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-q10-500 transition-colors disabled:opacity-50"
              >
                {loading ? 'Iniciando sesión...' : 'Ingresar a la Plataforma'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
