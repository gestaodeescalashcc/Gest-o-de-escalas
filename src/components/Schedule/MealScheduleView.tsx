import { useState, useEffect } from 'react';
import { Coffee, Settings, RefreshCw, Download, Calendar, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import MealCategoryConfig from './MealCategoryConfig';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../Common/ToastContainer';
import ConfirmDialog from '../Common/ConfirmDialog';

interface MealScheduleViewProps {
  onBack?: () => void;
}

interface MealScheduleEntry {
  id: string;
  professional_id: string;
  professional_name: string;
  category_name: string;
  department_name: string;
  shift_type: string;
  shift_hours: number;
  has_breakfast: boolean;
  has_lunch: boolean;
  has_dinner: boolean;
  has_supper: boolean;
  total_meals: number;
}

interface Company {
  id: string;
  name: string;
}

export default function MealScheduleView({ onBack }: MealScheduleViewProps = {}) {
  const { user } = useAuth();
  const { toasts, toast, removeToast } = useToast();
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [mealSchedule, setMealSchedule] = useState<MealScheduleEntry[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    loadMealSchedule();
  }, [selectedDate]);

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Erro ao carregar empresas:', error);
      toast.error('Erro ao carregar empresas.');
    }
  };

  const loadMealSchedule = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('meal_schedules')
        .select(`
          *,
          professional:professionals (
            full_name,
            category:professional_categories (
              name
            )
          ),
          shift:shifts (
            department:departments (
              name
            )
          )
        `)
        .eq('shift_date', selectedDate)
        .order('professional(full_name)');

      if (error) throw error;

      const formatted = data?.map((entry: any) => ({
        id: entry.id,
        professional_id: entry.professional_id,
        professional_name: entry.professional?.full_name || 'N/A',
        category_name: entry.professional?.category?.name || 'N/A',
        department_name: entry.shift?.department?.name || 'N/A',
        shift_type: entry.shift_type,
        shift_hours: entry.shift_hours,
        has_breakfast: entry.has_breakfast,
        has_lunch: entry.has_lunch,
        has_dinner: entry.has_dinner,
        has_supper: entry.has_supper,
        total_meals: entry.total_meals,
      })) || [];

      setMealSchedule(formatted);
    } catch (error) {
      console.error('Erro ao carregar escala de refeições:', error);
      toast.error('Erro ao carregar escala de refeições.');
    } finally {
      setLoading(false);
    }
  };

  const calculateShiftHours = (shiftType: string, startTime: string, endTime: string): number => {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (diff < 0) diff += 24;
    return diff;
  };

  const isNightShift = (shiftType: string): boolean => {
    const nightTypes = ['Noite', 'SN', 'noite', 'sn'];
    return nightTypes.includes(shiftType);
  };

  const isDayShift = (shiftType: string): boolean => {
    const dayTypes = ['Diurno', 'SD', 'diurno', 'sd', 'Manhã', 'M', 'Tarde', 'T', 'Manhã e Tarde', 'MT'];
    return dayTypes.includes(shiftType);
  };

  const is24hShift = (shiftType: string): boolean => {
    const fullTypes = ['24h', '24', 'P', 'Plantão 24h'];
    return fullTypes.includes(shiftType);
  };

  const determineMealRights = (shiftType: string, hours: number) => {
    const meals = {
      has_breakfast: false,
      has_lunch: false,
      has_dinner: false,
      has_supper: false,
    };

    if (hours <= 6) {
      return meals;
    }

    if (is24hShift(shiftType) || hours >= 20) {
      meals.has_lunch = true;
      meals.has_dinner = true;
      meals.has_supper = true;
      meals.has_breakfast = true;
      return meals;
    }

    if (isNightShift(shiftType)) {
      meals.has_supper = true;
      meals.has_breakfast = true;
      return meals;
    }

    if (isDayShift(shiftType)) {
      meals.has_lunch = true;
      return meals;
    }

    if (hours >= 7 && hours <= 9) {
      meals.has_lunch = true;
      return meals;
    }

    if (hours >= 10 && hours < 20) {
      meals.has_lunch = true;
      if (hours >= 14) {
        meals.has_dinner = true;
      }
      return meals;
    }

    meals.has_lunch = true;
    return meals;
  };

  const doGenerateMealSchedule = async () => {
    try {
      setGenerating(true);

      const [year, month] = selectedDate.split('-');
      const monthKey = `${year}-${month}-01`;

      const { data: schedulesData, error: schedulesError } = await supabase
        .from('monthly_schedules')
        .select('id, department_id')
        .eq('month', monthKey);

      if (schedulesError) throw schedulesError;

      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select(`
          *,
          professional:professionals (
            id,
            full_name,
            category_id,
            company_id,
            category:professional_categories (
              id,
              name
            )
          )
        `)
        .eq('shift_date', selectedDate);

      if (shiftsError) throw shiftsError;

      const { data: configData, error: configError } = await supabase
        .from('meal_category_config')
        .select('category_id, has_meal_benefit')
        .eq('has_meal_benefit', true);

      if (configError) throw configError;

      const allowedCategories = new Set(
        configData?.map(c => c.category_id) || []
      );

      const { error: deleteError } = await supabase
        .from('meal_schedules')
        .delete()
        .eq('shift_date', selectedDate);

      if (deleteError) throw deleteError;

      const mealEntries = [];

      for (const shift of shiftsData || []) {
        const categoryId = shift.professional?.category_id;
        const companyId = shift.professional?.company_id;

        if (!categoryId || !allowedCategories.has(categoryId)) {
          continue;
        }

        if (selectedCompanies.length > 0 && companyId && !selectedCompanies.includes(companyId)) {
          continue;
        }

        const hours = calculateShiftHours(
          shift.shift_type,
          shift.start_time,
          shift.end_time
        );

        const mealRights = determineMealRights(shift.shift_type, hours);
        const totalMeals = [
          mealRights.has_breakfast,
          mealRights.has_lunch,
          mealRights.has_dinner,
          mealRights.has_supper
        ].filter(Boolean).length;

        mealEntries.push({
          shift_id: shift.id,
          professional_id: shift.professional_id,
          shift_date: selectedDate,
          shift_type: shift.shift_type,
          shift_hours: hours,
          ...mealRights,
          total_meals: totalMeals,
          created_by: user?.id,
        });
      }

      if (mealEntries.length > 0) {
        const { error: insertError } = await supabase
          .from('meal_schedules')
          .insert(mealEntries);

        if (insertError) throw insertError;
      }

      toast.success(`Escala de refeições gerada com sucesso! ${mealEntries.length} profissionais incluídos.`);
      await loadMealSchedule();
    } catch (error) {
      console.error('Erro ao gerar escala de refeições:', error);
      toast.error('Erro ao gerar escala de refeições');
    } finally {
      setGenerating(false);
    }
  };

  const generateMealSchedule = () => {
    setShowGenerateConfirm(true);
  };

  const exportToCSV = () => {
    const headers = [
      'Profissional',
      'Categoria',
      'Setor',
      'Tipo de Turno',
      'Horas',
      'Desjejum',
      'Almoço',
      'Jantar',
      'Ceia',
      'Total Refeições'
    ];

    const rows = mealSchedule.map(entry => [
      entry.professional_name,
      entry.category_name,
      entry.department_name,
      entry.shift_type,
      entry.shift_hours,
      entry.has_breakfast ? 'Sim' : 'Não',
      entry.has_lunch ? 'Sim' : 'Não',
      entry.has_dinner ? 'Sim' : 'Não',
      entry.has_supper ? 'Sim' : 'Não',
      entry.total_meals
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `escala_refeicoes_${selectedDate}.csv`;
    link.click();
  };

  const getTotalByMeal = () => {
    return {
      breakfast: mealSchedule.filter(e => e.has_breakfast).length,
      lunch: mealSchedule.filter(e => e.has_lunch).length,
      dinner: mealSchedule.filter(e => e.has_dinner).length,
      supper: mealSchedule.filter(e => e.has_supper).length,
    };
  };

  const totals = getTotalByMeal();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                title="Voltar para Escala do Dia"
              >
                <ArrowLeft className="w-6 h-6 text-gray-600" />
              </button>
            )}
            <Coffee className="w-8 h-8 text-blue-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Escala de Refeições</h2>
              <p className="text-gray-600">Gerencie as refeições dos profissionais</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowConfig(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
            >
              <Settings className="w-4 h-4" />
              Configurar Categorias
            </button>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={generateMealSchedule}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
              {generating ? 'Gerando...' : 'Gerar Escala'}
            </button>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por Empresas (selecione as empresas que deseja incluir)
            </label>
            <div className="flex flex-wrap gap-2">
              {companies.map((company) => {
                const isSelected = selectedCompanies.includes(company.id);
                return (
                  <button
                    key={company.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedCompanies(prev => prev.filter(id => id !== company.id));
                      } else {
                        setSelectedCompanies(prev => [...prev, company.id]);
                      }
                    }}
                    className={`px-4 py-2 rounded-lg border-2 transition ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400'
                    }`}
                  >
                    {company.name}
                  </button>
                );
              })}
              {selectedCompanies.length > 0 && (
                <button
                  onClick={() => setSelectedCompanies([])}
                  className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                >
                  Limpar Filtro
                </button>
              )}
            </div>
            {selectedCompanies.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">
                Nenhuma empresa selecionada - todas as empresas serão incluídas
              </p>
            )}
            {selectedCompanies.length > 0 && (
              <p className="text-sm text-blue-600 mt-2">
                {selectedCompanies.length} empresa(s) selecionada(s)
              </p>
            )}
          </div>
        </div>

        {mealSchedule.length > 0 && (
          <div className="flex justify-end mb-6">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          </div>
        )}

        {mealSchedule.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="text-orange-600 text-sm font-semibold mb-1">Desjejum</div>
              <div className="text-2xl font-bold text-orange-900">{totals.breakfast}</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-blue-600 text-sm font-semibold mb-1">Almoço</div>
              <div className="text-2xl font-bold text-blue-900">{totals.lunch}</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="text-purple-600 text-sm font-semibold mb-1">Jantar</div>
              <div className="text-2xl font-bold text-purple-900">{totals.dinner}</div>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <div className="text-indigo-600 text-sm font-semibold mb-1">Ceia</div>
              <div className="text-2xl font-bold text-indigo-900">{totals.supper}</div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-4">Carregando...</p>
          </div>
        ) : mealSchedule.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Coffee className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Nenhuma escala de refeições gerada para esta data</p>
            <p className="text-sm text-gray-500">Clique em "Gerar Escala" para criar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Profissional
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Categoria
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Setor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                    Turno
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                    Horas
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                    Desjejum
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                    Almoço
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                    Jantar
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                    Ceia
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {mealSchedule.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {entry.professional_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {entry.category_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {entry.department_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {entry.shift_type}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">
                      {entry.shift_hours}h
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.has_breakfast ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-600 rounded-full">
                          ✓
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.has_lunch ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-600 rounded-full">
                          ✓
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.has_dinner ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-600 rounded-full">
                          ✓
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entry.has_supper ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-600 rounded-full">
                          ✓
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                        {entry.total_meals}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showConfig && <MealCategoryConfig onClose={() => setShowConfig(false)} />}

      <ConfirmDialog
        isOpen={showGenerateConfirm}
        title="Gerar Escala de Refeições"
        message="Deseja gerar a escala de refeições para esta data? Isso substituirá qualquer escala existente."
        variant="warning"
        confirmLabel="Sim, gerar"
        cancelLabel="Cancelar"
        onConfirm={() => {
          setShowGenerateConfirm(false);
          doGenerateMealSchedule();
        }}
        onCancel={() => setShowGenerateConfirm(false)}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
