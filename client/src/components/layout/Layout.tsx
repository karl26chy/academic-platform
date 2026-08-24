import React, { useMemo } from 'react';
import { Bell, Building2, LogOut, User as UserIcon } from 'lucide-react';
import { useApp } from '../../context/useApp';

const ROLE_LABELS: Record<string, { text: string; bg: string }> = {
  super_admin: { text: 'Super Administrador', bg: 'bg-red-50 text-red-600 border-red-200' },
  admin: { text: 'Administrador', bg: 'bg-amber-50 text-amber-600 border-amber-200' },
  teacher: { text: 'Docente', bg: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  student: { text: 'Estudiante', bg: 'bg-blue-50 text-blue-600 border-blue-200' },
};

const roleDetailsFor = (rol: string) =>
  ROLE_LABELS[rol] || { text: rol, bg: 'bg-gray-100 text-gray-500 border-gray-200' };

/** Marco común: cabecera con institución activa, avisos y sesión. */
export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, currentInstitution, activeSubdomain, messages, setNavigateToTab } = useApp();

  const unreadMessages = useMemo(() => {
    if (!user) return 0;
    return messages.filter(m => m.destinatario_id === user.id && !m.leido).length;
  }, [messages, user]);

  const roleDetails = user ? roleDetailsFor(user.rol) : { text: '', bg: '' };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 min-h-16 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-q10-50 border border-q10-200 rounded-xl text-q10-600 shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-md font-bold text-gray-900 leading-tight truncate">
              {currentInstitution ? currentInstitution.nombre : 'Portal General'}
            </h1>
            {activeSubdomain && (
              <span className="text-[11px] font-medium text-gray-500 truncate block">
                {activeSubdomain}.plataforma.com
              </span>
            )}
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <button
              onClick={() => setNavigateToTab('messages')}
              className="relative p-2 bg-gray-100 hover:bg-q10-50 border border-gray-200 hover:border-q10-200 text-gray-500 hover:text-q10-600 rounded-xl transition-all"
              title="Mensajes"
            >
              <Bell className="h-5 w-5" />
              {unreadMessages > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </button>

            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-semibold text-gray-800">
                {user.nombre} {user.apellido}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${roleDetails.bg}`}>
                {roleDetails.text}
              </span>
            </div>

            <div className="h-9 w-9 bg-gray-100 rounded-full flex items-center justify-center border border-gray-300 text-q10-600">
              <UserIcon className="h-5 w-5" />
            </div>

            <button
              onClick={logout}
              className="p-2 bg-gray-100 hover:bg-red-50 border border-gray-200 hover:border-red-200 text-gray-500 hover:text-red-600 rounded-xl transition-all"
              title="Cerrar sesión"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="bg-gray-50 border-t border-gray-200 py-4 text-center text-[11px] text-gray-400">
        &copy; {new Date().getFullYear()} Plataforma Educativa Multi-Institución. Entorno de Desarrollo Local.
      </footer>
    </div>
  );
};
