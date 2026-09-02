import { useState, useEffect } from 'react';
import { Plus, Search, Calendar, Eye, Trash2, FileText, Filter, Building2, Clock, AlertTriangle, FileSpreadsheet, ArrowLeft, Download, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { setCurrentSetor } from '../../lib/setorContext';
import ShiftCard from './ShiftCard';
import CreateShiftModal from './CreateShiftModal';
import CreateScheduleModal from './CreateScheduleModal';
import ImportScheduleModal from './ImportScheduleModal';
import ConfirmDialog from '../Common/ConfirmDialog';
import ToastContainer from '../Common/ToastContainer';
import { useToast } from '../../hooks/useToast';
import { usePermissions } from '../../hooks/usePermissions';

interface Shift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  shift_type: string;
  status: string;
  notes: string;
  professional: {
    full_name: string;
    category: {
      name: string;
      color: string;
    };
  };
  department: {
    name: string;
  };
}

interface MonthlySchedule {
  id: string;
  name: string;
  month: string;
  status: string;
  created_at: string;
  department: {
    id: string;
    name: string;
  };
}

interface ScheduleViewProps {
  onNavigateToSchedule?: (scheduleId: string) => void;
  /** Setor (department_id) para pré-filtrar a lista — vindo do hub de Escala Médica. */
  initialDepartment?: string;
}

export default function ScheduleView({ onNavigateToSchedule, initialDepartment }: ScheduleViewProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [schedules, setSchedules] = useState<MonthlySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateScheduleModal, setShowCreateScheduleModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'schedules' | 'shifts'>('schedules');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDepartment, setFilterDepartment] = useState<string>(initialDepartment ?? '');
  // Filtro de mês opcional — começa vazio (mostra todas as escalas)
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('');
  const [deletingAll, setDeletingAll] = useState(false);
  const [exportingBatch, setExportingBatch] = useState(false);
  const [generatingConsolidado, setGeneratingConsolidado] = useState(false);
  const { toasts, toast, removeToast } = useToast();
  const { isAdmin, allowedDepartments } = usePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    loadDepartments();
  }, []);

  // Quando o hub de setores navega com ?setor=<id> e o componente já está
  // montado, o React Router não remonta — então sincronizamos o filtro aqui.
  useEffect(() => {
    if (initialDepartment) setFilterDepartment(initialDepartment);
  }, [initialDepartment]);

  // Mantém o "setor atual" (contexto fixo) sempre que há um setor selecionado.
  useEffect(() => {
    if (filterDepartment) {
      const name = departments.find(d => d.id === filterDepartment)?.name;
      setCurrentSetor(filterDepartment, name);
    }
  }, [filterDepartment, departments]);

  useEffect(() => {
    if (viewMode === 'schedules') {
      loadSchedules();
    } else {
      loadShifts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, allowedDepartments]);

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

  const loadSchedules = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('monthly_schedules')
        .select(`
          *,
          department:departments!department_id(id, name)
        `)
        .order('month', { ascending: false })
        .order('created_at', { ascending: false });

      // Filtrar pelos setores permitidos quando usuário não é admin
      if (!isAdmin() && allowedDepartments && allowedDepartments.length > 0) {
        query = query.in('department_id', allowedDepartments);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (data) setSchedules(data as any);
    } catch (err) {
      console.error('Error loading schedules:', err);
      toast.error('Erro ao carregar escalas.');
    } finally {
      setLoading(false);
    }
  };

  const loadShifts = async () => {
    setLoading(true);
    try {
      const startDate = getStartDate();
      const endDate = getEndDate();

      const { data, error } = await supabase
        .from('shifts')
        .select(`
          *,
          professional:professionals!professional_id (
            full_name,
            category:professional_categories!category_id (
              name,
              color
            )
          ),
          department:departments!department_id (
            name
          )
        `)
        .gte('shift_date', startDate)
        .lte('shift_date', endDate)
        .order('shift_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      if (data) setShifts(data as any);
    } catch (err) {
      console.error('Error loading shifts:', err);
      toast.error('Erro ao carregar plantões.');
    } finally {
      setLoading(false);
    }
  };

  const getStartDate = () => {
    const date = new Date(currentDate);
    date.setDate(1);
    return date.toISOString().split('T')[0];
  };

  const getEndDate = () => {
    const date = new Date(currentDate);
    date.setMonth(date.getMonth() + 1, 0);
    return date.toISOString().split('T')[0];
  };

  const handleDeleteRequest = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleDeleteSchedule = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);

    try {
      const { count, error: countError } = await supabase
        .from('shifts')
        .select('*', { count: 'exact', head: true })
        .eq('schedule_id', id);

      if (countError) throw countError;

      if (count && count > 0) {
        toast.error('Não é possível excluir esta escala pois existem plantões associados a ela. Exclua os plantões primeiro.');
        return;
      }

      const { error } = await supabase.from('monthly_schedules').delete().eq('id', id);
      if (error) throw error;

      toast.success('Escala excluída com sucesso.');
      loadSchedules();
    } catch (err: any) {
      console.error('Error deleting schedule:', err);
      toast.error('Erro ao excluir escala: ' + (err.message || 'Tente novamente.'));
    }
  };

  // Exclusão em massa de TODAS as escalas (e seus plantões)
  const handleDeleteAllSchedules = async () => {
    if (deleteAllConfirmText !== 'EXCLUIR TUDO') return;
    setDeletingAll(true);
    try {
      // 1) Apaga shifts vinculados às escalas visíveis (respeita filtro de departamento)
      const ids = filteredSchedules.map(s => s.id);
      if (ids.length === 0) {
        toast.error('Nenhuma escala para excluir.');
        return;
      }
      const { error: shiftsErr } = await supabase
        .from('shifts')
        .delete()
        .in('schedule_id', ids);
      if (shiftsErr) throw shiftsErr;

      const { error: schedulesErr } = await supabase
        .from('monthly_schedules')
        .delete()
        .in('id', ids);
      if (schedulesErr) throw schedulesErr;

      toast.success(`${ids.length} escala(s) e seus plantões foram excluídos.`);
      setShowDeleteAllModal(false);
      setDeleteAllConfirmText('');
      loadSchedules();
    } catch (err: any) {
      console.error('Erro ao excluir todas as escalas:', err);
      toast.error('Erro ao excluir todas as escalas: ' + (err.message || 'Tente novamente.'));
    } finally {
      setDeletingAll(false);
    }
  };

  // Exportação em lote: gera 1 .xlsx por escala e empacota tudo num único
  // .zip (evita disparar N downloads separados do navegador). Usa o código
  // corrente do plantão (shift_type) — não aplica overlay de ausências nem
  // distingue Planejada/Realizada; é um snapshot pra arquivo/backup, não a
  // visão operacional do dia a dia (essa já existe na grade, uma de cada vez).
  // Consolidado Mensal de Frequência da FESF. Com setor no filtro sai o do
  // setor; sem setor, o do hospital inteiro — que é o arquivo que o RH hoje
  // monta juntando as planilhas de todos os setores na mão.
  const handleGerarConsolidado = async () => {
    if (!filterMonth) {
      toast.warning('Escolha o mês no filtro acima para gerar o consolidado.');
      return;
    }
    setGeneratingConsolidado(true);
    try {
      const { gerarConsolidado } = await import('../../services/consolidado');
      const dept = filterDepartment ? departments.find(d => d.id === filterDepartment) : undefined;
      const { linhas, arquivo } = await gerarConsolidado({
        mes: filterMonth,
        departmentIds: filterDepartment ? [filterDepartment] : undefined,
        servicoPrograma: dept?.name,
      });
      if (linhas === 0) {
        toast.warning('Nenhuma frequência nesse mês — o consolidado saiu em branco.');
      } else {
        toast.success(`Consolidado gerado com ${linhas} profissionais: ${arquivo}`);
      }
    } catch (err: any) {
      console.error('Erro ao gerar consolidado:', err);
      toast.error('Erro ao gerar consolidado: ' + (err?.message ?? 'desconhecido'));
    } finally {
      setGeneratingConsolidado(false);
    }
  };

  const exportSchedulesBatch = async (schedulesToExport: MonthlySchedule[]) => {
    if (schedulesToExport.length === 0) {
      toast.error('Nenhuma escala para exportar.');
      return;
    }
    setExportingBatch(true);
    try {
      const [{ generateScheduleExcelBuffer }, { getShiftByName }, JSZipModule] = await Promise.all([
        import('../../utils/excelExport'),
        import('../../lib/shiftTypes'),
        import('jszip'),
      ]);
      const JSZip = JSZipModule.default;
      const zip = new JSZip();
      let failCount = 0;

      for (const schedule of schedulesToExport) {
        try {
          const monthStr = schedule.month.slice(0, 7);
          const { data: shiftsData, error: shiftsErr } = await supabase
            .from('shifts')
            .select('professional_id, shift_date, shift_type, deleted_in_realizada_at')
            .eq('schedule_id', schedule.id);
          if (shiftsErr) throw shiftsErr;

          const profIds = Array.from(new Set((shiftsData ?? []).map((s: any) => s.professional_id).filter(Boolean)));
          if (profIds.length === 0) continue;

          const { data: profsData, error: profsErr } = await supabase
            .from('professionals')
            .select('id, full_name, registration_number, coren, contracted_hours_per_month, category:professional_categories(name)')
            .in('id', profIds);
          if (profsErr) throw profsErr;

          const shiftsByProf = new Map<string, Map<number, string>>();
          const codesByProfDay = new Map<string, string[]>();
          (shiftsData ?? []).forEach((s: any) => {
            if (s.deleted_in_realizada_at) return;
            const shiftType = getShiftByName(s.shift_type);
            if (!shiftType) return;
            const day = parseInt(s.shift_date.slice(8, 10), 10);
            const key = `${s.professional_id}|${day}`;
            const arr = codesByProfDay.get(key) ?? [];
            arr.push(shiftType.code);
            codesByProfDay.set(key, arr);
          });
          codesByProfDay.forEach((codes, key) => {
            const [profId, dayStr] = key.split('|');
            const day = parseInt(dayStr, 10);
            let code = codes[0] || '';
            if (codes.length === 2) {
              const set = new Set(codes);
              if (set.has('SD') && set.has('SN')) code = 'P';
              else if (set.has('M') && set.has('T')) code = 'MT';
            }
            if (!shiftsByProf.has(profId)) shiftsByProf.set(profId, new Map());
            if (code) shiftsByProf.get(profId)!.set(day, code);
          });

          const { buffer, filename } = await generateScheduleExcelBuffer({
            scheduleName: schedule.name,
            departmentName: schedule.department?.name || '',
            month: monthStr,
            professionals: (profsData ?? []).map((p: any) => ({
              id: p.id,
              full_name: p.full_name,
              registration_number: p.registration_number,
              coren: p.coren,
              category_name: p.category?.name,
              contracted_hours: p.contracted_hours_per_month,
            })),
            shiftsByProf,
          });
          zip.file(filename, buffer);
        } catch (err) {
          console.error(`Erro ao exportar escala "${schedule.name}":`, err);
          failCount++;
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `escalas_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (failCount > 0) {
        toast.warning(`${schedulesToExport.length - failCount} escala(s) exportada(s); ${failCount} falharam.`);
      } else {
        toast.success(`${schedulesToExport.length} escala(s) exportada(s) em um único .zip.`);
      }
    } catch (err: any) {
      console.error('Erro ao exportar escalas em lote:', err);
      toast.error('Erro ao exportar escalas: ' + (err?.message ?? 'desconhecido'));
    } finally {
      setExportingBatch(false);
    }
  };

  const handleViewSchedule = (scheduleId: string) => {
    if (onNavigateToSchedule) {
      onNavigateToSchedule(scheduleId);
    }
  };

  const filteredShifts = shifts.filter(shift => {
    const profName = shift.professional?.full_name || '';
    const categoryName = shift.professional?.category?.name || '';
    const deptName = shift.department?.name || '';
    return profName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      categoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deptName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredSchedules = schedules.filter(schedule => {
    const scheduleName = schedule.name || '';
    const deptName = schedule.department?.name || '';
    const matchesSearch =
      scheduleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deptName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = !filterStatus || schedule.status === filterStatus;
    const matchesDepartment = !filterDepartment || schedule.department?.id === filterDepartment;

    // Filtro por mês/ano
    const scheduleMonth = schedule.month.slice(0, 7); // Formato YYYY-MM
    const matchesMonth = !filterMonth || scheduleMonth === filterMonth;

    return matchesSearch && matchesStatus && matchesDepartment && matchesMonth;
  });

  const getMonthLabel = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    return new Date(parseInt(year), parseInt(month) - 1, 15).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          {filterDepartment && (
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-700 mb-1 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Setores
            </button>
          )}
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            {(filterDepartment && departments.find(d => d.id === filterDepartment)?.name) || 'Gestão de Escalas'}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {viewMode === 'schedules'
              ? `${filteredSchedules.length} ${filteredSchedules.length === 1 ? 'escala' : 'escalas'}`
              : `${filteredShifts.length} ${filteredShifts.length === 1 ? 'plantão' : 'plantões'}`
            }
            {viewMode === 'schedules' && filteredSchedules.length !== schedules.length && ` de ${schedules.length}`}
          </p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          {viewMode === 'schedules' && (
            <>
              <button
                onClick={() => exportSchedulesBatch(filteredSchedules)}
                disabled={exportingBatch || filteredSchedules.length === 0}
                className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 sm:px-4 py-2 rounded-lg transition text-sm sm:text-base disabled:opacity-50"
                title="Baixar as escalas filtradas (respeitando os filtros de setor/mês acima) em um único .zip"
              >
                {exportingBatch ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                <span className="hidden sm:inline">Baixar com filtros</span>
                <span className="sm:hidden">Baixar</span>
              </button>
              <button
                onClick={() => exportSchedulesBatch(schedules)}
                disabled={exportingBatch || schedules.length === 0}
                className="hidden md:flex items-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-3 sm:px-4 py-2 rounded-lg transition text-sm sm:text-base disabled:opacity-50"
                title="Baixar TODAS as escalas (ignora os filtros) em um único .zip"
              >
                {exportingBatch ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                Baixar todas as escalas
              </button>
              {/* Consolidado da FESF: sem setor no filtro, sai o hospital inteiro
                  — é assim que o RH deixa de juntar as planilhas dos 22 setores. */}
              <button
                onClick={handleGerarConsolidado}
                disabled={generatingConsolidado || !filterMonth}
                className="flex items-center gap-2 bg-teal-50 border border-teal-300 text-teal-800 hover:bg-teal-100 px-3 sm:px-4 py-2 rounded-lg transition text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  filterMonth
                    ? `Gera o Consolidado Mensal de Frequência (FESF 5.11 FML 007) de ${
                        filterDepartment
                          ? departments.find(d => d.id === filterDepartment)?.name
                          : 'TODOS os setores'
                      }`
                    : 'Escolha o mês no filtro acima para gerar o consolidado'
                }
              >
                {generatingConsolidado ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5" />}
                <span className="hidden sm:inline">Consolidado FESF</span>
                <span className="sm:hidden">Consolidado</span>
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 px-3 sm:px-4 py-2 rounded-lg transition text-sm sm:text-base"
                title="Importar escala de um arquivo Excel"
              >
                <FileSpreadsheet className="w-5 h-5" />
                <span className="hidden sm:inline">Importar Excel</span>
                <span className="sm:hidden">Importar</span>
              </button>
              <button
                onClick={() => setShowCreateScheduleModal(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg transition text-sm sm:text-base"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Nova Escala Mensal</span>
                <span className="sm:hidden">Nova Escala</span>
              </button>
            </>
          )}
          {viewMode === 'shifts' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg transition text-sm sm:text-base"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Novo Plantão Avulso</span>
              <span className="sm:hidden">Novo Plantão</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-6">
        <div className="space-y-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder={viewMode === 'schedules' ? "Buscar escalas por nome ou setor..." : "Buscar plantões..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('schedules')}
                className={`px-4 py-2 rounded-lg transition whitespace-nowrap ${
                  viewMode === 'schedules'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Calendar className="w-4 h-4 inline mr-2" />
                Escalas Mensais
              </button>
              <button
                onClick={() => setViewMode('shifts')}
                className={`px-4 py-2 rounded-lg transition whitespace-nowrap ${
                  viewMode === 'shifts'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Plantões Avulsos
              </button>
            </div>
          </div>

          {viewMode === 'schedules' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Todos os setores</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>

                <input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  title="Filtrar por mês (opcional)"
                />
                {filterMonth && (
                  <button
                    type="button"
                    onClick={() => setFilterMonth('')}
                    className="px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  >
                    Todos os meses
                  </button>
                )}

                {(filterStatus || filterDepartment) && (
                  <button
                    onClick={() => {
                      setFilterStatus('');
                      setFilterDepartment('');
                    }}
                    className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium flex items-center gap-1"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-4">Carregando...</p>
          </div>
        ) : viewMode === 'schedules' ? (
          filteredSchedules.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">
                Nenhuma escala encontrada para <span className="font-semibold capitalize">{getMonthLabel(filterMonth)}</span>
              </p>
              {(searchTerm || filterStatus || filterDepartment || filterMonth) ? (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterStatus('');
                    setFilterDepartment('');
                    setFilterMonth('');
                  }}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Limpar busca e filtros
                </button>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSchedules.map((schedule) => {
                const [year, month] = schedule.month.split('-');
                const monthName = new Date(parseInt(year), parseInt(month) - 1, 15).toLocaleDateString('pt-BR', {
                  month: 'long',
                  year: 'numeric',
                });
                const published = schedule.status === 'Publicada';

                return (
                  <div
                    key={schedule.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleViewSchedule(schedule.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleViewSchedule(schedule.id);
                      }
                    }}
                    className="group relative bg-white rounded-2xl border border-gray-200 p-5 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-5 h-5 text-blue-600" />
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          published ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {schedule.status}
                      </span>
                    </div>
                    <h3 className="mt-3 font-bold text-gray-900 leading-snug">{schedule.name}</h3>
                    <div className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-600">
                      <Clock className="w-4 h-4 flex-shrink-0" />
                      <span className="capitalize">{monthName}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                      <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                      {schedule.department?.name || 'Sem setor'}
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-700">
                        <Eye className="w-4 h-4" /> Abrir
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRequest(schedule.id);
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Excluir escala"
                        aria-label={`Excluir ${schedule.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          filteredShifts.length === 0 ? (
            <div className="text-center py-12">
              <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nenhum plantão encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredShifts.map((shift) => (
                <ShiftCard key={shift.id} shift={shift} onUpdate={loadShifts} />
              ))}
            </div>
          )
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDeleteId !== null}
        title="Excluir Escala"
        message="Deseja realmente excluir esta escala? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={handleDeleteSchedule}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {/* Modal de exclusão em massa — exige digitar EXCLUIR TUDO */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900">Excluir TODAS as escalas listadas?</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Esta ação vai apagar <strong>{filteredSchedules.length} escala(s)</strong> e <strong>todos os plantões associados</strong>.
                  Não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-xs text-red-900">
              <strong>Cuidado:</strong> incluindo escalas de meses anteriores, ausências e trocas continuam, mas sem o vínculo da escala.
              Se você só quer excluir uma escala, feche este aviso e use o ícone de lixeira na linha da escala.
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Para confirmar, digite <strong>EXCLUIR TUDO</strong>:
            </label>
            <input
              type="text"
              value={deleteAllConfirmText}
              onChange={(e) => setDeleteAllConfirmText(e.target.value)}
              placeholder="EXCLUIR TUDO"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm font-mono uppercase"
              autoFocus
            />
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowDeleteAllModal(false); setDeleteAllConfirmText(''); }}
                disabled={deletingAll}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAllSchedules}
                disabled={deleteAllConfirmText !== 'EXCLUIR TUDO' || deletingAll}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {deletingAll ? 'Excluindo...' : 'Excluir Tudo'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {showCreateModal && (
        <CreateShiftModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadShifts();
          }}
        />
      )}

      {showCreateScheduleModal && (
        <CreateScheduleModal
          onClose={() => setShowCreateScheduleModal(false)}
          onSuccess={() => {
            setShowCreateScheduleModal(false);
            loadSchedules();
          }}
        />
      )}

      {showImportModal && (
        <ImportScheduleModal
          onClose={() => setShowImportModal(false)}
          onSuccess={(scheduleId) => {
            setShowImportModal(false);
            if (onNavigateToSchedule) onNavigateToSchedule(scheduleId);
            else loadSchedules();
          }}
        />
      )}
    </div>
  );
}
