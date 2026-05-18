import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  UserCheck,
  UserX,
  Edit2,
  Trash2,
  Phone,
  Mail,
  FileText,
  Filter,
  X,
  Users,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import CreateProfessionalModal from './CreateProfessionalModal';
import EditProfessionalModal from './EditProfessionalModal';
import { TableSkeleton } from '../Common/Skeleton';
import EmptyState from '../Common/EmptyState';
import Pagination from '../Common/Pagination';
import ConfirmDialog from '../Common/ConfirmDialog';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../Common/ToastContainer';

interface Professional {
  id: string;
  full_name: string;
  cpf: string | null;
  pis_number: string | null;
  hire_date: string | null;
  registration_number: string | null;
  coren: string | null;
  on_leave?: boolean;
  leave_reason?: string | null;
  leave_started_at?: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  contracted_hours: number | null;
  contracted_hours_per_month?: number;
  category_id: string;
  department_id: string;
  company_id?: string;
  category: {
    id: string;
    name: string;
    color: string;
  };
  department: {
    id: string;
    name: string;
  };
  company: {
    id: string;
    name: string;
  } | null;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Department {
  id: string;
  name: string;
}

interface Company {
  id: string;
  name: string;
}

const STORAGE_KEY_PAGE_SIZE = 'medscale.professionals.pageSize';

function normalize(s: string | null | undefined) {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export default function ProfessionalsView() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  const [deletingProf, setDeletingProf] = useState<Professional | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { toasts, toast, removeToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  // Default: mostra só ativos. Inativos (soft-deleted) ficam ocultos até
  // o usuário clicar no filtro "Inativos".
  const [filterActive, setFilterActive] = useState<boolean | null>(true);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [filterCompany, setFilterCompany] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PAGE_SIZE);
      if (stored) return Number(stored);
    } catch {
      /* ignore */
    }
    return 20;
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PAGE_SIZE, String(pageSize));
    } catch {
      /* ignore */
    }
  }, [pageSize]);

  // Reset to first page when any filter changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterActive, filterCategory, filterDepartment, filterCompany]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        loadProfessionals(),
        loadCategories(),
        loadDepartments(),
        loadCompanies(),
      ]);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingProf) return;
    setDeleteLoading(true);
    try {
      // Tenta DELETE definitivo. Usa .select() para saber QUANTAS linhas
      // foram realmente afetadas — sem isso, o Supabase devolve sucesso
      // mesmo quando a RLS bloqueia silenciosamente (0 rows affected).
      const { data: deleted, error: delErr } = await supabase
        .from('professionals')
        .delete()
        .eq('id', deletingProf.id)
        .select('id');

      let hardDeleted = !delErr && Array.isArray(deleted) && deleted.length > 0;

      if (!hardDeleted) {
        // DELETE falhou (erro ou silenciosamente bloqueado). Tenta soft delete.
        const { data: updated, error: softErr } = await supabase
          .from('professionals')
          .update({ active: false, updated_at: new Date().toISOString() } as any)
          .eq('id', deletingProf.id)
          .select('id');

        const softWorked = !softErr && Array.isArray(updated) && updated.length > 0;

        if (!softWorked) {
          throw new Error(
            softErr?.message ||
              'Você não tem permissão para excluir este profissional. Procure um Administrador.'
          );
        }
        toast.success(
          `${deletingProf.full_name} foi DESATIVADO (preservando histórico de plantões).`
        );
      } else {
        toast.success(`${deletingProf.full_name} foi removido definitivamente.`);
      }
      setDeletingProf(null);
      await loadProfessionals();
    } catch (err: any) {
      console.error('Erro ao excluir profissional:', err);
      toast.error('Erro ao excluir: ' + (err.message ?? 'tente novamente'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const loadProfessionals = async () => {
    const { data, error } = await supabase
      .from('professionals')
      .select(
        `
        *,
        category:professional_categories!category_id (id, name, color),
        department:departments!department_id (id, name),
        company:companies (id, name)
      `
      )
      .order('full_name');

    if (error) throw error;
    if (data) setProfessionals(data as any);
  };

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from('professional_categories')
      .select('id, name, color')
      .order('name');
    if (error) throw error;
    if (data) setCategories(data);
  };

  const loadDepartments = async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .eq('active', true)
      .order('name');
    if (error) throw error;
    if (data) setDepartments(data);
  };

  const loadCompanies = async () => {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name')
      .order('name');
    if (error) throw error;
    if (data) setCompanies(data);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterActive(null);
    setFilterCategory('');
    setFilterDepartment('');
    setFilterCompany('');
  };

  const filteredProfessionals = useMemo(() => {
    const q = normalize(searchTerm);
    return professionals.filter(prof => {
      const matchesSearch =
        !q ||
        normalize(prof.full_name).includes(q) ||
        normalize(prof.category?.name).includes(q) ||
        normalize(prof.department?.name).includes(q) ||
        normalize(prof.registration_number).includes(q) ||
        normalize(prof.coren).includes(q) ||
        normalize(prof.phone).includes(q) ||
        normalize(prof.email).includes(q);

      const matchesActive = filterActive === null || prof.active === filterActive;
      const matchesCategory = !filterCategory || prof.category_id === filterCategory;
      const matchesDepartment = !filterDepartment || prof.department_id === filterDepartment;
      const matchesCompany =
        !filterCompany || (prof.company && prof.company.id === filterCompany);

      return matchesSearch && matchesActive && matchesCategory && matchesDepartment && matchesCompany;
    });
  }, [professionals, searchTerm, filterActive, filterCategory, filterDepartment, filterCompany]);

  const paginatedProfessionals = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProfessionals.slice(start, start + pageSize);
  }, [filteredProfessionals, page, pageSize]);

  const activeFiltersCount = [
    filterActive !== null,
    filterCategory,
    filterDepartment,
    filterCompany,
  ].filter(Boolean).length;

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 shadow-sm">
        <EmptyState
          variant="error"
          icon={AlertCircle}
          title="Erro ao carregar profissionais"
          description={error}
          action={{
            label: 'Tentar novamente',
            onClick: () => {
              setError(null);
              loadData();
            },
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profissionais</h1>
          <p className="text-sm text-gray-600 mt-1">
            {loading ? (
              'Carregando...'
            ) : (
              <>
                <span className="font-medium text-gray-900">{filteredProfessionals.length}</span>{' '}
                {filteredProfessionals.length === 1 ? 'profissional' : 'profissionais'}
                {filteredProfessionals.length !== professionals.length && (
                  <> de {professionals.length}</>
                )}
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <Plus className="w-5 h-5" aria-hidden="true" />
          Novo Profissional
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
                aria-hidden="true"
              />
              <label className="sr-only" htmlFor="prof-search">
                Buscar profissional
              </label>
              <input
                id="prof-search"
                type="search"
                placeholder="Buscar por nome, categoria, setor, matrícula, telefone ou email..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full min-h-[44px] pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              aria-expanded={showFilters}
              className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg font-medium transition whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                showFilters || activeFiltersCount > 0
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-4 h-4" aria-hidden="true" />
              Filtros
              {activeFiltersCount > 0 && (
                <span className="bg-white text-blue-600 text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px]">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-4 border border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-medium text-gray-900">Filtros avançados</h3>
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                    Limpar filtros
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFilterActive(null)}
                      className={`flex-1 min-h-[40px] px-2 py-2 rounded-lg text-sm transition ${
                        filterActive === null
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterActive(true)}
                      className={`flex-1 min-h-[40px] px-2 py-2 rounded-lg text-sm transition ${
                        filterActive === true
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-300'
                      }`}
                    >
                      <UserCheck className="w-4 h-4 inline mr-1" />
                      Ativo
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterActive(false)}
                      className={`flex-1 min-h-[40px] px-2 py-2 rounded-lg text-sm transition ${
                        filterActive === false
                          ? 'bg-red-600 text-white'
                          : 'bg-white text-red-700 hover:bg-red-50 border border-red-300'
                      }`}
                    >
                      <UserX className="w-4 h-4 inline mr-1" />
                      Inativo
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="filter-category"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Categoria
                  </label>
                  <select
                    id="filter-category"
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">Todas as categorias</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="filter-dept"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Setor
                  </label>
                  <select
                    id="filter-dept"
                    value={filterDepartment}
                    onChange={e => setFilterDepartment(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">Todos os setores</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="filter-company"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Empresa
                  </label>
                  <select
                    id="filter-company"
                    value={filterCompany}
                    onChange={e => setFilterCompany(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">Todas as empresas</option>
                    {companies.map(comp => (
                      <option key={comp.id} value={comp.id}>
                        {comp.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="px-4 sm:px-6 pb-6">
            <TableSkeleton rows={pageSize > 10 ? 10 : pageSize} columns={6} />
          </div>
        ) : filteredProfessionals.length === 0 ? (
          professionals.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum profissional cadastrado"
              description="Cadastre profissionais para começar a montar suas escalas."
              action={{
                label: 'Cadastrar primeiro profissional',
                onClick: () => setShowCreateModal(true),
                icon: Plus,
              }}
            />
          ) : (
            <EmptyState
              variant="search"
              title="Nenhum profissional encontrado"
              description="Tente ajustar os filtros ou a busca para ver outros resultados."
              action={
                activeFiltersCount > 0 || searchTerm
                  ? { label: 'Limpar filtros', onClick: clearFilters }
                  : undefined
              }
            />
          )
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-y border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Categoria
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">
                      Setor
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">
                      Empresa
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden lg:table-cell">
                      Contato
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider hidden md:table-cell">
                      Horas
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedProfessionals.map(prof => (
                    <tr key={prof.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-gray-900">{prof.full_name}</div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                            {prof.registration_number && (
                              <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                                <FileText className="w-3 h-3" aria-hidden="true" />
                                {prof.registration_number}
                              </span>
                            )}
                            {prof.coren && (
                              <span className="text-xs inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium ring-1 ring-inset ring-emerald-200">
                                COREN: {prof.coren}
                              </span>
                            )}
                            {prof.on_leave && (
                              <span
                                className="text-xs inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium ring-1 ring-inset ring-amber-300"
                                title={prof.leave_reason || 'Afastado'}
                              >
                                AFASTADO{prof.leave_reason ? `: ${prof.leave_reason}` : ''}
                              </span>
                            )}
                          </div>
                          {/* Mobile-only condensed info */}
                          <div className="md:hidden text-xs text-gray-500 mt-1">
                            {prof.department?.name || 'Sem setor'}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-white whitespace-nowrap"
                          style={{ backgroundColor: prof.category?.color || '#6B7280' }}
                        >
                          {prof.category?.name || 'Sem categoria'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-sm text-gray-900">
                        {prof.department?.name || '-'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-sm text-gray-900">
                        {prof.company?.name || '-'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="space-y-0.5">
                          {prof.phone && (
                            <div className="text-xs text-gray-600 flex items-center gap-1">
                              <Phone className="w-3 h-3" aria-hidden="true" />
                              {prof.phone}
                            </div>
                          )}
                          {prof.email && (
                            <div className="text-xs text-gray-600 flex items-center gap-1 truncate max-w-[200px]">
                              <Mail className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                              <span className="truncate">{prof.email}</span>
                            </div>
                          )}
                          {!prof.phone && !prof.email && (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-sm text-gray-900">
                        {prof.contracted_hours != null ? `${prof.contracted_hours}h` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {prof.active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                            <UserCheck className="w-3 h-3" aria-hidden="true" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <UserX className="w-3 h-3" aria-hidden="true" />
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingProfessional(prof)}
                            aria-label={`Editar ${prof.full_name}`}
                            title="Editar"
                            className="inline-flex items-center gap-1 min-h-[36px] px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <Edit2 className="w-4 h-4" aria-hidden="true" />
                            <span className="hidden sm:inline">Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingProf(prof)}
                            aria-label={`Excluir ${prof.full_name}`}
                            title="Excluir"
                            className="inline-flex items-center justify-center min-h-[36px] w-9 text-red-700 rounded-lg hover:bg-red-50 transition focus:outline-none focus:ring-2 focus:ring-red-500"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              pageSize={pageSize}
              total={filteredProfessionals.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="profissionais"
            />
          </>
        )}
      </div>

      {showCreateModal && (
        <CreateProfessionalModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadProfessionals();
          }}
        />
      )}

      {editingProfessional && (
        <EditProfessionalModal
          professional={editingProfessional}
          onClose={() => setEditingProfessional(null)}
          onSuccess={() => {
            setEditingProfessional(null);
            loadProfessionals();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={deletingProf !== null}
        title="Excluir profissional?"
        message={`Tem certeza que deseja excluir ${deletingProf?.full_name ?? ''}? Caso ele tenha plantões registrados, será apenas desativado (preservando o histórico). Caso contrário, será removido definitivamente.`}
        confirmLabel="Excluir"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingProf(null)}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
