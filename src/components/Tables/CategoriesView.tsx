import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Briefcase } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import ConfirmDialog from '../Common/ConfirmDialog';
import ToastContainer from '../Common/ToastContainer';
import { useToast } from '../../hooks/useToast';

interface Category {
  id: string;
  name: string;
  created_at: string;
}

export default function CategoriesView() {
  const { canCreate: _canCreate, canUpdate: _canUpdate, canDelete: _canDelete } = usePermissions();
  const canCreate = _canCreate('professional_categories');
  const canUpdate = _canUpdate('professional_categories');
  const canDelete = _canDelete('professional_categories');
  const { toasts, toast, removeToast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '' });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('professional_categories')
        .select('*')
        .order('name');

      if (error) {
        console.error('Erro ao carregar categorias:', error);
        toast.error('Erro ao carregar categorias: ' + error.message);
        return;
      }

      if (data) {
        setCategories(data);
      }
    } catch (err) {
      console.error('Erro inesperado:', err);
      toast.error('Erro inesperado ao carregar categorias');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast.warning('Nome é obrigatório');
      return;
    }

    try {
      const { error } = await supabase
        .from('professional_categories')
        .insert({
          name: createForm.name.trim(),
        });

      if (error) {
        console.error('Erro ao criar categoria:', error);
        toast.error('Erro ao criar categoria: ' + error.message);
        return;
      }

      setShowCreateModal(false);
      setCreateForm({ name: '' });
      loadCategories();
    } catch (err) {
      console.error('Erro inesperado:', err);
      toast.error('Erro inesperado ao criar categoria');
    }
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id);
    setEditForm({
      name: category.name,
    });
  };

  const handleSaveEdit = async () => {
    if (!editForm.name.trim()) {
      toast.warning('Nome é obrigatório');
      return;
    }

    try {
      const { error } = await supabase
        .from('professional_categories')
        .update({
          name: editForm.name.trim(),
        })
        .eq('id', editingId);

      if (error) {
        console.error('Erro ao atualizar categoria:', error);
        toast.error('Erro ao atualizar categoria: ' + error.message);
        return;
      }

      setEditingId(null);
      setEditForm({ name: '' });
      loadCategories();
    } catch (err) {
      console.error('Erro inesperado:', err);
      toast.error('Erro inesperado ao atualizar categoria');
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDelete(id);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete;
    setConfirmDelete(null);

    try {
      const { error } = await supabase
        .from('professional_categories')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erro ao excluir categoria:', error);
        toast.error('Erro ao excluir categoria: ' + error.message);
        return;
      }

      loadCategories();
    } catch (err) {
      console.error('Erro inesperado:', err);
      toast.error('Erro inesperado ao excluir categoria');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorias Profissionais</h1>
          <p className="text-sm text-gray-600 mt-1">Gerencie as categorias dos profissionais</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nova Categoria
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Carregando...</div>
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma categoria cadastrada</h3>
          <p className="text-gray-600 mb-6">Comece criando sua primeira categoria profissional</p>
          {canCreate && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nova Categoria
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Nome
                </th>
                {(canUpdate || canDelete) && (
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {categories.map((category) => (
                <tr key={category.id} className="hover:bg-gray-50">
                  {editingId === category.id ? (
                    <>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Nome da categoria"
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={handleSaveEdit}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Salvar"
                          >
                            <Save className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditForm({ name: '' });
                            }}
                            className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                            title="Cancelar"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{category.name}</div>
                      </td>
                      {(canUpdate || canDelete) && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canUpdate && (
                              <button
                                onClick={() => handleEdit(category)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-5 h-5" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(category.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Nova Categoria</h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateForm({ name: '' });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome *
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Médico, Enfermeiro, Técnico..."
                />
              </div>

            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateForm({ name: '' });
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Criar Categoria
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDelete !== null}
        title="Excluir categoria"
        message="Tem certeza que deseja excluir esta categoria? Profissionais vinculados ficarão sem categoria."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
