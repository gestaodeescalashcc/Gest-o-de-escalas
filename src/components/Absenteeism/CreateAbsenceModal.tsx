import { useState, useEffect, useMemo } from 'react';
import { CalendarX, Loader2, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../Common/ToastContainer';
import Modal from '../Common/Modal';
import { AbsenceReason, Absence } from './AbsenteeismView';

interface DeptOption { id: string; name: string }
interface ProfOption { id: string; full_name: string; department_id: string }

interface Props {
  absence: Absence | null;
  reasons: AbsenceReason[];
  departments: DeptOption[];
  professionals: ProfOption[];
  onClose: () => void;
  onSuccess: () => void;
}

const SHIFT_TYPES = ['SD', 'SN', 'M', 'M2', 'T', 'MT', 'P'];

export default function CreateAbsenceModal({
  absence, reasons, departments, professionals, onClose, onSuccess,
}: Props) {
  const { user } = useAuth();
  const { toasts, toast, removeToast } = useToast();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    professional_id: absence?.professional_id ?? '',
    department_id: absence?.department_id ?? '',
    reason_id: absence?.reason_id ?? '',
    start_date: absence?.start_date ?? new Date().toISOString().slice(0, 10),
    end_date: absence?.end_date ?? new Date().toISOString().slice(0, 10),
    shift_type: absence?.shift_type ?? 'SD',
    hours_per_day: absence?.hours_per_day ?? 12,
    is_justified: absence?.is_justified ?? false,
    has_coverage: absence?.has_coverage ?? false,
    coverage_professional_id: absence?.coverage_professional_id ?? '',
    observation: absence?.observation ?? '',
  });

  const isEdit = absence !== null;

  // Quando seleciona um profissional, auto-preencher department_id
  useEffect(() => {
    if (form.professional_id && !form.department_id) {
      const prof = professionals.find(p => p.id === form.professional_id);
      if (prof?.department_id) {
        setForm(f => ({ ...f, department_id: prof.department_id }));
      }
    }
  }, [form.professional_id]);

  // Quando muda o motivo, ajusta default_justified
  useEffect(() => {
    if (form.reason_id && !isEdit) {
      const r = reasons.find(x => x.id === form.reason_id);
      if (r) {
        setForm(f => ({ ...f, is_justified: r.default_justified }));
      }
    }
  }, [form.reason_id]);

  // Filtrar profissionais pelo setor selecionado (se houver)
  const filteredProfs = useMemo(() => {
    if (!form.department_id) return professionals;
    return professionals.filter(p => p.department_id === form.department_id);
  }, [professionals, form.department_id]);

  const filteredCoverageProfs = useMemo(() => {
    return filteredProfs.filter(p => p.id !== form.professional_id);
  }, [filteredProfs, form.professional_id]);

  const daysCount = useMemo(() => {
    if (!form.start_date || !form.end_date) return 0;
    const s = new Date(form.start_date + 'T12:00:00');
    const e = new Date(form.end_date + 'T12:00:00');
    return Math.round((e.getTime() - s.getTime()) / (86400000)) + 1;
  }, [form.start_date, form.end_date]);

  const isFormValid =
    form.professional_id &&
    form.reason_id &&
    form.start_date &&
    form.end_date &&
    daysCount > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        professional_id: form.professional_id,
        department_id: form.department_id || null,
        reason_id: form.reason_id,
        start_date: form.start_date,
        end_date: form.end_date,
        shift_type: form.shift_type || null,
        hours_per_day: Number(form.hours_per_day) || 0,
        is_justified: form.is_justified,
        has_coverage: form.has_coverage,
        coverage_professional_id: form.has_coverage && form.coverage_professional_id
          ? form.coverage_professional_id
          : null,
        observation: form.observation?.trim() || null,
      };
      let error;
      if (isEdit && absence) {
        ({ error } = await supabase.from('absences').update(payload).eq('id', absence.id));
      } else {
        ({ error } = await supabase.from('absences').insert({ ...payload, created_by: user?.id }));
      }
      if (error) throw error;
      toast.success(isEdit ? 'Registro atualizado.' : 'Registro criado com sucesso.');
      onSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar: ' + (err.message ?? 'desconhecido'));
    } finally {
      setLoading(false);
    }
  }

  const inputClass = 'w-full min-h-[44px] px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white';
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
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <CalendarX className="w-5 h-5 text-red-600" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">
              {isEdit ? 'Editar Registro' : 'Registrar Absenteísmo'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Falta, atestado, licença ou outra exceção da escala
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label htmlFor="abs-prof" className={labelClass}>
                Profissional <span className="text-red-500">*</span>
              </label>
              <select
                id="abs-prof"
                required
                value={form.professional_id}
                onChange={e => setForm({ ...form, professional_id: e.target.value })}
                className={inputClass}
              >
                <option value="">Selecione um profissional</option>
                {filteredProfs.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="abs-dept" className={labelClass}>Setor</label>
              <select
                id="abs-dept"
                value={form.department_id}
                onChange={e => setForm({ ...form, department_id: e.target.value })}
                className={inputClass}
              >
                <option value="">—</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="abs-reason" className={labelClass}>
                Motivo <span className="text-red-500">*</span>
              </label>
              <select
                id="abs-reason"
                required
                value={form.reason_id}
                onChange={e => setForm({ ...form, reason_id: e.target.value })}
                className={inputClass}
              >
                <option value="">Selecione</option>
                {reasons.map(r => (
                  <option key={r.id} value={r.id}>
                    [{r.shift_code}] {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="abs-start" className={labelClass}>
                Data início <span className="text-red-500">*</span>
              </label>
              <input
                id="abs-start"
                type="date"
                required
                value={form.start_date}
                onChange={e => setForm({ ...form, start_date: e.target.value, end_date: form.end_date < e.target.value ? e.target.value : form.end_date })}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="abs-end" className={labelClass}>
                Data fim <span className="text-red-500">*</span>
              </label>
              <input
                id="abs-end"
                type="date"
                required
                min={form.start_date}
                value={form.end_date}
                onChange={e => setForm({ ...form, end_date: e.target.value })}
                className={inputClass}
              />
              {daysCount > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {daysCount} dia{daysCount > 1 ? 's' : ''} · {daysCount * Number(form.hours_per_day || 0)}h totais
                </p>
              )}
            </div>

            <div>
              <label htmlFor="abs-shift" className={labelClass}>Turno afetado</label>
              <select
                id="abs-shift"
                value={form.shift_type ?? ''}
                onChange={e => setForm({ ...form, shift_type: e.target.value })}
                className={inputClass}
              >
                <option value="">—</option>
                {SHIFT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="abs-hours" className={labelClass}>Horas/dia</label>
              <input
                id="abs-hours"
                type="number"
                min="0"
                step="0.5"
                value={form.hours_per_day}
                onChange={e => setForm({ ...form, hours_per_day: Number(e.target.value) })}
                className={inputClass}
              />
            </div>

            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={form.is_justified}
                  onChange={e => setForm({ ...form, is_justified: e.target.checked })}
                  className="mt-0.5 h-5 w-5 text-blue-600 rounded"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Justificada?</div>
                  <div className="text-xs text-gray-500">Apresentou documento/justificativa</div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={form.has_coverage}
                  onChange={e => setForm({ ...form, has_coverage: e.target.checked })}
                  className="mt-0.5 h-5 w-5 text-blue-600 rounded"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Houve cobertura?</div>
                  <div className="text-xs text-gray-500">Outro profissional cobriu o turno</div>
                </div>
              </label>
            </div>

            {form.has_coverage && (
              <div className="md:col-span-2">
                <label htmlFor="abs-cov" className={labelClass}>Quem cobriu?</label>
                <select
                  id="abs-cov"
                  value={form.coverage_professional_id ?? ''}
                  onChange={e => setForm({ ...form, coverage_professional_id: e.target.value })}
                  className={inputClass}
                >
                  <option value="">—</option>
                  {filteredCoverageProfs.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="md:col-span-2">
              <label htmlFor="abs-obs" className={labelClass}>Observações</label>
              <textarea
                id="abs-obs"
                rows={2}
                value={form.observation ?? ''}
                onChange={e => setForm({ ...form, observation: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white resize-y"
                placeholder="Ex: Apresentou atestado de 2 dias, anexo CRM 12345"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-blue-900">
              Este registro será aplicado sobre a escala planejada na visualização da escala realizada.
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="min-h-[44px] px-4 py-2.5 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 transition font-medium disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !isFormValid}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {loading ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Registrar'}
            </button>
          </div>
        </form>
      </Modal>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
