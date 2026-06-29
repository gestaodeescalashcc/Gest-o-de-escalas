import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../Common/ToastContainer';
import ConfirmDialog from '../Common/ConfirmDialog';

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: string | null;
  recurring: boolean | null;
  active: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export function HolidaysView() {
  const { toasts, toast, removeToast } = useToast();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    date: '',
    type: 'Nacional',
    recurring: false,
  });

  useEffect(() => {
    loadHolidays();
  }, [selectedYear]);

  const loadHolidays = async () => {
    setLoading(true);
    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;

    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date');

    if (error) {
      console.error('Error loading holidays:', error);
      toast.error('Erro ao carregar feriados.');
    } else if (data) {
      setHolidays(data);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let error;

    if (editingId) {
      ({ error } = await supabase
        .from('holidays')
        .update({
          name: formData.name,
          date: formData.date,
          type: formData.type,
          recurring: formData.recurring,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId));
    } else {
      ({ error } = await supabase
        .from('holidays')
        .insert({
          name: formData.name,
          date: formData.date,
          type: formData.type,
          recurring: formData.recurring,
          active: true,
        }));
    }

    if (error) {
      toast.error('Erro ao salvar feriado: ' + error.message);
      return;
    }

    toast.success(editingId ? 'Feriado atualizado com sucesso!' : 'Feriado adicionado com sucesso!');
    setShowModal(false);
    setEditingId(null);
    setFormData({ name: '', date: '', type: 'Nacional', recurring: false });
    loadHolidays();
  };

  const handleEdit = (holiday: Holiday) => {
    setFormData({
      name: holiday.name,
      date: holiday.date,
      type: holiday.type ?? 'Nacional',
      recurring: holiday.recurring ?? false,
    });
    setEditingId(holiday.id);
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const doDelete = async () => {
    if (!deleteConfirmId) return;
    const { error } = await supabase.from('holidays').delete().eq('id', deleteConfirmId);
    setDeleteConfirmId(null);
    if (error) {
      toast.error('Erro ao excluir feriado: ' + error.message);
      return;
    }
    toast.success('Feriado excluído com sucesso!');
    loadHolidays();
  };

  const handleToggleActive = async (holiday: Holiday) => {
    const { error } = await supabase
      .from('holidays')
      .update({ active: !holiday.active, updated_at: new Date().toISOString() })
      .eq('id', holiday.id);
    if (error) {
      toast.error('Erro ao atualizar feriado');
      return;
    }
    loadHolidays();
  };

  const getDayOfWeek = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { weekday: 'long' });
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      Nacional: 'bg-blue-100 text-blue-800',
      Estadual: 'bg-green-100 text-green-800',
      Municipal: 'bg-amber-100 text-amber-800',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[type] || 'bg-gray-100 text-gray-800'}`}>
        {type}
      </span>
    );
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-teal-600" />
          <h2 className="text-xl font-semibold text-gray-900">Feriados</h2>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button
            onClick={() => {
              setFormData({ name: '', date: `${selectedYear}-01-01`, type: 'Nacional', recurring: false });
              setEditingId(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : holidays.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhum feriado cadastrado para {selectedYear}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {holidays.map((holiday) => (
              <div
                key={holiday.id}
                className={`flex items-center justify-between p-4 hover:bg-gray-50 ${!holiday.active ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 text-center">
                    <div className="text-2xl font-bold text-teal-600">
                      {new Date(holiday.date + 'T00:00:00').getDate()}
                    </div>
                    <div className="text-xs text-gray-500 uppercase">
                      {new Date(holiday.date + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' })}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{holiday.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-gray-500 capitalize">{getDayOfWeek(holiday.date)}</span>
                      {getTypeBadge(holiday.type ?? '')}
                      {holiday.recurring && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          Recorrente
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(holiday)}
                    className={`p-2 rounded-lg transition-colors ${
                      holiday.active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'
                    }`}
                    title={holiday.active ? 'Desativar' : 'Ativar'}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(holiday)}
                    className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(holiday.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Editar Feriado' : 'Novo Feriado'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingId(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Ex: Natal"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="Nacional">Nacional</option>
                  <option value="Estadual">Estadual</option>
                  <option value="Municipal">Municipal</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={formData.recurring}
                  onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
                  className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                />
                <label htmlFor="recurring" className="text-sm text-gray-700">
                  Feriado recorrente (repete todo ano)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingId(null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                  {editingId ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        title="Excluir Feriado"
        message="Deseja realmente excluir este feriado?"
        variant="danger"
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={doDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
