import React from 'react';
import { Key, User as UserIcon, X } from 'lucide-react';
import type { User } from '../../../types';

interface UserDetailModalProps {
  user: User;
  /** Contraseña en claro recordada en esta sesión, si la hay. */
  password?: string;
  onClose: () => void;
}

const Item: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({
  icon, label, children,
}) => (
  <div className="flex items-center gap-2">
    {icon}
    <div>
      <div className="text-[10px] text-white/70">{label}</div>
      <div className="text-sm font-semibold">{children}</div>
    </div>
  </div>
);

/** Credenciales de un usuario de cualquier institución. */
export const UserDetailModal: React.FC<UserDetailModalProps> = ({
  user, password, onClose,
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    onClick={onClose}
  >
    <div
      className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
      onClick={e => e.stopPropagation()}
    >
      <div className="bg-gradient-to-r from-q10-500 to-indigo-600 rounded-t-2xl p-4 sm:p-6 text-white">
        <div className="flex items-start justify-between">
          <h3 className="text-xl font-bold">Credenciales</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 mt-5 pt-4 border-t border-white/20">
          <Item icon={<UserIcon className="h-4 w-4 text-white/70" />} label="Usuario">
            {user.email}
          </Item>
          <Item icon={<Key className="h-4 w-4 text-white/70" />} label="Contraseña">
            {password || 'No disponible'}
          </Item>
        </div>
      </div>

      <div className="p-4 sm:p-6 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl text-sm transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  </div>
);
