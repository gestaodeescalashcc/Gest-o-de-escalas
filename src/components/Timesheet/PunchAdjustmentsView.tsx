import { useState, useEffect } from 'react';
import { Edit3, Plus, Check, X, AlertCircle, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ToastContainer from '../Common/ToastContainer';
import { useToast } from '../../hooks/useToast';

interface Professional {
  id: string;
  full_name: string;
  registration_number: string;
  department: { name: string };
}

interface Establishment {
  id: string;
  employer_name: string;
}

interface PunchRecord {
  id: string;
  nsr: number;
  punch_type: string;
  punch_datetime: string;
  record_hash: string;
  professional: {
    full_name: string;
  };
}

interface Adjustment {
  id: string;
  original_punch_id: string | null;
  professional_id: string;
  establishment_id: string;
  adjustment_type: string;
  adjusted_datetime: string;
  adjusted_punch_type: string;
  justification: string;
  approval_status: string;
  requested_at: string;
  approved_at: string | null;
  adjustment_hash: string;
  professional: {
    full_name: string;
  };
  original_punch?: {
    nsr: number;
    punch_datetime: string;
    punch_type: string;
  };
}

export default function PunchAdjustmentsView() {
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [punches, setPunches] = useState<PunchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'REJECTED'>('all');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingAdjustmentId, setRejectingAdjustmentId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const { toasts, toast, removeToast } = useToast();

  const [formData, setFormData] = useState({
    professional_id: '',
    establishment_id: '',
    original_punch_id: '',
    adjustment_type: 'INCLUSION',
    adjusted_datetime: '',
    adjusted_punch_type: 'ENTRY',
    justification: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const [adjRes, profRes, estabRes] = await Promise.all([
      supabase
        .from('punch_adjustments')
        .select(`
          *,
          professional:professionals!professional_id(full_name),
          original_punch:punch_records(nsr, punch_datetime, punch_type)
        `)
        .order('requested_at', { ascending: false }),
      supabase
        .from('professionals')
        .select('id, full_name, registration_number, department:departments!department_id(name)')
        .eq('active', true)
        .order('full_name'),
      supabase
        .from('establishments')
        .select('id, employer_name')
        .eq('active', true)
    ]);

    if (adjRes.error) {
      console.error('Error loading adjustments:', adjRes.error);
      toast.error('Erro ao carregar ajustes de marcação.');
    } else if (adjRes.data) {
      setAdjustments(adjRes.data as Adjustment[]);
    }

    if (profRes.error) {
      console.error('Error loading professionals:', profRes.error);
    } else if (profRes.data) {
      setProfessionals(profRes.data as Professional[]);
    }

    if (estabRes.error) {
      console.error('Error loading establishments:', estabRes.error);
    } else if (estabRes.data) {
      setEstablishments(estabRes.data);
    }

    setLoading(false);
  };

  const loadPunches = async (professionalId: string, establishmentId: string) => {
    if (!professionalId || !establishmentId) return;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from('punch_records')
      .select('id, nsr, punch_type, punch_datetime, record_hash, professional:professionals!professional_id(full_name)')
      .eq('professional_id', professionalId)
      .eq('establishment_id', establishmentId)
      .gte('punch_datetime', thirtyDaysAgo.toISOString())
      .order('punch_datetime', { ascending: false });

    if (error) {
      console.error('Error loading punches:', error);
      return;
    }
    if (data) setPunches(data as PunchRecord[]);
  };

  const handleProfessionalChange = (professionalId: string) => {
    setFormData({ ...formData, professional_id: professionalId, original_punch_id: '' });
    if (formData.establishment_id) {
      loadPunches(professionalId, formData.establishment_id);
    }
  };

  const handleEstablishmentChange = (establishmentId: string) => {
    setFormData({ ...formData, establishment_id: establishmentId, original_punch_id: '' });
    if (formData.professional_id) {
      loadPunches(formData.professional_id, establishmentId);
    }
  };

  const generateAdjustmentHash = async (data: string): Promise<string> => {
    const msgBuffer = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.professional_id || !formData.establishment_id || !formData.justification) {
      toast.error('Preencha todos os campos obrigatorios');
      return;
    }

    if (formData.adjustment_type !== 'INCLUSION' && !formData.original_punch_id) {
      toast.error('Selecione a marcacao original para este tipo de ajuste');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: systemUser } = await supabase
      .from('system_users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!systemUser) return;

    const hashData = `${formData.professional_id}|${formData.establishment_id}|${formData.adjustment_type}|${formData.adjusted_datetime}|${new Date().toISOString()}`;
    const adjustmentHash = await generateAdjustmentHash(hashData);

    const { error } = await supabase
      .from('punch_adjustments')
      .insert({
        professional_id: formData.professional_id,
        establishment_id: formData.establishment_id,
        original_punch_id: formData.original_punch_id || null,
        adjustment_type: formData.adjustment_type,
        adjusted_datetime: formData.adjusted_datetime || null,
        adjusted_punch_type: formData.adjusted_punch_type,
        justification: formData.justification,
        requested_by: systemUser.id,
        adjustment_hash: adjustmentHash
      });

    if (error) {
      console.error('Error creating adjustment:', error);
      toast.error('Erro ao criar ajuste: ' + error.message);
      return;
    }

    await supabase.from('punch_audit_log').insert({
      entity_type: 'punch_adjustment',
      entity_id: crypto.randomUUID(),
      action: 'ADJUSTMENT_REQUESTED',
      action_details: {
        professional_id: formData.professional_id,
        adjustment_type: formData.adjustment_type,
        justification: formData.justification
      },
      user_id: user.id
    });

    toast.success('Ajuste criado com sucesso!');
    setShowModal(false);
    setFormData({
      professional_id: '',
      establishment_id: '',
      original_punch_id: '',
      adjustment_type: 'INCLUSION',
      adjusted_datetime: '',
      adjusted_punch_type: 'ENTRY',
      justification: ''
    });
    loadData();
  };

  const handleApproval = async (adjustmentId: string, approved: boolean, reason?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: systemUser } = await supabase
      .from('system_users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!systemUser) return;

    const { error } = await supabase
      .from('punch_adjustments')
      .update({
        approval_status: approved ? 'APPROVED' : 'REJECTED',
        approved_by: systemUser.id,
        approved_at: new Date().toISOString(),
        rejection_reason: reason || null
      })
      .eq('id', adjustmentId);

    if (error) {
      console.error('Error updating adjustment:', error);
      toast.error('Erro ao atualizar ajuste: ' + error.message);
      return;
    }

    await supabase.from('punch_audit_log').insert({
      entity_type: 'punch_adjustment',
      entity_id: adjustmentId,
      action: approved ? 'ADJUSTMENT_APPROVED' : 'ADJUSTMENT_REJECTED',
      action_details: { rejection_reason: reason },
      user_id: user.id
    });

    toast.success(approved ? 'Ajuste aprovado com sucesso!' : 'Ajuste recusado.');
    loadData();
  };

  const handleRejectRequest = (adjustmentId: string) => {
    setRejectingAdjustmentId(adjustmentId);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectingAdjustmentId) return;
    setShowRejectModal(false);
    await handleApproval(rejectingAdjustmentId, false, rejectReason);
    setRejectingAdjustmentId(null);
    setRejectReason('');
  };

  const getAdjustmentTypeLabel = (type: string): string => {
    const types: Record<string, string> = {
      'INCLUSION': 'Inclusao de Marcacao',
      'DISREGARD': 'Desconsiderar Marcacao',
      'PRE_ASSIGNED': 'Pre-assinalacao',
      'CORRECTION': 'Correcao'
    };
    return types[type] || type;
  };

  const getPunchTypeLabel = (type: string): string => {
    const types: Record<string, string> = {
      'ENTRY': 'Entrada',
      'EXIT': 'Saida',
      'MEAL_START': 'Saida Intervalo',
      'MEAL_END': 'Retorno Intervalo'
    };
    return types[type] || type;
  };

  const filteredAdjustments = filter === 'all'
    ? adjustments
    : adjustments.filter(a => a.approval_status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-600 to-amber-700 rounded-xl flex items-center justify-center">
            <Edit3 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ajustes de Ponto</h1>
            <p className="text-gray-600">Conforme Art. 74, IV - Sem alterar registros originais</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Novo Ajuste
        </button>
      </div>

      <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold mb-1">Conformidade Legal - Art. 74, IV</p>
            <p>Ajustes de ponto nao alteram os registros originais. Cada ajuste e um evento separado com justificativa, aprovacao e trilha de auditoria completa.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <span className="text-sm font-medium text-gray-700">Filtrar por status:</span>
          <div className="flex gap-2">
            {[
              { value: 'all', label: 'Todos' },
              { value: 'PENDING', label: 'Pendentes' },
              { value: 'APPROVED', label: 'Aprovados' },
              { value: 'REJECTED', label: 'Rejeitados' }
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value as any)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                  filter === option.value
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando ajustes...</p>
          </div>
        ) : filteredAdjustments.length === 0 ? (
          <div className="text-center py-12">
            <Edit3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Nenhum ajuste encontrado</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAdjustments.map((adjustment) => (
              <div
                key={adjustment.id}
                className={`border-2 rounded-xl p-4 ${
                  adjustment.approval_status === 'PENDING'
                    ? 'border-yellow-300 bg-yellow-50'
                    : adjustment.approval_status === 'APPROVED'
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        adjustment.approval_status === 'PENDING'
                          ? 'bg-yellow-200 text-yellow-800'
                          : adjustment.approval_status === 'APPROVED'
                          ? 'bg-green-200 text-green-800'
                          : 'bg-red-200 text-red-800'
                      }`}>
                        {adjustment.approval_status === 'PENDING' ? 'Pendente' :
                         adjustment.approval_status === 'APPROVED' ? 'Aprovado' : 'Rejeitado'}
                      </span>
                      <span className="px-2 py-1 bg-gray-200 rounded text-xs font-medium text-gray-700">
                        {getAdjustmentTypeLabel(adjustment.adjustment_type)}
                      </span>
                    </div>

                    <h3 className="font-semibold text-gray-900 mb-1">
                      {adjustment.professional?.full_name}
                    </h3>

                    {adjustment.original_punch && (
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Marcacao original:</span> NSR {adjustment.original_punch.nsr} - {getPunchTypeLabel(adjustment.original_punch.punch_type)} em {new Date(adjustment.original_punch.punch_datetime).toLocaleString('pt-BR')}
                      </p>
                    )}

                    {adjustment.adjusted_datetime && (
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Nova marcacao:</span> {getPunchTypeLabel(adjustment.adjusted_punch_type)} em {new Date(adjustment.adjusted_datetime).toLocaleString('pt-BR')}
                      </p>
                    )}

                    <p className="text-sm text-gray-700 mt-2">
                      <span className="font-medium">Justificativa:</span> {adjustment.justification}
                    </p>

                    <p className="text-xs text-gray-500 mt-2">
                      Solicitado em {new Date(adjustment.requested_at).toLocaleString('pt-BR')}
                      {adjustment.approved_at && ` | ${adjustment.approval_status === 'APPROVED' ? 'Aprovado' : 'Rejeitado'} em ${new Date(adjustment.approved_at).toLocaleString('pt-BR')}`}
                    </p>
                  </div>

                  {adjustment.approval_status === 'PENDING' && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleApproval(adjustment.id, true)}
                        className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        title="Aprovar"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleRejectRequest(adjustment.id)}
                        className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                        title="Rejeitar"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-400 font-mono">
                    Hash: {adjustment.adjustment_hash?.substring(0, 32)}...
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Solicitar Ajuste de Ponto</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estabelecimento *
                  </label>
                  <select
                    value={formData.establishment_id}
                    onChange={(e) => handleEstablishmentChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    required
                  >
                    <option value="">Selecione...</option>
                    {establishments.map(e => (
                      <option key={e.id} value={e.id}>{e.employer_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Profissional *
                  </label>
                  <select
                    value={formData.professional_id}
                    onChange={(e) => handleProfessionalChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    required
                  >
                    <option value="">Selecione...</option>
                    {professionals.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Ajuste *
                </label>
                <select
                  value={formData.adjustment_type}
                  onChange={(e) => setFormData({ ...formData, adjustment_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  required
                >
                  <option value="INCLUSION">Inclusao de Marcacao</option>
                  <option value="DISREGARD">Desconsiderar Marcacao</option>
                  <option value="PRE_ASSIGNED">Pre-assinalacao</option>
                  <option value="CORRECTION">Correcao</option>
                </select>
              </div>

              {formData.adjustment_type !== 'INCLUSION' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Marcacao Original *
                  </label>
                  <select
                    value={formData.original_punch_id}
                    onChange={(e) => setFormData({ ...formData, original_punch_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                    required
                  >
                    <option value="">Selecione a marcacao...</option>
                    {punches.map(p => (
                      <option key={p.id} value={p.id}>
                        NSR {p.nsr} - {getPunchTypeLabel(p.punch_type)} - {new Date(p.punch_datetime).toLocaleString('pt-BR')}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(formData.adjustment_type === 'INCLUSION' || formData.adjustment_type === 'CORRECTION') && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tipo de Marcacao *
                      </label>
                      <select
                        value={formData.adjusted_punch_type}
                        onChange={(e) => setFormData({ ...formData, adjusted_punch_type: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                        required
                      >
                        <option value="ENTRY">Entrada</option>
                        <option value="EXIT">Saida</option>
                        <option value="MEAL_START">Saida Intervalo</option>
                        <option value="MEAL_END">Retorno Intervalo</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Data/Hora *
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.adjusted_datetime}
                        onChange={(e) => setFormData({ ...formData, adjusted_datetime: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Justificativa * (minimo 20 caracteres)
                </label>
                <textarea
                  value={formData.justification}
                  onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                  rows={4}
                  placeholder="Descreva o motivo do ajuste..."
                  minLength={20}
                  required
                />
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-gray-600">
                    <p className="font-medium mb-1">Nota Legal</p>
                    <p>Este ajuste sera registrado com hash de integridade e requer aprovacao. O registro original permanece inalterado conforme Art. 74, IV da Portaria MTP 671/2021.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-medium"
                >
                  Solicitar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Motivo da Rejeicao</h2>
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                rows={4}
                placeholder="Descreva o motivo da rejeicao..."
              />
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                >
                  Confirmar Rejeicao
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
