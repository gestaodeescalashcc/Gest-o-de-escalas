import { useState, useEffect } from 'react';
import { X, User, Shield, AlertCircle, ToggleLeft, ToggleRight, Building2, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../Common/ToastContainer';

interface EditUserModalProps {
  user: {
    id: string;
    email: string;
    full_name: string;
    role_id: string;
    active: boolean;
    allowed_departments: string[] | null;
  };
  onClose: () => void;
  onSuccess: () => void;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: any;
}

interface Department {
  id: string;
  name: string;
}

export default function EditUserModal({ user, onClose, onSuccess }: EditUserModalProps) {
  const { toasts, toast, removeToast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user.full_name,
    role_id: user.role_id,
    active: user.active,
    allowed_departments: user.allowed_departments || [],
    allDepartments: !user.allowed_departments || user.allowed_departments.length === 0,
  });
  const [errors, setErrors] = useState({
    full_name: '',
    role_id: '',
  });

  useEffect(() => {
    loadRoles();
    loadDepartments();
  }, []);

  const loadRoles = async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('*')
      .order('name');

    if (data) setRoles(data);
  };

  const loadDepartments = async () => {
    const { data } = await supabase
      .from('departments')
      .select('*')
      .eq('active', true)
      .order('name');

    if (data) setDepartments(data);
  };

  const validateForm = () => {
    const newErrors = {
      full_name: '',
      role_id: '',
    };
    let isValid = true;

    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Nome completo é obrigatório';
      isValid = false;
    } else if (formData.full_name.trim().length < 3) {
      newErrors.full_name = 'Nome deve ter pelo menos 3 caracteres';
      isValid = false;
    }

    if (!formData.role_id) {
      newErrors.role_id = 'Selecione uma função';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from('system_users')
        .update({
          full_name: formData.full_name,
          role_id: formData.role_id,
          active: formData.active,
          allowed_departments: formData.allDepartments ? null : formData.allowed_departments,
        })
        .eq('id', user.id);

      if (error) throw error;

      onSuccess();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error('Erro ao atualizar usuário: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleDepartment = (deptId: string) => {
    if (formData.allDepartments) return;

    const current = formData.allowed_departments;
    if (current.includes(deptId)) {
      setFormData({
        ...formData,
        allowed_departments: current.filter(id => id !== deptId)
      });
    } else {
      setFormData({
        ...formData,
        allowed_departments: [...current, deptId]
      });
    }
  };

  const selectedRole = roles.find(r => r.id === formData.role_id);
  const isAdmin = selectedRole?.name === 'Administrador';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-700 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Editar Usuário</h2>
            <p className="text-green-100 text-sm mt-1">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Nome Completo *
              </div>
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                errors.full_name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Digite o nome completo do usuário"
            />
            {errors.full_name && (
              <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.full_name}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Função / Perfil de Acesso *
              </div>
            </label>
            <div className="space-y-2">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, role_id: role.id })}
                  className={`w-full text-left p-4 rounded-lg border-2 transition ${
                    formData.role_id === role.id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900">{role.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{role.description}</p>
                    </div>
                    {formData.role_id === role.id && (
                      <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white">
                        ✓
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
            {errors.role_id && (
              <p className="text-red-600 text-sm mt-2 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.role_id}
              </p>
            )}
          </div>

          {selectedRole && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Permissões da Função:</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {Object.entries(selectedRole.permissions).map(([module, perms]: [string, any]) => (
                  <div key={module} className="bg-white rounded p-2 border border-gray-200">
                    <p className="font-bold text-gray-700 capitalize mb-1">{module}</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(perms).map(([action, allowed]: [string, any]) => (
                        allowed && (
                          <span key={action} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                            {action}
                          </span>
                        )
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
            <div className="flex items-start gap-3 mb-4">
              <Building2 className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 mb-1">Restrição por Setor</h4>
                <p className="text-xs text-gray-600">
                  {isAdmin
                    ? 'Administradores têm acesso a todos os setores automaticamente'
                    : 'Selecione os setores que este usuário pode acessar'}
                </p>
              </div>
            </div>

            {!isAdmin && (
              <>
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      allDepartments: !formData.allDepartments,
                      allowed_departments: !formData.allDepartments ? [] : formData.allowed_departments
                    })}
                    className={`w-full p-3 rounded-lg border-2 transition ${
                      formData.allDepartments
                        ? 'border-blue-500 bg-blue-100 text-blue-900'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Acesso a todos os setores</span>
                      {formData.allDepartments && <span className="text-blue-600">✓</span>}
                    </div>
                  </button>
                </div>

                {!formData.allDepartments && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Setores Permitidos:</p>
                    {departments.map((dept) => (
                      <button
                        key={dept.id}
                        type="button"
                        onClick={() => toggleDepartment(dept.id)}
                        className={`w-full text-left p-3 rounded-lg border-2 transition ${
                          formData.allowed_departments.includes(dept.id)
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{dept.name}</span>
                          {formData.allowed_departments.includes(dept.id) && (
                            <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center text-white text-xs">
                              ✓
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                    {formData.allowed_departments.length === 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                        <Info className="w-4 h-4 text-amber-600 mt-0.5" />
                        <p className="text-xs text-amber-900">
                          Nenhum setor selecionado. O usuário não terá acesso a nenhum dado.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {isAdmin && (
              <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 text-center">
                <p className="text-sm font-semibold text-blue-900">
                  Acesso Total Liberado
                </p>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900">Status do Usuário</h4>
                <p className="text-xs text-gray-600 mt-1">
                  {formData.active
                    ? 'Usuário pode acessar o sistema normalmente'
                    : 'Usuário está bloqueado e não pode acessar o sistema'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, active: !formData.active })}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${
                  formData.active
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                {formData.active ? (
                  <>
                    <ToggleRight className="w-5 h-5" />
                    Ativo
                  </>
                ) : (
                  <>
                    <ToggleLeft className="w-5 h-5" />
                    Inativo
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-semibold disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
