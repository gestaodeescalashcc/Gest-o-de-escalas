import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../Common/ToastContainer';
import ConfirmDialog from '../Common/ConfirmDialog';

interface CreateShiftModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface Professional {
  id: string;
  full_name: string;
  category: { name: string };
}

interface Department {
  id: string;
  name: string;
}

export default function CreateShiftModal({ onClose, onSuccess }: CreateShiftModalProps) {
  const { user } = useAuth();
  const { toasts, toast, removeToast } = useToast();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTimeConfirm, setShowTimeConfirm] = useState(false);

  const [formData, setFormData] = useState({
    professional_id: '',
    department_id: '',
    shift_date: '',
    start_time: '',
    end_time: '',
    shift_type: 'Manhã',
    notes: '',
  });

  useEffect(() => {
    loadProfessionals();
    loadDepartments();
  }, []);

  const loadProfessionals = async () => {
    const { data, error } = await supabase
      .from('professionals')
      .select('id, full_name, category:professional_categories(name)')
      .eq('active', true)
      .order('full_name');

    if (error) { console.error('Error loading professionals:', error); return; }
    if (data) setProfessionals(data as any);
  };

  const loadDepartments = async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .order('name');

    if (error) { console.error('Error loading departments:', error); return; }
    if (data) setDepartments(data);
  };

  const doCreateShift = async () => {
    setLoading(true);

    try {
      const { error } = await supabase.from('shifts').insert({
        ...formData,
        created_by: user?.id,
        status: 'Agendado',
      });

      if (error) {
        console.error('Error creating shift:', error);

        if (error.message?.includes('duplicate') || error.message?.includes('unique') ||
            error.code === '23505') {
          toast.error('Este profissional já possui um plantão agendado para esta data neste setor.');
        } else {
          toast.error('Erro ao criar plantão: ' + error.message);
        }
        return;
      }

      onSuccess();
    } catch (err: any) {
      console.error('Unexpected error creating shift:', err);
      toast.error('Erro inesperado ao criar plantão.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.professional_id || !formData.department_id || !formData.shift_date ||
        !formData.start_time || !formData.end_time) {
      toast.error('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const isNightShift = formData.shift_type.includes('Noturno') ||
                         formData.shift_type.includes('24h') ||
                         formData.shift_type === 'Noite';

    if (!isNightShift && formData.start_time >= formData.end_time) {
      setShowTimeConfirm(true);
      return;
    }

    await doCreateShift();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Novo Plantão</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profissional *
              </label>
              <select
                required
                value={formData.professional_id}
                onChange={(e) => setFormData({ ...formData, professional_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecione um profissional</option>
                {professionals.map((prof) => (
                  <option key={prof.id} value={prof.id}>
                    {prof.full_name} - {prof.category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Setor *
              </label>
              <select
                required
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                Data *
              </label>
              <input
                type="date"
                required
                value={formData.shift_date}
                onChange={(e) => setFormData({ ...formData, shift_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Plantão *
              </label>
              <select
                required
                value={formData.shift_type}
                onChange={(e) => setFormData({ ...formData, shift_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Manhã">Manhã</option>
                <option value="Tarde">Tarde</option>
                <option value="Noite">Noite</option>
                <option value="24h">24 horas</option>
                <option value="12h">12 horas</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hora Início *
              </label>
              <input
                type="time"
                required
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hora Fim *
              </label>
              <input
                type="time"
                required
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observações
            </label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Adicione observações sobre o plantão..."
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Criando...' : 'Criar Plantão'}
            </button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        isOpen={showTimeConfirm}
        title="Confirmar Horário"
        message="O horário de término é anterior ou igual ao horário de início. Isso é correto? (Apenas turnos noturnos devem cruzar a meia-noite)"
        variant="warning"
        confirmLabel="Sim, está correto"
        cancelLabel="Não, corrigir"
        onConfirm={() => {
          setShowTimeConfirm(false);
          doCreateShift();
        }}
        onCancel={() => setShowTimeConfirm(false)}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
