import { Edit, Trash2, Shield, Mail, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';

interface UserCardProps {
  user: {
    id: string;
    email: string;
    full_name: string;
    active: boolean;
    last_login: string | null;
    created_at: string;
    role: {
      name: string;
      description: string;
    };
  };
  onEdit: (user: any) => void;
  onDelete: (user: any) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export default function UserCard({ user, onEdit, onDelete, canEdit, canDelete }: UserCardProps) {
  const [showActions, setShowActions] = useState(false);

  const getRoleColor = (roleName: string) => {
    switch (roleName) {
      case 'Administrador':
        return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' };
      case 'Gestor':
        return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' };
      case 'Coordenador':
        return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' };
      case 'Visualizador':
        return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' };
    }
  };

  const roleColor = getRoleColor(user.role.name);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div
      className={`bg-white rounded-xl border-2 ${user.active ? 'border-gray-200' : 'border-red-300'} hover:shadow-lg transition-all`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-full ${roleColor.bg} flex items-center justify-center border-2 ${roleColor.border}`}>
              <span className={`text-xl font-bold ${roleColor.text}`}>
                {getInitials(user.full_name)}
              </span>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900">{user.full_name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">{user.email}</span>
              </div>
            </div>
          </div>

          {user.active ? (
            <CheckCircle className="w-6 h-6 text-green-500" />
          ) : (
            <XCircle className="w-6 h-6 text-red-500" />
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-400" />
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${roleColor.bg} ${roleColor.text}`}>
              {user.role.name}
            </span>
          </div>

          {user.last_login && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4 text-gray-400" />
              <span>
                Último acesso:{' '}
                {new Date(user.last_login).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          )}

          <p className="text-xs text-gray-500">
            Cadastrado em {new Date(user.created_at).toLocaleDateString('pt-BR')}
          </p>
        </div>

        {(canEdit || canDelete) && showActions && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
            {canEdit && (
              <button
                onClick={() => onEdit(user)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
              >
                <Edit className="w-4 h-4" />
                Editar
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(user)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition"
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
