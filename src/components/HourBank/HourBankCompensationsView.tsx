import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../Common/ToastContainer';
import {
  RefreshCw, Plus, Search, CheckCircle, XCircle, Calendar,
  Clock, ChevronLeft, ChevronRight, User
} from 'lucide-react';

interface Compensation {
  id: string;
  professional_id: string;
  compensation_date: string;
  minutes_compensated: number;
  compensation_type: 'folga' | 'saida_antecipada' | 'entrada_tardia' | 'dia_parcial';
  description: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
  professional?: { full_name: string; department_id: string };
  requested_by_user?: { full_name: string };
  approved_by_user?: { full_name: string };
}

interface Professional {
  id: string;
  full_name: string;
  department_id: string;
}

interface BalanceInfo {
  balance: number;
  expiringSoon: number;
}

export function HourBankCompensationsView() {
  const { user } = useAuth();
  const { toasts, toast, removeToast } = useToast();
  const [compensations, setCompensations] = useState<Compensation[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedProfBalance, setSelectedProfBalance] = useState<BalanceInfo | null>(null);
  const pageSize = 20;

  const [formData, setFormData] = useState({
    professional_id: '',
    compensation_date: new Date().toISOString().split('T')[0],
    compensation_type: 'folga' as const,
    hours: 0,
    minutes: 0,
    description: '',
  });

  useEffect(() => {
    loadProfessionals();
    loadCompensations();
  }, []);

  useEffect(() => {
    loadCompensations();
  }, [page, statusFilter]);

  useEffect(() => {
    if (formData.professional_id) {
      loadProfessionalBalance(formData.professional_id);
    } else {
      setSelectedProfBalance(null);
    }
  }, [formData.professional_id]);

  const loadProfessionals = async () => {
    const { data, error } = await supabase
      .from('professionals')
      .select('id, full_name, department_id')
      .eq('active', true)
      .order('full_name');
    if (error) {
      console.error('Error loading professionals:', error);
      return;
    }
    if (data) setProfessionals(data);
  };

  const loadProfessionalBalance = async (professionalId: string) => {
    const { data: entries, error: entriesError } = await supabase
      .from('hour_bank_entries')
      .select('entry_type, minutes, expires_at')
      .eq('professional_id', professionalId)
      .eq('status', 'approved');

    if (entriesError) {
      console.error('Error loading professional balance:', entriesError);
      return;
    }

    if (entries) {
      const credits = entries.filter(e => e.entry_type === 'credit').reduce((sum, e) => sum + e.minutes, 0);
      const debits = entries.filter(e => ['debit', 'compensation', 'expiration'].includes(e.entry_type))
        .reduce((sum, e) => sum + Math.abs(e.minutes), 0);

      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const expiringSoon = entries
        .filter(e => e.expires_at && new Date(e.expires_at) <= thirtyDaysFromNow && new Date(e.expires_at) > new Date())
        .reduce((sum, e) => sum + e.minutes, 0);

      setSelectedProfBalance({
        balance: credits - debits,
        expiringSoon,
      });
    }
  };

  const loadCompensations = async () => {
    setLoading(true);

    let query = supabase
      .from('hour_bank_compensations')
      .select(`
        *,
        professional:professionals(full_name, department_id),
        requested_by_user:system_users!hour_bank_compensations_requested_by_fkey(full_name),
        approved_by_user:system_users!hour_bank_compensations_approved_by_fkey(full_name)
      `, { count: 'exact' })
      .order('compensation_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, count, error: compError } = await query;

    if (compError) {
      console.error('Error loading compensations:', compError);
      toast.error('Erro ao carregar compensações.');
      setLoading(false);
      return;
    }

    if (data) {
      let filtered = data as Compensation[];

      if (searchTerm) {
        filtered = filtered.filter(c =>
          c.professional?.full_name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      setCompensations(filtered);
      setTotalCount(count || 0);
    }

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const totalMinutes = formData.hours * 60 + formData.minutes;

    const { error } = await supabase
      .from('hour_bank_compensations')
      .insert({
        professional_id: formData.professional_id,
        compensation_date: formData.compensation_date,
        compensation_type: formData.compensation_type,
        minutes_compensated: totalMinutes,
        description: formData.description || null,
        requested_by: user?.id,
        status: 'pending',
      });

    if (error) {
      toast.error('Erro ao solicitar compensacao: ' + error.message);
    } else {
      toast.success('Compensacao solicitada com sucesso!');
      setShowModal(false);
      setFormData({
        professional_id: '',
        compensation_date: new Date().toISOString().split('T')[0],
        compensation_type: 'folga',
        hours: 0,
        minutes: 0,
        description: '',
      });
      loadCompensations();
    }
  };

  const handleApprove = async (comp: Compensation) => {
    const { data: currentBalance } = await supabase
      .from('hour_bank_entries')
      .select('balance_after')
      .eq('professional_id', comp.professional_id)
      .eq('status', 'approved')
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const balanceAfter = (currentBalance?.balance_after || 0) - comp.minutes_compensated;

    const { error: entryError } = await supabase.from('hour_bank_entries').insert({
      professional_id: comp.professional_id,
      entry_date: comp.compensation_date,
      entry_type: 'compensation',
      minutes: -comp.minutes_compensated,
      balance_after: balanceAfter,
      source: 'compensation',
      description: `Compensacao: ${getCompensationTypeLabel(comp.compensation_type)}`,
      status: 'approved',
      created_by: user?.id,
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
    });

    if (entryError) {
      toast.error('Erro ao criar lancamento: ' + entryError.message);
      return;
    }

    const { error: approveError } = await supabase
      .from('hour_bank_compensations')
      .update({
        status: 'approved',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', comp.id);

    if (approveError) {
      toast.error('Erro ao aprovar compensacao: ' + approveError.message);
      return;
    }

    toast.success('Compensacao aprovada com sucesso!');
    loadCompensations();
  };

  const handleReject = async (comp: Compensation) => {
    const { error } = await supabase
      .from('hour_bank_compensations')
      .update({
        status: 'rejected',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', comp.id);

    if (error) {
      toast.error('Erro ao rejeitar compensacao: ' + error.message);
      return;
    }

    toast.success('Compensacao rejeitada.');
    loadCompensations();
  };

  const formatMinutes = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h${m > 0 ? ` ${m}min` : ''}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const getCompensationTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      folga: 'Folga',
      saida_antecipada: 'Saida Antecipada',
      entrada_tardia: 'Entrada Tardia',
      dia_parcial: 'Dia Parcial',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    const labels: Record<string, string> = {
      pending: 'Pendente',
      approved: 'Aprovada',
      rejected: 'Rejeitada',
      cancelled: 'Cancelada',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-6 h-6 text-teal-600" />
          <h2 className="text-xl font-semibold text-gray-900">Compensacoes</h2>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Compensacao
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar profissional..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="all">Todos Status</option>
            <option value="pending">Pendente</option>
            <option value="approved">Aprovada</option>
            <option value="rejected">Rejeitada</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profissional</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Horas</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descricao</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Solicitado por</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
                  </td>
                </tr>
              ) : compensations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    Nenhuma compensacao encontrada
                  </td>
                </tr>
              ) : (
                compensations.map((comp) => (
                  <tr key={comp.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{formatDate(comp.compensation_date)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {comp.professional?.full_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {getCompensationTypeLabel(comp.compensation_type)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-teal-600">
                      {formatMinutes(comp.minutes_compensated)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {comp.description || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {comp.requested_by_user?.full_name || '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(comp.status)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {comp.status === 'pending' && (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleApprove(comp)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Aprovar"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleReject(comp)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Rejeitar"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Mostrando {((page - 1) * pageSize) + 1} a {Math.min(page * pageSize, totalCount)} de {totalCount} registros
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-700">
                Pagina {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Solicitar Compensacao</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Profissional</label>
                <select
                  value={formData.professional_id}
                  onChange={(e) => setFormData({ ...formData, professional_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">Selecione...</option>
                  {professionals.map((prof) => (
                    <option key={prof.id} value={prof.id}>{prof.full_name}</option>
                  ))}
                </select>
              </div>

              {selectedProfBalance && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">Saldo disponivel:</span>
                    <span className={`font-semibold ${selectedProfBalance.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatMinutes(selectedProfBalance.balance)}
                    </span>
                  </div>
                  {selectedProfBalance.expiringSoon > 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      {formatMinutes(selectedProfBalance.expiringSoon)} vencendo em 30 dias
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data da Compensacao</label>
                <input
                  type="date"
                  value={formData.compensation_date}
                  onChange={(e) => setFormData({ ...formData, compensation_date: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Compensacao</label>
                <select
                  value={formData.compensation_type}
                  onChange={(e) => setFormData({ ...formData, compensation_type: e.target.value as typeof formData.compensation_type })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="folga">Folga (dia inteiro)</option>
                  <option value="saida_antecipada">Saida Antecipada</option>
                  <option value="entrada_tardia">Entrada Tardia</option>
                  <option value="dia_parcial">Dia Parcial</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Horas</label>
                  <input
                    type="number"
                    value={formData.hours}
                    onChange={(e) => setFormData({ ...formData, hours: parseInt(e.target.value) || 0 })}
                    min={0}
                    max={24}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Minutos</label>
                  <input
                    type="number"
                    value={formData.minutes}
                    onChange={(e) => setFormData({ ...formData, minutes: parseInt(e.target.value) || 0 })}
                    min={0}
                    max={59}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descricao/Motivo</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Motivo da compensacao..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!formData.professional_id || (formData.hours === 0 && formData.minutes === 0)}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Solicitar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
