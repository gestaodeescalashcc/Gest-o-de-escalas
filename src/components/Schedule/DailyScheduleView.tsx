import { useState, useEffect } from 'react';
import { Calendar, Filter, Download, ChevronDown, ChevronUp, Coffee } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportToPDF, escapeHTML } from '../../utils/pdfExport';
import MealScheduleView from './MealScheduleView';
import ToastContainer from '../Common/ToastContainer';
import { useToast } from '../../hooks/useToast';

interface Professional {
  id: string;
  full_name: string;
  registration_number: string;
  category: {
    name: string;
  };
}

interface Department {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  shift_date: string;
  shift_type: string;
  start_time: string;
  end_time: string;
  professional_id: string;
  department_id: string;
  professional: Professional;
  department: Department;
}

const SHIFT_TYPES = [
  { code: 'SN', name: 'Noite', time: '19h-07h', color: 'bg-blue-500' },
  { code: 'SD', name: 'Diurno', time: '07h-19h', color: 'bg-green-500' },
  { code: 'M', name: 'Manhã', time: '07h-13h', color: 'bg-yellow-500' },
  { code: 'M2', name: 'Manhã', time: '08h-12h', color: 'bg-yellow-400' },
  { code: 'T', name: 'Tarde', time: '13h-19h', color: 'bg-orange-500' },
  { code: 'MT', name: 'Manhã e Tarde', time: '08h-17h', color: 'bg-amber-500' },
  { code: '24', name: '24h', time: '07h-07h', color: 'bg-purple-500' },
  { code: 'FG', name: 'Folga', time: '-', color: 'bg-gray-400' },
  { code: 'FR', name: 'Feriado', time: '-', color: 'bg-gray-400' },
  { code: 'FE', name: 'Férias', time: '-', color: 'bg-gray-500' },
  { code: 'LP', name: 'Licença Prêmio', time: '-', color: 'bg-gray-500' },
  { code: 'LM', name: 'Licença Médica', time: '-', color: 'bg-gray-500' },
  { code: 'LG', name: 'Licença Gestação', time: '-', color: 'bg-gray-500' },
  { code: 'AS', name: 'Afastamento À Serviço', time: '-', color: 'bg-gray-500' }
];

export default function DailyScheduleView() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedShiftType, setSelectedShiftType] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'schedule' | 'meals'>('schedule');
  const { toasts, toast, removeToast } = useToast();

  useEffect(() => {
    loadDepartments();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadShifts();
    }
  }, [selectedDate, selectedDepartment, selectedShiftType]);

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
    }
  };

  const loadShifts = async () => {
    try {
      setLoading(true);

      // Busca TODAS as escalas ativas para a data selecionada (pode haver múltiplas, uma por departamento)
      const [year, month] = selectedDate.split('-');
      const monthKey = `${year}-${month}-01`;

      const { data: schedulesData, error: scheduleError } = await supabase
        .from('monthly_schedules')
        .select('id, department_id')
        .eq('month', monthKey);

      if (scheduleError) {
        console.error('Erro ao buscar escalas:', scheduleError);
        toast.error('Erro ao carregar escalas do dia.');
      }

      // Monta a query base
      let query = supabase
        .from('shifts')
        .select(`
          *,
          professional:professionals (
            id,
            full_name,
            registration_number,
            category:professional_categories (
              name
            )
          ),
          department:departments (
            id,
            name
          )
        `)
        .eq('shift_date', selectedDate)
        .order('department(name)')
        .order('professional(full_name)');

      // Se encontrou escalas, filtra pelos schedule_ids correspondentes
      if (schedulesData && schedulesData.length > 0) {
        const scheduleIds = schedulesData.map(s => s.id);
        query = query.in('schedule_id', scheduleIds);
      }

      if (selectedDepartment !== 'all') {
        query = query.eq('department_id', selectedDepartment);
      }

      if (selectedShiftType !== 'all') {
        const shiftTypeInfo = SHIFT_TYPES.find(st => st.code === selectedShiftType);
        if (shiftTypeInfo) {
          query = query.in('shift_type', [shiftTypeInfo.code, shiftTypeInfo.name]);
        } else {
          query = query.eq('shift_type', selectedShiftType);
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao carregar turnos:', error);
        toast.error('Erro ao carregar plantões do dia.');
      }

      if (data) {
        setShifts(data as any);
        const deptIds = new Set((data as any).map((s: Shift) => s.department_id));
        setExpandedDepartments(deptIds);
      } else {
        setShifts([]);
      }
    } catch (err) {
      console.error('Erro inesperado ao carregar turnos:', err);
      setShifts([]);
    } finally {
      setLoading(false);
    }
  };

  const getShiftTypeInfo = (type: string) => {
    return SHIFT_TYPES.find(st => st.code === type || st.name === type) || SHIFT_TYPES[0];
  };

  const groupedByDepartment = shifts.reduce((acc, shift) => {
    const deptId = shift.department_id;
    if (!acc[deptId]) {
      acc[deptId] = {
        department: shift.department,
        shifts: []
      };
    }
    acc[deptId].shifts.push(shift);
    return acc;
  }, {} as Record<string, { department: Department; shifts: Shift[] }>);

  const toggleDepartment = (deptId: string) => {
    const newExpanded = new Set(expandedDepartments);
    if (newExpanded.has(deptId)) {
      newExpanded.delete(deptId);
    } else {
      newExpanded.add(deptId);
    }
    setExpandedDepartments(newExpanded);
  };

  const handleExportPDF = () => {
    const dateFormatted = new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    const departmentName = selectedDepartment === 'all'
      ? 'Todos os Setores'
      : departments.find(d => d.id === selectedDepartment)?.name || 'N/A';

    const container = document.createElement('div');
    container.innerHTML = `
      <div style="padding: 40px; font-family: Arial, sans-serif;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="margin: 0; font-size: 28px; color: #1f2937; text-transform: capitalize;">
            Escala do Dia - ${dateFormatted}
          </h1>
          <p style="margin: 10px 0; font-size: 16px; color: #6b7280; font-weight: 500;">
            ${escapeHTML(departmentName)}
          </p>
          <p style="margin: 5px 0; font-size: 12px; color: #9ca3af;">
            Total: ${shifts.length} profissiona${shifts.length !== 1 ? 'is' : 'l'}
          </p>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background-color: #3b82f6; color: white;">
              <th style="border: 1px solid #ddd; padding: 12px 8px; text-align: left; font-weight: 600;">Profissional</th>
              <th style="border: 1px solid #ddd; padding: 12px 8px; text-align: left; font-weight: 600;">Categoria</th>
              <th style="border: 1px solid #ddd; padding: 12px 8px; text-align: center; font-weight: 600;">Matrícula</th>
              <th style="border: 1px solid #ddd; padding: 12px 8px; text-align: left; font-weight: 600;">Setor</th>
              <th style="border: 1px solid #ddd; padding: 12px 8px; text-align: center; font-weight: 600;">Turno</th>
              <th style="border: 1px solid #ddd; padding: 12px 8px; text-align: center; font-weight: 600;">Horário</th>
            </tr>
          </thead>
          <tbody>
            ${shifts.map((shift, idx) => {
              const shiftInfo = getShiftTypeInfo(shift.shift_type);
              return `
                <tr style="background-color: ${idx % 2 === 0 ? '#f9fafb' : 'white'};">
                  <td style="padding: 10px 8px; border: 1px solid #e5e7eb; font-weight: 600; color: #1f2937;">${escapeHTML(shift.professional?.full_name || 'N/A')}</td>
                  <td style="padding: 10px 8px; border: 1px solid #e5e7eb; color: #4b5563;">${escapeHTML(shift.professional?.category?.name || 'N/A')}</td>
                  <td style="padding: 10px 8px; border: 1px solid #e5e7eb; text-align: center; color: #6b7280;">${escapeHTML(shift.professional?.registration_number || 'N/A')}</td>
                  <td style="padding: 10px 8px; border: 1px solid #e5e7eb; color: #4b5563;">${escapeHTML(shift.department?.name || 'N/A')}</td>
                  <td style="padding: 10px 8px; border: 1px solid #e5e7eb; text-align: center;">
                    <span style="font-weight: 700; color: #1f2937;">${escapeHTML(shift.shift_type)}</span>
                  </td>
                  <td style="padding: 10px 8px; border: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 10px;">${shiftInfo.time}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div style="margin-top: 30px; padding: 20px; border-top: 2px solid #e5e7eb; background: #f9fafb;">
          <h3 style="font-size: 13px; margin-bottom: 12px; color: #1f2937; font-weight: 700;">Legenda de Turnos:</h3>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 10px;">
            ${SHIFT_TYPES.map(type => `
              <div style="padding: 6px; background: white; border-radius: 4px; border: 1px solid #e5e7eb;">
                <strong style="color: #1f2937;">${type.code}:</strong> <span style="color: #6b7280;">${type.name} - ${type.time}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div style="margin-top: 20px; text-align: center; font-size: 10px; color: #9ca3af;">
          Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
        </div>
      </div>
    `;

    exportToPDF(container, `Escala_Diaria_${selectedDate}.pdf`, (msg) => toast.error(msg));
  };

  if (viewMode === 'meals') {
    return <MealScheduleView onBack={() => setViewMode('schedule')} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Escala do Dia</h1>
            <p className="text-sm text-gray-600">Visualize todos os profissionais escalados</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('meals')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
          >
            <Coffee className="w-5 h-5" />
            Escala de Refeições
          </button>
          {shifts.length > 0 && (
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              <Download className="w-5 h-5" />
              Exportar PDF
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Filter className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filtros</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Setor
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos os Setores</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Turno
            </label>
            <select
              value={selectedShiftType}
              onChange={(e) => setSelectedShiftType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos os Turnos</option>
              {SHIFT_TYPES.map((type) => (
                <option key={type.code} value={type.code}>
                  {type.name} ({type.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">Carregando escalas...</p>
        </div>
      ) : shifts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma escala encontrada</h3>
          <p className="text-gray-600">
            Não há profissionais escalados para os filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Data selecionada</p>
                <p className="text-xl font-bold text-blue-900 capitalize">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-600 font-medium">Total de profissionais</p>
                <p className="text-3xl font-bold text-blue-900">{shifts.length}</p>
              </div>
            </div>
          </div>

          {selectedDepartment === 'all' ? (
            Object.entries(groupedByDepartment).map(([deptId, { department, shifts: deptShifts }]) => {
              const isExpanded = expandedDepartments.has(deptId);
              return (
                <div key={deptId} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => toggleDepartment(deptId)}
                    className="w-full px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-150 border-b border-gray-200 flex items-center justify-between transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-lg">{deptShifts.length}</span>
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-bold text-gray-900">{department.name}</h3>
                        <p className="text-sm text-gray-600">
                          {deptShifts.length} profissiona{deptShifts.length !== 1 ? 'is' : 'l'} escalado{deptShifts.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-600" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Profissional
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Categoria
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Matrícula
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Turno
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Horário
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {deptShifts.map((shift, idx) => {
                            const shiftInfo = getShiftTypeInfo(shift.shift_type);
                            return (
                              <tr key={shift.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="font-semibold text-gray-900">{shift.professional?.full_name || 'N/A'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  {shift.professional?.category?.name || 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                                  {shift.professional?.registration_number || 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white ${shiftInfo.color}`}>
                                    {shift.shift_type}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                                  {shiftInfo.time}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-blue-600 to-blue-700">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                        Profissional
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                        Categoria
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-white">
                        Matrícula
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                        Setor
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-white">
                        Turno
                      </th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-white">
                        Horário
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {shifts.map((shift, idx) => {
                      const shiftInfo = getShiftTypeInfo(shift.shift_type);
                      return (
                        <tr key={shift.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-semibold text-gray-900">{shift.professional?.full_name || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {shift.professional?.category?.name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                            {shift.professional?.registration_number || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {shift.department?.name || 'Sem setor'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white ${shiftInfo.color}`}>
                              {shift.shift_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                            {shiftInfo.time}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Legenda de Turnos</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {SHIFT_TYPES.map((type) => (
                <div key={type.code} className="flex items-center gap-2">
                  <span className={`w-8 h-8 ${type.color} rounded-lg flex items-center justify-center text-white text-xs font-bold`}>
                    {type.code}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{type.name}</p>
                    <p className="text-xs text-gray-500">{type.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
