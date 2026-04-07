import { useState, useEffect, useMemo } from 'react';
import { Calendar, Download, Filter, CreditCard as Edit3, Copy, Save, X, UserPlus, Plus, Trash2, Zap, MoreVertical, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import CreateScheduleModal from './CreateScheduleModal';
import AutoFillModal, { ScaleConfig } from './AutoFillModal';
import { exportToPDF, createPrintableSchedule } from '../../utils/pdfExport';
import ConfirmDialog from '../Common/ConfirmDialog';
import ToastContainer from '../Common/ToastContainer';
import { useToast } from '../../hooks/useToast';

interface Professional {
  id: string;
  full_name: string;
  registration_number: string;
  category: { name: string };
  department: { name: string };
  contracted_hours_per_month?: number;
}

interface Shift {
  id: string;
  professional_id: string;
  shift_date: string;
  shift_type: string;
  start_time: string;
  end_time: string;
}

const SHIFT_TYPES = [
  { code: 'SN', name: 'Serviço Noturno (19h às 7h) 12h', start: '19:00', end: '07:00', hours: 12 },
  { code: 'SD', name: 'Serviço Diurno (7h às 19h) 12h', start: '07:00', end: '19:00', hours: 12 },
  { code: 'M', name: 'Manhã (7h às 13h) 6h', start: '07:00', end: '13:00', hours: 6 },
  { code: 'M2', name: 'Manhã (8h às 12h) 4h', start: '08:00', end: '12:00', hours: 4 },
  { code: 'T', name: 'Tarde (12h às 18h) 6h', start: '12:00', end: '18:00', hours: 6 },
  { code: 'MT', name: 'Manhã e Tarde (8h às 17h) 8h', start: '08:00', end: '17:00', hours: 8 },
  { code: '24', name: 'Plantão 24h (7h às 7h) 24h', start: '07:00', end: '07:00', hours: 24 },
  { code: 'FG', name: 'Folga', start: '00:00', end: '00:00', hours: 0 },
  { code: 'FR', name: 'Feriado', start: '00:00', end: '00:00', hours: 0 },
  { code: 'FE', name: 'Férias', start: '00:00', end: '00:00', hours: 0 },
  { code: 'FA', name: 'Falta', start: '00:00', end: '00:00', hours: 0 },
  { code: 'LP', name: 'Licença Prêmio', start: '00:00', end: '00:00', hours: 0 },
  { code: 'LM', name: 'Licença Médica', start: '00:00', end: '00:00', hours: 0 },
  { code: 'LG', name: 'Licença Gestação', start: '00:00', end: '00:00', hours: 0 },
  { code: 'AS', name: 'Afastamento À Serviço', start: '00:00', end: '00:00', hours: 0 },
];

interface MonthlySchedule {
  id: string;
  name: string;
  month: string;
  status: string;
  department_id: string;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
  type: string;
  recurring: boolean;
  active: boolean;
}

interface ConsolidatedScheduleViewProps {
  initialScheduleId?: string | null;
}

export default function ConsolidatedScheduleView({ initialScheduleId }: ConsolidatedScheduleViewProps) {
  const { user } = useAuth();
  const { toasts, toast, removeToast } = useToast();
  const [pendingConfirm, setPendingConfirm] = useState<{ title: string; message: string; action: () => void } | null>(null);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [schedules, setSchedules] = useState<MonthlySchedule[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<string>('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ profId: string; day: number } | null>(null);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddProfessionalModal, setShowAddProfessionalModal] = useState(false);
  const [showCreateScheduleModal, setShowCreateScheduleModal] = useState(false);
  const [allProfessionals, setAllProfessionals] = useState<Professional[]>([]);
  const [professionalIdsInSchedule, setProfessionalIdsInSchedule] = useState<Set<string>>(new Set());
  const [addProfessionalSuccess, setAddProfessionalSuccess] = useState<string | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState<string | null>(null);
  const [actionsMenuPosition, setActionsMenuPosition] = useState({ x: 0, y: 0 });
  const [showAutoFillModal, setShowAutoFillModal] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [expandedSections, setExpandedSections] = useState({
    allDays: false,
    oddDays: false,
    evenDays: false,
    removeDays: false
  });
  const [quickMenuExpanded, setQuickMenuExpanded] = useState({
    shifts: true,
    absences: false
  });

  const shiftsCache = useMemo(() => {
    const cache = new Map<string, Map<string, Shift>>();

    shifts.forEach(shift => {
      if (!cache.has(shift.professional_id)) {
        cache.set(shift.professional_id, new Map());
      }
      cache.get(shift.professional_id)!.set(shift.shift_date, shift);
    });

    return cache;
  }, [shifts]);

  const totalHoursCache = useMemo(() => {
    const cache = new Map<string, number>();

    professionals.forEach(prof => {
      const professionalShifts = shifts.filter(s => s.professional_id === prof.id);
      let totalHours = 0;

      professionalShifts.forEach(shift => {
        const shiftType = SHIFT_TYPES.find(st => st.name === shift.shift_type);
        if (shiftType) {
          totalHours += shiftType.hours;
        }
      });

      cache.set(prof.id, totalHours);
    });

    return cache;
  }, [shifts, professionals]);

  const workDaysCache = useMemo(() => {
    const cache = new Map<string, number>();

    professionals.forEach(prof => {
      const workDays = shifts.filter(s =>
        s.professional_id === prof.id &&
        !['Folga', 'Feriado', 'Férias', 'Falta', 'Licença Prêmio', 'Licença Médica', 'Licença Gestação', 'Afastamento À Serviço'].includes(s.shift_type)
      ).length;
      cache.set(prof.id, workDays);
    });

    return cache;
  }, [shifts, professionals]);

  useEffect(() => {
    loadDepartments();
    loadSchedules();
  }, []);

  useEffect(() => {
    if (selectedMonth) {
      loadHolidays();
    }
  }, [selectedMonth]);

  useEffect(() => {
    if (initialScheduleId && schedules.length > 0) {
      const schedule = schedules.find(s => s.id === initialScheduleId);
      if (schedule) {
        setSelectedSchedule(schedule.id);
        setSelectedDepartment(schedule.department_id);
        setSelectedMonth(schedule.month.slice(0, 7));
      }
    }
  }, [initialScheduleId, schedules]);

  useEffect(() => {
    if (selectedSchedule && selectedMonth) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchedule, selectedMonth]);

  const loadSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('monthly_schedules')
        .select('*')
        .order('month', { ascending: false });

      if (error) {
        console.error('Erro ao carregar escalas:', error);
        return;
      }

      if (data && data.length > 0) {
        setSchedules(data);
        if (!selectedSchedule && !initialScheduleId) {
          setSelectedSchedule(data[0].id);
          setSelectedDepartment(data[0].department_id);
          setSelectedMonth(data[0].month.slice(0, 7));
        }
      }
    } catch (err) {
      console.error('Erro inesperado ao carregar escalas:', err);
    }
  };

  const loadHolidays = async () => {
    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = `${year}-${month}-31`;

      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('active', true)
        .order('date');

      if (error) {
        console.error('Erro ao carregar feriados:', error);
        return;
      }

      setHolidays(data || []);
    } catch (err) {
      console.error('Erro inesperado ao carregar feriados:', err);
    }
  };

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) {
        console.error('Erro ao carregar departamentos:', error);
        return;
      }

      if (data) {
        setDepartments(data);
      }
    } catch (err) {
      console.error('Erro inesperado ao carregar departamentos:', err);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().slice(0, 10);

      const [allProfsData, shiftsData] = await Promise.all([
        supabase
          .from('professionals')
          .select('id, full_name, registration_number, contracted_hours_per_month, category:professional_categories(name), department:departments(name)')
          .eq('department_id', selectedDepartment)
          .eq('active', true)
          .order('full_name'),
        supabase
          .from('shifts')
          .select('id, professional_id, shift_date, shift_type, start_time, end_time')
          .eq('schedule_id', selectedSchedule)
          .gte('shift_date', startDate)
          .lte('shift_date', endDate)
          .order('shift_date'),
      ]);

      if (allProfsData.error) {
        console.error('Erro ao carregar profissionais:', allProfsData.error);
        toast.error('Erro ao carregar profissionais: ' + allProfsData.error.message);
        return;
      }

      if (shiftsData.error) {
        console.error('Erro ao carregar turnos:', shiftsData.error);
        toast.error('Erro ao carregar turnos: ' + shiftsData.error.message);
        return;
      }

      if (allProfsData.data) {
        setAllProfessionals(allProfsData.data);

        if (shiftsData.data) {
          setShifts(shiftsData.data);
          const profsWithShifts = new Set(shiftsData.data.map(s => s.professional_id));
          setProfessionalIdsInSchedule(profsWithShifts);
          setProfessionals(allProfsData.data.filter(p => profsWithShifts.has(p.id)));
        } else {
          setShifts([]);
          setProfessionalIdsInSchedule(new Set());
          setProfessionals([]);
        }
      }
    } catch (err) {
      console.error('Erro inesperado ao carregar dados:', err);
      toast.error('Erro inesperado ao carregar dados. Verifique o console para detalhes.');
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = () => {
    const [year, month] = selectedMonth.split('-');
    return new Date(parseInt(year), parseInt(month), 0).getDate();
  };

  const getShiftCode = (professionalId: string, day: number) => {
    const [year, month] = selectedMonth.split('-');
    const date = `${year}-${month}-${day.toString().padStart(2, '0')}`;
    const shift = shiftsCache.get(professionalId)?.get(date);

    if (!shift) return '';

    const shiftType = SHIFT_TYPES.find(st => st.name === shift.shift_type);
    return shiftType?.code || '';
  };

  const getDayOfWeek = (day: number) => {
    const [year, month] = selectedMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, day);
    const days = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
    return days[date.getDay()];
  };

  const calculateTotalHours = (professionalId: string) => {
    return totalHoursCache.get(professionalId) || 0;
  };

  const isOverWorkload = (professionalId: string) => {
    const professional = professionals.find(p => p.id === professionalId);
    const contractedHours = professional?.contracted_hours_per_month || 180;
    const totalHours = totalHoursCache.get(professionalId) || 0;
    return totalHours > contractedHours;
  };

  const calculateWorkDays = (professionalId: string) => {
    return workDaysCache.get(professionalId) || 0;
  };

  const getCellColorClass = (code: string) => {
    switch (code) {
      case 'FG':
        return 'bg-gray-100 text-gray-700';
      case 'FE':
        return 'bg-yellow-100 text-yellow-900';
      case 'FA':
        return 'bg-red-200 text-red-900';
      case 'LP':
        return 'bg-purple-100 text-purple-900';
      case 'LM':
        return 'bg-red-100 text-red-900';
      case 'LG':
        return 'bg-pink-100 text-pink-900';
      case 'AS':
        return 'bg-orange-100 text-orange-900';
      case 'SN':
        return 'bg-indigo-100 text-indigo-900';
      case 'SD':
        return 'bg-blue-50 text-blue-900';
      case 'M':
        return 'bg-green-50 text-green-900';
      case 'T':
        return 'bg-amber-50 text-amber-900';
      case 'MT':
        return 'bg-teal-50 text-teal-900';
      case '24':
        return 'bg-blue-50 text-blue-900';
      default:
        return 'bg-blue-50 text-blue-900';
    }
  };

  const handleCellClick = (profId: string, day: number, event: React.MouseEvent) => {
    if (!editMode) return;

    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setMenuPosition({ x: rect.left, y: rect.bottom + 5 });
    setSelectedCell({ profId, day });
    setShowQuickMenu(true);
  };

  const handleShiftSelect = async (shiftType: typeof SHIFT_TYPES[0]) => {
    if (!selectedCell) return;

    try {
      const [year, month] = selectedMonth.split('-');
      const date = `${year}-${month}-${selectedCell.day.toString().padStart(2, '0')}`;

      const existingShift = shifts.find(
        s => s.professional_id === selectedCell.profId && s.shift_date === date
      );

      if (existingShift) {
        const { error } = await supabase
          .from('shifts')
          .update({
            shift_type: shiftType.name,
            start_time: shiftType.start,
            end_time: shiftType.end,
          })
          .eq('id', existingShift.id);

        if (error) {
          console.error('Erro ao atualizar turno:', error);
          toast.error('Erro ao atualizar turno: ' + error.message);
          return;
        }

        setShifts(prev => prev.map(s =>
          s.id === existingShift.id
            ? { ...s, shift_type: shiftType.name, start_time: shiftType.start, end_time: shiftType.end }
            : s
        ));
      } else {
        const { data, error } = await supabase
          .from('shifts')
          .insert({
            professional_id: selectedCell.profId,
            department_id: selectedDepartment,
            schedule_id: selectedSchedule,
            shift_date: date,
            shift_type: shiftType.name,
            start_time: shiftType.start,
            end_time: shiftType.end,
            status: 'Agendado',
            created_by: user?.id,
          })
          .select()
          .maybeSingle();

        if (error) {
          console.error('Erro ao inserir turno:', error);

          if (error.message?.includes('duplicate') || error.message?.includes('unique') ||
              error.code === '23505') {
            toast.warning('Este profissional já possui um plantão agendado para esta data nesta escala.');
          } else {
            toast.error('Erro ao inserir turno: ' + error.message);
          }
          return;
        }

        if (!data) {
          console.error('Nenhum turno foi criado');
          toast.error('Erro: Nenhum turno foi criado');
          return;
        }

        setShifts(prev => [...prev, data]);
      }

      setShowQuickMenu(false);
      setSelectedCell(null);
      setHasChanges(true);
    } catch (err) {
      console.error('Erro inesperado ao salvar turno:', err);
      toast.error('Erro inesperado ao salvar turno. Verifique o console para detalhes.');
    }
  };

  const handleDeleteShift = async () => {
    if (!selectedCell) return;

    try {
      const [year, month] = selectedMonth.split('-');
      const date = `${year}-${month}-${selectedCell.day.toString().padStart(2, '0')}`;

      const existingShift = shifts.find(
        s => s.professional_id === selectedCell.profId && s.shift_date === date
      );

      if (existingShift) {
        const { error } = await supabase.from('shifts').delete().eq('id', existingShift.id);

        if (error) {
          console.error('Erro ao deletar turno:', error);
          toast.error('Erro ao deletar turno: ' + error.message);
          return;
        }

        setShifts(prev => prev.filter(s => s.id !== existingShift.id));
        setHasChanges(true);
      }

      setShowQuickMenu(false);
      setSelectedCell(null);
    } catch (err) {
      console.error('Erro inesperado ao deletar turno:', err);
      toast.error('Erro inesperado ao deletar turno. Verifique o console para detalhes.');
    }
  };

  const handleRemoveProfessional = (professionalId: string) => {
    setPendingConfirm({
      title: 'Remover Profissional',
      message: 'Deseja remover este profissional da escala? Todos os plantões deste profissional serão excluídos.',
      action: async () => {
        try {
          const professionalShifts = shifts.filter(s => s.professional_id === professionalId);

          if (professionalShifts.length > 0) {
            const shiftIds = professionalShifts.map(s => s.id);
            const { error } = await supabase.from('shifts').delete().in('id', shiftIds);

            if (error) {
              console.error('Erro ao remover turnos do profissional:', error);
              toast.error('Erro ao remover turnos: ' + error.message);
              return;
            }

            setShifts(prev => prev.filter(s => s.professional_id !== professionalId));
          }

          setProfessionals(prev => prev.filter(p => p.id !== professionalId));
          setProfessionalIdsInSchedule(prev => {
            const newSet = new Set(prev);
            newSet.delete(professionalId);
            return newSet;
          });
          setHasChanges(true);
        } catch (err) {
          console.error('Erro inesperado ao remover profissional:', err);
          toast.error('Erro inesperado ao remover profissional. Verifique o console para detalhes.');
        }
      }
    });
  };

  const handleFillOddDays = async (professionalId: string, shiftType: typeof SHIFT_TYPES[0]) => {
    try {
      setLoading(true);
      const [year, month] = selectedMonth.split('-');
      const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();

      const shiftsToUpdate: any[] = [];
      const shiftsToInsert: any[] = [];

      for (let day = 1; day <= daysInMonth; day += 2) {
        const date = `${year}-${month}-${day.toString().padStart(2, '0')}`;
        const existingShift = shifts.find(
          s => s.professional_id === professionalId && s.shift_date === date
        );

        if (existingShift) {
          shiftsToUpdate.push({
            id: existingShift.id,
            shift_type: shiftType.name,
            start_time: shiftType.start,
            end_time: shiftType.end,
          });
        } else {
          shiftsToInsert.push({
            professional_id: professionalId,
            department_id: selectedDepartment,
            schedule_id: selectedSchedule,
            shift_date: date,
            shift_type: shiftType.name,
            start_time: shiftType.start,
            end_time: shiftType.end,
            status: 'Agendado',
            created_by: user?.id,
          });
        }
      }

      let updateErrors = 0;
      for (const shift of shiftsToUpdate) {
        const { error } = await supabase
          .from('shifts')
          .update({
            shift_type: shift.shift_type,
            start_time: shift.start_time,
            end_time: shift.end_time,
          })
          .eq('id', shift.id);

        if (error) {
          console.error('Erro ao atualizar turno:', error);
          updateErrors++;
        }
      }

      if (updateErrors > 0) {
        toast.warning(`${updateErrors} turno(s) não puderam ser atualizados.`);
      }

      if (shiftsToInsert.length > 0) {
        const { error } = await supabase.from('shifts').insert(shiftsToInsert);
        if (error) {
          console.error('Erro ao inserir turnos:', error);

          if (error.message?.includes('duplicate') || error.message?.includes('unique') ||
              error.code === '23505') {
            toast.warning('Alguns turnos já existem e foram ignorados. Os demais foram criados com sucesso.');
          } else {
            toast.error('Erro ao inserir turnos: ' + error.message);
          }
        }
      }

      await loadData();
      setShowActionsMenu(null);
    } catch (err) {
      console.error('Erro ao preencher dias ímpares:', err);
      toast.error('Erro ao preencher dias. Verifique o console.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillEvenDays = async (professionalId: string, shiftType: typeof SHIFT_TYPES[0]) => {
    try {
      setLoading(true);
      const [year, month] = selectedMonth.split('-');
      const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();

      const shiftsToUpdate: any[] = [];
      const shiftsToInsert: any[] = [];

      for (let day = 2; day <= daysInMonth; day += 2) {
        const date = `${year}-${month}-${day.toString().padStart(2, '0')}`;
        const existingShift = shifts.find(
          s => s.professional_id === professionalId && s.shift_date === date
        );

        if (existingShift) {
          shiftsToUpdate.push({
            id: existingShift.id,
            shift_type: shiftType.name,
            start_time: shiftType.start,
            end_time: shiftType.end,
          });
        } else {
          shiftsToInsert.push({
            professional_id: professionalId,
            department_id: selectedDepartment,
            schedule_id: selectedSchedule,
            shift_date: date,
            shift_type: shiftType.name,
            start_time: shiftType.start,
            end_time: shiftType.end,
            status: 'Agendado',
            created_by: user?.id,
          });
        }
      }

      let updateErrorsEven = 0;
      for (const shift of shiftsToUpdate) {
        const { error } = await supabase
          .from('shifts')
          .update({
            shift_type: shift.shift_type,
            start_time: shift.start_time,
            end_time: shift.end_time,
          })
          .eq('id', shift.id);

        if (error) {
          console.error('Erro ao atualizar turno:', error);
          updateErrorsEven++;
        }
      }

      if (updateErrorsEven > 0) {
        toast.warning(`${updateErrorsEven} turno(s) não puderam ser atualizados.`);
      }

      if (shiftsToInsert.length > 0) {
        const { error } = await supabase.from('shifts').insert(shiftsToInsert);
        if (error) {
          console.error('Erro ao inserir turnos:', error);

          if (error.message?.includes('duplicate') || error.message?.includes('unique') ||
              error.code === '23505') {
            toast.warning('Alguns turnos já existem e foram ignorados. Os demais foram criados com sucesso.');
          } else {
            toast.error('Erro ao inserir turnos: ' + error.message);
          }
        }
      }

      await loadData();
      setShowActionsMenu(null);
    } catch (err) {
      console.error('Erro ao preencher dias pares:', err);
      toast.error('Erro ao preencher dias. Verifique o console.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillAllDays = async (professionalId: string, shiftType: typeof SHIFT_TYPES[0]) => {
    try {
      setLoading(true);
      const [year, month] = selectedMonth.split('-');
      const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();

      const shiftsToUpdate: any[] = [];
      const shiftsToInsert: any[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${year}-${month}-${day.toString().padStart(2, '0')}`;
        const existingShift = shifts.find(
          s => s.professional_id === professionalId && s.shift_date === date
        );

        if (existingShift) {
          shiftsToUpdate.push({
            id: existingShift.id,
            shift_type: shiftType.name,
            start_time: shiftType.start,
            end_time: shiftType.end,
          });
        } else {
          shiftsToInsert.push({
            professional_id: professionalId,
            department_id: selectedDepartment,
            schedule_id: selectedSchedule,
            shift_date: date,
            shift_type: shiftType.name,
            start_time: shiftType.start,
            end_time: shiftType.end,
            status: 'Agendado',
            created_by: user?.id,
          });
        }
      }

      let updateErrorsAll = 0;
      for (const shift of shiftsToUpdate) {
        const { error } = await supabase
          .from('shifts')
          .update({
            shift_type: shift.shift_type,
            start_time: shift.start_time,
            end_time: shift.end_time,
          })
          .eq('id', shift.id);

        if (error) {
          console.error('Erro ao atualizar turno:', error);
          updateErrorsAll++;
        }
      }

      if (updateErrorsAll > 0) {
        toast.warning(`${updateErrorsAll} turno(s) não puderam ser atualizados.`);
      }

      if (shiftsToInsert.length > 0) {
        const { error } = await supabase.from('shifts').insert(shiftsToInsert);
        if (error) {
          console.error('Erro ao inserir turnos:', error);

          if (error.message?.includes('duplicate') || error.message?.includes('unique') ||
              error.code === '23505') {
            toast.warning('Alguns turnos já existem e foram ignorados. Os demais foram criados com sucesso.');
          } else {
            toast.error('Erro ao inserir turnos: ' + error.message);
          }
        }
      }

      await loadData();
      setShowActionsMenu(null);
    } catch (err) {
      console.error('Erro ao preencher todos os dias:', err);
      toast.error('Erro ao preencher dias. Verifique o console.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllDays = (professionalId: string) => {
    setPendingConfirm({
      title: 'Remover Todos os Plantões',
      message: 'Deseja realmente remover TODOS os plantões deste profissional neste mês? Esta ação não pode ser desfeita.',
      action: async () => {
        try {
          setLoading(true);

          const shiftsToDelete = shifts.filter(s => s.professional_id === professionalId);
          const shiftIds = shiftsToDelete.map(s => s.id);

          if (shiftIds.length > 0) {
            const { error } = await supabase
              .from('shifts')
              .delete()
              .in('id', shiftIds);

            if (error) {
              console.error('Erro ao remover turnos:', error);
              toast.error('Erro ao remover turnos: ' + error.message);
            } else {
              await loadData();
              setShowActionsMenu(null);
            }
          } else {
            toast.info('Não há plantões para remover.');
            setShowActionsMenu(null);
          }
        } catch (err) {
          console.error('Erro ao limpar dias:', err);
          toast.error('Erro ao limpar dias. Verifique o console.');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleClearOddDays = (professionalId: string) => {
    setPendingConfirm({
      title: 'Remover Plantões dos Dias Ímpares',
      message: 'Deseja realmente remover os plantões dos dias ÍMPARES deste profissional? Esta ação não pode ser desfeita.',
      action: async () => {
        try {
          setLoading(true);
          const [year, month] = selectedMonth.split('-');
          const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();

          const shiftsToDelete: string[] = [];

          for (let day = 1; day <= daysInMonth; day += 2) {
            const date = `${year}-${month}-${day.toString().padStart(2, '0')}`;
            const existingShift = shifts.find(
              s => s.professional_id === professionalId && s.shift_date === date
            );

            if (existingShift) {
              shiftsToDelete.push(existingShift.id);
            }
          }

          if (shiftsToDelete.length > 0) {
            const { error } = await supabase
              .from('shifts')
              .delete()
              .in('id', shiftsToDelete);

            if (error) {
              console.error('Erro ao remover turnos:', error);
              toast.error('Erro ao remover turnos: ' + error.message);
            } else {
              await loadData();
              setShowActionsMenu(null);
            }
          } else {
            toast.info('Não há plantões nos dias ímpares para remover.');
            setShowActionsMenu(null);
          }
        } catch (err) {
          console.error('Erro ao limpar dias ímpares:', err);
          toast.error('Erro ao limpar dias. Verifique o console.');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleClearEvenDays = (professionalId: string) => {
    setPendingConfirm({
      title: 'Remover Plantões dos Dias Pares',
      message: 'Deseja realmente remover os plantões dos dias PARES deste profissional? Esta ação não pode ser desfeita.',
      action: async () => {
        try {
          setLoading(true);
          const [year, month] = selectedMonth.split('-');
          const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();

          const shiftsToDelete: string[] = [];

          for (let day = 2; day <= daysInMonth; day += 2) {
            const date = `${year}-${month}-${day.toString().padStart(2, '0')}`;
            const existingShift = shifts.find(
              s => s.professional_id === professionalId && s.shift_date === date
            );

            if (existingShift) {
              shiftsToDelete.push(existingShift.id);
            }
          }

          if (shiftsToDelete.length > 0) {
            const { error } = await supabase
              .from('shifts')
              .delete()
              .in('id', shiftsToDelete);

            if (error) {
              console.error('Erro ao remover turnos:', error);
              toast.error('Erro ao remover turnos: ' + error.message);
            } else {
              await loadData();
              setShowActionsMenu(null);
            }
          } else {
            toast.info('Não há plantões nos dias pares para remover.');
            setShowActionsMenu(null);
          }
        } catch (err) {
          console.error('Erro ao limpar dias pares:', err);
          toast.error('Erro ao limpar dias. Verifique o console.');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const applyAutoFillPatterns = async (configs: ScaleConfig[]) => {
    try {
      setLoading(true);
      const [year, month] = selectedMonth.split('-');
      const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();

      for (const config of configs) {
        const { professionalId, pattern, startDay } = config;

        const existingShifts = shifts.filter(s => s.professional_id === professionalId);
        const shiftIdsToDelete = existingShifts.map(s => s.id);

        if (shiftIdsToDelete.length > 0) {
          const { error: deleteError } = await supabase.from('shifts').delete().in('id', shiftIdsToDelete);
          if (deleteError) {
            console.error('Erro ao deletar turnos:', deleteError);
            throw deleteError;
          }
        }

        if (pattern === '12x36-day' || pattern === '12x36-night') {
          const shiftType = pattern === '12x36-day' ? 'SD' : 'SN';
          const shift = SHIFT_TYPES.find(st => st.code === shiftType)!;
          const professional = professionals.find(p => p.id === professionalId);
          const contractedHours = professional?.contracted_hours_per_month || 180;
          let totalHours = 0;

          for (let day = startDay; day <= daysInMonth; day += 2) {
            if (totalHours + shift.hours > contractedHours) {
              console.warn(`Carga horária de ${professional?.full_name} seria excedida. Parando em ${totalHours}h de ${contractedHours}h contratadas.`);
              break;
            }

            const date = `${year}-${month}-${day.toString().padStart(2, '0')}`;

            const { error: insertError } = await supabase
              .from('shifts')
              .insert({
                professional_id: professionalId,
                department_id: selectedDepartment,
                schedule_id: selectedSchedule,
                shift_date: date,
                shift_type: shift.name,
                start_time: shift.start,
                end_time: shift.end,
                status: 'Agendado',
                created_by: user?.id,
              });

            if (insertError) {
              console.error('Erro ao inserir turno:', insertError);
            } else {
              totalHours += shift.hours;
            }
          }
        } else if (pattern === '24x48') {
          const shift24 = SHIFT_TYPES.find(st => st.code === '24')!;
          const professional = professionals.find(p => p.id === professionalId);
          const contractedHours = professional?.contracted_hours_per_month || 240;
          let totalHours = 0;

          for (let day = startDay; day <= daysInMonth; day += 3) {
            if (totalHours + shift24.hours > contractedHours) {
              console.warn(`Carga horária de ${professional?.full_name} seria excedida. Parando em ${totalHours}h de ${contractedHours}h contratadas.`);
              break;
            }

            const date = `${year}-${month}-${day.toString().padStart(2, '0')}`;

            const { error: insertError } = await supabase.from('shifts').insert({
              professional_id: professionalId,
              department_id: selectedDepartment,
              schedule_id: selectedSchedule,
              shift_date: date,
              shift_type: shift24.name,
              start_time: shift24.start,
              end_time: shift24.end,
              status: 'Agendado',
              created_by: user?.id,
            });

            if (insertError) {
              console.error('Erro ao inserir turno:', insertError);
            } else {
              totalHours += shift24.hours;
            }
          }
        } else if (pattern === 'admin-morning') {
          const shiftM = SHIFT_TYPES.find(st => st.code === 'M')!;
          const professional = professionals.find(p => p.id === professionalId);
          const contractedHours = professional?.contracted_hours_per_month || 120;
          let totalHours = 0;

          for (let day = 1; day <= daysInMonth; day++) {
            const date = `${year}-${month}-${day.toString().padStart(2, '0')}`;
            const dayOfWeek = getDayOfWeek(day);

            if (!['SAB', 'DOM'].includes(dayOfWeek)) {
              if (totalHours + shiftM.hours > contractedHours) {
                console.warn(`Carga horária de ${professional?.full_name} seria excedida. Parando em ${totalHours}h de ${contractedHours}h contratadas.`);
                break;
              }

              const { error: insertError } = await supabase.from('shifts').insert({
                professional_id: professionalId,
                department_id: selectedDepartment,
                schedule_id: selectedSchedule,
                shift_date: date,
                shift_type: shiftM.name,
                start_time: shiftM.start,
                end_time: shiftM.end,
                status: 'Agendado',
                created_by: user?.id,
              });

              if (!insertError) {
                totalHours += shiftM.hours;
              }
            }
          }
        } else if (pattern === 'admin-afternoon') {
          const shiftT = SHIFT_TYPES.find(st => st.code === 'T')!;
          const professional = professionals.find(p => p.id === professionalId);
          const contractedHours = professional?.contracted_hours_per_month || 120;
          let totalHours = 0;

          for (let day = 1; day <= daysInMonth; day++) {
            const date = `${year}-${month}-${day.toString().padStart(2, '0')}`;
            const dayOfWeek = getDayOfWeek(day);

            if (!['SAB', 'DOM'].includes(dayOfWeek)) {
              if (totalHours + shiftT.hours > contractedHours) {
                console.warn(`Carga horária de ${professional?.full_name} seria excedida. Parando em ${totalHours}h de ${contractedHours}h contratadas.`);
                break;
              }

              const { error: insertError } = await supabase.from('shifts').insert({
                professional_id: professionalId,
                department_id: selectedDepartment,
                schedule_id: selectedSchedule,
                shift_date: date,
                shift_type: shiftT.name,
                start_time: shiftT.start,
                end_time: shiftT.end,
                status: 'Agendado',
                created_by: user?.id,
              });

              if (!insertError) {
                totalHours += shiftT.hours;
              }
            }
          }
        } else if (pattern === 'admin-full') {
          const shiftMT = SHIFT_TYPES.find(st => st.code === 'MT')!;
          const professional = professionals.find(p => p.id === professionalId);
          const contractedHours = professional?.contracted_hours_per_month || 200;
          let totalHours = 0;

          for (let day = 1; day <= daysInMonth; day++) {
            const date = `${year}-${month}-${day.toString().padStart(2, '0')}`;
            const dayOfWeek = getDayOfWeek(day);

            if (!['SAB', 'DOM'].includes(dayOfWeek)) {
              if (totalHours + shiftMT.hours > contractedHours) {
                console.warn(`Carga horária de ${professional?.full_name} seria excedida. Parando em ${totalHours}h de ${contractedHours}h contratadas.`);
                break;
              }

              const { error: insertError } = await supabase.from('shifts').insert({
                professional_id: professionalId,
                department_id: selectedDepartment,
                schedule_id: selectedSchedule,
                shift_date: date,
                shift_type: shiftMT.name,
                start_time: shiftMT.start,
                end_time: shiftMT.end,
                status: 'Agendado',
                created_by: user?.id,
              });

              if (!insertError) {
                totalHours += shiftMT.hours;
              }
            }
          }
        }
      }

      setShowAutoFillModal(false);
      await loadData();
    } catch (error) {
      console.error('Erro ao aplicar preenchimento automático:', error);
      toast.error('Erro ao aplicar preenchimento automático. Verifique o console para mais detalhes.');
    } finally {
      setLoading(false);
    }
  };

  const copyPreviousMonth = () => {
    setPendingConfirm({
      title: 'Copiar Mês Anterior',
      message: 'Deseja copiar a escala do mês anterior? Isso irá sobrescrever os dados existentes.',
      action: async () => {
        try {
          setLoading(true);
          const [year, month] = selectedMonth.split('-');
          const prevMonth = new Date(parseInt(year), parseInt(month) - 2, 1);
          const prevYear = prevMonth.getFullYear();
          const prevMonthNum = (prevMonth.getMonth() + 1).toString().padStart(2, '0');

          const startDate = `${prevYear}-${prevMonthNum}-01`;
          const endDate = new Date(prevYear, prevMonth.getMonth() + 1, 0).toISOString().slice(0, 10);

          const { data: prevShifts, error: fetchError } = await supabase
            .from('shifts')
            .select('*')
            .eq('department_id', selectedDepartment)
            .gte('shift_date', startDate)
            .lte('shift_date', endDate);

          if (fetchError) {
            console.error('Erro ao buscar turnos do mês anterior:', fetchError);
            toast.error('Erro ao buscar turnos do mês anterior: ' + fetchError.message);
            return;
          }

          if (prevShifts && prevShifts.length > 0) {
            const newShifts = prevShifts.map(shift => {
              const prevDate = new Date(shift.shift_date);
              const newDate = new Date(parseInt(year), parseInt(month) - 1, prevDate.getDate());

              return {
                professional_id: shift.professional_id,
                department_id: shift.department_id,
                schedule_id: selectedSchedule,
                shift_date: newDate.toISOString().slice(0, 10),
                shift_type: shift.shift_type,
                start_time: shift.start_time,
                end_time: shift.end_time,
                status: 'Agendado',
                created_by: user?.id,
              };
            });

            const { error: insertError } = await supabase.from('shifts').insert(newShifts);

            if (insertError) {
              console.error('Erro ao copiar turnos:', insertError);

              if (insertError.message?.includes('duplicate') || insertError.message?.includes('unique') ||
                  insertError.code === '23505') {
                toast.warning('Alguns turnos já existem e foram ignorados. Os demais foram copiados com sucesso.');
              } else {
                toast.error('Erro ao copiar turnos: ' + insertError.message);
              }
              return;
            }

            toast.success('Escala copiada com sucesso!');
            await loadData();
          } else {
            toast.info('Nenhum turno encontrado no mês anterior.');
          }
        } catch (err) {
          console.error('Erro inesperado ao copiar mês anterior:', err);
          toast.error('Erro inesperado ao copiar mês anterior. Verifique o console para detalhes.');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleAddProfessionalToSchedule = (professionalId: string) => {
    setProfessionalIdsInSchedule(prev => new Set([...prev, professionalId]));
    const prof = allProfessionals.find(p => p.id === professionalId);
    if (prof) {
      setProfessionals(prev => [...prev, prof]);
      setAddProfessionalSuccess(`${prof.full_name} adicionado com sucesso!`);
      setTimeout(() => setAddProfessionalSuccess(null), 3000);
    }
  };

  const handleExportPDF = () => {
    const currentSchedule = schedules.find(s => s.id === selectedSchedule);
    if (!currentSchedule) return;

    const dept = departments.find(d => d.id === selectedDepartment);

    const getShiftForDay = (profName: string, day: number) => {
      const prof = professionals.find(p => p.full_name === profName);
      if (!prof) return '';
      return getShiftCode(prof.id, day);
    };

    const printable = createPrintableSchedule(
      currentSchedule.name,
      dept?.name || '',
      selectedMonth,
      professionals,
      getDaysInMonth(),
      getShiftForDay
    );

    exportToPDF(printable, `${currentSchedule.name.replace(/\s+/g, '_')}.pdf`, (msg) => toast.error(msg));
  };

  const daysInMonth = getDaysInMonth();
  const [year, month] = selectedMonth.split('-');
  const monthName = new Date(parseInt(year), parseInt(month) - 1, 15).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Escala Consolidada</h1>
        </div>
        <div className="flex gap-3">
          {!editMode ? (
            <>
              <button
                onClick={() => setShowCreateScheduleModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nova Escala
              </button>
              <button
                onClick={() => setShowAddProfessionalModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Adicionar Profissional
              </button>
              <button
                onClick={copyPreviousMonth}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Copy className="w-4 h-4" />
                Copiar Mês Anterior
              </button>
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                Modo Edição
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowAutoFillModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Preenchimento Automático
              </button>
              <button
                onClick={() => setShowAddProfessionalModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Adicionar Profissional
              </button>
              <button
                onClick={() => {
                  setEditMode(false);
                  setShowQuickMenu(false);
                  if (hasChanges) {
                    loadData();
                    setHasChanges(false);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                Salvar e Sair
              </button>
            </>
          )}
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar PDF
          </button>
        </div>
      </div>

      {editMode && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-yellow-700" />
            <p className="text-sm font-medium text-yellow-900">
              Modo de Edição Ativo - Clique em qualquer célula para adicionar ou editar turnos
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Escala:</span>
          </div>

          <select
            value={selectedSchedule}
            onChange={(e) => {
              const schedule = schedules.find(s => s.id === e.target.value);
              if (schedule) {
                setSelectedSchedule(schedule.id);
                setSelectedDepartment(schedule.department_id);
                setSelectedMonth(schedule.month.slice(0, 7));
              }
            }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {schedules.map((schedule) => (
              <option key={schedule.id} value={schedule.id}>
                {schedule.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando escala...</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 capitalize">
                Mês/Ano: {monthName}
              </h2>
              <p className="text-sm text-gray-600">
                Setor: {departments.find(d => d.id === selectedDepartment)?.name}
              </p>
            </div>

            <div className="overflow-x-auto -mx-6 px-6">
              <div className="inline-block min-w-full">
                <div
                  className="origin-top-left"
                  style={{
                    transform: 'scale(0.85)',
                    transformOrigin: 'top left',
                  }}
                >
                  <table className="border-collapse" style={{ fontSize: '11px', width: 'max-content' }}>
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-2 py-2 text-left font-semibold sticky left-0 bg-gray-100 z-10 whitespace-nowrap" style={{ minWidth: '70px' }}>
                          MATRÍCULA
                        </th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold sticky bg-gray-100 z-10 whitespace-nowrap" style={{ minWidth: '180px', left: '70px' }}>
                          NOME
                        </th>
                        <th className="border border-gray-300 px-2 py-2 text-left font-semibold sticky bg-gray-100 z-10 whitespace-nowrap" style={{ minWidth: '120px', left: '250px' }}>
                          FUNÇÃO
                        </th>
                        <th className="border border-gray-300 px-2 py-2 text-center font-semibold whitespace-nowrap" style={{ minWidth: '60px' }}>
                          DIAS<br/>TRAB.
                        </th>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
                          <th key={day} className="border border-gray-300 px-1 py-2 text-center font-semibold" style={{ minWidth: '32px', maxWidth: '32px' }}>
                            {day}
                          </th>
                        ))}
                        <th className="border border-gray-300 px-2 py-2 text-center font-semibold whitespace-nowrap" style={{ minWidth: '70px' }}>
                          TOTAL<br/>HORAS
                        </th>
                        {editMode && (
                          <th className="border border-gray-300 px-2 py-2 text-center font-semibold sticky right-0 bg-gray-100 z-10 whitespace-nowrap" style={{ minWidth: '50px' }}>
                            AÇÕES
                          </th>
                        )}
                      </tr>
                      <tr className="bg-gray-50">
                        <th colSpan={4} className="border border-gray-300 px-2 py-1"></th>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
                          <th key={day} className="border border-gray-300 px-1 py-1 text-center font-medium text-gray-600" style={{ fontSize: '9px' }}>
                            {getDayOfWeek(day)}
                          </th>
                        ))}
                        <th className="border border-gray-300 px-2 py-1"></th>
                        {editMode && (
                          <th className="border border-gray-300 px-2 py-1 sticky right-0 bg-gray-50"></th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {professionals.map((prof) => (
                        <tr key={prof.id} className={`hover:bg-gray-50 ${isOverWorkload(prof.id) ? 'bg-red-50' : ''}`}>
                          <td className={`border border-gray-300 px-2 py-2 text-center sticky left-0 whitespace-nowrap ${isOverWorkload(prof.id) ? 'bg-red-50' : 'bg-white'}`}>
                            {prof.registration_number || '-'}
                          </td>
                          <td className={`border border-gray-300 px-3 py-2 font-medium sticky whitespace-nowrap ${isOverWorkload(prof.id) ? 'bg-red-50' : 'bg-white'}`} style={{ left: '70px' }}>
                            {prof.full_name}
                          </td>
                          <td className={`border border-gray-300 px-2 py-2 sticky whitespace-nowrap ${isOverWorkload(prof.id) ? 'bg-red-50' : 'bg-white'}`} style={{ left: '250px' }}>
                            {prof.category?.name}
                          </td>
                          <td className="border border-gray-300 px-2 py-2 text-center font-semibold">
                            {calculateWorkDays(prof.id)}
                          </td>
                          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                            const code = getShiftCode(prof.id, day);
                            const isWeekend = ['SAB', 'DOM'].includes(getDayOfWeek(day));
                            return (
                              <td
                                key={day}
                                onClick={(e) => handleCellClick(prof.id, day, e)}
                                className={`border border-gray-300 px-1 py-2 text-center font-semibold ${
                                  code ? getCellColorClass(code) : ''
                                } ${isWeekend && !code ? 'bg-gray-100' : ''} ${
                                  editMode ? 'cursor-pointer hover:ring-2 hover:ring-blue-400' : ''
                                }`}
                                style={{ minWidth: '32px', maxWidth: '32px' }}
                              >
                                {code}
                              </td>
                            );
                          })}
                          <td className={`border border-gray-300 px-2 py-2 text-center font-bold ${
                            isOverWorkload(prof.id)
                              ? 'bg-red-100 text-red-700 border-red-400'
                              : 'text-gray-900'
                          }`}>
                            <div className="flex flex-col items-center">
                              <span className={isOverWorkload(prof.id) ? 'line-through' : ''}>
                                {calculateTotalHours(prof.id)}h
                              </span>
                              {isOverWorkload(prof.id) && (
                                <span style={{ fontSize: '9px' }} className="font-normal">
                                  Lim: {prof.contracted_hours_per_month || 180}h
                                </span>
                              )}
                            </div>
                          </td>
                          {editMode && (
                            <td className="border border-gray-300 px-2 py-2 text-center sticky right-0 bg-white">
                              <button
                                onClick={(e) => {
                                  const button = e.target as HTMLElement;
                                  const rect = button.getBoundingClientRect();

                                  const menuHeight = 450;
                                  const menuWidth = 280;

                                  let x = rect.left - menuWidth - 10;
                                  if (x < 10) x = rect.right + 10;

                                  let y = rect.top;
                                  const spaceBelow = window.innerHeight - rect.bottom;
                                  const spaceAbove = rect.top;

                                  if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
                                    y = Math.max(10, rect.bottom - menuHeight);
                                  } else {
                                    y = Math.min(y, window.innerHeight - menuHeight - 10);
                                    y = Math.max(10, y);
                                  }

                                  setActionsMenuPosition({ x, y });
                                  setExpandedSections({ allDays: false, oddDays: false, evenDays: false, removeDays: false });
                                  setShowActionsMenu(prof.id);
                                }}
                                className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                title="Ações rápidas"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-3">Legenda:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {SHIFT_TYPES.map(type => (
                  <div key={type.code} className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded font-semibold text-xs border ${getCellColorClass(type.code)} border-current`}>
                      {type.code}
                    </span>
                    <span className="text-sm text-gray-700">{type.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {holidays.length > 0 && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Feriados do Mês ({new Date(selectedMonth + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {holidays.map(holiday => {
                    const date = new Date(holiday.date + 'T12:00:00');
                    const day = date.getDate();
                    const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });

                    return (
                      <div key={holiday.id} className="flex items-start gap-3 bg-white p-3 rounded-lg border border-blue-300">
                        <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-lg flex flex-col items-center justify-center">
                          <span className="text-xs font-medium">
                            {date.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()}
                          </span>
                          <span className="text-lg font-bold">{day}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm">{holiday.name}</p>
                          <p className="text-xs text-gray-600 capitalize">{weekday}</p>
                          <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                            {holiday.type}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showQuickMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setShowQuickMenu(false);
              setSelectedCell(null);
            }}
          />
          <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 w-[260px] flex flex-col"
            style={{
              left: menuPosition.x,
              top: menuPosition.y,
              maxHeight: 'calc(100vh - 20px)'
            }}
          >
            <div className="py-2 space-y-1 overflow-y-auto flex-1">
              <button
                onClick={() => setQuickMenuExpanded(prev => ({ ...prev, shifts: !prev.shifts }))}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 rounded transition"
              >
                <div className="flex items-center gap-2">
                  {quickMenuExpanded.shifts ? (
                    <ChevronDown className="w-4 h-4 text-blue-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-blue-600" />
                  )}
                  <span className="text-sm font-semibold text-gray-900">Turnos</span>
                </div>
              </button>

              {quickMenuExpanded.shifts && (
                <div className="space-y-1 px-2">
                  {SHIFT_TYPES.filter(type => ['SN', 'SD', 'M', 'T', 'MT', '24'].includes(type.code)).map(type => (
                    <button
                      key={type.code}
                      onClick={() => handleShiftSelect(type)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded text-left transition"
                    >
                      <span className={`px-2 py-1 rounded font-semibold text-xs min-w-[40px] text-center ${getCellColorClass(type.code)}`}>
                        {type.code}
                      </span>
                      <span className="text-sm text-gray-700 flex-1">{type.name}</span>
                      <span className="text-xs text-gray-500">{type.hours}h</span>
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => setQuickMenuExpanded(prev => ({ ...prev, absences: !prev.absences }))}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 rounded transition"
              >
                <div className="flex items-center gap-2">
                  {quickMenuExpanded.absences ? (
                    <ChevronDown className="w-4 h-4 text-blue-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-blue-600" />
                  )}
                  <span className="text-sm font-semibold text-gray-900">Ausências Justificadas</span>
                </div>
              </button>

              {quickMenuExpanded.absences && (
                <div className="space-y-1 px-2">
                  {SHIFT_TYPES.filter(type => ['FG', 'FR', 'FE', 'FA', 'LP', 'LM', 'LG', 'AS'].includes(type.code)).map(type => (
                    <button
                      key={type.code}
                      onClick={() => handleShiftSelect(type)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded text-left transition"
                    >
                      <span className={`px-2 py-1 rounded font-semibold text-xs min-w-[40px] text-center ${getCellColorClass(type.code)}`}>
                        {type.code}
                      </span>
                      <span className="text-sm text-gray-700 flex-1">{type.name}</span>
                      <span className="text-xs text-gray-500">{type.hours}h</span>
                    </button>
                  ))}
                </div>
              )}

              <hr className="my-2 mx-2" />
              <button
                onClick={handleDeleteShift}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 rounded text-left transition text-red-600"
              >
                <X className="w-4 h-4" />
                <span className="text-sm">Remover</span>
              </button>
            </div>
          </div>
        </>
      )}

      {showActionsMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowActionsMenu(null)}
          />
          <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 w-[280px] flex flex-col"
            style={{
              left: actionsMenuPosition.x,
              top: actionsMenuPosition.y,
              maxHeight: 'calc(100vh - 20px)'
            }}
          >
            <div className="px-3 py-2 border-b border-gray-200 flex items-center gap-2 flex-shrink-0">
              <Zap className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-gray-900">Ações Rápidas</span>
            </div>

            <div className="py-2 space-y-1 overflow-y-auto flex-1">
              <div className="px-3 py-1 bg-gray-50">
                <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">✓ Preencher Dias</p>
              </div>

              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, allDays: !prev.allDays }))}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 rounded transition text-sm"
              >
                <div className="flex items-center gap-2">
                  {expandedSections.allDays ? (
                    <ChevronDown className="w-4 h-4 text-blue-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-blue-600" />
                  )}
                  <span className="text-xs font-semibold text-blue-600 uppercase">Todos os Dias</span>
                </div>
              </button>

              {expandedSections.allDays && (
                <div className="pl-4 space-y-1">
                  {SHIFT_TYPES.filter(type => ['M', 'T', 'MT', 'FG'].includes(type.code)).map(type => (
                    <button
                      key={`all-${type.code}`}
                      onClick={() => handleFillAllDays(showActionsMenu!, type)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 rounded text-left transition text-sm"
                    >
                      <span className={`px-2 py-0.5 rounded font-semibold text-xs ${getCellColorClass(type.code)}`}>
                        {type.code}
                      </span>
                      <span className="text-gray-700">{type.name}</span>
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, oddDays: !prev.oddDays }))}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-green-50 rounded transition text-sm"
              >
                <div className="flex items-center gap-2">
                  {expandedSections.oddDays ? (
                    <ChevronDown className="w-4 h-4 text-green-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-green-600" />
                  )}
                  <span className="text-xs font-semibold text-green-600 uppercase">Dias Ímpares (1,3,5...)</span>
                </div>
              </button>

              {expandedSections.oddDays && (
                <div className="pl-4 space-y-1">
                  {SHIFT_TYPES.slice(0, 5).map(type => (
                    <button
                      key={`odd-${type.code}`}
                      onClick={() => handleFillOddDays(showActionsMenu!, type)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-green-50 rounded text-left transition text-sm"
                    >
                      <span className={`px-2 py-0.5 rounded font-semibold text-xs ${getCellColorClass(type.code)}`}>
                        {type.code}
                      </span>
                      <span className="text-gray-700">{type.name}</span>
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, evenDays: !prev.evenDays }))}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-orange-50 rounded transition text-sm"
              >
                <div className="flex items-center gap-2">
                  {expandedSections.evenDays ? (
                    <ChevronDown className="w-4 h-4 text-orange-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-orange-600" />
                  )}
                  <span className="text-xs font-semibold text-orange-600 uppercase">Dias Pares (2,4,6...)</span>
                </div>
              </button>

              {expandedSections.evenDays && (
                <div className="pl-4 space-y-1">
                  {SHIFT_TYPES.slice(0, 5).map(type => (
                    <button
                      key={`even-${type.code}`}
                      onClick={() => handleFillEvenDays(showActionsMenu!, type)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-orange-50 rounded text-left transition text-sm"
                    >
                      <span className={`px-2 py-0.5 rounded font-semibold text-xs ${getCellColorClass(type.code)}`}>
                        {type.code}
                      </span>
                      <span className="text-gray-700">{type.name}</span>
                    </button>
                  ))}
                </div>
              )}

              <hr className="my-3 border-gray-300" />

              <div className="px-3 py-1 bg-red-50">
                <p className="text-xs font-bold text-red-700 uppercase tracking-wide">✗ Remover Dias</p>
              </div>

              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, removeDays: !prev.removeDays }))}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-red-50 rounded transition text-sm"
              >
                <div className="flex items-center gap-2">
                  {expandedSections.removeDays ? (
                    <ChevronDown className="w-4 h-4 text-red-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-red-600" />
                  )}
                  <span className="text-xs font-semibold text-red-600 uppercase">Opções de Limpeza</span>
                </div>
              </button>

              {expandedSections.removeDays && (
                <div className="pl-4 space-y-1">
                  <button
                    onClick={() => handleClearAllDays(showActionsMenu!)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 rounded text-left transition text-sm text-red-600"
                  >
                    <X className="w-4 h-4" />
                    <span className="font-medium">Limpar Todos os Dias</span>
                  </button>

                  <button
                    onClick={() => handleClearOddDays(showActionsMenu!)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 rounded text-left transition text-sm text-red-600"
                  >
                    <X className="w-4 h-4" />
                    <span className="font-medium">Limpar Dias Ímpares</span>
                  </button>

                  <button
                    onClick={() => handleClearEvenDays(showActionsMenu!)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 rounded text-left transition text-sm text-red-600"
                  >
                    <X className="w-4 h-4" />
                    <span className="font-medium">Limpar Dias Pares</span>
                  </button>
                </div>
              )}

              <hr className="my-3 border-gray-300" />

              <button
                onClick={() => {
                  handleRemoveProfessional(showActionsMenu!);
                  setShowActionsMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-100 rounded text-left transition text-red-700 font-semibold"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-sm">Remover da Escala</span>
              </button>
            </div>
          </div>
        </>
      )}

      {showAddProfessionalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Adicionar Profissionais à Escala</h2>
              <button
                onClick={() => {
                  setShowAddProfessionalModal(false);
                  setAddProfessionalSuccess(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {addProfessionalSuccess && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-green-800">{addProfessionalSuccess}</p>
                </div>
              )}

              <p className="text-sm text-gray-600 mb-4">
                Clique para adicionar profissionais à escala. Você pode adicionar vários de uma vez:
              </p>

              {allProfessionals.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhum profissional disponível neste setor
                </div>
              ) : (
                <div className="space-y-2">
                  {allProfessionals
                    .filter(prof => !professionalIdsInSchedule.has(prof.id))
                    .map(prof => (
                      <button
                        key={prof.id}
                        onClick={() => handleAddProfessionalToSchedule(prof.id)}
                        className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <UserPlus className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-gray-900">{prof.full_name}</p>
                            <p className="text-sm text-gray-600">
                              {prof.category?.name} - Mat: {prof.registration_number || 'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                          Adicionar
                        </div>
                      </button>
                    ))}
                  {allProfessionals.filter(prof => !professionalIdsInSchedule.has(prof.id)).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      Todos os profissionais já estão na escala
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-600">
                  {professionals.length} profissional{professionals.length !== 1 ? 'is' : ''} na escala
                </p>
                <p className="text-xs text-gray-500">
                  {allProfessionals.filter(prof => !professionalIdsInSchedule.has(prof.id)).length} disponível{allProfessionals.filter(prof => !professionalIdsInSchedule.has(prof.id)).length !== 1 ? 'is' : ''}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAddProfessionalModal(false);
                  setAddProfessionalSuccess(null);
                }}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
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

      <AutoFillModal
        isOpen={showAutoFillModal}
        onClose={() => setShowAutoFillModal(false)}
        professionals={professionals}
        onApply={applyAutoFillPatterns}
      />

      <ConfirmDialog
        isOpen={pendingConfirm !== null}
        title={pendingConfirm?.title || ''}
        message={pendingConfirm?.message || ''}
        confirmLabel="Confirmar"
        onConfirm={() => { pendingConfirm?.action(); setPendingConfirm(null); }}
        onCancel={() => setPendingConfirm(null)}
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
