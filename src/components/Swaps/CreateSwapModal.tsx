import { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, ArrowRight, CheckCircle, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../Common/ToastContainer';

interface CreateSwapModalProps {
  onClose: () => void;
  onSuccess: () => void;
  /**
   * Quando passado, pré-seleciona o plantão original e pula o passo 1.
   * Útil para abrir a troca a partir de uma célula da escala consolidada.
   */
  initialShiftId?: string;
}

interface Shift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  shift_type: string;
  department: { id: string; name: string };
  professional: {
    id: string;
    full_name: string;
    category: { name: string; color: string };
  };
}

interface Professional {
  id: string;
  full_name: string;
  registration_number: string;
  category: { name: string; color: string };
  department: { id: string; name: string };
}

export default function CreateSwapModal({ onClose, onSuccess, initialShiftId }: CreateSwapModalProps) {
  const { user } = useAuth();
  const { toasts, toast, removeToast } = useToast();
  const [step, setStep] = useState(initialShiftId ? 2 : 1);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchShift, setSearchShift] = useState('');
  const [searchProfessional, setSearchProfessional] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterDate, setFilterDate] = useState('');

  const [formData, setFormData] = useState({
    original_shift_id: initialShiftId ?? '',
    target_professional_id: '',
    offered_shift_id: '',
    reason: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  // Se o initialShiftId chegar depois (ou mudar), atualiza o estado
  useEffect(() => {
    if (initialShiftId) {
      setFormData(prev => ({ ...prev, original_shift_id: initialShiftId }));
      if (step === 1) setStep(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialShiftId]);

  const loadData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [shiftsRes, profsRes, deptsRes] = await Promise.all([
        supabase
          .from('shifts')
          .select(`
            id, shift_date, start_time, end_time, shift_type,
            department:departments!department_id (id, name),
            professional:professionals!professional_id (
              id, full_name,
              category:professional_categories!category_id (name, color)
            )
          `)
          .gte('shift_date', today)
          .order('shift_date'),

        supabase
          .from('professionals')
          .select(`
            id, full_name, registration_number,
            category:professional_categories!category_id(name, color),
            department:departments!department_id(id, name)
          `)
          .eq('active', true)
          .order('full_name'),

        supabase
          .from('departments')
          .select('id, name')
          .eq('active', true)
          .order('name')
      ]);

      if (shiftsRes.error) {
        console.error('Erro ao carregar plantões:', shiftsRes.error);
        toast.error('Erro ao carregar plantões');
        return;
      }

      if (profsRes.error) {
        console.error('Erro ao carregar profissionais:', profsRes.error);
        toast.error('Erro ao carregar profissionais');
        return;
      }

      if (deptsRes.error) {
        console.error('Erro ao carregar setores:', deptsRes.error);
        toast.error('Erro ao carregar setores');
        return;
      }

      if (shiftsRes.data) setShifts(shiftsRes.data as any);
      if (profsRes.data) setProfessionals(profsRes.data as any);
      if (deptsRes.data) setDepartments(deptsRes.data);

      // Se foi aberto com initialShiftId, garantir que esse shift está carregado
      // (pode ser de data passada, e o filtro >= today o exclui)
      if (initialShiftId && shiftsRes.data && !shiftsRes.data.some((s: any) => s.id === initialShiftId)) {
        const { data: extraShift } = await supabase
          .from('shifts')
          .select(`
            id, shift_date, start_time, end_time, shift_type,
            department:departments!department_id (id, name),
            professional:professionals!professional_id (
              id, full_name,
              category:professional_categories!category_id (name, color)
            )
          `)
          .eq('id', initialShiftId)
          .maybeSingle();
        if (extraShift) {
          setShifts(prev => [extraShift as any, ...prev]);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      toast.error('Erro ao carregar dados');
    }
  };

  const getSelectedShift = () => shifts.find(s => s.id === formData.original_shift_id);
  const getOfferedShift = () => shifts.find(s => s.id === formData.offered_shift_id);
  const getTargetProfessional = () => professionals.find(p => p.id === formData.target_professional_id);
  const getRequestingProfessionalId = () => getSelectedShift()?.professional.id || '';
  // Médico: regra especial — pode fazer cessão simples e a troca fica Pendente
  // até aprovação da Diretoria Médica.
  const isDoctorFlow = (() => {
    const sel = getSelectedShift();
    const catName = sel?.professional?.category?.name ?? '';
    return /m[eé]dic/i.test(catName);
  })();

  // Step 3: lista de plantões do DESTINATÁRIO que o solicitante pegará em troca.
  // Importante: o shift "oferecido" deve ser do target, não do requesting,
  // para que o swap recíproco aconteça corretamente em handleApprove
  // (original do A → B, offered do B → A).
  const getAvailableShiftsForOffer = () => {
    const targetId = formData.target_professional_id;
    if (!targetId) return [];
    return shifts.filter(s =>
      s.professional.id === targetId &&
      s.id !== formData.original_shift_id
    );
  };

  // Função auxiliar: garantir que offered_shift_id seja resetado quando
  // mudar de target professional (evita oferecer um shift de um profissional
  // que não é mais o destinatário)
  useEffect(() => {
    if (formData.offered_shift_id && formData.target_professional_id) {
      const off = shifts.find(s => s.id === formData.offered_shift_id);
      if (off && off.professional.id !== formData.target_professional_id) {
        setFormData(prev => ({ ...prev, offered_shift_id: '' }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.target_professional_id]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  };

  const formatTime = (time: string) => time.slice(0, 5);

  const isUrgent = (dateStr: string) => {
    const shiftDate = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const diffDays = Math.ceil((shiftDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  };

  const filteredShifts = shifts.filter(shift => {
    const profName = shift.professional?.full_name || '';
    const deptName = shift.department?.name || '';
    const matchesSearch = profName.toLowerCase().includes(searchShift.toLowerCase()) ||
                          deptName.toLowerCase().includes(searchShift.toLowerCase());
    const matchesDate = !filterDate || shift.shift_date === filterDate;
    const matchesDept = filterDepartment === 'all' || shift.department?.id === filterDepartment;
    return matchesSearch && matchesDate && matchesDept;
  });

  const filteredProfessionals = professionals
    .filter(p => p.id !== getRequestingProfessionalId())
    // Mostra apenas profissionais do mesmo setor do plantão original
    // (não faz sentido trocar plantão entre setores diferentes)
    .filter(p => {
      const originalShift = getSelectedShift();
      if (!originalShift?.department?.id) return true;
      return p.department?.id === originalShift.department.id;
    })
    .filter(prof =>
      prof.full_name.toLowerCase().includes(searchProfessional.toLowerCase()) ||
      prof.registration_number.toLowerCase().includes(searchProfessional.toLowerCase())
    );

  const handleSubmit = async () => {
    setLoading(true);
    const requestingProfId = getRequestingProfessionalId();

    try {
      // MÉDICOS: troca vai pra Pendente, aguarda Diretoria Médica. Não aplica
      // mudança em shifts ainda.
      if (isDoctorFlow) {
        const { data: inserted, error: insertError } = await supabase
          .from('shift_swaps')
          .insert({
            original_shift_id: formData.original_shift_id,
            requesting_professional_id: requestingProfId,
            target_professional_id: formData.target_professional_id,
            offered_shift_id: formData.offered_shift_id || null,
            reason: formData.reason.trim() || 'Solicitação de troca',
            status: 'Pendente',
          })
          .select('id');
        if (insertError) throw insertError;
        if (!inserted || inserted.length === 0) {
          throw new Error('A troca não foi registrada (RLS).');
        }
        toast.success('Solicitação enviada. Aguardando aprovação da Diretoria Médica.');
        onSuccess();
        return;
      }

      // FLUXO PADRÃO (não-médicos): RPC atômica que insere swap Aprovado
      // e aplica os UPDATEs nos shifts em uma única transação.
      // Garante consistência (tudo ou nada) e dispara triggers de validação
      // anti-conflito e histórico.
      const { error: rpcError } = await supabase.rpc('create_and_apply_swap', {
        p_original_shift_id: formData.original_shift_id,
        p_offered_shift_id: formData.offered_shift_id,
        p_requesting_professional_id: requestingProfId,
        p_target_professional_id: formData.target_professional_id,
        p_reason: formData.reason,
      });
      if (rpcError) throw rpcError;

      toast.success('Troca aprovada e plantões atualizados.');
      onSuccess();
    } catch (err: any) {
      console.error('Erro ao criar troca:', err);
      toast.error('Erro ao criar troca: ' + (err.message ?? 'tente novamente'));
    } finally {
      setLoading(false);
    }
  };

  const canProceedToStep2 = formData.original_shift_id !== '';
  const canProceedToStep3 = formData.target_professional_id !== '';
  // Para médicos, oferecer plantão é opcional (cessão simples permitida)
  const canProceedToStep4 = isDoctorFlow ? true : formData.offered_shift_id !== '';
  // Motivo é opcional — sempre pode submeter no último passo
  const canSubmit = true;

  const selectedShift = getSelectedShift();
  const targetProf = getTargetProfessional();
  const offeredShift = getOfferedShift();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Nova Troca de Plantão</h2>
            <button onClick={onClose} className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex items-center">
            {[
              { num: 1, label: 'Plantão' },
              { num: 2, label: 'Profissional' },
              { num: 3, label: 'Oferta' },
              { num: 4, label: 'Motivo' },
            ].map((item, index) => (
              <div key={item.num} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm transition ${
                    step >= item.num ? 'bg-white text-blue-600' : 'bg-blue-500 text-white'
                  }`}>
                    {step > item.num ? <CheckCircle className="w-5 h-5" /> : item.num}
                  </div>
                  <span className={`text-xs mt-1 font-medium ${
                    step >= item.num ? 'text-white' : 'text-blue-300'
                  }`}>
                    {item.label}
                  </span>
                </div>
                {index < 3 && (
                  <div className={`flex-1 h-1 mx-2 rounded mt-[-16px] ${step > item.num ? 'bg-white' : 'bg-blue-500'}`} />
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 text-sm font-medium bg-blue-500 rounded-lg px-4 py-2">
            {step === 1 && 'Selecione o plantão que deseja trocar'}
            {step === 2 && 'Escolha com quem deseja trocar'}
            {step === 3 && 'Selecione o plantão que será trocado'}
            {step === 4 && 'Informe o motivo da solicitação'}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            <div className="lg:col-span-2">
              {step === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Buscar profissional ou setor..."
                      value={searchShift}
                      onChange={(e) => setSearchShift(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <select
                      value={filterDepartment}
                      onChange={(e) => setFilterDepartment(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="all">Todos os setores</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>

                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredShifts.map((shift) => {
                      const urgent = isUrgent(shift.shift_date);
                      return (
                        <button
                          key={shift.id}
                          onClick={() => setFormData({ ...formData, original_shift_id: shift.id, offered_shift_id: '' })}
                          className={`w-full text-left p-4 rounded-lg border-2 transition ${
                            formData.original_shift_id === shift.id
                              ? 'border-blue-500 bg-blue-50 shadow-md'
                              : 'border-gray-200 hover:border-blue-300 hover:shadow'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1">
                              <div
                                className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0"
                                style={{ backgroundColor: shift.professional?.category?.color || '#6B7280' }}
                              >
                                {shift.professional?.full_name ? shift.professional.full_name.split(' ').map(n => n[0]).slice(0, 2).join('') : 'NA'}
                              </div>
                              <div className="flex-1">
                                <div className="font-bold text-gray-900">{shift.professional?.full_name || 'N/A'}</div>
                                <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                                  <Calendar className="w-4 h-4" />
                                  <span className="font-semibold">{formatDate(shift.shift_date)}</span>
                                  <Clock className="w-4 h-4 ml-2" />
                                  <span>{formatTime(shift.start_time)}-{formatTime(shift.end_time)}</span>
                                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{shift.shift_type}</span>
                                </div>
                                <div className="text-xs text-gray-500 mt-1">{shift.department?.name || 'Sem setor'}</div>
                              </div>
                            </div>
                            {urgent && (
                              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded flex-shrink-0">
                                URGENTE
                              </span>
                            )}
                            {formData.original_shift_id === shift.id && (
                              <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                    {filteredShifts.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p>Nenhum plantão encontrado</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  {getSelectedShift()?.department?.name && (
                    <div className="flex items-start gap-2 text-sm bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-900">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>
                        Mostrando apenas profissionais do setor{' '}
                        <strong>{getSelectedShift()?.department.name}</strong>.
                      </span>
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Buscar profissional..."
                    value={searchProfessional}
                    onChange={(e) => setSearchProfessional(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredProfessionals.map((prof) => (
                      <button
                        key={prof.id}
                        onClick={() => setFormData({ ...formData, target_professional_id: prof.id })}
                        className={`w-full text-left p-4 rounded-lg border-2 transition ${
                          formData.target_professional_id === prof.id
                            ? 'border-green-500 bg-green-50 shadow-md'
                            : 'border-gray-200 hover:border-green-300 hover:shadow'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1">
                            <div
                              className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                              style={{ backgroundColor: prof.category?.color || '#6B7280' }}
                            >
                              {prof.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-gray-900">{prof.full_name}</h4>
                              <p className="text-sm text-gray-600">{prof.category?.name}</p>
                              <p className="text-xs text-gray-500">{prof.department?.name}</p>
                            </div>
                          </div>
                          {formData.target_professional_id === prof.id && (
                            <CheckCircle className="w-6 h-6 text-green-600" />
                          )}
                        </div>
                      </button>
                    ))}
                    {filteredProfessionals.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                        <p className="font-medium">Nenhum profissional encontrado</p>
                        <p className="text-xs mt-1">
                          A lista mostra apenas profissionais do mesmo setor do plantão original
                          {getSelectedShift()?.department?.name && (
                            <> ({getSelectedShift()?.department.name})</>
                          )}.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className={`${isDoctorFlow ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'} border rounded-lg p-3 text-sm`}>
                    {isDoctorFlow ? (
                      <>
                        <p className="font-semibold mb-1">Médico — escolha como será a troca</p>
                        <p className="text-xs">
                          Você pode <strong>oferecer um plantão em troca</strong> (recíproca)
                          ou <strong>ceder o plantão sem retorno</strong> (cessão simples).
                          A solicitação fica <strong>pendente até aprovação da Diretoria Médica</strong>.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold mb-1">Qual plantão de {getTargetProfessional()?.full_name?.split(' ')[0] ?? 'destinatário'} será assumido por {getSelectedShift()?.professional.full_name?.split(' ')[0] ?? 'solicitante'}?</p>
                        <p className="text-xs">
                          A troca é sempre <strong>recíproca</strong>: cada um troca de dia,
                          todos mantêm o mesmo número de plantões.
                        </p>
                      </>
                    )}
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {/* Opção de cessão simples — apenas para médicos */}
                    {isDoctorFlow && (
                      <button
                        onClick={() => setFormData({ ...formData, offered_shift_id: '' })}
                        className={`w-full text-left p-4 rounded-lg border-2 transition ${
                          !formData.offered_shift_id
                            ? 'border-amber-400 bg-amber-50'
                            : 'border-gray-200 hover:border-amber-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <AlertCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${!formData.offered_shift_id ? 'text-amber-600' : 'text-gray-400'}`} />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-gray-900">Cessão simples (sem retorno)</span>
                              {!formData.offered_shift_id && <CheckCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />}
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              {getTargetProfessional()?.full_name?.split(' ')[0] ?? 'Destinatário'} assume o plantão sem precisar trabalhar no lugar.
                            </p>
                          </div>
                        </div>
                      </button>
                    )}
                    {getAvailableShiftsForOffer().map((shift) => (
                      <button
                        key={shift.id}
                        onClick={() => setFormData({ ...formData, offered_shift_id: shift.id })}
                        className={`w-full text-left p-4 rounded-lg border-2 transition ${
                          formData.offered_shift_id === shift.id
                            ? 'border-emerald-500 bg-emerald-50 shadow-md'
                            : 'border-gray-200 hover:border-emerald-300 hover:shadow'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 text-sm flex-wrap">
                              <Calendar className="w-4 h-4 text-gray-600" />
                              <span className="font-bold text-gray-900">{formatDate(shift.shift_date)}</span>
                              <Clock className="w-4 h-4 text-gray-600 ml-2" />
                              <span>{formatTime(shift.start_time)}-{formatTime(shift.end_time)}</span>
                              <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{shift.shift_type}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{shift.department.name}</div>
                          </div>
                          {formData.offered_shift_id === shift.id && (
                            <CheckCircle className="w-6 h-6 text-emerald-600" />
                          )}
                        </div>
                      </button>
                    ))}

                    {getAvailableShiftsForOffer().length === 0 && (
                      <div className="text-center py-8 px-4 text-gray-600 bg-gray-50 rounded-lg border border-gray-200">
                        <AlertCircle className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                        <p className="font-medium">{getTargetProfessional()?.full_name ?? 'O destinatário'} não tem outros plantões agendados.</p>
                        <p className="text-xs mt-1">Volte e escolha outro profissional para fazer a troca recíproca.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-900">
                    <p className="font-semibold flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" /> Pronto para confirmar
                    </p>
                    <p className="text-xs mt-1">
                      Ao confirmar, a troca será aplicada imediatamente nos plantões.
                      Use o campo abaixo para registrar o motivo (opcional).
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Motivo da troca <span className="text-gray-400 font-normal">(opcional)</span>
                    </label>
                    <textarea
                      rows={6}
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      placeholder="Ex: Acordo entre profissionais, cobertura de feriado, etc."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      O motivo fica registrado no histórico da troca para auditoria.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-1">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border-2 border-gray-200 sticky top-0">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  Resumo da Troca
                </h3>

                {selectedShift ? (
                  <div className="bg-white rounded-lg p-3 mb-3 border border-red-200">
                    <p className="text-xs text-red-600 font-semibold mb-2">TROCAR</p>
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: selectedShift.professional.category?.color }}
                      >
                        {selectedShift.professional.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">{selectedShift.professional.full_name}</p>
                        <p className="text-xs text-gray-600">{selectedShift.professional.category?.name}</p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-700 space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        <span className="font-semibold">{formatDate(selectedShift.shift_date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        <span>{formatTime(selectedShift.start_time)}-{formatTime(selectedShift.end_time)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-100 rounded-lg p-4 mb-3 text-center">
                    <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Selecione um plantão</p>
                  </div>
                )}

                <div className="flex justify-center my-2">
                  <ArrowRight className="w-6 h-6 text-gray-400" />
                </div>

                {targetProf ? (
                  <div className="bg-white rounded-lg p-3 mb-3 border border-green-200">
                    <p className="text-xs text-green-600 font-semibold mb-2">COM</p>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: targetProf.category?.color }}
                      >
                        {targetProf.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">{targetProf.full_name}</p>
                        <p className="text-xs text-gray-600">{targetProf.category?.name}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-100 rounded-lg p-4 mb-3 text-center">
                    <User className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Escolha um profissional</p>
                  </div>
                )}

                {/* Swap recíproco: mostra o plantão do destinatário que volta para o solicitante */}
                {offeredShift && targetProf && selectedShift && (
                  <>
                    <div className="flex justify-center my-2">
                      <ArrowRight className="w-6 h-6 text-emerald-500 transform rotate-180" />
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-emerald-300">
                      <p className="text-xs text-emerald-700 font-semibold mb-2">EM TROCA, PEGARÁ</p>
                      <div className="text-xs text-gray-700 space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          <span className="font-semibold">{formatDate(offeredShift.shift_date)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          <span>{formatTime(offeredShift.start_time)}-{formatTime(offeredShift.end_time)}</span>
                          <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">{offeredShift.shift_type}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                      <p className="text-xs font-semibold text-emerald-800 mb-2">✓ TROCA RECÍPROCA</p>
                      <div className="text-xs text-emerald-900 space-y-1.5">
                        <p>Após aprovação:</p>
                        <p>• <strong>{selectedShift.professional.full_name.split(' ')[0]}</strong> trabalhará {formatDate(offeredShift.shift_date)}</p>
                        <p>• <strong>{targetProf.full_name.split(' ')[0]}</strong> trabalhará {formatDate(selectedShift.shift_date)}</p>
                        <p className="text-emerald-700 mt-1">Ambos mantêm o mesmo número de plantões.</p>
                      </div>
                    </div>
                  </>
                )}

                {formData.reason && (
                  <div className="mt-3 bg-white rounded-lg p-3 border border-blue-200">
                    <p className="text-xs text-blue-600 font-semibold mb-1">MOTIVO</p>
                    <p className="text-xs text-gray-700 line-clamp-3">{formData.reason}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </button>
            )}

            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition"
            >
              Cancelar
            </button>

            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 1 && !canProceedToStep2) ||
                  (step === 2 && !canProceedToStep3) ||
                  (step === 3 && !canProceedToStep4)
                }
                className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Continuar
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading || !canSubmit}
                className="flex-1 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (isDoctorFlow ? 'Enviando...' : 'Aplicando...') : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    {isDoctorFlow ? 'Enviar Solicitação' : 'Confirmar Troca'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
