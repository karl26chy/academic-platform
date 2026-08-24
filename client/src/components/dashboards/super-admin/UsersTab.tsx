import React, { useState } from 'react';
import { Edit3, Eye, Trash2 } from 'lucide-react';
import { api } from '../../../services/api';
import { Card, CardTitle, EmptyMessage, TableWrapper, TableHead, TableBody } from '../../ui';
import { CreateUserForm } from './CreateUserForm';
import { EditUserModal } from './EditUserModal';
import { DeleteUserModal } from './DeleteUserModal';
import { UserDetailModal } from './UserDetailModal';
import type { Institution, User } from '../../../types';
import type { Feedback } from './useSuperAdmin';

const ROL_BADGE: Record<string, string> = {
  admin: 'bg-amber-100 text-amber-500',
  teacher: 'bg-emerald-100 text-emerald-500',
  student: 'bg-blue-100 text-blue-600',
};

interface UsersTabProps {
  institutions: Institution[];
  users: User[];
  showMsg: (type: Feedback['type'], text: string) => void;
  getInstName: (instId: string | null) => string;
  onChanged: () => Promise<void>;
}

/** Gestión de usuarios: alta, consulta, edición, borrado y activación. */
export const UsersTab: React.FC<UsersTabProps> = ({
  institutions, users, showMsg, onChanged,
}) => {
  const [selectedInstId, setSelectedInstId] = useState('');
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  // Contraseñas en claro recordadas durante la sesión para poder mostrarlas.
  const [userPasswords, setUserPasswords] = useState<Record<string, string>>({});
  const rememberPassword = (userId: string, password: string) =>
    setUserPasswords(prev => ({ ...prev, [userId]: password }));

  const instUsers = users.filter(u => u.institucion_id === selectedInstId);

  const toggleUserActive = async (target: User) => {
    try {
      await api.updateUser(target.id, { ...target, activo: !target.activo });
      await onChanged();
    } catch {
      showMsg('error', 'Error al cambiar estado.');
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    try {
      await api.deleteUser(deletingUser.id);
      setUserPasswords(prev =>
        Object.fromEntries(Object.entries(prev).filter(([k]) => k !== deletingUser.id))
      );
      setDeletingUser(null);
      showMsg('success', 'Usuario eliminado.');
      await onChanged();
    } catch {
      showMsg('error', 'Error al eliminar usuario.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
      <CreateUserForm
        institutions={institutions}
        selectedInstId={selectedInstId}
        onSelectInst={setSelectedInstId}
        showMsg={showMsg}
        rememberPassword={rememberPassword}
        onChanged={onChanged}
      />

      <Card className="lg:col-span-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <CardTitle className="">Usuarios por Institución</CardTitle>
          <select
            value={selectedInstId}
            onChange={e => setSelectedInstId(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none w-full sm:w-auto min-w-0"
          >
            <option value="">-- Seleccionar Institución --</option>
            {institutions.map(inst => (
              <option key={inst.id} value={inst.id}>{inst.nombre}</option>
            ))}
          </select>
        </div>

        {selectedInstId ? (
          <TableWrapper>
            <TableHead uppercase>
              <th className="pb-3">Nombre</th>
              <th className="pb-3">Email</th>
              <th className="pb-3 text-center">Rol</th>
              <th className="pb-3 text-center">Estado</th>
              <th className="pb-3 text-right">Acción</th>
            </TableHead>
            <TableBody>
              {instUsers.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="py-3 font-medium text-gray-900">{u.nombre} {u.apellido}</td>
                  <td className="py-3 text-gray-500">{u.email}</td>
                  <td className="py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${ROL_BADGE[u.rol] || ROL_BADGE.student}`}>
                      {u.rol}
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                      u.activo ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-400'
                    }`}>
                      {u.activo ? 'Activo' : 'Desactivado'}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setViewUser(u)} title="Ver información"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-q10-600 hover:bg-q10-50 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingUser(u)} title="Editar usuario"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeletingUser(u)} title="Eliminar usuario"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleUserActive(u)}
                        className={`px-2 py-1 rounded text-xs border ${
                          u.activo
                            ? 'bg-red-50 hover:bg-red-50 text-red-400 border-red-100'
                            : 'bg-emerald-50 hover:bg-emerald-950/40 text-emerald-600 border-emerald-100'
                        }`}
                      >
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </TableBody>
          </TableWrapper>
        ) : (
          <EmptyMessage className="text-gray-500 text-sm py-8 text-center">
            Selecciona una institución para ver sus usuarios.
          </EmptyMessage>
        )}
      </Card>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          showMsg={showMsg}
          rememberPassword={rememberPassword}
          onClose={() => setEditingUser(null)}
          onChanged={onChanged}
        />
      )}

      {deletingUser && (
        <DeleteUserModal
          user={deletingUser}
          onCancel={() => setDeletingUser(null)}
          onConfirm={handleDelete}
        />
      )}

      {viewUser && (
        <UserDetailModal
          user={viewUser}
          password={userPasswords[viewUser.id]}
          onClose={() => setViewUser(null)}
        />
      )}
    </div>
  );
};
