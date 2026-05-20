import { useState, useEffect } from 'react';
import { Plus, Search, AlertCircle, Filter, TrendingUp, Clock, CheckCircle, XCircle, Calendar, ChevronLeft, ChevronRight, ArrowRight, Check, X, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import CreateSwapModal from './CreateSwapModal';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import ConfirmDialog from '../Common/ConfirmDialog';
import ToastContainer from '../Common/ToastContainer';
import { useToast } from '../../hooks/useToast';

interface ShiftSwap {
  id: string;
  reason: string;
  status: string;
  requested_at: string;
  responded_at: string | null;
  notes: string | null;
  requesting_professional: {
    id: string;
    full_name: string;
    registration_number: string;
    category: { name: string; color: string };
  };
  target_professional: {
    id: string;
    full_name: string;
    registration_number: string;
    category: { name: string; color: string };
  };
  original_shift: {
    shift_date: string;
    start_time: string;
    end_time: string;
    shift_type: string;
    department: { id: string; name: string };
  };
  offered_shift: {
    shift_date: string;
    start_time: string;
    end_time: string;
    shift_type: string;
    department: { id: string; name: string };
  } | null;
}

interface Department {
  id: string;
  name: string;
}

export default function SwapsView() {
  const { user } = useAuth();
  const { roleName, isAdmin } = usePermissions();
  const isDiretoriaMedica = roleName === 'Diretoria Médica';
  const [swaps, setSwaps] = useState<ShiftSwap[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  // Filtro de mês — vazio = todos os meses (padrão)
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedSwap, setSelectedSwap] = useState<ShiftSwap | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmApproveSwap, setConfirmApproveSwap] = useState<ShiftSwap | null>(null);
  const [confirmCancelSwap, setConfirmCancelSwap] = useState<ShiftSwap | null>(null);
  const { toasts, toast, removeToast } = useToast();

  useEffect(() => {
    loadSwaps();
    loadDepartments();
  }, []);

  const loadSwaps = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shift_swaps')
        .select(`
          *,
          requesting_professional:professionals!shift_swaps_requesting_professional_id_fkey (
            id,
            full_name,
            registration_number,
            category:professional_categories!category_id (name, color)
          ),
          target_professional:professionals!shift_swaps_target_professional_id_fkey (
            id,
            full_name,
            registration_number,
            category:professional_categories!category_id (name, color)
          ),
          original_shift:shifts!shift_swaps_original_shift_id_fkey (
            shift_date,
            start_time,
            end_time,
            shift_type,
            department:departments!department_id (id, name)
          ),
          offered_shift:shifts!shift_swaps_offered_shift_id_fkey (
            shift_date,
            start_time,
            end_time,
            shift_type,
            department:departments!department_id (id, name)
          )
        `)
        .order('requested_at', { ascending: false });

      if (error) throw error;
      if (data) setSwaps(data as any);
    } catch (err) {
      console.error('Error loading swaps:', err);
      toast.error('Erro ao carregar trocas de plantão.');
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .order('name');

      if (error) throw error;
      if (data) setDepartments(data);
    } catch (err) {
      console.error('Error loading departments:', err);
    }
  };

  const filteredSwaps = swaps.filter(swap => {
    const catName = swap.requesting_professional?.category?.name ?? '';
    const isMedical = /m[eé]dic/i.test(catName);
    // Diretoria Médica → só trocas de médicos
    if (isDiretoriaMedica && !isAdmin() && !isMedical) return false;
    // Coordenadora (não-admin, não-DiretoriaMédica) → NÃO vê trocas de médicos
    if (!isDiretoriaMedica && !isAdmin() && roleName === 'Coordenador' && isMedical) return false;
    const matchesStatus = filterStatus === 'all' || swap.status === filterStatus;
    const matchesDepartment = filterDepartment === 'all' ||
      swap.original_shift.department.id === filterDepartment ||
      (swap.offered_shift && swap.offered_shift.department.id === filterDepartment);
    const matchesSearch = !searchTerm ||
      swap.requesting_professional.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      swap.target_professional.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      swap.reason.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesMonth = true;
    if (selectedMonth) {
      const [year, month] = selectedMonth.split('-').map(Number);
      const shiftDate = new Date(swap.original_shift.shift_date + 'T12:00:00');
      matchesMonth = shiftDate.getFullYear() === year && shiftDate.getMonth() + 1 === month;
    }

    return matchesStatus && matchesDepartment && matchesSearch && matchesMonth;
  });

  const getStatusCount = (status: string) => {
    return filteredSwaps.filter(s => s.status === status).length;
  };

  const getUrgentCount = () => {
    return filteredSwaps.filter(swap => {
      const shiftDate = new Date(swap.original_shift.shift_date + 'T00:00:00');
      const today = new Date();
      const diffDays = Math.ceil((shiftDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 7 && diffDays >= 0 && swap.status === 'Pendente';
    }).length;
  };

  const changeMonth = (delta: number) => {
    // Se não há mês selecionado, parte do mês atual
    const base = selectedMonth || (() => {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
    })();
    const [year, month] = base.split('-').map(Number);
    const newDate = new Date(year, month - 1 + delta, 1);
    setSelectedMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const formatMonthYear = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    return new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const formatTime = (time: string) => time.slice(0, 5);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Pendente':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' };
      case 'Aprovado':
        return { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' };
      case 'Recusado':
        return { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' };
      case 'Cancelado':
        return { bg: 'bg-gray-100', text: 'text-gray-800', dot: 'bg-gray-500' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', dot: 'bg-gray-500' };
    }
  };

  const isUrgent = (swap: ShiftSwap) => {
    const shiftDate = new Date(swap.original_shift.shift_date + 'T00:00:00');
    const today = new Date();
    const diffDays = Math.ceil((shiftDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays >= 0 && swap.status === 'Pendente';
  };

  const handleApprove = async (swap: ShiftSwap) => {
    setActionLoading(true);
    try {
      // Aprovação atômica via RPC: troca shifts + marca status em uma única
      // transação no banco. Garante consistência (se algo falhar, nada é aplicado).
      const { error } = await supabase.rpc('approve_shift_swap', { p_swap_id: swap.id });
      if (error) throw error;
      toast.success('Troca aprovada e plantões atualizados com sucesso!');
      loadSwaps();
    } catch (err: any) {
      console.error('Error approving swap:', err);
      toast.error('Erro ao aprovar troca: ' + (err.message || 'Tente novamente.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveRequest = (swap: ShiftSwap) => {
    setConfirmApproveSwap(swap);
  };

  const handleReject = (swap: ShiftSwap) => {
    setSelectedSwap(swap);
    setAdminNotes('');
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!selectedSwap || !adminNotes.trim()) {
      toast.warning('Por favor, informe o motivo da recusa.');
      return;
    }

    setActionLoading(true);
    try {
      // Recusa atômica via RPC: valida motivo, status e salva em uma transação
      const { error } = await supabase.rpc('reject_shift_swap', {
        p_swap_id: selectedSwap.id,
        p_reason: adminNotes,
      });
      if (error) throw error;
      toast.success('Troca recusada com sucesso.');
      setShowRejectModal(false);
      setSelectedSwap(null);
      loadSwaps();
    } catch (err: any) {
      console.error('Error rejecting swap:', err);
      toast.error('Erro ao recusar troca: ' + (err.message ?? 'Tente novamente.'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (swap: ShiftSwap) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('shift_swaps')
        .update({
          status: 'Cancelado',
          responded_at: new Date().toISOString(),
        })
        .eq('id', swap.id);

      if (error) throw error;
      toast.success('Troca cancelada com sucesso.');
      loadSwaps();
    } catch (err) {
      console.error('Error canceling swap:', err);
      toast.error('Erro ao cancelar troca. Tente novamente.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRequest = (swap: ShiftSwap) => {
    setConfirmCancelSwap(swap);
  };

  const openDetails = (swap: ShiftSwap) => {
    setSelectedSwap(swap);
    setShowDetailsModal(true);
  };

  const stats = [
    {
      label: 'Total',
      value: filteredSwaps.length,
      icon: TrendingUp,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Pendentes',
      value: getStatusCount('Pendente'),
      icon: Clock,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
    },
    {
      label: 'Aprovadas',
      value: getStatusCount('Aprovado'),
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Recusadas',
      value: getStatusCount('Recusado'),
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Trocas de Plantões</h2>
          <p className="text-gray-600 mt-1">Gerencie solicitações de troca de plantões</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
        >
          <Plus className="w-5 h-5" />
          Nova Solicitação
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {selectedMonth && (
              <button
                onClick={() => changeMonth(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-blue-600" />
              <span className="text-lg font-semibold text-gray-900 capitalize">
                {selectedMonth ? formatMonthYear(selectedMonth) : 'Todos os meses'}
              </span>
            </div>
            {selectedMonth && (
              <button
                onClick={() => changeMonth(1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                aria-label="Próximo mês"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {selectedMonth && (
              <button
                type="button"
                onClick={() => setSelectedMonth('')}
                className="px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition"
              >
                Todos os meses
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className={`${stat.bg} rounded-xl p-3 border border-transparent`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
              <stat.icon className={`w-8 h-8 ${stat.color}`} />
            </div>
          </div>
        ))}
      </div>

      {getUrgentCount() > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 animate-pulse" />
            <p className="text-sm text-red-700">
              <span className="font-bold">{getUrgentCount()}</span> solicitações urgentes (plantões nos próximos 7 dias)
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar profissional..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">Todos os setores</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-1">
              {['all', 'Pendente', 'Aprovado', 'Recusado'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
                    filterStatus === status
                      ? status === 'all' ? 'bg-blue-600 text-white' :
                        status === 'Pendente' ? 'bg-yellow-500 text-white' :
                        status === 'Aprovado' ? 'bg-green-500 text-white' :
                        'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status === 'all' ? 'Todas' : status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-4">Carregando...</p>
          </div>
        ) : filteredSwaps.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">Nenhuma solicitação encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">De</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase"></th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Para</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Setor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Horário</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSwaps.map((swap) => {
                  const statusStyle = getStatusStyle(swap.status);
                  const urgent = isUrgent(swap);
                  const isPending = swap.status === 'Pendente';

                  return (
                    <tr key={swap.id} className={`hover:bg-gray-50 transition ${urgent ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}></span>
                            {swap.status}
                          </span>
                          {urgent && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded animate-pulse">
                              !
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">
                          {formatDate(swap.original_shift.shift_date)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: swap.requesting_professional.category?.color || '#6B7280' }}
                          >
                            {swap.requesting_professional.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
                              {swap.requesting_professional.full_name.split(' ')[0]}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {swap.requesting_professional.category?.name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <ArrowRight className="w-4 h-4 text-gray-400 mx-auto" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: swap.target_professional.category?.color || '#6B7280' }}
                          >
                            {swap.target_professional.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
                              {swap.target_professional.full_name.split(' ')[0]}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {swap.target_professional.category?.name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">{swap.original_shift.department?.name || 'Sem setor'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700">
                          {formatTime(swap.original_shift.start_time)}-{formatTime(swap.original_shift.end_time)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openDetails(swap)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {isPending && (
                            <>
                              <button
                                onClick={() => handleApproveRequest(swap)}
                                disabled={actionLoading}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition disabled:opacity-50"
                                title="Aprovar"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleReject(swap)}
                                disabled={actionLoading}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                                title="Recusar"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredSwaps.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
              Exibindo <span className="font-semibold">{filteredSwaps.length}</span> solicitação(ões){' '}
              <span className="font-semibold capitalize">
                {selectedMonth ? `em ${formatMonthYear(selectedMonth)}` : 'no total'}
              </span>
            </p>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateSwapModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadSwaps();
          }}
        />
      )}

      {showDetailsModal && selectedSwap && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Detalhes da Troca</h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${getStatusStyle(selectedSwap.status).bg} ${getStatusStyle(selectedSwap.status).text}`}>
                  {selectedSwap.status}
                </span>
                <span className="text-sm text-gray-500">
                  Solicitado em {new Date(selectedSwap.requested_at).toLocaleDateString('pt-BR')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">DE</p>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: selectedSwap.requesting_professional.category?.color || '#6B7280' }}
                    >
                      {selectedSwap.requesting_professional.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{selectedSwap.requesting_professional.full_name}</p>
                      <p className="text-xs text-gray-600">{selectedSwap.requesting_professional.category?.name}</p>
                    </div>
                  </div>
                  <div className="mt-3 text-sm">
                    <p className="text-gray-600">
                      <span className="font-medium">Data:</span> {new Date(selectedSwap.original_shift.shift_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-medium">Horário:</span> {formatTime(selectedSwap.original_shift.start_time)} - {formatTime(selectedSwap.original_shift.end_time)}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-medium">Setor:</span> {selectedSwap.original_shift.department?.name || 'Sem setor'}
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">PARA</p>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: selectedSwap.target_professional.category?.color || '#6B7280' }}
                    >
                      {selectedSwap.target_professional.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{selectedSwap.target_professional.full_name}</p>
                      <p className="text-xs text-gray-600">{selectedSwap.target_professional.category?.name}</p>
                    </div>
                  </div>
                  {selectedSwap.offered_shift && (
                    <div className="mt-3 text-sm">
                      <p className="text-xs font-semibold text-blue-700 mb-1">Plantão oferecido em troca:</p>
                      <p className="text-gray-600">
                        <span className="font-medium">Data:</span> {new Date(selectedSwap.offered_shift.shift_date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                      </p>
                      <p className="text-gray-600">
                        <span className="font-medium">Horário:</span> {formatTime(selectedSwap.offered_shift.start_time)} - {formatTime(selectedSwap.offered_shift.end_time)}
                      </p>
                    </div>
                  )}
                  {!selectedSwap.offered_shift && (
                    <p className="text-xs text-gray-500 mt-3 italic">Sem plantão oferecido em troca</p>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-500 mb-1">MOTIVO</p>
                <p className="text-sm text-gray-700">{selectedSwap.reason}</p>
              </div>

              {selectedSwap.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-amber-700 mb-1">OBSERVAÇÕES DO ADMINISTRADOR</p>
                  <p className="text-sm text-gray-700">{selectedSwap.notes}</p>
                </div>
              )}

              {selectedSwap.status === 'Pendente' && (
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleCancelRequest(selectedSwap)}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      handleReject(selectedSwap);
                    }}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50"
                  >
                    Recusar
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      handleApproveRequest(selectedSwap);
                    }}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition disabled:opacity-50"
                  >
                    Aprovar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showRejectModal && selectedSwap && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">Recusar Solicitação</h3>
              <p className="text-sm text-gray-600 mt-1">Informe o motivo da recusa</p>
            </div>
            <div className="p-6">
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                placeholder="Explique o motivo da recusa..."
              />
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedSwap(null);
                  setAdminNotes('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmReject}
                disabled={actionLoading || !adminNotes.trim()}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition disabled:opacity-50"
              >
                {actionLoading ? 'Processando...' : 'Confirmar Recusa'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={confirmApproveSwap !== null}
        title="Aprovar Troca"
        message="Tem certeza que deseja aprovar esta troca?"
        confirmLabel="Aprovar"
        variant="default"
        onConfirm={() => { if (confirmApproveSwap) handleApprove(confirmApproveSwap); setConfirmApproveSwap(null); }}
        onCancel={() => setConfirmApproveSwap(null)}
      />
      <ConfirmDialog
        isOpen={confirmCancelSwap !== null}
        title="Cancelar Solicitação"
        message="Tem certeza que deseja cancelar esta solicitação?"
        confirmLabel="Cancelar Solicitação"
        variant="danger"
        onConfirm={() => { if (confirmCancelSwap) handleCancel(confirmCancelSwap); setConfirmCancelSwap(null); }}
        onCancel={() => setConfirmCancelSwap(null)}
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
