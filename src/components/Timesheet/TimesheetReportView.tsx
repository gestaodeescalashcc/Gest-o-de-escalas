import { useState, useEffect } from 'react';
import { FileText, Calendar, Download, Filter, Clock, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ToastContainer from '../Common/ToastContainer';
import { useToast } from '../../hooks/useToast';

interface TimesheetRecord {
  id: string;
  check_in_time: string;
  check_out_time: string | null;
  status: string;
  notes: string | null;
  professional: {
    id: string;
    full_name: string;
    registration_number: string;
    category: { name: string };
    department: { name: string };
  };
  shift: {
    shift_type: string;
    shift_date: string;
  } | null;
}

export default function TimesheetReportView() {
  const { toasts, toast, removeToast } = useToast();
  const [records, setRecords] = useState<TimesheetRecord[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    professional_id: '',
    department_id: '',
    start_date: new Date().toISOString().slice(0, 7) + '-01',
    end_date: new Date().toISOString().slice(0, 10),
    status: '',
  });

  useEffect(() => {
    loadProfessionals();
    loadDepartments();
  }, []);

  useEffect(() => {
    loadRecords();
  }, [filters]);

  const loadProfessionals = async () => {
    try {
      const { data, error } = await supabase
        .from('professionals')
        .select('id, full_name, registration_number')
        .eq('active', true)
        .order('full_name');
      if (error) throw error;
      if (data) setProfessionals(data);
    } catch (err) {
      console.error('Error loading professionals:', err);
      toast.error('Erro ao carregar profissionais.');
    }
  };

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      if (error) throw error;
      if (data) setDepartments(data);
    } catch (err) {
      console.error('Error loading departments:', err);
      toast.error('Erro ao carregar setores.');
    }
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('timesheet_records')
        .select(`
          *,
          professional:professionals!professional_id(
            id,
            full_name,
            registration_number,
            category:professional_categories!category_id(name),
            department:departments!department_id(id, name)
          ),
          shift:shifts(shift_type, shift_date)
        `)
        .gte('check_in_time', filters.start_date)
        .lte('check_in_time', filters.end_date + 'T23:59:59')
        .order('check_in_time', { ascending: false });

      if (filters.professional_id) {
        query = query.eq('professional_id', filters.professional_id);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (data) {
        let filteredData = data as any[];

        if (filters.department_id) {
          filteredData = filteredData.filter(
            (record) => record.professional?.department?.id === filters.department_id
          );
        }

        setRecords(filteredData);
      }
    } catch (err) {
      console.error('Error loading records:', err);
      toast.error('Erro ao carregar registros de ponto.');
    } finally {
      setLoading(false);
    }
  };

  const calculateDuration = (checkIn: string, checkOut: string | null) => {
    if (!checkOut) return 'Em andamento';

    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}h ${minutes}min`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Concluído':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Em andamento':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Incompleto':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const exportToCSV = () => {
    const headers = ['Data/Hora Entrada', 'Data/Hora Saída', 'Profissional', 'Matrícula', 'Setor', 'Função', 'Duração', 'Status', 'Plantão'];
    const rows = records.map(record => [
      new Date(record.check_in_time).toLocaleString('pt-BR'),
      record.check_out_time ? new Date(record.check_out_time).toLocaleString('pt-BR') : '-',
      record.professional?.full_name || '-',
      record.professional?.registration_number || '-',
      record.professional?.department?.name || '-',
      record.professional?.category?.name || '-',
      calculateDuration(record.check_in_time, record.check_out_time),
      record.status,
      record.shift ? `${record.shift.shift_type} (${new Date(record.shift.shift_date + 'T12:00:00').toLocaleDateString('pt-BR')})` : 'Sem plantão vinculado',
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_pontos_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Relatório de Pontos</h1>
            <p className="text-gray-600">Visualize e exporte os registros de ponto</p>
          </div>
        </div>
        <button
          onClick={exportToCSV}
          disabled={records.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-5 h-5" />
          Exportar CSV
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Filtros</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Inicial
            </label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Final
            </label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Setor
            </label>
            <select
              value={filters.department_id}
              onChange={(e) => setFilters({ ...filters, department_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos os setores</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Profissional
            </label>
            <select
              value={filters.professional_id}
              onChange={(e) => setFilters({ ...filters, professional_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos os profissionais</option>
              {professionals.map((prof) => (
                <option key={prof.id} value={prof.id}>
                  {prof.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos os status</option>
              <option value="Em andamento">Em andamento</option>
              <option value="Concluído">Concluído</option>
              <option value="Incompleto">Incompleto</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Registros Encontrados: {records.length}
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando registros...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Nenhum registro encontrado com os filtros selecionados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Profissional</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Setor</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Entrada</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Saída</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Duração</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Plantão</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{record.professional?.full_name}</p>
                        <p className="text-sm text-gray-600">{record.professional?.category?.name}</p>
                        <p className="text-xs text-gray-500">Mat: {record.professional?.registration_number || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {record.professional?.department?.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-green-600" />
                        {new Date(record.check_in_time).toLocaleString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {record.check_out_time ? (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-red-600" />
                          {new Date(record.check_out_time).toLocaleString('pt-BR')}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {calculateDuration(record.check_in_time, record.check_out_time)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {record.shift ? (
                        <div>
                          <p className="font-medium">{record.shift.shift_type}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(record.shift.shift_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-400">Sem plantão</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
