import { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../Common/ToastContainer';

interface CreateScheduleModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface Department {
  id: string;
  name: string;
}

export default function CreateScheduleModal({ onClose, onSuccess }: CreateScheduleModalProps) {
  const { user } = useAuth();
  const { toasts, toast, removeToast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    department_id: '',
    month: new Date().toISOString().slice(0, 7),
    name: '',
  });

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    if (formData.department_id && formData.month) {
      const dept = departments.find(d => d.id === formData.department_id);
      const [year, month] = formData.month.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 15);
      const monthName = date.toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric'
      });
      setFormData(prev => ({
        ...prev,
        name: `Escala ${dept?.name || ''} - ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`
      }));
    }
  }, [formData.department_id, formData.month, departments]);

  const loadDepartments = async () => {
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .order('name');

    if (data) setDepartments(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const monthDate = `${formData.month}-01`;

    const { data: existingSchedule } = await supabase
      .from('monthly_schedules')
      .select('id')
      .eq('department_id', formData.department_id)
      .eq('month', monthDate)
      .maybeSingle();

    if (existingSchedule) {
      toast.error('Já existe uma escala para este setor e mês!');
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('monthly_schedules').insert({
      department_id: formData.department_id,
      month: monthDate,
      name: formData.name,
      status: 'Rascunho',
      created_by: user?.id,
    });

    if (!error) {
      toast.success('Escala criada com sucesso!');
      onSuccess();
    } else {
      toast.error('Erro ao criar escala: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Nova Escala Mensal</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Setor *
            </label>
            <select
              required
              value={formData.department_id}
              onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Selecione um setor</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mês/Ano *
            </label>
            <input
              type="month"
              required
              value={formData.month}
              onChange={(e) => setFormData({ ...formData, month: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome da Escala *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: Escala Emergência - Janeiro 2024"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              Uma nova escala mensal será criada. Você poderá adicionar profissionais e definir turnos na visualização consolidada.
            </p>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 font-medium"
            >
              {loading ? 'Criando...' : 'Criar Escala'}
            </button>
          </div>
        </form>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
