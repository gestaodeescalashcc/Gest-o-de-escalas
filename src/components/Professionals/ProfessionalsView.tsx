import { useState, useEffect } from 'react';
import { Plus, Search, UserCheck, UserX, Edit2, Phone, Mail, FileText, Filter, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import CreateProfessionalModal from './CreateProfessionalModal';
import EditProfessionalModal from './EditProfessionalModal';

interface Professional {
  id: string;
  full_name: string;
  cpf: string | null;
  pis_number: string | null;
  hire_date: string | null;
  registration_number: string | null;
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

export default function ProfessionalsView() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [filterCompany, setFilterCompany] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

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

  const loadProfessionals = async () => {
    const { data, error } = await supabase
      .from('professionals')
      .select(`
        *,
        category:professional_categories (
          id,
          name,
          color
        ),
        department:departments (
          id,
          name
        ),
        company:companies (
          id,
          name
        )
      `)
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

  const filteredProfessionals = professionals.filter(prof => {
    const fullName = prof.full_name || '';
    const categoryName = prof.category?.name || '';
    const departmentName = prof.department?.name || '';
    const matchesSearch =
      fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      categoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      departmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (prof.registration_number && prof.registration_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (prof.phone && prof.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (prof.email && prof.email.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesActive = filterActive === null || prof.active === filterActive;
    const matchesCategory = !filterCategory || prof.category_id === filterCategory;
    const matchesDepartment = !filterDepartment || prof.department_id === filterDepartment;
    const matchesCompany = !filterCompany || (prof.company && prof.company.id === filterCompany);

    return matchesSearch && matchesActive && matchesCategory && matchesDepartment && matchesCompany;
  });

  const activeFiltersCount = [filterActive !== null, filterCategory, filterDepartment, filterCompany].filter(Boolean).length;

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <UserX className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Erro ao Carregar</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              loadData();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Profissionais</h2>
          <p className="text-gray-600 mt-1">
            {filteredProfessionals.length} {filteredProfessionals.length === 1 ? 'profissional' : 'profissionais'}
            {filteredProfessionals.length !== professionals.length && ` de ${professionals.length}`}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
        >
          <Plus className="w-5 h-5" />
          Novo Profissional
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="space-y-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nome, categoria, departamento, matrícula, telefone ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition whitespace-nowrap ${
                showFilters || activeFiltersCount > 0
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-5 h-5" />
              Filtros
              {activeFiltersCount > 0 && (
                <span className="bg-white text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-4 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">Filtros Avançados</h3>
                {activeFiltersCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <X className="w-4 h-4" />
                    Limpar Filtros
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFilterActive(null)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm transition ${
                        filterActive === null
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setFilterActive(true)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm transition ${
                        filterActive === true
                          ? 'bg-green-600 text-white'
                          : 'bg-white text-green-700 hover:bg-green-50 border border-green-300'
                      }`}
                    >
                      <UserCheck className="w-4 h-4 inline mr-1" />
                      Ativo
                    </button>
                    <button
                      onClick={() => setFilterActive(false)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm transition ${
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Todas as categorias</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Departamento</label>
                  <select
                    value={filterDepartment}
                    onChange={(e) => setFilterDepartment(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Todos os departamentos</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Empresa</label>
                  <select
                    value={filterCompany}
                    onChange={(e) => setFilterCompany(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Todas as empresas</option>
                    {companies.map((comp) => (
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
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-4">Carregando profissionais...</p>
          </div>
        ) : filteredProfessionals.length === 0 ? (
          <div className="text-center py-12">
            <UserX className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Nenhum profissional encontrado</p>
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Categoria
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Departamento
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Empresa
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Contato
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Horas
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProfessionals.map((prof) => (
                  <tr key={prof.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{prof.full_name}</div>
                        {prof.registration_number && (
                          <div className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                            <FileText className="w-3 h-3" />
                            {prof.registration_number}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: prof.category?.color || '#6B7280' }}
                      >
                        {prof.category?.name || 'Sem categoria'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">{prof.department?.name || 'Sem setor'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">
                        {prof.company ? prof.company.name : '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        {prof.phone && (
                          <div className="text-sm text-gray-600 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {prof.phone}
                          </div>
                        )}
                        {prof.email && (
                          <div className="text-sm text-gray-600 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {prof.email}
                          </div>
                        )}
                        {!prof.phone && !prof.email && (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">
                        {prof.contracted_hours != null ? `${prof.contracted_hours}h` : '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {prof.active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <UserCheck className="w-3 h-3" />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <UserX className="w-3 h-3" />
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => setEditingProfessional(prof)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm font-medium"
                      >
                        <Edit2 className="w-4 h-4" />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
    </div>
  );
}
