import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../Common/ToastContainer';
import {
  List, Plus, Search, CheckCircle, XCircle, Clock,
  TrendingUp, TrendingDown, AlertTriangle, FileText, ChevronLeft, ChevronRight
} from 'lucide-react';

interface Entry {
  id: string;
  professional_id: string;
  entry_date: string;
  entry_type: 'credit' | 'debit' | 'compensation' | 'expiration' | 'adjustment';
  minutes: number;
  balance_after: number;
  source: string;
  description: string | null;
  multiplier_applied: number;
  original_minutes: number | null;
  expires_at: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'compensated';
  created_at: string;
  professional?: { full_name: string; department_id: string };
  created_by_user?: { full_name: string };
  approved_by_user?: { full_name: string };
}

interface Professional {
  id: string;
  full_name: string;
  department_id: string | null;
}

interface Department {
  id: string;
  name: string;
}

export function HourBankEntriesView() {
  const { user } = useAuth();
  const { toasts, toast, removeToast } = useToast();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  const [formData, setFormData] = useState({
    professional_id: '',
    entry_date: new Date().toISOString().split('T')[0],
    entry_type: 'credit' as 'credit' | 'debit',
    hours: 0,
    minutes: 0,
    description: '',
    multiplier_applied: 1.0,
  });

  useEffect(() => {
    loadDepartments();
    loadProfessionals();
  }, []);

  useEffect(() => {
    loadEntries();
  }, [page, selectedDepartment, statusFilter, typeFilter, dateFrom, dateTo]);

  const loadDepartments = async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .order('name');
    if (error) { console.error('Error loading departments:', error); return; }
    if (data) setDepartments(data);
  };

  const loadProfessionals = async () => {
    const { data, error } = await supabase
      .from('professionals')
      .select('id, full_name, department_id')
      .eq('active', true)
      .order('full_name');
    if (error) { console.error('Error loading professionals:', error); return; }
    if (data) setProfessionals(data);
  };

  const loadEntries = async () => {
    setLoading(true);

    let query = supabase
      .from('hour_bank_entries')
      .select(`
        *,
        professional:professionals!professional_id(full_name, department_id),
        created_by_user:system_users!hour_bank_entries_created_by_fkey(full_name),
        approved_by_user:system_users!hour_bank_entries_approved_by_fkey(full_name)
      `, { count: 'exact' })
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    if (typeFilter !== 'all') {
      query = query.eq('entry_type', typeFilter);
    }

    if (dateFrom) {
      query = query.gte('entry_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('entry_date', dateTo);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('Error loading entries:', error);
      toast.error('Erro ao carregar lançamentos');
      setLoading(false);
      return;
    }

    if (data) {
      let filtered = data as Entry[];

      if (selectedDepartment !== 'all') {
        filtered = filtered.filter(e => e.professional?.department_id === selectedDepartment);
      }

      if (searchTerm) {
        filtered = filtered.filter(e =>
          (e.professional?.full_name ?? '').toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      setEntries(filtered);
      setTotalCount(count || 0);
    }

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const totalMinutes = (formData.hours * 60 + formData.minutes) * (formData.entry_type === 'debit' ? -1 : 1);

    const { data: currentBalance } = await supabase
      .from('hour_bank_entries')
      .select('balance_after')
      .eq('professional_id', formData.professional_id)
      .eq('status', 'approved')
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const balanceAfter = (currentBalance?.balance_after || 0) + totalMinutes;

    const { data: config } = await supabase
      .from('hour_bank_config')
      .select('compensation_period_months')
      .limit(1)
      .maybeSingle();

    const expiresAt = new Date(formData.entry_date);
    expiresAt.setMonth(expiresAt.getMonth() + (config?.compensation_period_months || 6));

    const { error } = await supabase
      .from('hour_bank_entries')
      .insert({
        professional_id: formData.professional_id,
        entry_date: formData.entry_date,
        entry_type: formData.entry_type,
        minutes: totalMinutes,
        balance_after: balanceAfter,
        source: 'manual',
        description: formData.description || null,
        multiplier_applied: formData.multiplier_applied,
        original_minutes: formData.hours * 60 + formData.minutes,
        expires_at: formData.entry_type === 'credit' ? expiresAt.toISOString().split('T')[0] : null,
        created_by: user?.id,
        status: 'pending',
      });

    if (error) {
      toast.error('Erro ao salvar lançamento: ' + error.message);
      return;
    }

    toast.success('Lançamento salvo com sucesso!');
    setShowModal(false);
    setFormData({
      professional_id: '',
      entry_date: new Date().toISOString().split('T')[0],
      entry_type: 'credit',
      hours: 0,
      minutes: 0,
      description: '',
      multiplier_applied: 1.0,
    });
    loadEntries();
  };

  const handleApprove = async (entry: Entry) => {
    const { error } = await supabase
      .from('hour_bank_entries')
      .update({
        status: 'approved',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', entry.id);

    if (error) {
      toast.error('Erro ao aprovar lançamento');
      return;
    }
    toast.success('Lançamento aprovado!');
    loadEntries();
  };

  const handleReject = async (entry: Entry) => {
    const { error } = await supabase
      .from('hour_bank_entries')
      .update({
        status: 'rejected',
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', entry.id);

    if (error) {
      toast.error('Erro ao recusar lançamento');
      return;
    }
    toast.success('Lançamento recusado.');
    loadEntries();
  };

  const formatMinutes = (minutes: number) => {
    const sign = minutes < 0 ? '-' : '+';
    const absMinutes = Math.abs(minutes);
    const h = Math.floor(absMinutes / 60);
    const m = absMinutes % 60;
    return `${sign}${h}h${m > 0 ? ` ${m}min` : ''}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const getEntryTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      credit: 'Credito',
      debit: 'Debito',
      compensation: 'Compensacao',
      expiration: 'Vencimento',
      adjustment: 'Ajuste',
    };
    return labels[type] || type;
  };

  const getEntryTypeIcon = (type: string) => {
    switch (type) {
      case 'credit': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'debit': return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'compensation': return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'expiration': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'adjustment': return <FileText className="w-4 h-4 text-gray-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800',
      compensated: 'bg-blue-100 text-blue-800',
    };
    const labels: Record<string, string> = {
      pending: 'Pendente',
      approved: 'Aprovado',
      rejected: 'Rejeitado',
      expired: 'Vencido',
      compensated: 'Compensado',
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
          <List className="w-6 h-6 text-teal-600" />
          <h2 className="text-xl font-semibold text-gray-900">Lancamentos do Banco de Horas</h2>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Lancamento
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="relative lg:col-span-2">
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
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="all">Todos Departamentos</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="all">Todos Status</option>
            <option value="pending">Pendente</option>
            <option value="approved">Aprovado</option>
            <option value="rejected">Rejeitado</option>
            <option value="expired">Vencido</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="all">Todos Tipos</option>
            <option value="credit">Credito</option>
            <option value="debit">Debito</option>
            <option value="compensation">Compensacao</option>
            <option value="adjustment">Ajuste</option>
          </select>

          <div className="flex gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              placeholder="De"
            />
          </div>
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Multiplicador</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descricao</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vencimento</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    Nenhum lancamento encontrado
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{formatDate(entry.entry_date)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {entry.professional?.full_name}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getEntryTypeIcon(entry.entry_type)}
                        <span className="text-sm text-gray-700">{getEntryTypeLabel(entry.entry_type)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-semibold ${entry.minutes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatMinutes(entry.minutes)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-500">
                      {entry.multiplier_applied}x
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {entry.description || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {entry.expires_at ? formatDate(entry.expires_at) : '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(entry.status)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {entry.status === 'pending' && (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleApprove(entry)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                            title="Aprovar"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleReject(entry)}
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
              <h3 className="text-lg font-semibold text-gray-900">Novo Lancamento</h3>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                <input
                  type="date"
                  value={formData.entry_date}
                  onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={formData.entry_type}
                  onChange={(e) => setFormData({ ...formData, entry_type: e.target.value as 'credit' | 'debit' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="credit">Credito (hora extra)</option>
                  <option value="debit">Debito (falta/atraso)</option>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Multiplicador</label>
                <select
                  value={formData.multiplier_applied}
                  onChange={(e) => setFormData({ ...formData, multiplier_applied: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value={1.0}>1.0x (Normal)</option>
                  <option value={1.5}>1.5x (Hora Extra 50%)</option>
                  <option value={2.0}>2.0x (Domingo/Feriado)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descricao</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Motivo do lancamento..."
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
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                  Salvar
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
