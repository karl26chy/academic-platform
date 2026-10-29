import React, { useState } from 'react';
import { Eye, EyeOff, Key, User } from 'lucide-react';
import { useApp } from '../../context/useApp';

/**
 * Login de Kamak: la imagen de la marca ocupa toda la pantalla y el
 * formulario va en un cuadro translúcido (efecto vidrio).
 *
 *  · Pantalla vertical (celular, tablet de pie): imagen vertical y el cuadro
 *    en el centro exacto; el nombre queda visible arriba.
 *  · Pantalla horizontal: imagen panorámica. Desde 1024 px el cuadro va a
 *    la derecha, fuera de la nube con el nombre (43 %–66 % del ancho de la
 *    imagen); si la pantalla es menos panorámica que la imagen, el recorte
 *    se hace por la izquierda para no tapar el nombre.
 *
 * Se elige por orientación y no solo por ancho: una tablet de pie usa la
 * imagen vertical aunque mida 1024 px.
 *
 * Colores tomados de la imagen: verde bosque del logotipo para el botón y
 * los textos, vidrio cálido para el cuadro.
 */

const FIELD =
  'block w-full pl-10 pr-3 py-3 bg-white/70 border border-white/70 rounded-xl text-[#1f332d] placeholder-[#5c6f68] focus:outline-none focus:ring-2 focus:ring-[#2f4f47]/40 focus:border-[#2f4f47]/60 focus:bg-white/85 transition-colors';

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
    <div className="relative min-h-dvh bg-[#e9dcc8] bg-cover bg-[position:center_15%] bg-[url('/kamak-fondo-movil.webp')] landscape:bg-[url('/kamak-fondo.webp')] landscape:bg-[position:56%_center] lg:landscape:bg-[position:85%_center]">
      {/* En pantalla grande, leve sombra a la derecha para que el cuadro se lea sobre la imagen. */}
      <div className="pointer-events-none absolute inset-0 hidden lg:landscape:block bg-gradient-to-l from-black/20 via-black/5 to-transparent" />

      <main className="relative min-h-dvh flex items-center justify-center px-4 py-8 lg:landscape:justify-end lg:landscape:pr-[3.5vw]">
        <div className="w-full max-w-sm lg:landscape:max-w-[23rem] xl:landscape:max-w-[24rem] bg-white/30 backdrop-blur-xl backdrop-saturate-150 border border-white/50 rounded-3xl shadow-[0_20px_60px_-15px_rgba(31,51,45,0.45)] px-6 py-8 sm:px-9 sm:py-10">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {authError && (
              <div role="alert" className="bg-red-50/90 border border-red-200 p-3.5 rounded-xl text-sm text-red-700">
                {authError}
              </div>
            )}

            <div>
              <label htmlFor="identifier" className="block text-sm font-semibold text-[#1f332d]">
                Usuario
              </label>
              <div className="mt-1.5 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#3d5a50]">
                  <User className="h-5 w-5" />
                </div>
                <input
                  id="identifier" name="identifier" type="text" required autoComplete="username"
                  value={identifier} onChange={e => setIdentifier(e.target.value)}
                  className={FIELD}
                  placeholder="Correo o número de identificación"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-[#1f332d]">
                Contraseña
              </label>
              <div className="mt-1.5 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#3d5a50]">
                  <Key className="h-5 w-5" />
                </div>
                <input
                  id="password" name="password" type={showPassword ? 'text' : 'password'} required
                  autoComplete="current-password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  className={`${FIELD} pr-10`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#3d5a50] hover:text-[#1f332d] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-semibold text-white bg-[#2f4f47] hover:bg-[#24403a] shadow-md shadow-[#1f332d]/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white/40 focus:ring-[#2f4f47] transition-colors disabled:opacity-60"
            >
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};
