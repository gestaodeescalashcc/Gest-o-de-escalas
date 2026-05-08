import { useState, useEffect, useMemo, Fragment } from 'react';
import {
  Plus, Search, Filter, Edit2, Trash2, AlertCircle, CalendarX,
  CheckCircle, XCircle, UserCheck, X, FileSpreadsheet, Calendar,
  Users as UsersIcon, ChevronRight, ChevronDown,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../Common/ToastContainer';
import EmptyState from '../Common/EmptyState';
import Pagination from '../Common/Pagination';
import { TableSkeleton } from '../Common/Skeleton';
import ConfirmDialog from '../Common/ConfirmDialog';
import CreateAbsenceModal from './CreateAbsenceModal';
import { usePermissions } from '../../hooks/usePermissions';

export interface AbsenceReason {
  id: string;
  name: string;
  shift_code: string;
  default_justified: boolean;
  active: boolean;
}

export interface Absence {
  id: string;
  professional_id: string;
  department_id: string | null;
  reason_id: string;
  start_date: string;
  end_date: string;
  shift_type: string | null;
  hours_per_day: number;
  is_justified: boolean;
  has_coverage: boolean;
  coverage_professional_id: string | null;
  observation: string | null;
  created_at: string;
  professional: { id: string; full_name: string } | null;
  department: { id: string; name: string } | null;
  reason: AbsenceReason | null;
  coverage_professional: { id: string; full_name: string } | null;
}

interface DeptOption { id: string; name: string }
interface ProfOption { id: string; full_name: string; department_id: string }

const REASON_BADGE: Record<string, string> = {
  FA: 'bg-red-100 text-red-800 ring-red-200',
  LM: 'bg-rose-100 text-rose-800 ring-rose-200',
  LG: 'bg-pink-100 text-pink-800 ring-pink-200',
  LP: 'bg-purple-100 text-purple-800 ring-purple-200',
  FE: 'bg-yellow-100 text-yellow-800 ring-yellow-200',
  AS: 'bg-orange-100 text-orange-800 ring-orange-200',
  DG: 'bg-slate-200 text-slate-700 ring-slate-300',
  FG: 'bg-gray-100 text-gray-700 ring-gray-200',
};

function formatDateRange(start: string, end: string): string {
  if (start === end) {
    return new Date(start + 'T12:00:00').toLocaleDateString('pt-BR');
  }
  const s = new Date(start + 'T12:00:00').toLocaleDateString('pt-BR');
  const e = new Date(end + 'T12:00:00').toLocaleDateString('pt-BR');
  return `${s} – ${e}`;
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

const STORAGE_KEY_PAGE_SIZE = 'medscale.absenteeism.pageSize';

export default function AbsenteeismView() {
  const { canCreate, canUpdate, canDelete, isAdmin, allowedDepartments } = usePermissions();
  const { toasts, toast, removeToast } = useToast();

  const [absences, setAbsences] = useState<Absence[]>([]);
  const [reasons, setReasons] = useState<AbsenceReason[]>([]);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [professionals, setProfessionals] = useState<ProfOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterReason, setFilterReason] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterJustified, setFilterJustified] = useState<'all' | 'yes' | 'no'>('all');
  const [filterCoverage, setFilterCoverage] = useState<'all' | 'yes' | 'no'>('all');
  const [showFilters, setShowFilters] = useState(false);
  // Visão "Por pessoa" sempre ativa (não há mais alternância).
  const groupByPerson = true;
  const [expandedPersons, setExpandedPersons] = useState<Set<string>>(new Set());

  function togglePerson(id: string) {
    setExpandedPersons(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PAGE_SIZE);
      return stored ? Number(stored) : 20;
    } catch { return 20; }
  });

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Absence | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Recarrega quando allowedDepartments mudar (importante: na 1a render
  // ele pode estar null porque o usePermissions ainda está carregando do
  // banco. Quando popular, recarrega aplicando o filtro correto).
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedDepartments]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY_PAGE_SIZE, String(pageSize)); } catch {}
  }, [pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, filterDept, filterReason, filterMonth, filterJustified, filterCoverage]);

  async function loadData() {
    setLoading(true);
    try {
      // Coordenadora só vê absenteísmos dos seus setores permitidos
      const restrictByDept = !isAdmin() && allowedDepartments && allowedDepartments.length > 0;

      let absencesQuery = supabase.from('absences').select(`
        *,
        professional:professionals!absences_professional_id_fkey(id, full_name),
        department:departments(id, name),
        reason:absence_reasons(*),
        coverage_professional:professionals!absences_coverage_professional_id_fkey(id, full_name)
      `).order('start_date', { ascending: false });

      let deptsQuery = supabase.from('departments').select('id, name').eq('active', true).order('name');
      let profsQuery = supabase.from('professionals').select('id, full_name, department_id').eq('active', true).order('full_name');

      if (restrictByDept && allowedDepartments) {
        absencesQuery = absencesQuery.in('department_id', allowedDepartments);
        deptsQuery = deptsQuery.in('id', allowedDepartments);
        profsQuery = profsQuery.in('department_id', allowedDepartments);
      }

      const [a, r, d, p] = await Promise.all([
        absencesQuery,
        supabase.from('absence_reasons').select('*').eq('active', true).order('name'),
        deptsQuery,
        profsQuery,
      ]);

      if (a.error) throw a.error;
      setAbsences(a.data as any);
      if (r.data) setReasons(r.data);
      if (d.data) setDepartments(d.data);
      if (p.data) setProfessionals(p.data as any);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao carregar registros: ' + (err.message ?? 'desconhecido'));
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = absences.filter(a => {
      if (q) {
        const hay = [
          a.professional?.full_name ?? '',
          a.department?.name ?? '',
          a.reason?.name ?? '',
          a.observation ?? '',
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterDept && a.department_id !== filterDept) return false;
      if (filterReason && a.reason_id !== filterReason) return false;
      if (filterMonth && !a.start_date.startsWith(filterMonth)) return false;
      if (filterJustified !== 'all' && a.is_justified !== (filterJustified === 'yes')) return false;
      if (filterCoverage !== 'all' && a.has_coverage !== (filterCoverage === 'yes')) return false;
      return true;
    });
    return list;
  }, [absences, search, filterDept, filterReason, filterMonth, filterJustified, filterCoverage]);

  // Agrupado por pessoa: 1 linha por profissional, com lista de faltas dentro
  const byPerson = useMemo(() => {
    const map = new Map<string, {
      professional_id: string;
      name: string;
      department: string;
      count: number;
      days: number;
      hours: number;
      justified: number;
      withCoverage: number;
      items: Absence[];
    }>();
    filtered.forEach(a => {
      const key = a.professional_id;
      const days = daysBetween(a.start_date, a.end_date);
      const cur = map.get(key) ?? {
        professional_id: key,
        name: a.professional?.full_name ?? '—',
        department: a.department?.name ?? '—',
        count: 0,
        days: 0,
        hours: 0,
        justified: 0,
        withCoverage: 0,
        items: [],
      };
      cur.count += 1;
      cur.days += days;
      cur.hours += days * Number(a.hours_per_day || 0);
      if (a.is_justified) cur.justified += 1;
      if (a.has_coverage) cur.withCoverage += 1;
      cur.items.push(a);
      map.set(key, cur);
    });
    // ordena cada lista interna por data desc
    map.forEach(g => g.items.sort((x, y) => y.start_date.localeCompare(x.start_date)));
    // ordena o array de pessoas por quantidade de faltas (desc), depois nome
    return Array.from(map.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [filtered]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const stats = useMemo(() => {
    const total = filtered.length;
    let totalDays = 0;
    let totalHours = 0;
    let justified = 0;
    let withCov = 0;
    filtered.forEach(a => {
      const days = daysBetween(a.start_date, a.end_date);
      totalDays += days;
      totalHours += days * Number(a.hours_per_day || 0);
      if (a.is_justified) justified++;
      if (a.has_coverage) withCov++;
    });
    return { total, totalDays, totalHours, justified, withCov };
  }, [filtered]);

  const activeFilters =
    [filterDept, filterReason, filterMonth].filter(Boolean).length +
    (filterJustified !== 'all' ? 1 : 0) +
    (filterCoverage !== 'all' ? 1 : 0);

  function clearFilters() {
    setSearch('');
    setFilterDept('');
    setFilterReason('');
    setFilterMonth('');
    setFilterJustified('all');
    setFilterCoverage('all');
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from('absences').delete().eq('id', confirmDelete.id);
      if (error) throw error;
      toast.success('Registro removido.');
      setConfirmDelete(null);
      loadData();
    } catch (err: any) {
      toast.error('Erro ao remover: ' + (err.message ?? 'desconhecido'));
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarX className="w-7 h-7 text-red-500" />
            Absenteísmo
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Faltas, atestados, licenças e exceções da escala planejada
          </p>
        </div>
        {canCreate('absences' as any) && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Plus className="w-5 h-5" aria-hidden="true" />
            Registrar Absenteísmo
          </button>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Registros" value={stats.total} color="blue" />
        <StatCard label="Dias perdidos" value={stats.totalDays} color="red" />
        <StatCard label="Horas perdidas" value={`${stats.totalHours}h`} color="amber" />
        <StatCard
          label="Justificadas"
          value={`${stats.justified}/${stats.total}`}
          color="emerald"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
              <input
                type="search"
                placeholder="Buscar por nome, setor, motivo, observação..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full min-h-[44px] pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(s => !s)}
              className={`inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg font-medium transition ${
                showFilters || activeFilters > 0
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-4 h-4" aria-hidden="true" />
              Filtros
              {activeFilters > 0 && (
                <span className="bg-white text-blue-600 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {activeFilters}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-4 border border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">Filtros avançados</h3>
                {activeFilters > 0 && (
                  <button onClick={clearFilters} className="text-sm font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
                    <X className="w-4 h-4" /> Limpar filtros
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <FilterField label="Setor">
                  <select value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                    <option value="">Todos</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </FilterField>
                <FilterField label="Motivo">
                  <select value={filterReason} onChange={e => setFilterReason(e.target.value)}>
                    <option value="">Todos</option>
                    {reasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </FilterField>
                <FilterField label="Mês">
                  <input
                    type="month"
                    value={filterMonth}
                    onChange={e => setFilterMonth(e.target.value)}
                  />
                </FilterField>
                <FilterField label="Justificada?">
                  <select value={filterJustified} onChange={e => setFilterJustified(e.target.value as any)}>
                    <option value="all">Todas</option>
                    <option value="yes">Sim</option>
                    <option value="no">Não</option>
                  </select>
                </FilterField>
                <FilterField label="Tem cobertura?">
                  <select value={filterCoverage} onChange={e => setFilterCoverage(e.target.value as any)}>
                    <option value="all">Todas</option>
                    <option value="yes">Sim</option>
                    <option value="no">Não</option>
                  </select>
                </FilterField>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="px-4 sm:px-6 pb-6"><TableSkeleton rows={8} columns={6} /></div>
        ) : filtered.length === 0 ? (
          absences.length === 0 ? (
            <EmptyState
              icon={FileSpreadsheet}
              title="Nenhum absenteísmo registrado"
              description="Cadastre faltas, atestados e exceções da escala. Os registros vão impactar a escala realizada."
              action={canCreate('absences' as any) ? {
                label: 'Registrar primeiro absenteísmo',
                onClick: () => setShowCreate(true),
                icon: Plus,
              } : undefined}
            />
          ) : (
            <EmptyState
              variant="search"
              title="Nenhum registro encontrado"
              description="Ajuste os filtros para ver outros resultados."
              action={activeFilters > 0 || search ? { label: 'Limpar filtros', onClick: clearFilters } : undefined}
            />
          )
        ) : groupByPerson ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-y border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase text-xs tracking-wider">Profissional</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase text-xs tracking-wider hidden md:table-cell">Setor</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 uppercase text-xs tracking-wider">Faltas</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 uppercase text-xs tracking-wider hidden sm:table-cell">Dias</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 uppercase text-xs tracking-wider hidden md:table-cell">Horas</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 uppercase text-xs tracking-wider hidden lg:table-cell">Justif.</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 uppercase text-xs tracking-wider hidden xl:table-cell">Cobertura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {byPerson.map(g => {
                  const isOpen = expandedPersons.has(g.professional_id);
                  return (
                    <Fragment key={g.professional_id}>
                      <tr
                        onClick={() => togglePerson(g.professional_id)}
                        className="hover:bg-gray-50 transition cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isOpen ? (
                              <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" aria-hidden="true" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" aria-hidden="true" />
                            )}
                            <span className="font-medium text-gray-900">{g.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-gray-700">{g.department}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full bg-red-100 text-red-800 ring-1 ring-inset ring-red-200 text-xs font-bold">
                            {g.count}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center hidden sm:table-cell text-gray-700">{g.days}</td>
                        <td className="px-4 py-3 text-center hidden md:table-cell text-gray-700">{g.hours}h</td>
                        <td className="px-4 py-3 text-center hidden lg:table-cell text-gray-700 text-xs">
                          {g.justified}/{g.count}
                        </td>
                        <td className="px-4 py-3 text-center hidden xl:table-cell text-gray-700 text-xs">
                          {g.withCoverage}/{g.count}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-gray-50/60">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="space-y-2">
                              {g.items.map(a => {
                                const days = daysBetween(a.start_date, a.end_date);
                                const code = a.reason?.shift_code ?? '?';
                                return (
                                  <div key={a.id} className="flex flex-wrap items-center gap-3 bg-white rounded-lg border border-gray-200 px-3 py-2">
                                    <span className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${REASON_BADGE[code] ?? 'bg-gray-100 text-gray-800 ring-gray-200'}`}>
                                      <span className="font-bold">{code}</span>
                                      <span>{a.reason?.name ?? '—'}</span>
                                    </span>
                                    <span className="text-sm text-gray-700">{formatDateRange(a.start_date, a.end_date)}</span>
                                    <span className="text-xs text-gray-500">{days} dia{days > 1 ? 's' : ''} · {(days * Number(a.hours_per_day || 0))}h</span>
                                    {a.shift_type && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-200">
                                        {a.shift_type}
                                      </span>
                                    )}
                                    {a.is_justified ? (
                                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle className="w-3.5 h-3.5" /> Justificada</span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-xs text-red-600"><XCircle className="w-3.5 h-3.5" /> Não justificada</span>
                                    )}
                                    {a.has_coverage && a.coverage_professional && (
                                      <span className="inline-flex items-center gap-1 text-xs text-gray-700">
                                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                                        {a.coverage_professional.full_name}
                                      </span>
                                    )}
                                    {a.observation && (
                                      <span className="text-xs text-gray-500 italic">"{a.observation}"</span>
                                    )}
                                    <div className="ml-auto inline-flex items-center gap-1">
                                      {canUpdate('absences' as any) && (
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setEditingAbsence(a); }}
                                          aria-label="Editar"
                                          className="w-8 h-8 inline-flex items-center justify-center text-blue-700 hover:bg-blue-50 rounded-lg transition"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </button>
                                      )}
                                      {canDelete('absences' as any) && (
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(a); }}
                                          aria-label="Remover"
                                          className="w-8 h-8 inline-flex items-center justify-center text-red-700 hover:bg-red-50 rounded-lg transition"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-y border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase text-xs tracking-wider">Profissional</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase text-xs tracking-wider hidden md:table-cell">Setor</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase text-xs tracking-wider">Motivo</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase text-xs tracking-wider">Período</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600 uppercase text-xs tracking-wider hidden lg:table-cell">Turno</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600 uppercase text-xs tracking-wider hidden lg:table-cell">Just.</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase text-xs tracking-wider hidden xl:table-cell">Cobertura</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600 uppercase text-xs tracking-wider"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginated.map((a) => {
                    const days = daysBetween(a.start_date, a.end_date);
                    const code = a.reason?.shift_code ?? '?';
                    return (
                      <tr key={a.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{a.professional?.full_name ?? '—'}</div>
                          {a.observation && (
                            <div className="text-xs text-gray-500 mt-0.5 italic line-clamp-1" title={a.observation}>
                              {a.observation}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-gray-700">
                          {a.department?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${REASON_BADGE[code] ?? 'bg-gray-100 text-gray-800 ring-gray-200'}`}>
                            <span className="font-bold">{code}</span>
                            <span>{a.reason?.name ?? '—'}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <div>{formatDateRange(a.start_date, a.end_date)}</div>
                          <div className="text-xs text-gray-500">{days} dia{days > 1 ? 's' : ''} · {(days * Number(a.hours_per_day || 0))}h</div>
                        </td>
                        <td className="px-4 py-3 text-center hidden lg:table-cell">
                          {a.shift_type ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-200">
                              {a.shift_type}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-center hidden lg:table-cell">
                          {a.is_justified ? (
                            <CheckCircle className="w-5 h-5 text-emerald-500 inline" aria-label="Justificada" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-400 inline" aria-label="Não justificada" />
                          )}
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          {a.has_coverage && a.coverage_professional ? (
                            <div className="flex items-center gap-1 text-xs text-gray-700">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                              {a.coverage_professional.full_name}
                            </div>
                          ) : a.has_coverage ? (
                            <span className="text-xs text-gray-500">Sem nome</span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center gap-1">
                            {canUpdate('absences' as any) && (
                              <button
                                type="button"
                                onClick={() => setEditingAbsence(a)}
                                aria-label="Editar"
                                className="w-9 h-9 inline-flex items-center justify-center text-blue-700 hover:bg-blue-50 rounded-lg transition"
                              >
                                <Edit2 className="w-4 h-4" aria-hidden="true" />
                              </button>
                            )}
                            {canDelete('absences' as any) && (
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(a)}
                                aria-label="Remover"
                                className="w-9 h-9 inline-flex items-center justify-center text-red-700 hover:bg-red-50 rounded-lg transition"
                              >
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="registros"
            />
          </>
        )}
      </div>

      {(showCreate || editingAbsence) && (
        <CreateAbsenceModal
          absence={editingAbsence}
          reasons={reasons}
          departments={departments}
          professionals={professionals}
          onClose={() => { setShowCreate(false); setEditingAbsence(null); }}
          onSuccess={() => {
            setShowCreate(false);
            setEditingAbsence(null);
            loadData();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDelete !== null}
        title="Remover registro?"
        message={`Esta ação removerá o registro de absenteísmo de ${confirmDelete?.professional?.full_name ?? ''}. Não pode ser desfeita.`}
        variant="danger"
        confirmLabel="Remover"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: 'blue' | 'red' | 'amber' | 'emerald' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  }[color];
  return (
    <div className={`rounded-xl border ${colors} p-4`}>
      <div className="text-xs font-medium uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      <div className="[&>select]:w-full [&>select]:min-h-[40px] [&>select]:px-3 [&>select]:py-2 [&>select]:border [&>select]:border-gray-300 [&>select]:rounded-lg [&>select]:bg-white [&>input]:w-full [&>input]:min-h-[40px] [&>input]:px-3 [&>input]:py-2 [&>input]:border [&>input]:border-gray-300 [&>input]:rounded-lg [&>input]:bg-white">
        {children}
      </div>
    </label>
  );
}
