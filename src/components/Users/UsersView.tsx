import { useState, useEffect } from 'react';
import { Plus, Search, Users as UsersIcon, Shield, Filter, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import UserCard from './UserCard';
import CreateUserModal from './CreateUserModal';
import EditUserModal from './EditUserModal';
import ConfirmDialog from '../Common/ConfirmDialog';
import ToastContainer from '../Common/ToastContainer';
import { useToast } from '../../hooks/useToast';

interface User {
  id: string;
  email: string;
  full_name: string;
  role_id: string;
  active: boolean;
  last_login: string | null;
  created_at: string;
  role: {
    id: string;
    name: string;
    description: string;
    permissions: any;
  };
}

export default function UsersView() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<string | null>(null);
  const [permissions, setPermissions] = useState({
    canCreate: false,
    canRead: false,
    canUpdate: false,
    canDelete: false,
  });
  const { toasts, toast, removeToast } = useToast();

  useEffect(() => {
    loadUserPermissions();
    loadRoles();
  }, []);

  useEffect(() => {
    if (permissions.canRead) {
      loadUsers();
    }
  }, [permissions.canRead]);

  const loadUserPermissions = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('system_users')
        .select('role:user_roles(permissions)')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) throw error;

      if (data?.role?.permissions?.users) {
        setPermissions({
          canCreate: data.role.permissions.users.create || false,
          canRead: data.role.permissions.users.read || false,
          canUpdate: data.role.permissions.users.update || false,
          canDelete: data.role.permissions.users.delete || false,
        });
      }
    } catch (err) {
      console.error('Error loading permissions:', err);
      setError('Erro ao carregar permissões');
    }
  };

  const loadRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('name');

      if (error) throw error;
      if (data) setRoles(data);
    } catch (err) {
      console.error('Error loading roles:', err);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('system_users')
        .select(`
          id,
          email,
          full_name,
          role_id,
          active,
          last_login,
          created_at,
          allowed_departments,
          role:user_roles(id, name, description, permissions)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setUsers(data as any);
    } catch (err: any) {
      console.error('Error loading users:', err);
      setError(err.message || 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRequest = (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;

    if (user.id === currentUser?.id) {
      toast.error('Você não pode excluir seu próprio usuário!');
      return;
    }

    setConfirmDeleteUser(id);
  };

  const handleDelete = async () => {
    if (!confirmDeleteUser) return;

    const user = users.find(u => u.id === confirmDeleteUser);
    if (!user) return;

    const { error } = await supabase
      .from('system_users')
      .delete()
      .eq('id', user.id);

    setConfirmDeleteUser(null);

    if (!error) {
      toast.success('Usuário excluído com sucesso!');
      loadUsers();
    } else {
      toast.error('Erro ao excluir usuário: ' + error.message);
    }
  };

  const filteredUsers = users.filter(user => {
    const fullName = user.full_name || '';
    const email = user.email || '';
    const matchesSearch = fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role_id === filterRole;
    const matchesStatus = filterStatus === 'all' ||
                          (filterStatus === 'active' && user.active) ||
                          (filterStatus === 'inactive' && !user.active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const stats = {
    total: users.length,
    active: users.filter(u => u.active).length,
    inactive: users.filter(u => !u.active).length,
    byRole: roles.map(role => ({
      role,
      count: users.filter(u => u.role_id === role.id).length
    }))
  };

  if (!permissions.canRead) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Acesso Negado</h3>
          <p className="text-gray-600">
            Você não tem permissão para visualizar usuários.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Erro ao Carregar</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              loadUsers();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  const userToDelete = users.find(u => u.id === confirmDeleteUser);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UsersIcon className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestão de Usuários</h1>
            <p className="text-sm text-gray-600">Gerencie usuários e suas permissões</p>
          </div>
        </div>
        {permissions.canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            <Plus className="w-5 h-5" />
            Novo Usuário
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <UsersIcon className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.total}</span>
          </div>
          <p className="text-blue-100 text-sm font-medium">Total de Usuários</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Shield className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.active}</span>
          </div>
          <p className="text-green-100 text-sm font-medium">Usuários Ativos</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{stats.inactive}</span>
          </div>
          <p className="text-red-100 text-sm font-medium">Usuários Inativos</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Shield className="w-8 h-8 opacity-80" />
            <span className="text-3xl font-bold">{roles.length}</span>
          </div>
          <p className="text-purple-100 text-sm font-medium">Funções Disponíveis</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Filter className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filtros</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nome ou email..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Função
            </label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todas as Funções</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name} ({stats.byRole.find(s => s.role.id === role.id)?.count || 0})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos ({stats.total})</option>
              <option value="active">Ativos ({stats.active})</option>
              <option value="inactive">Inativos ({stats.inactive})</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">Carregando usuários...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <UsersIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum usuário encontrado</h3>
          <p className="text-gray-600">
            {searchTerm || filterRole !== 'all' || filterStatus !== 'all'
              ? 'Tente ajustar os filtros de busca'
              : 'Crie o primeiro usuário do sistema'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              onEdit={setEditingUser}
              onDelete={handleDeleteRequest}
              canEdit={permissions.canUpdate && user.id !== currentUser?.id}
              canDelete={permissions.canDelete && user.id !== currentUser?.id}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadUsers();
          }}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            setEditingUser(null);
            loadUsers();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDeleteUser !== null}
        title="Excluir Usuário"
        message={`Tem certeza que deseja excluir o usuário ${userToDelete?.full_name}?\n\nEsta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteUser(null)}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
