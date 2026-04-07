import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Wallet, TrendingUp, TrendingDown, AlertTriangle,
  Search, ChevronDown, ChevronUp, Users
} from 'lucide-react';
import ToastContainer from '../Common/ToastContainer';
import { useToast } from '../../hooks/useToast';

interface Professional {
  id: string;
  full_name: string;
  department_id: string;
  company_id: string | null;
  department?: { name: string };
  company?: { name: string };
}

interface BalanceData {
  professional: Professional;
  totalBalance: number;
  totalCredits: number;
  totalDebits: number;
  pendingEntries: number;
  nextExpiration: string | null;
  expiringSoon: number;
}

interface Department {
  id: string;
  name: string;
}

export function HourBankBalanceView() {
  const { toasts, toast, removeToast } = useToast();
  const [balances, setBalances] = useState<BalanceData[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'positive' | 'negative' | 'expiring'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'balance' | 'expiring'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    loadDepartments();
    loadBalances();
  }, []);

  const loadDepartments = async () => {
    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .order('name');
    if (data) setDepartments(data);
  };

  const loadBalances = async () => {
    setLoading(true);

    try {
      const { data: professionals, error: profError } = await supabase
        .from('professionals')
        .select(`
          id, full_name, department_id, company_id,
          department:departments(name),
          company:companies(name)
        `)
        .eq('active', true)
        .order('full_name');

      if (profError) {
        console.error('Error loading professionals:', profError);
        toast.error('Erro ao carregar profissionais.');
        setLoading(false);
        return;
      }

      if (!professionals || professionals.length === 0) {
        setBalances([]);
        setLoading(false);
        return;
      }

      const { data: allEntries, error: entriesError } = await supabase
        .from('hour_bank_entries')
        .select('professional_id, entry_type, minutes, expires_at, status');

      if (entriesError) {
        console.error('Error loading entries:', entriesError);
        toast.error('Erro ao carregar lançamentos do banco de horas.');
      }

      const entries = allEntries || [];
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const today = new Date();

      const balanceList: BalanceData[] = professionals.map(prof => {
        const profEntries = entries.filter(e => e.professional_id === prof.id);
        const approvedEntries = profEntries.filter(e => e.status === 'approved');
        const pendingEntries = profEntries.filter(e => e.status === 'pending').length;

        const totalCredits = approvedEntries
          .filter(e => e.entry_type === 'credit')
          .reduce((sum, e) => sum + e.minutes, 0);

        const totalDebits = approvedEntries
          .filter(e => ['debit', 'compensation', 'expiration'].includes(e.entry_type))
          .reduce((sum, e) => sum + Math.abs(e.minutes), 0);

        const expiringSoonEntries = approvedEntries.filter(e => {
          if (!e.expires_at || e.entry_type !== 'credit') return false;
          const expDate = new Date(e.expires_at);
          return expDate <= thirtyDaysFromNow && expDate > today;
        });

        const expiringSoon = expiringSoonEntries.reduce((sum, e) => sum + e.minutes, 0);
        const nextExpiration = expiringSoonEntries.length > 0
          ? expiringSoonEntries.sort((a, b) =>
              new Date(a.expires_at!).getTime() - new Date(b.expires_at!).getTime()
            )[0].expires_at
          : null;

        return {
          professional: prof as Professional,
          totalBalance: totalCredits - totalDebits,
          totalCredits,
          totalDebits,
          pendingEntries,
          nextExpiration,
          expiringSoon,
        };
      });

      setBalances(balanceList);
    } catch (err) {
      console.error('Error loading balances:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatMinutes = (minutes: number) => {
    const sign = minutes < 0 ? '-' : '';
    const absMinutes = Math.abs(minutes);
    const h = Math.floor(absMinutes / 60);
    const m = absMinutes % 60;
    return `${sign}${h}h${m > 0 ? ` ${m}min` : ''}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const filteredBalances = balances
    .filter(b => {
      if (searchTerm && !b.professional.full_name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (selectedDepartment !== 'all' && b.professional.department_id !== selectedDepartment) {
        return false;
      }
      if (balanceFilter === 'positive' && b.totalBalance <= 0) return false;
      if (balanceFilter === 'negative' && b.totalBalance >= 0) return false;
      if (balanceFilter === 'expiring' && b.expiringSoon <= 0) return false;
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.professional.full_name.localeCompare(b.professional.full_name);
      } else if (sortBy === 'balance') {
        comparison = a.totalBalance - b.totalBalance;
      } else if (sortBy === 'expiring') {
        comparison = b.expiringSoon - a.expiringSoon;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const totalPositive = balances.filter(b => b.totalBalance > 0).reduce((sum, b) => sum + b.totalBalance, 0);
  const totalNegative = balances.filter(b => b.totalBalance < 0).reduce((sum, b) => sum + b.totalBalance, 0);
  const totalExpiring = balances.reduce((sum, b) => sum + b.expiringSoon, 0);

  const toggleSort = (field: 'name' | 'balance' | 'expiring') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Wallet className="w-6 h-6 text-teal-600" />
        <h2 className="text-xl font-semibold text-gray-900">Saldos do Banco de Horas</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <Users className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Profissionais</p>
              <p className="text-xl font-semibold text-gray-900">{balances.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Creditos</p>
              <p className="text-xl font-semibold text-green-600">{formatMinutes(totalPositive)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Debitos</p>
              <p className="text-xl font-semibold text-red-600">{formatMinutes(totalNegative)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Vencendo em 30d</p>
              <p className="text-xl font-semibold text-amber-600">{formatMinutes(totalExpiring)}</p>
            </div>
          </div>
        </div>
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
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="all">Todos os Departamentos</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>

          <select
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value as typeof balanceFilter)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="all">Todos os Saldos</option>
            <option value="positive">Apenas Positivos</option>
            <option value="negative">Apenas Negativos</option>
            <option value="expiring">Com Vencimento Proximo</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Profissional
                    {sortBy === 'name' && (sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Departamento
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleSort('balance')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Saldo
                    {sortBy === 'balance' && (sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Creditos
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Debitos
                </th>
                <th
                  className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleSort('expiring')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Vencendo
                    {sortBy === 'expiring' && (sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                  </div>
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pendentes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredBalances.map((balance) => (
                <tr key={balance.professional.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{balance.professional.full_name}</div>
                    {balance.professional.company && (
                      <div className="text-xs text-gray-500">{(balance.professional.company as { name: string }).name}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {(balance.professional.department as { name: string })?.name || '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-semibold ${
                      balance.totalBalance > 0 ? 'text-green-600' :
                      balance.totalBalance < 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {formatMinutes(balance.totalBalance)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-green-600">
                    +{formatMinutes(balance.totalCredits)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-red-600">
                    -{formatMinutes(balance.totalDebits)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {balance.expiringSoon > 0 ? (
                      <div>
                        <span className="text-amber-600 font-medium">{formatMinutes(balance.expiringSoon)}</span>
                        {balance.nextExpiration && (
                          <div className="text-xs text-gray-500">ate {formatDate(balance.nextExpiration)}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {balance.pendingEntries > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        {balance.pendingEntries}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredBalances.length === 0 && (
            <div className="text-center py-12">
              <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nenhum registro encontrado</p>
            </div>
          )}
        </div>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
