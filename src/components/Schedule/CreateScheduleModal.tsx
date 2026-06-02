import { useState, useEffect } from 'react';
import { Calendar, Loader2, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../Common/ToastContainer';
import Modal from '../Common/Modal';

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
  const { allowedDepartments, isAdmin } = usePermissions();
  const { toasts, toast, removeToast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [nameDirty, setNameDirty] = useState(false);

  const [formData, setFormData] = useState({
    department_id: '',
    month: new Date().toISOString().slice(0, 7),
    name: '',
  });

  useEffect(() => {
    loadDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedDepartments]);

  // Auto-generate name only if user hasn't manually edited it
  useEffect(() => {
    if (nameDirty) return;
    if (formData.department_id && formData.month) {
      const dept = departments.find(d => d.id === formData.department_id);
      const [year, month] = formData.month.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 15);
      const monthName = date.toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      });
      const generated = `Escala ${dept?.name || ''} - ${
        monthName.charAt(0).toUpperCase() + monthName.slice(1)
      }`;
      setFormData(prev => ({ ...prev, name: generated }));
    }
  }, [formData.department_id, formData.month, departments, nameDirty]);

  const loadDepartments = async () => {
    let query = supabase.from('departments').select('id, name').eq('active', true).order('name');
    // Admin vê tudo. Coordenador/Gestor vê só os setores permitidos.
    if (!isAdmin() && allowedDepartments && allowedDepartments.length > 0) {
      query = query.in('id', allowedDepartments);
    }
    const { data } = await query;
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
      toast.error('Já existe uma escala para este setor e mês.');
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
      toast.success('Escala criada com sucesso.');
      onSuccess();
    } else {
      toast.error('Erro ao criar escala: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        size="lg"
        closeOnEscape={!loading}
        closeOnOverlayClick={!loading}
        title=""
        bare
      >
        <div className="px-6 pt-5 pb-4 border-b border-gray-200 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5 text-blue-600" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">Nova Escala Mensal</h2>
            <p className="text-sm text-gray-500 mt-0.5">Crie uma nova escala para um setor</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label htmlFor="schedule-dept" className="block text-sm font-medium text-gray-700 mb-1.5">
              Setor <span className="text-red-500">*</span>
            </label>
            <select
              id="schedule-dept"
              required
              value={formData.department_id}
              onChange={e => setFormData({ ...formData, department_id: e.target.value })}
              className="w-full min-h-[44px] px-3 py-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Selecione um setor</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="schedule-month"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              Mês/Ano <span className="text-red-500">*</span>
            </label>
            <input
              id="schedule-month"
              type="month"
              required
              value={formData.month}
              onChange={e => setFormData({ ...formData, month: e.target.value })}
              className="w-full min-h-[44px] px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="schedule-name" className="block text-sm font-medium text-gray-700 mb-1.5">
              Nome da Escala <span className="text-red-500">*</span>
            </label>
            <input
              id="schedule-name"
              type="text"
              required
              value={formData.name}
              onChange={e => {
                setNameDirty(true);
                setFormData({ ...formData, name: e.target.value });
              }}
              className="w-full min-h-[44px] px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ex: Escala Emergência - Janeiro 2026"
            />
            {!nameDirty && formData.department_id && (
              <p className="mt-1 text-xs text-gray-500">
                O nome é gerado automaticamente. Você pode editar livremente.
              </p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-blue-900">
              Após criar a escala, você poderá adicionar profissionais e definir os turnos na
              visualização consolidada.
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="min-h-[44px] px-4 py-2.5 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 transition font-medium disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !formData.department_id || !formData.name}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {loading ? 'Criando...' : 'Criar Escala'}
            </button>
          </div>
        </form>
      </Modal>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
