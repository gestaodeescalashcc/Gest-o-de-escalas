import { useState, useEffect } from 'react';
import { Loader2, ClipboardList } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../Common/ToastContainer';
import ConfirmDialog from '../Common/ConfirmDialog';
import Modal from '../Common/Modal';

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

const SHIFT_TYPES = [
  { value: 'Manhã', label: 'Manhã' },
  { value: 'Tarde', label: 'Tarde' },
  { value: 'Noite', label: 'Noite' },
  { value: '24h', label: '24 horas' },
  { value: '12h', label: '12 horas' },
];

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

    if (error) {
      console.error('Error loading professionals:', error);
      return;
    }
    if (data) setProfessionals(data as any);
  };

  const loadDepartments = async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .order('name');

    if (error) {
      console.error('Error loading departments:', error);
      return;
    }
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
        if (
          error.message?.includes('duplicate') ||
          error.message?.includes('unique') ||
          error.code === '23505'
        ) {
          toast.error('Este profissional já tem um plantão agendado nessa data e setor.');
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

    if (
      !formData.professional_id ||
      !formData.department_id ||
      !formData.shift_date ||
      !formData.start_time ||
      !formData.end_time
    ) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    const isNightShift =
      formData.shift_type.includes('Noturno') ||
      formData.shift_type.includes('24h') ||
      formData.shift_type === 'Noite';

    if (!isNightShift && formData.start_time >= formData.end_time) {
      setShowTimeConfirm(true);
      return;
    }

    await doCreateShift();
  };

  const isFormValid =
    formData.professional_id &&
    formData.department_id &&
    formData.shift_date &&
    formData.start_time &&
    formData.end_time;

  const inputClass =
    'w-full min-h-[44px] px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5';

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        size="xl"
        closeOnEscape={!loading}
        closeOnOverlayClick={!loading}
        bare
      >
        <div className="px-6 pt-5 pb-4 border-b border-gray-200 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <ClipboardList className="w-5 h-5 text-blue-600" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">Novo Plantão</h2>
            <p className="text-sm text-gray-500 mt-0.5">Agende um plantão avulso</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label htmlFor="shift-prof" className={labelClass}>
                Profissional <span className="text-red-500">*</span>
              </label>
              <select
                id="shift-prof"
                required
                value={formData.professional_id}
                onChange={e => setFormData({ ...formData, professional_id: e.target.value })}
                className={inputClass}
              >
                <option value="">Selecione um profissional</option>
                {professionals.map(prof => (
                  <option key={prof.id} value={prof.id}>
                    {prof.full_name} — {prof.category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="shift-dept" className={labelClass}>
                Setor <span className="text-red-500">*</span>
              </label>
              <select
                id="shift-dept"
                required
                value={formData.department_id}
                onChange={e => setFormData({ ...formData, department_id: e.target.value })}
                className={inputClass}
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
              <label htmlFor="shift-date" className={labelClass}>
                Data <span className="text-red-500">*</span>
              </label>
              <input
                id="shift-date"
                type="date"
                required
                value={formData.shift_date}
                onChange={e => setFormData({ ...formData, shift_date: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="shift-type" className={labelClass}>
                Tipo de Plantão <span className="text-red-500">*</span>
              </label>
              <select
                id="shift-type"
                required
                value={formData.shift_type}
                onChange={e => setFormData({ ...formData, shift_type: e.target.value })}
                className={inputClass}
              >
                {SHIFT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="shift-start" className={labelClass}>
                Hora Início <span className="text-red-500">*</span>
              </label>
              <input
                id="shift-start"
                type="time"
                required
                value={formData.start_time}
                onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="shift-end" className={labelClass}>
                Hora Fim <span className="text-red-500">*</span>
              </label>
              <input
                id="shift-end"
                type="time"
                required
                value={formData.end_time}
                onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="shift-notes" className={labelClass}>
              Observações
            </label>
            <textarea
              id="shift-notes"
              rows={3}
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white resize-y"
              placeholder="Adicione observações sobre o plantão..."
            />
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
              disabled={loading || !isFormValid}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {loading ? 'Criando...' : 'Criar Plantão'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={showTimeConfirm}
        title="Confirmar horário"
        message="O horário de término é anterior ou igual ao horário de início. Está correto? (Apenas turnos noturnos cruzam a meia-noite.)"
        variant="warning"
        confirmLabel="Sim, está correto"
        cancelLabel="Corrigir"
        onConfirm={() => {
          setShowTimeConfirm(false);
          doCreateShift();
        }}
        onCancel={() => setShowTimeConfirm(false)}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
