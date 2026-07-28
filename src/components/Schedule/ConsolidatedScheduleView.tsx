import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { Calendar, Download, CreditCard as Edit3, Copy, Save, X, UserPlus, Plus, Trash2, Zap, MoreVertical, Sparkles, ChevronDown, ChevronLeft, ChevronRight, Users, CheckCircle2, Lock, Unlock, CalendarX, ArrowLeftRight, AlertCircle, Clock, ArrowUpDown, Repeat, Shuffle, Coffee } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { setCurrentSetor } from '../../lib/setorContext';
import CreateScheduleModal from './CreateScheduleModal';
import AutoFillModal, { ScaleConfig } from './AutoFillModal';
import { exportScheduleToExcel } from '../../utils/excelExport';
import { SHIFT_TYPES } from '../../lib/shiftTypes';
import ConfirmDialog from '../Common/ConfirmDialog';
import ToastContainer from '../Common/ToastContainer';
import EmptyState from '../Common/EmptyState';
import CreateAbsenceModal, { AbsenceInitialData } from '../Absenteeism/CreateAbsenceModal';
import type { AbsenceReason } from '../Absenteeism/AbsenteeismView';
import CreateSwapModal from '../Swaps/CreateSwapModal';
import { useToast } from '../../hooks/useToast';

interface Professional {
  id: string;
  full_name: string;
  registration_number: string;
  coren?: string | null;
  category: { name: string };
  department: { name: string };
  contracted_hours_per_month?: number;
  on_leave?: boolean;
  leave_reason?: string | null;
  display_order?: number | null;
  block_separator_after?: boolean;
  created_at?: string | null;
}

interface Shift {
  id: string;
  professional_id: string | null;
  shift_date: string;
  shift_type: string;
  start_time: string;
  end_time: string;
  original_shift_type?: string | null;
  original_start_time?: string | null;
  original_end_time?: string | null;
  original_professional_id?: string | null;
  published_at?: string | null;
  company_id?: string | null;
  original_company_id?: string | null;
  deleted_in_realizada_at?: string | null;
}

interface MonthlySchedule {
  id: string;
  name: string;
  month: string;
  status: string | null;
  department_id: string;
  published_at?: string | null;
  published_by?: string | null;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
  type: string | null;
  recurring: boolean | null;
  active: boolean | null;
}

interface ConsolidatedScheduleViewProps {
  initialScheduleId?: string | null;
  mode?: 'planejada' | 'troca' | 'realizada';
  onBackToList?: () => void;
}

export default function ConsolidatedScheduleView({ initialScheduleId, mode, onBackToList }: ConsolidatedScheduleViewProps) {
  const { user } = useAuth();
  const { isAdmin, canUpdate, canCreate, canDelete, allowedDepartments } = usePermissions();
  const { toasts, toast, removeToast } = useToast();
  const [pendingConfirm, setPendingConfirm] = useState<{ title: string; message: string; action: () => void } | null>(null);
  const [statusChangeDialog, setStatusChangeDialog] = useState<{
    targetStatus: 'Rascunho' | 'Publicada' | 'Fechada';
    title: string;
    message: string;
    variant: 'default' | 'warning' | 'danger';
    confirmLabel: string;
  } | null>(null);
  const [statusChangeLoading, setStatusChangeLoading] = useState(false);
  // Note: `professionals` is derived from `allProfessionals` + `professionalIdsInSchedule`
  // via useMemo (see below). This guarantees the visible list always matches who's in the schedule,
  // regardless of shift state. Setters were replaced with explicit setProfessionalIdsInSchedule calls.
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [schedules, setSchedules] = useState<MonthlySchedule[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<string>('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  // Inicia false — só vira true quando loadData realmente roda. Evita
  // que a tela fique presa em "Carregando..." se selectedSchedule/Month
  // não estiverem prontos ainda.
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ profId: string; day: number } | null>(null);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddProfessionalModal, setShowAddProfessionalModal] = useState(false);
  const [showCreateScheduleModal, setShowCreateScheduleModal] = useState(false);
  const [allProfessionals, setAllProfessionals] = useState<Professional[]>([]);

  // Ordenação da lista de profissionais na grade.
  // 'custom' = display_order (padrão atual); 'alpha' = nome A→Z;
  // 'created' = data de cadastro; 'alpha_colab_last' = alfabética
  // com nomes "COLABORADOR ..." sempre no fim. Suffix _desc para ordem inversa.
  type SortMode = 'custom' | 'alpha_asc' | 'alpha_desc' | 'created_asc' | 'created_desc' | 'alpha_colab_last';
  const SORT_STORAGE_KEY = 'medscale.schedule.profSort';
  const VALID_SORT_MODES: SortMode[] = ['custom', 'alpha_asc', 'alpha_desc', 'created_asc', 'created_desc', 'alpha_colab_last'];
  const [profSort, setProfSort] = useState<SortMode>(() => {
    try {
      const saved = localStorage.getItem(SORT_STORAGE_KEY) as SortMode | null;
      if (saved && VALID_SORT_MODES.includes(saved)) return saved;
    } catch { /* noop */ }
    return 'custom';
  });
  useEffect(() => {
    try { localStorage.setItem(SORT_STORAGE_KEY, profSort); } catch { /* noop */ }
  }, [profSort]);
  const [professionalIdsInSchedule, setProfessionalIdsInSchedule] = useState<Set<string>>(new Set());
  const [addProfessionalSuccess, setAddProfessionalSuccess] = useState<string | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState<string | null>(null);
  const [actionsMenuPosition, setActionsMenuPosition] = useState({ x: 0, y: 0 });
  const [showAutoFillModal, setShowAutoFillModal] = useState(false);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [clearAllConfirmText, setClearAllConfirmText] = useState('');
  const [clearingAll, setClearingAll] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showDeleteScheduleModal, setShowDeleteScheduleModal] = useState(false);
  const [mobileToolbarOpen, setMobileToolbarOpen] = useState(false);
  const [deleteScheduleConfirm, setDeleteScheduleConfirm] = useState('');
  const [deletingSchedule, setDeletingSchedule] = useState(false);
  const [auditEntries, setAuditEntries] = useState<Array<{
    id: string;
    table_name: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE' | string;
    actionLabel: string;
    description: string | null;
    user_email: string | null;
    created_at: string;
    schedule_id: string | null;
    professional_id: string | null;
    professional_name?: string | null;
    shift_date: string | null;
    old_data: Record<string, any> | null;
    new_data: Record<string, any> | null;
    changed_fields: string[] | null;
  }>>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilters, setAuditFilters] = useState<{
    search: string;
    action: 'all' | 'INSERT' | 'UPDATE' | 'DELETE';
    table: 'all' | 'shifts' | 'monthly_schedules' | 'absences' | 'shift_swaps';
    author: string;
  }>({ search: '', action: 'all', table: 'all', author: '' });
  const [auditExpanded, setAuditExpanded] = useState<Set<string>>(new Set());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  // Absenteísmo
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [absenceInitialData, setAbsenceInitialData] = useState<AbsenceInitialData | undefined>(undefined);
  const [absenceReasons, setAbsenceReasons] = useState<AbsenceReason[]>([]);
  // Troca de plantão
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapInitialShiftId, setSwapInitialShiftId] = useState<string | null>(null);
  // Modo de visualização da escala (planejada / troca e remanejamento / realizada)
  type ViewMode = 'planejada' | 'troca' | 'realizada';
  const [viewMode, setViewMode] = useState<ViewMode>(mode ?? 'planejada');
  // URL é a fonte da verdade: sincroniza o estado interno quando o modo da rota muda.
  useEffect(() => {
    if (mode && mode !== viewMode) setViewMode(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  // A navegação entre camadas agora vive na sidebar (3 entradas). Este componente
  // apenas reflete o `mode` que vem da rota — não precisa mais rotear internamente.
  // Responsive: detect mobile viewport
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // Lista de absences do mês atual (com reason → shift_code)
  const [scheduleAbsences, setScheduleAbsences] = useState<
    Array<{
      professional_id: string;
      coverage_professional_id: string | null;
      start_date: string;
      end_date: string;
      shift_code: string;
      reason_name: string;
    }>
  >([]);
  // Conjunto de células que tiveram troca aprovada: chave = `${professional_id}|${YYYY-MM-DD}`
  const [swappedCells, setSwappedCells] = useState<Set<string>>(new Set());
  // Detalhes da troca por célula (pra suportar desfazer)
  const [swapsByCell, setSwapsByCell] = useState<Map<string, {
    swap_id: string;
    requesting_professional_id: string;
    target_professional_id: string;
    original_shift_id: string;
    offered_shift_id: string | null;
  }>>(new Map());
  const [expandedSections, setExpandedSections] = useState({
    allDays: false,
    oddDays: false,
    evenDays: false,
    weekDays: false,
    removeDays: false
  });
  const [quickMenuExpanded, setQuickMenuExpanded] = useState({
    shifts: true,
    absences: false
  });

  // Lista de profissionais visíveis na escala — derivada de allProfessionals + professionalIdsInSchedule.
  // Single source of truth: quem está na escala = quem está em professionalIdsInSchedule.
  // O conjunto é atualizado explicitamente em loadData (a partir de shifts) e nos handlers
  // de Adicionar/Remover Profissional.
  // Visíveis na grade principal (exclui afastados — eles vão pro rodapé)
  const professionals = useMemo(
    () => {
      const list = allProfessionals.filter(
        p => professionalIdsInSchedule.has(p.id) && !p.on_leave
      );
      const byCustom = (a: Professional, b: Professional) => {
        const aOrder = a.display_order ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.display_order ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (a.full_name ?? '').localeCompare(b.full_name ?? '', 'pt-BR');
      };
      // Collator com numeric:true para "COLABORADOR 2" vir antes de "COLABORADOR 10"
      // (sem isso, ordenação lexicográfica põe 10 antes de 2).
      const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
      const byAlpha = (a: Professional, b: Professional) =>
        collator.compare((a.full_name ?? '').trim(), (b.full_name ?? '').trim());
      const byCreated = (a: Professional, b: Professional) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return ta - tb;
      };
      // "Colaborador" identificado por nome — qualquer profissional cujo
      // full_name contenha "colaborador" (case-insensitive, com ou sem espaço
      // inicial, masculino ou feminino) vai pro fim da lista.
      const isColab = (p: Professional) => /colaborador/i.test((p.full_name ?? '').trim());
      const byAlphaColabLast = (a: Professional, b: Professional) => {
        const ca = isColab(a), cb = isColab(b);
        if (ca !== cb) return ca ? 1 : -1;
        return byAlpha(a, b);
      };
      const cmpMap: Record<SortMode, (a: Professional, b: Professional) => number> = {
        custom: byCustom,
        alpha_asc: byAlpha,
        alpha_desc: (a, b) => -byAlpha(a, b),
        created_asc: byCreated,
        created_desc: (a, b) => -byCreated(a, b),
        alpha_colab_last: byAlphaColabLast,
      };
      return [...list].sort(cmpMap[profSort]);
    },
    [allProfessionals, professionalIdsInSchedule, profSort]
  );
  // Afastados do setor da escala — mostrados automaticamente no rodapé.
  // Não dependem de ter shifts, basta estarem ativos no setor e marcados
  // como afastados na edição do profissional.
  const onLeaveProfessionals = useMemo(
    () => allProfessionals.filter(p => p.on_leave),
    [allProfessionals]
  );

  // Current schedule and lock state
  const currentSchedule = useMemo(
    () => schedules.find(s => s.id === selectedSchedule),
    [schedules, selectedSchedule]
  );
  // Modo de visualização atual.
  const isRealizada = viewMode === 'realizada';
  const isClosed = (currentSchedule as any)?.status === 'Fechada';
  // Escala é considerada "finalizada"/publicada quando monthly_schedules.published_at foi setado
  // (via botão "Finalizar Planejamento"). A partir desse momento, a Planejada vira snapshot
  // (original_*): edições passam a valer só na Realizada e novos plantões não entram na Planejada.
  const isPublished = !!(currentSchedule as any)?.published_at;
  // Trava de edição:
  // - Planejada publicada fica CONGELADA (read-only) até ser REABERTA explicitamente.
  // - Escala 'Fechada' (arquivada) trava tudo.
  // - Troca permanece sempre livre; Realizada é somente-leitura (tratada via isRealizada).
  const isLocked = isClosed || (isPublished && viewMode === 'planejada');
  // Só edita quem: não está travado, não está na Realizada (resultado) e tem permissão.
  const canEditSchedule = !isLocked && !isRealizada && (isAdmin() || canUpdate('schedules'));
  // Reabrir planejamento (destravar Planejada publicada): Admin OU Coordenador do setor da escala.
  const scheduleDeptId = (currentSchedule as any)?.department_id as string | undefined;
  const isCoordOfSchedule =
    !!scheduleDeptId && (!allowedDepartments || allowedDepartments.includes(scheduleDeptId));
  const canReopenPlanning =
    isPublished && (isAdmin() || (canUpdate('schedules') && isCoordOfSchedule));

  // Dono "efetivo" do shift para fins de agrupamento/totais, de acordo com o
  // modo de visualização atual:
  // - Planejada CONGELADA (publicada): usa o dono do snapshot (original_professional_id).
  //   Sem isso, uma troca aprovada DEPOIS da publicação "rouba" retroativamente
  //   o plantão da grade e dos totais da Planejada do profissional original.
  // - Troca/Realizada (ou rascunho ainda não publicado): usa o dono corrente.
  const getEffectiveOwnerId = (shift: { professional_id: string | null; original_professional_id?: string | null }): string | null => {
    if (viewMode === 'planejada' && isPublished) {
      return shift.original_professional_id || null;
    }
    return shift.professional_id;
  };

  // Cache armazena ARRAY de shifts por profissional/dia — permite plantão duplo
  // (ex: SD + SN no mesmo dia quando alguém cobre depois do próprio plantão).
  const shiftsCache = useMemo(() => {
    const cache = new Map<string, Map<string, Shift[]>>();

    shifts.forEach(shift => {
      const ownerId = getEffectiveOwnerId(shift);
      if (!ownerId) return;
      if (!cache.has(ownerId)) {
        cache.set(ownerId, new Map());
      }
      const dayMap = cache.get(ownerId)!;
      const arr = dayMap.get(shift.shift_date) || [];
      arr.push(shift);
      dayMap.set(shift.shift_date, arr);
    });

    return cache;
  }, [shifts, viewMode, isPublished]);

  // Helper: retorna o shift_type "efetivo" do shift de acordo com o modo atual
  // de visualização. Crucial para totais (horas/dias) baterem com a grade.
  const getEffectiveShiftType = (shift: any): string | null => {
    if (viewMode === 'planejada' && isPublished) {
      // Planejada: usa snapshot original. Se NULL (shift adicionado pós-finalização)
      // → não faz parte da Planejada, ignorar nos totais.
      return (shift.original_shift_type as string) || null;
    }
    // Realizada (ou rascunho): pula plantões soft-deletados
    if (shift.deleted_in_realizada_at) return null;
    return shift.shift_type;
  };

  const totalHoursCache = useMemo(() => {
    const cache = new Map<string, number>();
    professionals.forEach(prof => {
      const professionalShifts = shifts.filter(s => getEffectiveOwnerId(s) === prof.id);
      let totalHours = 0;
      professionalShifts.forEach(shift => {
        const name = getEffectiveShiftType(shift);
        if (!name) return;
        const shiftType = SHIFT_TYPES.find(st => st.name === name);
        if (shiftType) totalHours += shiftType.hours;
      });
      cache.set(prof.id, totalHours);
    });
    return cache;
  }, [shifts, professionals, viewMode, isPublished]);

  const NON_WORK_TYPES = new Set([
    'Folga', 'Feriado', 'Férias', 'Falta',
    'Licença Prêmio', 'Licença Médica', 'Licença Gestação', 'Afastamento À Serviço',
  ]);

  const workDaysCache = useMemo(() => {
    const cache = new Map<string, number>();
    professionals.forEach(prof => {
      // Conta DIAS ÚNICOS de trabalho (não shifts). Plantão duplo (SD+SN) no
      // mesmo dia conta como 1 dia trabalhado, não 2.
      const uniqueWorkDates = new Set<string>();
      shifts.forEach(s => {
        if (getEffectiveOwnerId(s) !== prof.id) return;
        const name = getEffectiveShiftType(s);
        if (!name) return;
        if (NON_WORK_TYPES.has(name)) return;
        uniqueWorkDates.add(s.shift_date);
      });
      cache.set(prof.id, uniqueWorkDates.size);
    });
    return cache;
  }, [shifts, professionals, viewMode, isPublished]);

  useEffect(() => {
    loadDepartments();
    loadAbsenceReasons();
  }, []);

  // Recarregar escalas quando o filtro por allowedDepartments mudar
  useEffect(() => {
    loadSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedDepartments]);

  useEffect(() => {
    if (selectedMonth) {
      loadHolidays();
    }
  }, [selectedMonth]);

  // Mantém o "setor atual" (contexto fixo) ao abrir/trocar a escala.
  useEffect(() => {
    if (selectedDepartment) {
      const name = departments.find(d => d.id === selectedDepartment)?.name;
      setCurrentSetor(selectedDepartment, name);
    }
  }, [selectedDepartment, departments]);

  const loadAbsenceReasons = async () => {
    const { data } = await supabase
      .from('absence_reasons')
      .select('*')
      .eq('active', true)
      .order('name');
    if (data) setAbsenceReasons(data);
  };

  // Marca as células (profissional + data) onde houve troca aprovada.
  // Para cada swap aprovado: marca a célula do plantão original (com seu novo dono)
  // e a célula do plantão oferecido (com seu novo dono). Também marca os "donos antigos".
  const loadScheduleSwaps = async (monthStr: string) => {
    if (!monthStr) {
      setSwappedCells(new Set());
      return;
    }
    const [year, month] = monthStr.split('-').map(Number);
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    // 1) Pega os swaps aprovados (sem JOIN para evitar surpresas no shape)
    const { data: swaps, error: swapsErr } = await supabase
      .from('shift_swaps')
      .select('id, requesting_professional_id, target_professional_id, original_shift_id, offered_shift_id')
      .eq('status', 'Aprovado');

    if (swapsErr) {
      console.error('Erro ao carregar trocas:', swapsErr);
      setSwappedCells(new Set());
      return;
    }

    // 2) Coleta todos os shift_ids envolvidos e busca as datas em uma query
    const shiftIds = new Set<string>();
    (swaps ?? []).forEach((s: any) => {
      if (s.original_shift_id) shiftIds.add(s.original_shift_id);
      if (s.offered_shift_id) shiftIds.add(s.offered_shift_id);
    });
    if (shiftIds.size === 0) {
      console.log('[swaps] mês:', monthStr, '| nenhuma troca aprovada');
      setSwappedCells(new Set());
      return;
    }
    const { data: shiftsData, error: shiftsErr } = await supabase
      .from('shifts')
      .select('id, shift_date')
      .in('id', Array.from(shiftIds));

    if (shiftsErr) {
      console.error('Erro ao carregar shifts das trocas:', shiftsErr);
      setSwappedCells(new Set());
      return;
    }
    const dateById = new Map<string, string>();
    (shiftsData ?? []).forEach((sh: any) => dateById.set(sh.id, sh.shift_date));

    // 3) Para cada swap, marca a célula do NOVO dono em cada um dos 2 dias
    //    e guarda mapeamento célula → swap_id (pra suportar desfazer)
    const set = new Set<string>();
    const byCell = new Map<string, any>();
    (swaps ?? []).forEach((s: any) => {
      const originalDate = s.original_shift_id ? dateById.get(s.original_shift_id) : undefined;
      const offeredDate = s.offered_shift_id ? dateById.get(s.offered_shift_id) : undefined;
      const swapInfo = {
        swap_id: s.id,
        requesting_professional_id: s.requesting_professional_id,
        target_professional_id: s.target_professional_id,
        original_shift_id: s.original_shift_id,
        offered_shift_id: s.offered_shift_id,
      };
      if (originalDate && originalDate >= monthStart && originalDate <= monthEnd && s.target_professional_id) {
        const k = `${s.target_professional_id}|${originalDate}`;
        set.add(k);
        byCell.set(k, swapInfo);
      }
      if (offeredDate && offeredDate >= monthStart && offeredDate <= monthEnd && s.requesting_professional_id) {
        const k = `${s.requesting_professional_id}|${offeredDate}`;
        set.add(k);
        byCell.set(k, swapInfo);
      }
    });
    setSwappedCells(set);
    setSwapsByCell(byCell);
  };

  const loadScheduleAbsences = async (scheduleId: string) => {
    if (!scheduleId) {
      setScheduleAbsences([]);
      return;
    }
    const { data, error } = await supabase
      .from('absences')
      .select(`
        professional_id,
        coverage_professional_id,
        start_date,
        end_date,
        reason:absence_reasons(name, shift_code)
      `)
      .eq('schedule_id', scheduleId);

    if (error) {
      console.error('Erro ao carregar ausências da escala:', error);
      return;
    }
    if (data) {
      setScheduleAbsences(
        data.map((a: any) => ({
          professional_id: a.professional_id,
          coverage_professional_id: a.coverage_professional_id,
          start_date: a.start_date,
          end_date: a.end_date,
          shift_code: a.reason?.shift_code ?? 'FA',
          reason_name: a.reason?.name ?? '',
        }))
      );
    }
  };

  // Aplicar initialScheduleId APENAS na primeira vez que as escalas carregam
  // (ou quando o initialScheduleId muda — i.e., usuário navegou para uma URL
  // diferente). Sem o guard, qualquer recarga de `schedules` (toda volta de
  // janela / refetch) jogava o usuário de volta pra escala original da URL.
  const appliedInitialIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialScheduleId || schedules.length === 0) return;
    if (appliedInitialIdRef.current === initialScheduleId) return;
    const schedule = schedules.find(s => s.id === initialScheduleId);
    if (schedule) {
      setSelectedSchedule(schedule.id);
      setSelectedDepartment(schedule.department_id);
      setSelectedMonth(schedule.month.slice(0, 7));
      appliedInitialIdRef.current = initialScheduleId;
    }
  }, [initialScheduleId, schedules]);

  useEffect(() => {
    if (selectedSchedule && selectedMonth) {
      loadData();
      loadScheduleAbsences(selectedSchedule);
      loadScheduleSwaps(selectedMonth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchedule, selectedMonth]);

  const loadSchedules = async () => {
    try {
      let query = supabase
        .from('monthly_schedules')
        .select('*')
        .order('month', { ascending: false });

      // Filtrar pelos setores permitidos quando o usuário não é admin
      // e tem allowed_departments definido (não NULL = sem restrição)
      if (!isAdmin() && allowedDepartments && allowedDepartments.length > 0) {
        query = query.in('department_id', allowedDepartments);
      }

      const { data, error } = await query;

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
      } else {
        setSchedules([]);
      }
    } catch (err) {
      console.error('Erro inesperado ao carregar escalas:', err);
    }
  };

  const loadHolidays = async () => {
    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      // Último dia real do mês (evita 30/31 inválidos)
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

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

  /**
   * Carrega dados da escala.
   * @param keepCurrent Quando true, preserva os profissionais que já estão visíveis
   *   na tela (mesmo que tenham ficado sem turnos após uma operação tipo "limpar dias"
   *   ou tenham acabado de ser adicionados via "Adicionar Profissional").
   */
  const loadData = async (keepCurrent = false) => {
    if (!selectedSchedule || !selectedMonth || !selectedDepartment) {
      console.warn('[loadData] abortado — falta dado:', { selectedSchedule, selectedMonth, selectedDepartment });
      setLoading(false);
      return;
    }
    // Watchdog: se a query travar por mais de 15s, libera o spinner
    const watchdog = setTimeout(() => {
      console.warn('[loadData] timeout 15s — liberando loading');
      setLoading(false);
    }, 15000);
    try {
      setLoading(true);
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().slice(0, 10);

      // Busca profissionais via professional_department_links (multi-setor).
      // Antes filtrávamos só pelo professionals.department_id (primary), o que
      // escondia médicos vinculados a setores secundários. Agora todo profissional
      // com vínculo (primary ou secundário) ao setor selecionado aparece.
      const [primaryProfsData, linkedProfsData, shiftsData, linksData] = await Promise.all([
        supabase
          .from('professionals')
          .select('id, full_name, registration_number, coren, contracted_hours_per_month, on_leave, leave_reason, display_order, block_separator_after, created_at, category:professional_categories!category_id(name), department:departments!department_id(name)')
          .eq('department_id', selectedDepartment)
          .eq('active', true),
        supabase
          .from('professional_department_links')
          .select('professional_id, professionals!inner(id, full_name, registration_number, coren, contracted_hours_per_month, on_leave, leave_reason, display_order, block_separator_after, created_at, active, category:professional_categories!category_id(name), department:departments!department_id(name))')
          .eq('department_id', selectedDepartment)
          .eq('professionals.active', true),
        supabase
          .from('shifts')
          .select('id, professional_id, shift_date, shift_type, start_time, end_time, original_shift_type, original_start_time, original_end_time, original_professional_id, published_at, company_id, original_company_id, deleted_in_realizada_at')
          .eq('schedule_id', selectedSchedule)
          .gte('shift_date', startDate)
          .lte('shift_date', endDate)
          .order('shift_date'),
        // Profissionais explicitamente adicionados à escala (mesmo sem plantões)
        supabase
          .from('schedule_professional_links')
          .select('professional_id')
          .eq('schedule_id', selectedSchedule),
      ]);

      // Une primary + links e deduplica por id
      const allProfsMap = new Map<string, any>();
      (primaryProfsData.data ?? []).forEach((p: any) => allProfsMap.set(p.id, p));
      (linkedProfsData.data ?? []).forEach((row: any) => {
        const p = row.professionals;
        if (p && !allProfsMap.has(p.id)) allProfsMap.set(p.id, p);
      });
      const allProfsList = Array.from(allProfsMap.values())
        .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
      const allProfsData = {
        data: allProfsList,
        error: primaryProfsData.error || linkedProfsData.error,
      };

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

        const shiftsArr = shiftsData.data ?? [];
        setShifts(shiftsArr);
        // Inclui tanto o dono corrente quanto o dono original (snapshot) do plantão
        // — um profissional cujo plantão foi todo trocado após a publicação ainda
        // precisa aparecer como linha na grade da Planejada.
        const profsWithShifts = new Set(
          shiftsArr
            .flatMap(s => [s.professional_id, (s as any).original_professional_id])
            .filter((id): id is string => !!id)
        );
        const linkedProfIds = new Set(((linksData?.data ?? []) as any[]).map(l => l.professional_id));

        // União: profissionais com plantões + explicitamente vinculados à escala
        // (estes últimos podem não ter plantão ainda — recém-adicionados).
        setProfessionalIdsInSchedule(prev => {
          const base = new Set<string>([...profsWithShifts, ...linkedProfIds]);
          if (keepCurrent) {
            for (const id of prev) base.add(id);
          }
          return base;
        });
      }
      // Recarrega marcações de troca para manter a célula verde após swaps
      loadScheduleSwaps(selectedMonth);
    } catch (err) {
      console.error('Erro inesperado ao carregar dados:', err);
      toast.error('Erro inesperado ao carregar dados. Verifique o console para detalhes.');
    } finally {
      clearTimeout(watchdog);
      setLoading(false);
    }
  };

  const getDaysInMonth = () => {
    const [year, month] = selectedMonth.split('-');
    return new Date(parseInt(year), parseInt(month), 0).getDate();
  };

  // Retorna ARRAY de códigos válidos no dia/profissional (pode ser 1 ou 2).
  // Usado para renderizar célula diagonal quando há plantão duplo.
  const getShiftCodes = (professionalId: string, day: number): string[] => {
    const [year, month] = selectedMonth.split('-');
    const date = `${year}-${month}-${day.toString().padStart(2, '0')}`;
    const arr = shiftsCache.get(professionalId)?.get(date) || [];
    if (arr.length === 0) return [];

    const codes: string[] = [];
    for (const shift of arr) {
      let name: string | null;
      if (viewMode === 'planejada' && isPublished) {
        // Planejada: usa snapshot original. Sem original → invisível na planejada.
        name = (shift as any).original_shift_type || null;
      } else {
        // Realizada/rascunho: pula soft-deletados
        if ((shift as any).deleted_in_realizada_at) continue;
        name = shift.shift_type;
      }
      if (!name) continue;
      const found = SHIFT_TYPES.find(st => st.name === name)?.code;
      if (found) codes.push(found);
    }
    // Ordena pra "primeiro horário" vir antes (start_time crescente)
    // — usa o array original já que `arr` está na ordem do banco; manter
    return codes;
  };

  // Compat: retorna o PRIMEIRO código (1º plantão do dia) ou ''
  const getShiftCode = (professionalId: string, day: number): string => {
    const codes = getShiftCodes(professionalId, day);
    return codes[0] || '';
  };

  /**
   * Código da planejada original (snapshot), independente do viewMode atual.
   * Usado para detectar diferenças entre Planejada e Realizada.
   * Quando a escala ainda é rascunho, retorna o código corrente (não há diff).
   */
  const getOriginalShiftCode = (professionalId: string, day: number): string => {
    const [year, month] = selectedMonth.split('-');
    const date = `${year}-${month}-${day.toString().padStart(2, '0')}`;
    const arr = shiftsCache.get(professionalId)?.get(date) || [];
    if (arr.length === 0) return '';
    const first = arr[0];
    let name = '';
    if (isPublished) {
      name = (first as any).original_shift_type || '';
    } else {
      if ((first as any).deleted_in_realizada_at) return '';
      name = first.shift_type;
    }
    if (!name) return '';
    return SHIFT_TYPES.find(st => st.name === name)?.code || '';
  };

  /**
   * Retorna o código que deve ser exibido na célula considerando o modo
   * de visualização atual:
   * - planejada: retorna apenas o código do shift planejado
   * - realizada: aplica absences sobre o planejado (faltas, atestados, etc.
   *   sobrescrevem o código original)
   */
  // Retorna ARRAY de códigos efetivos (com overlays de ausência/cobertura aplicados na Realizada)
  const getEffectiveShiftCodes = (professionalId: string, day: number): string[] => {
    const planned = getShiftCodes(professionalId, day);
    // planejada → snapshot original; troca → shift VIVO (com remanejamentos/trocas)
    // SEM sobrepor absences. Só a Realizada aplica faltas/atestados por cima.
    if (viewMode === 'planejada' || viewMode === 'troca') return planned;

    const [year, month] = selectedMonth.split('-');
    const date = `${year}-${month}-${day.toString().padStart(2, '0')}`;

    const absence = scheduleAbsences.find(
      a =>
        a.professional_id === professionalId &&
        date >= a.start_date &&
        date <= a.end_date
    );
    if (absence) return [absence.shift_code || 'FA'];

    const coverage = scheduleAbsences.find(
      a =>
        a.coverage_professional_id === professionalId &&
        date >= a.start_date &&
        date <= a.end_date
    );
    if (coverage) {
      const coveredCodes = getShiftCodes(coverage.professional_id, day);
      if (coveredCodes.length) return coveredCodes;
    }
    return planned;
  };

  // Compat: 1º código
  const getEffectiveShiftCode = (professionalId: string, day: number): string => {
    return getEffectiveShiftCodes(professionalId, day)[0] || '';
  };

  // Retorna a absence registrada nesse dia (independente do modo)
  // Usado para destacar visualmente células com ausências mesmo em modo Planejada
  const findAbsenceForCell = (professionalId: string, day: number) => {
    const [year, month] = selectedMonth.split('-');
    const date = `${year}-${month}-${day.toString().padStart(2, '0')}`;
    return scheduleAbsences.find(
      a =>
        a.professional_id === professionalId &&
        date >= a.start_date &&
        date <= a.end_date
    );
  };

  const getDayOfWeek = (day: number) => {
    const [year, month] = selectedMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, day);
    const days = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
    return days[date.getDay()];
  };

  // Mapa dia → feriado (do mês selecionado). Permite destaque visual e tooltip.
  const holidayByDay = useMemo(() => {
    const map = new Map<number, Holiday>();
    holidays.forEach(h => {
      // h.date está como 'YYYY-MM-DD' — pega o dia
      const d = parseInt(h.date.slice(8, 10), 10);
      if (!isNaN(d)) map.set(d, h);
    });
    return map;
  }, [holidays]);

  // Maior dia do mês com plantão VIVO não-deletado (usado no badge "Realizada
  // preenchida até dia X").
  const realizadaFilledUntilDay = useMemo(() => {
    let max = 0;
    for (const s of shifts) {
      if ((s as any).deleted_in_realizada_at) continue;
      if (!s.shift_type) continue;
      if (!s.shift_date?.startsWith(selectedMonth)) continue;
      const d = parseInt(s.shift_date.slice(8, 10), 10);
      if (!isNaN(d) && d > max) max = d;
    }
    return max;
  }, [shifts, selectedMonth]);

  const getHolidayForDay = (day: number): Holiday | undefined => holidayByDay.get(day);

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
        return 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200';
      case 'FE':
        return 'bg-yellow-100 text-yellow-900 ring-1 ring-inset ring-yellow-200';
      case 'FA':
        return 'bg-red-200 text-red-900 ring-1 ring-inset ring-red-300';
      case 'FR':
        return 'bg-rose-100 text-rose-900 ring-1 ring-inset ring-rose-200';
      case 'LP':
        return 'bg-purple-100 text-purple-900 ring-1 ring-inset ring-purple-200';
      case 'LM':
        return 'bg-red-100 text-red-900 ring-1 ring-inset ring-red-200';
      case 'LG':
        return 'bg-pink-100 text-pink-900 ring-1 ring-inset ring-pink-200';
      case 'AS':
        return 'bg-orange-100 text-orange-900 ring-1 ring-inset ring-orange-200';
      case 'SN':
        return 'bg-indigo-100 text-indigo-900 ring-1 ring-inset ring-indigo-200';
      case 'SD':
        return 'bg-sky-100 text-sky-900 ring-1 ring-inset ring-sky-200';
      case 'D':
        return 'bg-cyan-100 text-cyan-900 ring-1 ring-inset ring-cyan-200';
      case 'M':
        return 'bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-200';
      case 'M2':
        return 'bg-lime-100 text-lime-900 ring-1 ring-inset ring-lime-200';
      case 'T':
        return 'bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-200';
      case 'MT':
        return 'bg-teal-100 text-teal-900 ring-1 ring-inset ring-teal-200';
      case 'P':
        return 'bg-blue-100 text-blue-900 ring-1 ring-inset ring-blue-200';
      default:
        return 'bg-blue-50 text-blue-900 ring-1 ring-inset ring-blue-200';
    }
  };

  // Hex sólidos para fundos dos totais (linha sticky inferior).
  // Tailwind JIT não emite as classes -50 geradas dinamicamente; usamos inline style.
  const getSolidBgHex = (code: string): string => {
    switch (code) {
      case 'FG': return '#f3f4f6'; // gray-100
      case 'FE': return '#fef9c3'; // yellow-100
      case 'FA': return '#fecaca'; // red-200
      case 'FR': return '#ffe4e6'; // rose-100
      case 'LP': return '#f3e8ff'; // purple-100
      case 'LM': return '#fee2e2'; // red-100
      case 'LG': return '#fce7f3'; // pink-100
      case 'AS': return '#ffedd5'; // orange-100
      case 'SN': return '#e0e7ff'; // indigo-100
      case 'SD': return '#e0f2fe'; // sky-100
      case 'D':  return '#cffafe'; // cyan-100
      case 'M':  return '#d1fae5'; // emerald-100
      case 'M2': return '#ecfccb'; // lime-100
      case 'T':  return '#fef3c7'; // amber-100
      case 'MT': return '#ccfbf1'; // teal-100
      case 'P':  return '#dbeafe'; // blue-100
      default:   return '#dbeafe'; // blue-100
    }
  };

  // Standardized badge classes — all shift codes use the same dimensions
  const SHIFT_BADGE_CLASS =
    'inline-flex items-center justify-center min-w-[40px] h-6 px-2 rounded-md text-xs font-semibold tracking-wide';

  // Sai do modo edição ao entrar numa escala travada OU na aba Realizada (read-only).
  useEffect(() => {
    if ((isLocked || isRealizada) && editMode) {
      setEditMode(false);
      setShowQuickMenu(false);
    }
  }, [isLocked, isRealizada, editMode]);

  const updateScheduleStatus = async (newStatus: 'Rascunho' | 'Publicada' | 'Fechada') => {
    if (!currentSchedule) return;
    setStatusChangeLoading(true);
    try {
      // "Publicada" agora significa "Planejamento finalizado" — chama a RPC que
      // marca published_at e congela a planejada (qualquer INSERT a partir daqui
      // só aparece na Realizada).
      if (newStatus === 'Publicada' && !(currentSchedule as any).published_at) {
        const { data, error } = await supabase.rpc('finalize_schedule_planning' as any, {
          p_schedule_id: currentSchedule.id,
        });
        if (error) throw error;
        const result = data as { success: boolean; error?: string; shifts?: number } | null;
        if (!result?.success) throw new Error(result?.error || 'Falha ao finalizar planejamento');
        await supabase
          .from('monthly_schedules')
          .update({ status: newStatus } as any)
          .eq('id', currentSchedule.id);
        toast.success(`Planejamento finalizado — Planejada congelada (${result.shifts ?? 0} plantões).`);
      } else if (newStatus === 'Rascunho' && (currentSchedule as any).published_at) {
        // Reabrir planejamento — apenas admin via RPC
        const { data, error } = await supabase.rpc('reopen_schedule_planning' as any, {
          p_schedule_id: currentSchedule.id,
        });
        if (error) throw error;
        const result = data as { success: boolean; error?: string } | null;
        if (!result?.success) throw new Error(result?.error || 'Falha ao reabrir');
        await supabase
          .from('monthly_schedules')
          .update({ status: newStatus } as any)
          .eq('id', currentSchedule.id);
        toast.success('Planejamento reaberto.');
      } else {
        const { error } = await supabase
          .from('monthly_schedules')
          .update({ status: newStatus } as any)
          .eq('id', currentSchedule.id);
        if (error) throw error;
        toast.success(`Status alterado para ${newStatus}.`);
      }

      await loadSchedules();
      setStatusChangeDialog(null);
    } catch (err: any) {
      console.error('Error updating schedule status:', err);
      toast.error('Erro: ' + (err.message || 'desconhecido'));
    } finally {
      setStatusChangeLoading(false);
    }
  };

  const requestPublish = () =>
    setStatusChangeDialog({
      targetStatus: 'Publicada',
      title: 'Finalizar planejamento desta escala?',
      message:
        'A Planejada será CONGELADA exatamente como está agora. A partir daqui:\n\n• Edições em plantões existentes → vão apenas para a Realizada (Planejada preservada)\n• Novos plantões adicionados → aparecem só na Realizada (não fazem parte da Planejada original)\n• Exclusões → somem da Realizada mas continuam na Planejada\n\nUse este botão quando terminar de montar a escala e quiser que dali pra frente tudo seja tratado como "exceção".',
      variant: 'default',
      confirmLabel: 'Finalizar planejamento',
    });

  const requestReopen = () =>
    setStatusChangeDialog({
      targetStatus: 'Rascunho',
      title: 'Reabrir escala?',
      message:
        'A escala voltará para o estado de Rascunho e poderá ser editada novamente. Os profissionais não terão mais acesso até nova publicação.',
      variant: 'warning',
      confirmLabel: 'Reabrir',
    });

  const handleCellClick = (profId: string, day: number, event: React.MouseEvent) => {
    // Realizada é somente-leitura (apenas o RESULTADO: Planejada/Troca + ausências +
    // coberturas). Faltas/atestados entram pelo módulo Absenteísmo, não aqui.
    if (isRealizada) return;
    // Nos demais modos o menu sempre abre — as opções variam por permissão e estado
    // (modo edição: turnos+remover; modo visualização ou escala bloqueada:
    // apenas Trocar e Registrar Ausência).
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    // Altura aproximada do popup: ~180px em modo visualização (só 2 botões),
    // ~420px em modo edição (tem turnos, ausências, etc.)
    const popupHeight = editMode && !isLocked ? 420 : 180;
    const margin = 8;

    let x = rect.left;
    // Keep popup within horizontal viewport (260px wide)
    const popupWidth = 260;
    if (x + popupWidth > window.innerWidth - margin) {
      x = Math.max(margin, window.innerWidth - popupWidth - margin);
    }

    // Position above the cell if not enough space below
    let y: number;
    if (spaceBelow >= popupHeight + margin || spaceBelow >= viewportHeight / 2) {
      y = rect.bottom + 5;
    } else {
      // Place above; ensure it doesn't go off the top
      const aboveTop = rect.top - 5 - Math.min(popupHeight, viewportHeight - margin * 2);
      y = Math.max(margin, aboveTop);
    }

    setMenuPosition({ x, y });
    setSelectedCell({ profId, day });
    setShowQuickMenu(true);
  };

  const handleShiftSelect = async (shiftType: typeof SHIFT_TYPES[0]) => {
    if (!selectedCell) return;

    try {
      const [year, month] = selectedMonth.split('-');
      const date = `${year}-${month}-${selectedCell.day.toString().padStart(2, '0')}`;

      // Edição em modo PLANEJADA propaga pra Realizada (atualiza original_* TAMBÉM).
      // Edição em modo REALIZADA só altera os campos correntes (original_* preservado).
      const planejadaFields: Record<string, any> = viewMode === 'planejada'
        ? {
            original_shift_type: shiftType.name,
            original_start_time: shiftType.start,
            original_end_time: shiftType.end,
            original_professional_id: selectedCell.profId,
          }
        : {};

      // Todos os shifts existentes nesse dia/profissional.
      // - Realizada: só os ATIVOS (não soft-deletados).
      // - Planejada: inclui também shifts soft-deletados que ainda têm original_*,
      //   pois eles ESTÃO visíveis na Planejada (vivem só lá).
      const existingShifts = shifts.filter(s => {
        if (s.professional_id !== selectedCell.profId) return false;
        if (s.shift_date !== date) return false;
        const isSoftDeleted = !!(s as any).deleted_in_realizada_at;
        const hasOriginal = !!(s as any).original_shift_type;
        if (viewMode === 'planejada' && isPublished) {
          // Em Planejada, "existente" = qualquer shift que aparece na Planejada
          return hasOriginal;
        }
        return !isSoftDeleted;
      });

      // Se já tem 2 shifts ativos: substituir o primeiro (mantém a regra simples)
      // — pode evoluir depois pra perguntar qual.
      if (existingShifts.length >= 2) {
        const target = existingShifts[0];
        const { error } = await supabase
          .from('shifts')
          .update({
            shift_type: shiftType.name,
            start_time: shiftType.start,
            end_time: shiftType.end,
            deleted_in_realizada_at: null,
            ...planejadaFields,
          } as any)
          .eq('id', target.id);
        if (error) {
          toast.error('Erro ao atualizar turno: ' + error.message);
          return;
        }
        setShifts(prev => prev.map(s =>
          s.id === target.id
            ? ({ ...s, shift_type: shiftType.name, start_time: shiftType.start, end_time: shiftType.end, deleted_in_realizada_at: null } as any)
            : s
        ));
      } else if (existingShifts.length === 1) {
        const existing = existingShifts[0];
        // PLANEJADA: sempre SUBSTITUI o existente (não cria 2º plantão).
        // Plantão duplo (SD+SN diagonal) só faz sentido na Realizada via troca/cobertura.
        if (viewMode === 'planejada') {
          const sameType = existing.shift_type === shiftType.name;
          const alreadySynced = (existing as any).original_shift_type === shiftType.name;
          if (sameType && alreadySynced) {
            setShowQuickMenu(false);
            setSelectedCell(null);
            return;
          }
          const { error } = await supabase
            .from('shifts')
            .update({
              shift_type: shiftType.name,
              start_time: shiftType.start,
              end_time: shiftType.end,
              deleted_in_realizada_at: null,
              ...planejadaFields,
            } as any)
            .eq('id', existing.id);
          if (error) {
            toast.error('Erro ao atualizar plantão (Planejada): ' + error.message);
            return;
          }
          setShifts(prev => prev.map(s =>
            s.id === existing.id
              ? ({ ...s, shift_type: shiftType.name, start_time: shiftType.start, end_time: shiftType.end, deleted_in_realizada_at: null, ...planejadaFields } as any)
              : s
          ));
          setHasChanges(true);
          toast.success('Plantão atualizado na Planejada (e propagado para a Realizada).');
          setShowQuickMenu(false);
          setSelectedCell(null);
          return;
        }
        // REALIZADA: se mesmo tipo, no-op.
        if (existing.shift_type === shiftType.name) {
          setShowQuickMenu(false);
          setSelectedCell(null);
          return;
        }
        // REALIZADA: tipo diferente → cria 2º plantão (plantão duplo via troca/cobertura).
        // Verifica se existe shift INATIVO (soft-deletado) que poderia ser reativado
        const inactive = shifts.find(s =>
          s.professional_id === selectedCell.profId &&
          s.shift_date === date &&
          (s as any).deleted_in_realizada_at
        );
        if (inactive) {
          // Reativa o inativo com o novo tipo (vira o 2º plantão)
          const { error } = await supabase
            .from('shifts')
            .update({
              shift_type: shiftType.name,
              start_time: shiftType.start,
              end_time: shiftType.end,
              deleted_in_realizada_at: null,
              ...planejadaFields,
            } as any)
            .eq('id', inactive.id);
          if (error) {
            toast.error('Erro ao reativar turno: ' + error.message);
            return;
          }
          setShifts(prev => prev.map(s =>
            s.id === inactive.id
              ? ({ ...s, shift_type: shiftType.name, start_time: shiftType.start, end_time: shiftType.end, deleted_in_realizada_at: null } as any)
              : s
          ));
        } else {
          // INSERT como 2º plantão do dia (plantão duplo via troca/cobertura)
          const profForShift = professionals.find(p => p.id === selectedCell.profId);
          const shiftCompanyId = (profForShift as any)?.company_id || null;
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
              company_id: shiftCompanyId,
              created_by: user?.id,
              ...planejadaFields,
            } as any)
            .select()
            .maybeSingle();
          if (error) {
            if (error.code === '23505') {
              toast.warning('Já existe um plantão com esse horário neste dia.');
            } else {
              toast.error('Erro ao inserir 2º plantão: ' + error.message);
            }
            return;
          }
          if (data) setShifts(prev => [...prev, data]);
          toast.success(`Plantão duplo: ${existing.shift_type.split('(')[0].trim()} + ${shiftType.name.split('(')[0].trim()}`);
        }
      } else {
        // 0 shifts "visíveis" na view atual. Antes de INSERT, procura QUALQUER
        // shift no mesmo slot (prof+data+horário) — pode ser:
        //   a) inativo (soft-deletado) → reativa.
        //   b) ativo só na Realizada (original_*=NULL) e estamos em Planejada
        //      → UPDATE para PROMOVER à Planejada (adiciona original_*).
        // Sem essa busca, INSERT bate no unique index do banco e mostra
        // "Já existe um plantão com esse horário" com a célula aparentemente vazia.
        // IMPORTANTE: o Postgres devolve TIME como 'HH:MM:SS' e o catálogo de
        // tipos usa 'HH:MM' → normalizar pra comparar.
        const hhmm = (t: string) => (t || '').slice(0, 5);
        const collidingSlot = shifts.find(s =>
          s.professional_id === selectedCell.profId &&
          s.shift_date === date &&
          hhmm(s.start_time) === hhmm(shiftType.start) &&
          hhmm(s.end_time) === hhmm(shiftType.end)
        );
        if (collidingSlot) {
          const { error } = await supabase
            .from('shifts')
            .update({
              shift_type: shiftType.name,
              start_time: shiftType.start,
              end_time: shiftType.end,
              deleted_in_realizada_at: null,
              ...planejadaFields,
            } as any)
            .eq('id', collidingSlot.id);
          if (error) {
            toast.error('Erro ao atualizar turno: ' + error.message);
            return;
          }
          setShifts(prev => prev.map(s =>
            s.id === collidingSlot.id
              ? ({ ...s, shift_type: shiftType.name, start_time: shiftType.start, end_time: shiftType.end, deleted_in_realizada_at: null, ...planejadaFields } as any)
              : s
          ));
          if (viewMode === 'planejada') {
            toast.success('Plantão registrado na Planejada.');
          }
        } else {
          const profForShift = professionals.find(p => p.id === selectedCell.profId);
          const shiftCompanyId = (profForShift as any)?.company_id || null;
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
              company_id: shiftCompanyId,
              created_by: user?.id,
              ...planejadaFields,
            } as any)
            .select()
            .maybeSingle();
          if (error) {
            if (error.code === '23505') {
              toast.warning('Já existe um plantão com esse horário neste dia.');
            } else {
              toast.error('Erro ao inserir turno: ' + error.message);
            }
            return;
          }
          if (data) setShifts(prev => [...prev, data]);
        }
      }

      setShowQuickMenu(false);
      setSelectedCell(null);
      setHasChanges(true);
    } catch (err) {
      console.error('Erro inesperado ao salvar turno:', err);
      toast.error('Erro inesperado ao salvar turno.');
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // FLUXO "TROCA E REMANEJAMENTO" — ações estruturadas (substitui digitação livre)
  // Estados auxiliares do menu de troca/remanejamento.
  const [trocaAction, setTrocaAction] = useState<null | 'trocar' | 'remanejar' | 'liberar'>(null);
  const [trocaTargetProf, setTrocaTargetProf] = useState<string>('');
  const [trocaRefDay, setTrocaRefDay] = useState<string>('');
  const [trocaSaving, setTrocaSaving] = useState(false);

  const resetTrocaState = () => {
    setTrocaAction(null);
    setTrocaTargetProf('');
    setTrocaRefDay('');
  };

  // Atualiza o shift VIVO (sem mexer em original_*) com novo tipo + notes padronizado.
  // Usado por Remanejar e Liberar por dobra. Retorna true em sucesso.
  const applyLiveShiftChange = async (
    profId: string,
    day: number,
    shiftType: typeof SHIFT_TYPES[0],
    note: string,
  ): Promise<boolean> => {
    const [year, month] = selectedMonth.split('-');
    const date = `${year}-${month}-${day.toString().padStart(2, '0')}`;
    // Pega o primeiro shift vivo (não soft-deletado) do dia.
    const live = shifts
      .filter(s => s.professional_id === profId && s.shift_date === date && !(s as any).deleted_in_realizada_at)
      .sort((a, b) => ((a.start_time || '').localeCompare(b.start_time || '')))[0];

    if (live) {
      const { error } = await supabase
        .from('shifts')
        .update({
          shift_type: shiftType.name,
          start_time: shiftType.start,
          end_time: shiftType.end,
          deleted_in_realizada_at: null,
          notes: note,
        } as any)
        .eq('id', live.id);
      if (error) {
        toast.error('Erro ao aplicar: ' + error.message);
        return false;
      }
      setShifts(prev => prev.map(s =>
        s.id === live.id
          ? ({ ...s, shift_type: shiftType.name, start_time: shiftType.start, end_time: shiftType.end, deleted_in_realizada_at: null, notes: note } as any)
          : s
      ));
      return true;
    }
    // Sem shift vivo — cria (ex.: liberar dia que não tinha plantão vivo).
    const profForShift = professionals.find(p => p.id === profId);
    const shiftCompanyId = (profForShift as any)?.company_id || null;
    const { data, error } = await supabase
      .from('shifts')
      .insert({
        professional_id: profId,
        department_id: selectedDepartment,
        schedule_id: selectedSchedule,
        shift_date: date,
        shift_type: shiftType.name,
        start_time: shiftType.start,
        end_time: shiftType.end,
        status: 'Agendado',
        company_id: shiftCompanyId,
        created_by: user?.id,
        notes: note,
      } as any)
      .select()
      .maybeSingle();
    if (error) {
      if (error.code === '23505') toast.warning('Já existe um plantão com esse horário neste dia.');
      else toast.error('Erro ao aplicar: ' + error.message);
      return false;
    }
    if (data) setShifts(prev => [...prev, data]);
    return true;
  };

  // REMANEJAR — substitui o tipo do shift vivo por um novo código (notes "Remanejamento").
  const handleRemanejar = async (shiftType: typeof SHIFT_TYPES[0]) => {
    if (!selectedCell) return;
    setTrocaSaving(true);
    try {
      const ok = await applyLiveShiftChange(
        selectedCell.profId, selectedCell.day, shiftType,
        `Remanejamento → ${shiftType.code}`,
      );
      if (ok) {
        toast.success(`Remanejado para ${shiftType.code}.`);
        setHasChanges(true);
        setShowQuickMenu(false);
        setSelectedCell(null);
        resetTrocaState();
      }
    } finally {
      setTrocaSaving(false);
    }
  };

  // LIBERAR POR DOBRA — marca o dia como folga (FG) referenciando um dia de dobra.
  const handleLiberarPorDobra = async () => {
    if (!selectedCell) return;
    const fg = SHIFT_TYPES.find(st => st.code === 'FG')!;
    setTrocaSaving(true);
    try {
      const refTxt = trocaRefDay.trim() ? ` (ref. dia ${trocaRefDay.trim()})` : '';
      const ok = await applyLiveShiftChange(
        selectedCell.profId, selectedCell.day, fg,
        `Liberação por dobra${refTxt}`,
      );
      if (ok) {
        toast.success('Liberado por dobra (FG).');
        setHasChanges(true);
        setShowQuickMenu(false);
        setSelectedCell(null);
        resetTrocaState();
      }
    } finally {
      setTrocaSaving(false);
    }
  };

  // TROCAR COM — aplica troca entre dois profissionais no MESMO dia e registra em shift_swaps.
  const handleTrocarCom = async () => {
    if (!selectedCell || !trocaTargetProf) return;
    setTrocaSaving(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const date = `${year}-${month}-${selectedCell.day.toString().padStart(2, '0')}`;
      const live = (pid: string) => shifts
        .filter(s => s.professional_id === pid && s.shift_date === date && !(s as any).deleted_in_realizada_at)
        .sort((a, b) => ((a.start_time || '').localeCompare(b.start_time || '')))[0];

      const reqShift = live(selectedCell.profId);
      if (!reqShift) {
        toast.warning('A célula de origem não tem plantão vivo para trocar.');
        return;
      }
      const targetShift = live(trocaTargetProf);

      // Aplica a troca de forma ATÔMICA: uma única operação no banco, sem
      // updates sequenciais separados (que deixavam a troca pela metade se o
      // 2º update falhasse). A propagação para `shifts` é garantida pelo
      // trigger trg_propagate_shift_swap_approval em shift_swaps — não
      // depende do client fazer os 2 updates certinho.
      if (targetShift) {
        // Troca recíproca: RPC atômica já usada pela tela de aprovação de trocas.
        const { error } = await supabase.rpc('create_and_apply_swap', {
          p_original_shift_id: reqShift.id,
          p_offered_shift_id: targetShift.id,
          p_requesting_professional_id: selectedCell.profId,
          p_target_professional_id: trocaTargetProf,
          p_reason: 'Troca aplicada pela gestão',
        } as any);
        if (error) { toast.error('Erro ao trocar: ' + error.message); return; }
      } else {
        // Cessão simples (sem plantão do alvo nesse dia): registra já Aprovada;
        // o trigger de propagação move o plantão para o profissional alvo.
        const { error } = await supabase
          .from('shift_swaps')
          .insert({
            original_shift_id: reqShift.id,
            offered_shift_id: null,
            requesting_professional_id: selectedCell.profId,
            target_professional_id: trocaTargetProf,
            reason: 'Troca aplicada pela gestão',
            status: 'Aprovado',
          } as any);
        if (error) { toast.error('Erro ao trocar: ' + error.message); return; }
      }
      toast.success('Troca aplicada e registrada.');

      setHasChanges(true);
      setShowQuickMenu(false);
      setSelectedCell(null);
      resetTrocaState();
      await loadData(true);
    } finally {
      setTrocaSaving(false);
    }
  };

  const handleDeleteShift = async () => {
    if (!selectedCell) return;

    try {
      const [year, month] = selectedMonth.split('-');
      const date = `${year}-${month}-${selectedCell.day.toString().padStart(2, '0')}`;

      // Pega os shifts "deletáveis" do dia:
      // - Realizada: shifts ativos (não soft-deletados).
      // - Planejada: shifts ativos OU shifts soft-deletados que ainda têm
      //   original_* (estão visíveis só na Planejada). Sem isso, clicar Remover
      //   em uma célula "só Planejada" não fazia nada (bug silencioso).
      const activeShifts = shifts
        .filter(s => {
          if (s.professional_id !== selectedCell.profId) return false;
          if (s.shift_date !== date) return false;
          const isSoftDeleted = !!(s as any).deleted_in_realizada_at;
          const hasOriginal = !!(s as any).original_shift_type;
          if (viewMode === 'planejada' && isPublished) return hasOriginal;
          return !isSoftDeleted;
        })
        .sort((a, b) => {
          const ta = (a as any).created_at || '';
          const tb = (b as any).created_at || '';
          return tb.localeCompare(ta);  // mais recente primeiro
        });

      const existingShift = activeShifts[0];

      if (existingShift) {
        const hasPlanejada = (existingShift as any).original_shift_type;
        // Regras por modo:
        // - PLANEJADA: hard delete (some das duas vistas)
        // - REALIZADA + escala finalizada com snapshot: soft delete (Planejada preservada)
        // - REALIZADA + sem snapshot OU rascunho: hard delete
        const useSoftDelete = viewMode === 'realizada' && isPublished && hasPlanejada;
        if (useSoftDelete) {
          const { error } = await supabase
            .from('shifts')
            .update({ deleted_in_realizada_at: new Date().toISOString() } as any)
            .eq('id', existingShift.id);
          if (error) {
            toast.error('Erro ao excluir turno: ' + error.message);
            return;
          }
          setShifts(prev =>
            prev.map(s =>
              s.id === existingShift.id
                ? ({ ...s, deleted_in_realizada_at: new Date().toISOString() } as any)
                : s
            )
          );
        } else {
          const { error } = await supabase.from('shifts').delete().eq('id', existingShift.id);
          if (error) {
            toast.error('Erro ao deletar turno: ' + error.message);
            return;
          }
          setShifts(prev => prev.filter(s => s.id !== existingShift.id));
        }
        setHasChanges(true);
        if (activeShifts.length > 1) {
          toast.info(`2º plantão removido. O plantão "${activeShifts[1].shift_type.split('(')[0].trim()}" permanece.`);
        }
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

          // Remove o vínculo escala-profissional para que não reapareça ao recarregar
          if (selectedSchedule) {
            await supabase
              .from('schedule_professional_links')
              .delete()
              .eq('schedule_id', selectedSchedule)
              .eq('professional_id', professionalId);
          }

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

      await loadData(true);
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

      await loadData(true);
      setShowActionsMenu(null);
    } catch (err) {
      console.error('Erro ao preencher dias pares:', err);
      toast.error('Erro ao preencher dias. Verifique o console.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillWeekDays = async (professionalId: string, shiftType: typeof SHIFT_TYPES[0]) => {
    try {
      setLoading(true);
      const [year, month] = selectedMonth.split('-');
      const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();

      const shiftsToUpdate: any[] = [];
      const shiftsToInsert: any[] = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${year}-${month}-${day.toString().padStart(2, '0')}`;
        // Pular finais de semana (Sábado=6, Domingo=0)
        const dow = new Date(parseInt(year), parseInt(month) - 1, day).getDay();
        if (dow === 0 || dow === 6) continue;

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
        if (error) updateErrors++;
      }
      if (updateErrors > 0) {
        toast.warning(`${updateErrors} turno(s) não puderam ser atualizados.`);
      }

      if (shiftsToInsert.length > 0) {
        const { error } = await supabase.from('shifts').insert(shiftsToInsert);
        if (error) {
          if (error.message?.includes('duplicate') || error.code === '23505') {
            toast.warning('Alguns turnos já existem e foram ignorados.');
          } else {
            toast.error('Erro ao inserir turnos: ' + error.message);
          }
        }
      }

      await loadData(true);
      setShowActionsMenu(null);
    } catch (err) {
      console.error('Erro ao preencher dias úteis:', err);
      toast.error('Erro ao preencher dias úteis. Verifique o console.');
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

      await loadData(true);
      setShowActionsMenu(null);
    } catch (err) {
      console.error('Erro ao preencher todos os dias:', err);
      toast.error('Erro ao preencher dias. Verifique o console.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllDays = (professionalId: string) => {
    setShowActionsMenu(null);
    setPendingConfirm({
      title: 'Remover Todos os Plantões',
      message: 'Deseja realmente remover TODOS os plantões deste profissional neste mês? Esta ação não pode ser desfeita.',
      action: async () => {
        try {
          setLoading(true);

          const shiftsToDelete = shifts.filter(s => s.professional_id === professionalId);
          const shiftIds = shiftsToDelete.map(s => s.id);

          if (shiftIds.length > 0) {
            const { data: deleted, error } = await supabase
              .from('shifts')
              .delete()
              .in('id', shiftIds)
              .select('id');

            if (error) {
              console.error('Erro ao remover turnos:', error);
              toast.error('Erro ao remover turnos: ' + error.message);
            } else if (!deleted || deleted.length === 0) {
              toast.error(
                'Não foi possível remover os turnos. Você não tem permissão para essa ação. Procure um Administrador.'
              );
              setShowActionsMenu(null);
            } else {
              await loadData(true);
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
    setShowActionsMenu(null);
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
            const { data: deleted, error } = await supabase
              .from('shifts')
              .delete()
              .in('id', shiftsToDelete)
              .select('id');

            if (error) {
              console.error('Erro ao remover turnos:', error);
              toast.error('Erro ao remover turnos: ' + error.message);
            } else if (!deleted || deleted.length === 0) {
              toast.error(
                'Não foi possível remover os turnos. Você não tem permissão para essa ação. Procure um Administrador.'
              );
              setShowActionsMenu(null);
            } else {
              await loadData(true);
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
    setShowActionsMenu(null);
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
            const { data: deleted, error } = await supabase
              .from('shifts')
              .delete()
              .in('id', shiftsToDelete)
              .select('id');

            if (error) {
              console.error('Erro ao remover turnos:', error);
              toast.error('Erro ao remover turnos: ' + error.message);
            } else if (!deleted || deleted.length === 0) {
              toast.error(
                'Não foi possível remover os turnos. Você não tem permissão para essa ação. Procure um Administrador.'
              );
              setShowActionsMenu(null);
            } else {
              await loadData(true);
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
          const shift24 = SHIFT_TYPES.find(st => st.code === 'P')!;
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
      await loadData(true);
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
            await loadData(true);
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

  const handleAddProfessionalToSchedule = async (professionalId: string) => {
    if (!selectedSchedule) return;
    // Optimistic UI
    setProfessionalIdsInSchedule(prev => new Set([...prev, professionalId]));
    const prof = allProfessionals.find(p => p.id === professionalId);

    // Persiste no banco (link table) — sem isso o profissional sumiria ao recarregar
    const { error } = await supabase
      .from('schedule_professional_links')
      .insert({
        schedule_id: selectedSchedule,
        professional_id: professionalId,
        added_by: user?.id,
      } as any);

    if (error && (error as any).code !== '23505') {
      // 23505 = duplicate key, ok (já estava na escala)
      console.error('Erro ao vincular profissional à escala:', error);
      toast.error('Erro ao adicionar: ' + error.message);
      // Reverter UI optimista
      setProfessionalIdsInSchedule(prev => {
        const next = new Set(prev);
        next.delete(professionalId);
        return next;
      });
      return;
    }

    if (prof) {
      setAddProfessionalSuccess(`${prof.full_name} adicionado com sucesso!`);
      setTimeout(() => setAddProfessionalSuccess(null), 3000);
    }
  };

  // Exclui a escala atual completamente (incluindo seus plantões e swaps)
  const handleDeleteSchedule = async () => {
    if (!selectedSchedule || deleteScheduleConfirm.trim().toUpperCase() !== 'EXCLUIR') return;
    setDeletingSchedule(true);
    try {
      // 1) Coleta IDs dos shifts pra apagar swaps
      const { data: shiftsToDelete } = await supabase
        .from('shifts')
        .select('id')
        .eq('schedule_id', selectedSchedule);
      const shiftIds = (shiftsToDelete ?? []).map(s => s.id);

      const chunk = <T,>(arr: T[], size: number): T[][] => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };

      // 2) Apaga swaps que referenciam esses shifts
      for (const batch of chunk(shiftIds, 50)) {
        await supabase.from('shift_swaps').delete().in('original_shift_id', batch);
        await supabase.from('shift_swaps').delete().in('offered_shift_id', batch);
      }

      // 3) Apaga shifts
      await supabase.from('shifts').delete().eq('schedule_id', selectedSchedule);

      // 4) Apaga a escala
      const { error } = await supabase.from('monthly_schedules').delete().eq('id', selectedSchedule);
      if (error) throw error;

      toast.success('Escala excluída.');
      setShowDeleteScheduleModal(false);
      setDeleteScheduleConfirm('');
      setSelectedSchedule('');
      await loadSchedules();
    } catch (err: any) {
      console.error('Erro ao excluir escala:', err);
      toast.error('Erro ao excluir escala: ' + (err.message ?? 'tente novamente'));
    } finally {
      setDeletingSchedule(false);
    }
  };

  // Desfaz uma troca aprovada: reverte os shifts pros donos originais e apaga o registro do swap
  const [undoingSwap, setUndoingSwap] = useState<{
    swap_id: string;
    requesting_professional_id: string;
    target_professional_id: string;
    original_shift_id: string;
    offered_shift_id: string | null;
  } | null>(null);
  const [undoSwapLoading, setUndoSwapLoading] = useState(false);

  const handleUndoSwap = async () => {
    if (!undoingSwap) return;
    setUndoSwapLoading(true);
    try {
      // Reverte original_shift de volta para requesting_professional_id (dono original)
      const { error: e1 } = await supabase
        .from('shifts')
        .update({ professional_id: undoingSwap.requesting_professional_id })
        .eq('id', undoingSwap.original_shift_id);
      if (e1) throw e1;

      // Reverte offered_shift de volta para target_professional_id (dono original)
      if (undoingSwap.offered_shift_id) {
        const { error: e2 } = await supabase
          .from('shifts')
          .update({ professional_id: undoingSwap.target_professional_id })
          .eq('id', undoingSwap.offered_shift_id);
        if (e2) throw e2;
      }

      // Apaga o registro da troca
      const { error: e3 } = await supabase
        .from('shift_swaps')
        .delete()
        .eq('id', undoingSwap.swap_id);
      if (e3) throw e3;

      toast.success('Troca desfeita.');
      setUndoingSwap(null);
      setShowQuickMenu(false);
      setSelectedCell(null);
      await loadData(true);
    } catch (err: any) {
      console.error('Erro ao desfazer troca:', err);
      toast.error('Erro ao desfazer: ' + (err.message ?? 'tente novamente'));
    } finally {
      setUndoSwapLoading(false);
    }
  };

  // Desfaz absenteísmo: apaga o registro da ausência para essa célula
  const [undoingAbsence, setUndoingAbsence] = useState<{
    professional_id: string;
    professional_name: string;
    date: string;
    reason_name: string;
  } | null>(null);
  const [undoAbsenceLoading, setUndoAbsenceLoading] = useState(false);

  const handleUndoAbsence = async () => {
    if (!undoingAbsence || !selectedSchedule) return;
    setUndoAbsenceLoading(true);
    try {
      const { error } = await supabase
        .from('absences')
        .delete()
        .eq('schedule_id', selectedSchedule)
        .eq('professional_id', undoingAbsence.professional_id)
        .lte('start_date', undoingAbsence.date)
        .gte('end_date', undoingAbsence.date);
      if (error) throw error;

      toast.success('Ausência desfeita.');
      setUndoingAbsence(null);
      setShowQuickMenu(false);
      setSelectedCell(null);
      // Recarrega ausências e dados
      if (selectedSchedule) await loadScheduleAbsences(selectedSchedule);
      await loadData(true);
    } catch (err: any) {
      console.error('Erro ao desfazer ausência:', err);
      toast.error('Erro ao desfazer: ' + (err.message ?? 'tente novamente'));
    } finally {
      setUndoAbsenceLoading(false);
    }
  };

  // Limpa TODOS os plantões da escala atual (mantém a escala e os profissionais vinculados)
  const handleClearAllShifts = async () => {
    if (!selectedSchedule || clearAllConfirmText.trim().toUpperCase() !== 'LIMPAR') return;
    setClearingAll(true);
    try {
      // 1) Pega os IDs dos shifts da escala
      const { data: shiftsToDelete, error: listErr } = await supabase
        .from('shifts')
        .select('id')
        .eq('schedule_id', selectedSchedule);
      if (listErr) throw listErr;

      const shiftIds = (shiftsToDelete ?? []).map(s => s.id);

      if (shiftIds.length === 0) {
        toast.success('Esta escala já está vazia.');
        setShowClearAllModal(false);
        setClearAllConfirmText('');
        return;
      }

      // Função auxiliar para batch — evita URL gigante se houver muitos IDs
      const chunk = <T,>(arr: T[], size: number): T[][] => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };
      const batches = chunk(shiftIds, 50);

      // 2) Apaga shift_swaps que referenciam esses shifts (em batches)
      for (const batch of batches) {
        const { error: e1 } = await supabase
          .from('shift_swaps')
          .delete()
          .in('original_shift_id', batch);
        if (e1) {
          console.error('Erro shift_swaps original:', e1);
          throw new Error(`shift_swaps (original): ${e1.message ?? JSON.stringify(e1)}`);
        }
        const { error: e2 } = await supabase
          .from('shift_swaps')
          .delete()
          .in('offered_shift_id', batch);
        if (e2) {
          console.error('Erro shift_swaps offered:', e2);
          throw new Error(`shift_swaps (offered): ${e2.message ?? JSON.stringify(e2)}`);
        }
      }

      // 3) Apaga os shifts em batches usando schedule_id direto (evita URL gigante)
      const { error: shiftsErr, count } = await supabase
        .from('shifts')
        .delete({ count: 'exact' })
        .eq('schedule_id', selectedSchedule);
      if (shiftsErr) {
        console.error('Erro shifts:', shiftsErr);
        throw new Error(`shifts: ${shiftsErr.message ?? JSON.stringify(shiftsErr)}`);
      }

      toast.success(`${count ?? shiftIds.length} plantão(ões) removido(s) da escala.`);
      setShowClearAllModal(false);
      setClearAllConfirmText('');
      await loadData(true);
    } catch (err: any) {
      console.error('Erro ao limpar plantões:', err);
      toast.error('Erro ao limpar plantões: ' + (err.message ?? JSON.stringify(err)));
    } finally {
      setClearingAll(false);
    }
  };

  // Carrega a trilha imutável da escala atual (schedule_audit_log: triggers no banco).
  // Cobre criação/edição/troca/soft-delete de plantão + publicar/reabrir planejamento.
  const loadAuditLog = async () => {
    if (!selectedSchedule) return;
    setAuditLoading(true);
    try {
      const { data, error } = await supabase
        .from('schedule_audit_log')
        .select(`
          id, action, schedule_id, shift_id, professional_id, shift_date,
          old_shift_type, new_shift_type, old_professional_id, new_professional_id,
          note, actor_email, actor_name, created_at
        `)
        .eq('schedule_id', selectedSchedule)
        .order('created_at', { ascending: false })
        .limit(2000);
      if (error) throw error;

      const rows = (data ?? []) as any[];

      // Lookup de nomes (profissional do evento + os dois lados de uma troca)
      const profIds = new Set<string>();
      rows.forEach(e => {
        if (e.professional_id) profIds.add(e.professional_id);
        if (e.old_professional_id) profIds.add(e.old_professional_id);
        if (e.new_professional_id) profIds.add(e.new_professional_id);
      });
      const nameById = new Map<string, string>();
      if (profIds.size > 0) {
        const { data: profs } = await supabase
          .from('professionals')
          .select('id, full_name')
          .in('id', Array.from(profIds));
        (profs ?? []).forEach((p: any) => nameById.set(p.id, p.full_name));
      }
      const nm = (id: string | null) => (id ? nameById.get(id) ?? '—' : '—');

      // Sigla do turno a partir do nome completo guardado no banco (ex: "Plantão 24h..." → "P")
      const code = (name: string | null) =>
        name ? (SHIFT_TYPES.find(st => st.name === name)?.code ?? name) : null;

      const fmtDay = (d: string | null) => {
        if (!d) return '';
        const [, m, day] = d.split('-');
        return day && m ? ` (${day}/${m})` : '';
      };

      setAuditEntries(
        rows.map(e => {
          const profChanged =
            e.old_professional_id != null &&
            e.new_professional_id != null &&
            e.old_professional_id !== e.new_professional_id;
          const typeChanged =
            (e.old_shift_type ?? null) !== (e.new_shift_type ?? null);

          // Bucket de ação (cor/filtro) e rótulo legível
          let bucket: 'INSERT' | 'UPDATE' | 'DELETE' = 'UPDATE';
          let label = 'Editou';
          let table = 'shifts';
          let description = e.note ?? '';

          const prof = nm(e.professional_id);
          const oldC = code(e.old_shift_type);
          const newC = code(e.new_shift_type);
          const day = fmtDay(e.shift_date);

          switch (e.action) {
            case 'insert':
              bucket = 'INSERT'; label = 'Criou';
              description = `${prof} · ${newC ?? 'plantão'}${day}`;
              break;
            case 'delete':
              bucket = 'DELETE'; label = 'Excluiu';
              description = `${prof} · ${oldC ?? 'plantão'}${day}`;
              break;
            case 'soft_delete':
              bucket = 'DELETE'; label = 'Removeu';
              description = `${prof} · removido da Realizada${day}`;
              break;
            case 'restore':
              bucket = 'UPDATE'; label = 'Restaurou';
              description = `${prof} · restaurado${day}`;
              break;
            case 'publish':
              bucket = 'UPDATE'; label = 'Publicou'; table = 'monthly_schedules';
              description = e.note ?? 'Planejamento publicado/congelado';
              break;
            case 'reopen':
              bucket = 'UPDATE'; label = 'Reabriu'; table = 'monthly_schedules';
              description = e.note ?? 'Planejamento reaberto';
              break;
            default: // 'update'
              if (profChanged) {
                bucket = 'UPDATE'; label = 'Trocou'; table = 'shift_swaps';
                description = `${nm(e.old_professional_id)} → ${nm(e.new_professional_id)}${day}`;
              } else {
                bucket = 'UPDATE'; label = 'Editou';
                description = `${prof}: ${oldC ?? '—'} → ${newC ?? '—'}${day}`;
              }
          }

          // Diff sintetizado para a expansão (reusa a grade Campo/Antes/Depois)
          const changed: string[] = [];
          const oldData: Record<string, any> = {};
          const newData: Record<string, any> = {};
          if (typeChanged && (oldC || newC)) {
            changed.push('turno'); oldData.turno = oldC ?? '—'; newData.turno = newC ?? '—';
          }
          if (profChanged) {
            changed.push('profissional');
            oldData.profissional = nm(e.old_professional_id);
            newData.profissional = nm(e.new_professional_id);
          }

          return {
            id: e.id,
            table_name: table,
            action: bucket,
            actionLabel: label,
            description,
            user_email: e.actor_email ?? e.actor_name ?? null,
            created_at: e.created_at,
            schedule_id: e.schedule_id,
            professional_id: e.professional_id,
            professional_name: e.professional_id ? nm(e.professional_id) : null,
            shift_date: e.shift_date,
            old_data: changed.length ? oldData : null,
            new_data: changed.length ? newData : null,
            changed_fields: changed.length ? changed : null,
          };
        })
      );
      setAuditExpanded(new Set());
    } catch (err: any) {
      console.error('Erro ao carregar histórico:', err);
      toast.error('Erro ao carregar histórico: ' + (err.message ?? 'tente novamente'));
    } finally {
      setAuditLoading(false);
    }
  };

  // Filtros aplicados em memória sobre auditEntries
  const filteredAuditEntries = auditEntries.filter(e => {
    if (auditFilters.action !== 'all' && e.action !== auditFilters.action) return false;
    if (auditFilters.table !== 'all' && e.table_name !== auditFilters.table) return false;
    if (auditFilters.author && !(e.user_email ?? '').toLowerCase().includes(auditFilters.author.toLowerCase())) return false;
    if (auditFilters.search) {
      const q = auditFilters.search.toLowerCase();
      const hay = `${e.description ?? ''} ${e.user_email ?? ''} ${e.professional_name ?? ''} ${e.shift_date ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // Lista de autores únicos para o dropdown
  const auditAuthors = Array.from(new Set(auditEntries.map(e => e.user_email).filter(Boolean))) as string[];

  // Export CSV do log filtrado
  const exportAuditCsv = () => {
    const rows = [
      ['Quando', 'Quem', 'Ação', 'Tabela', 'Profissional', 'Data plantão', 'Descrição', 'Campos alterados'],
      ...filteredAuditEntries.map(e => [
        new Date(e.created_at).toLocaleString('pt-BR'),
        e.user_email ?? 'Sistema',
        e.actionLabel ?? e.action,
        e.table_name,
        e.professional_name ?? '',
        e.shift_date ?? '',
        e.description ?? '',
        (e.changed_fields ?? []).join('; '),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `auditoria-${currentSchedule?.name ?? 'escala'}-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  // Recarrega o log toda vez que o modal abre
  useEffect(() => {
    if (showAuditLog) loadAuditLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAuditLog, selectedSchedule]);

  const handleExportExcel = async () => {
    const cs = schedules.find(s => s.id === selectedSchedule);
    if (!cs) return;

    const dept = departments.find(d => d.id === selectedDepartment);
    const daysInMonth = getDaysInMonth();

    // Construir o map professional_id -> day -> code
    // Usa getEffectiveShiftCodes (array): pega TODOS os plantões do dia.
    // Plantão duplo SD+SN (alguém que fez SD e depois SN via troca) colapsa
    // para "P" no Excel — Excel não suporta célula diagonal nativa, e SD+SN
    // = 24h = Plantão.
    const shiftsByProf = new Map<string, Map<number, string>>();
    professionals.forEach(p => {
      const m = new Map<number, string>();
      for (let day = 1; day <= daysInMonth; day++) {
        const codes = getEffectiveShiftCodes(p.id, day);
        let code = codes[0] || '';
        if (codes.length === 2) {
          const set = new Set(codes);
          // SD + SN = P (Plantão 24h)
          if (set.has('SD') && set.has('SN')) code = 'P';
          // Manhã + Tarde = MT (8h)
          else if (set.has('M') && set.has('T')) code = 'MT';
          // Caso contrário, mantém o primeiro
        }
        if (code) m.set(day, code);
      }
      shiftsByProf.set(p.id, m);
    });

    // Sufixo no nome para diferenciar versão exportada
    const suffix = viewMode === 'realizada' ? ' (Realizada)' : '';

    try {
      await exportScheduleToExcel({
        scheduleName: cs.name + suffix,
        departmentName: dept?.name || '',
        month: selectedMonth,
        professionals: professionals.map(p => ({
          id: p.id,
          full_name: p.full_name,
          registration_number: p.registration_number,
          coren: p.coren,
          category_name: p.category?.name,
          contracted_hours: p.contracted_hours_per_month,
        })),
        shiftsByProf,
      });
      toast.success(
        viewMode === 'realizada'
          ? 'Escala REALIZADA exportada com sucesso (ausências aplicadas).'
          : 'Escala PLANEJADA exportada com sucesso.'
      );
    } catch (err: any) {
      console.error('Erro ao exportar Excel:', err);
      toast.error('Erro ao exportar: ' + (err?.message ?? 'desconhecido'));
    }
  };

  const daysInMonth = getDaysInMonth();
  // Mostra a coluna COREN só quando há profissionais de enfermagem na escala
  // (categoria contém "enferm" no nome)
  const showCorenColumn = useMemo(
    () => professionals.some(p => /enferm/i.test(p.category?.name ?? '')),
    [professionals]
  );
  const [year, month] = selectedMonth.split('-');
  const monthName = new Date(parseInt(year), parseInt(month) - 1, 15).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  });

  // Totais diários por tipo de turno (rodapé da tabela)
  // Estrutura: Map<day, Map<code, count>>
  // Mostra apenas turnos efetivos (já considera ausências quando viewMode === 'realizada')
  const { dailyShiftTotals, uniqueShiftCodes } = (() => {
    const totals = new Map<number, Map<string, number>>();
    const codes = new Set<string>();
    for (let d = 1; d <= daysInMonth; d++) {
      const dayMap = new Map<string, number>();
      professionals.forEach(p => {
        const code = getEffectiveShiftCode(p.id, d);
        if (code) {
          dayMap.set(code, (dayMap.get(code) ?? 0) + 1);
          codes.add(code);
        }
      });
      totals.set(d, dayMap);
    }
    // Ordenação: turnos de trabalho primeiro (SD, SN, M, T, M2, MT, P), depois ausências
    const WORK_ORDER = ['SD', 'SN', 'M', 'T', 'M2', 'MT', 'P'];
    const sorted = Array.from(codes).sort((a, b) => {
      const ai = WORK_ORDER.indexOf(a);
      const bi = WORK_ORDER.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
    return { dailyShiftTotals: totals, uniqueShiftCodes: sorted };
  })();


  // Escala "recém-criada" → Copiar Mês Anterior só faz sentido aqui.
  const isEmptySchedule = !!currentSchedule && shifts.length === 0;
  // Unifica o estado do overflow (`⋯`) entre mobile e desktop reusando mobileToolbarOpen.
  const moreMenuOpen = mobileToolbarOpen;
  const setMoreMenuOpen = setMobileToolbarOpen;

  // Stickify das colunas TOTAL SD/SN/... à direita (antes da coluna TOTAL HORAS).
  // Empilha da direita pra esquerda: rightmost code col senta logo após
  // TOTAL HORAS (70px), as próximas vão somando 38px (largura da col code).
  const TOTAL_HORAS_W = 70;
  const TOTAL_CODE_W = 38;
  const rightStickyBase = editMode ? 50 : 0;
  const codeColRight = (i: number) =>
    rightStickyBase + TOTAL_HORAS_W + (uniqueShiftCodes.length - 1 - i) * TOTAL_CODE_W;

  // Identidade visual da página por modo. Aplicada no título grande,
  // na borda superior da seção principal (accent bar) e no subtítulo.
  // A ideia é que, ao olhar de relance, seja impossível confundir Planejada
  // com Troca ou Realizada — cores e legenda mudam junto.
  const pageHeading = {
    planejada: {
      label: 'ESCALA PLANEJADA',
      cls: 'text-blue-700',
      Icon: Calendar,
      accent: 'from-blue-500 to-blue-700',
      subtitle: 'Montagem da escala',
      tint: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    troca: {
      label: 'TROCA E REMANEJAMENTO',
      cls: 'text-indigo-700',
      Icon: Repeat,
      accent: 'from-indigo-500 to-indigo-700',
      subtitle: 'Ajuste de plantões',
      tint: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    realizada: {
      label: 'ESCALA REALIZADA',
      cls: 'text-orange-700',
      Icon: ArrowLeftRight,
      accent: 'from-orange-500 to-orange-700',
      subtitle: 'Registro do que aconteceu',
      tint: 'bg-orange-50 text-orange-700 border-orange-200',
    },
  }[viewMode];

  return (
    <div className="space-y-6">
      {/*
        HEADER EDITORIAL — Concentrado num único bloco:
        - Faixa colorida grossa (âncora do modo)
        - Título grande + subtítulo curto (o que a página faz, uma linha)
        - Toolbar à direita, alinhada com o título
        A navegação entre camadas vive na sidebar (Planejamento / Trocas & Remanejamento
        / Realizada), então NÃO há segmented control aqui. Isso evita a impressão de
        "abas na mesma tela" que confundia com trocas e ausências.
      */}
      <header>
        <div className={`h-2 rounded-full bg-gradient-to-r ${pageHeading.accent} shadow-sm`} aria-hidden="true" />
        <div className="mt-5 flex items-start justify-between gap-6 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            {onBackToList && (
              <button
                onClick={onBackToList}
                title="Voltar para a lista de escalas"
                className="inline-flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition text-gray-500 hover:text-gray-900 -ml-1 mt-1"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0">
              <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${pageHeading.cls}`}>
                {pageHeading.subtitle}
              </p>
              <h1 className={`mt-0.5 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.05] ${pageHeading.cls}`}>
                {pageHeading.label}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {!editMode ? (
            <>
              {/* ═══ GRUPO 1: ação primária + workflow — só na Planejada ═══
                  Modo Edição altera plantões/quem-está-na-escala; isso só se faz na Planejada.
                  Trocas/faltas têm fluxos próprios em /troca e /realizada. */}
              {viewMode === 'planejada' && canEditSchedule && (
                <button
                  onClick={() => setEditMode(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 active:bg-blue-800 transition-colors text-[13px] font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                >
                  <Edit3 className="w-4 h-4" aria-hidden="true" />
                  {isMobile ? 'Editar' : 'Modo Edição'}
                </button>
              )}

              {viewMode === 'planejada' && currentSchedule && !isPublished && canEditSchedule && !isMobile && (
                <button
                  onClick={requestPublish}
                  title="Congela a Planejada atual. A partir daqui, edições só afetam a Realizada."
                  className="inline-flex items-center gap-1.5 h-9 px-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
                >
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  Finalizar
                </button>
              )}

              {!isMobile && <div className="h-6 w-px bg-gray-200 mx-1" aria-hidden="true" />}

              {/* ═══ GRUPO 2: secundárias frequentes ═══ */}
              <button
                onClick={handleExportExcel}
                title={`Exporta a escala ${viewMode === 'realizada' ? 'Realizada (com ausências aplicadas)' : 'Planejada'}`}
                className="inline-flex items-center gap-1.5 h-9 px-3 bg-white text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-colors text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              >
                <Download className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
                Excel
              </button>

              {/* Ausência — só na Realizada. É o fluxo próprio dela. */}
              {viewMode === 'realizada' && currentSchedule && !isMobile && (
                <button
                  onClick={() => {
                    setAbsenceInitialData({
                      department_id: selectedDepartment,
                      schedule_id: currentSchedule.id,
                      start_date: new Date().toISOString().slice(0, 10),
                    });
                    setShowAbsenceModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 h-9 px-3 bg-white text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-colors text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                >
                  <CalendarX className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
                  Ausência
                </button>
              )}

              {!isMobile && <div className="h-6 w-px bg-gray-200 mx-1" aria-hidden="true" />}

              {/* ═══ GRUPO 3: criação / seed — só na Planejada ═══ */}
              {viewMode === 'planejada' && !isMobile && (
                <button
                  onClick={() => setShowCreateScheduleModal(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 bg-white text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-colors text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                >
                  <Plus className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
                  Nova Escala
                </button>
              )}

              {/* Copiar Mês Anterior: SÓ na Planejada, escala ainda vazia */}
              {viewMode === 'planejada' && !isMobile && isEmptySchedule && !isLocked && (
                <button
                  onClick={copyPreviousMonth}
                  title="Importa os plantões do mês anterior como ponto de partida (escala atual está vazia)"
                  className="inline-flex items-center gap-1.5 h-9 px-3 bg-white text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-colors text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                >
                  <Copy className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
                  Copiar Mês Anterior
                </button>
              )}

              {!isMobile && <div className="h-6 w-px bg-gray-200 mx-1" aria-hidden="true" />}

              {/* ═══ GRUPO 4: meta + overflow ═══ */}
              {currentSchedule && !isMobile && (
                <button
                  onClick={() => setShowAuditLog(true)}
                  title="Histórico de alterações desta escala"
                  aria-label="Histórico"
                  className="inline-flex items-center justify-center h-9 w-9 bg-white text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                >
                  <Clock className="w-4 h-4" aria-hidden="true" />
                </button>
              )}

              <div className="relative">
                <button
                  onClick={() => setMoreMenuOpen(prev => !prev)}
                  title="Mais ações"
                  aria-label="Mais ações"
                  aria-haspopup="menu"
                  aria-expanded={moreMenuOpen}
                  className="inline-flex items-center justify-center h-9 w-9 bg-white text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                >
                  <MoreVertical className="w-4 h-4" aria-hidden="true" />
                </button>
                {moreMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMoreMenuOpen(false)} />
                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-1.5 z-50 bg-white rounded-lg shadow-xl ring-1 ring-gray-200 py-1 w-60 max-h-[70vh] overflow-y-auto"
                    >
                      {/* Mobile-only items (no desktop já estão visíveis na barra) */}
                      {isMobile && (
                        <>
                          {viewMode === 'planejada' && (
                            <button onClick={() => { setShowCreateScheduleModal(true); setMoreMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-gray-700 hover:bg-gray-50">
                              <Plus className="w-4 h-4 text-gray-400" /> Nova Escala
                            </button>
                          )}
                          {viewMode === 'realizada' && currentSchedule && (
                            <button onClick={() => { setAbsenceInitialData({ department_id: selectedDepartment, schedule_id: currentSchedule.id, start_date: new Date().toISOString().slice(0, 10) }); setShowAbsenceModal(true); setMoreMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-gray-700 hover:bg-gray-50">
                              <CalendarX className="w-4 h-4 text-gray-400" /> Registrar Ausência
                            </button>
                          )}
                          {viewMode === 'planejada' && isEmptySchedule && !isLocked && (
                            <button onClick={() => { copyPreviousMonth(); setMoreMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-gray-700 hover:bg-gray-50">
                              <Copy className="w-4 h-4 text-gray-400" /> Copiar Mês Anterior
                            </button>
                          )}
                          {currentSchedule && (
                            <button onClick={() => { setShowAuditLog(true); setMoreMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-gray-700 hover:bg-gray-50">
                              <Clock className="w-4 h-4 text-gray-400" /> Histórico
                            </button>
                          )}
                          {viewMode === 'planejada' && currentSchedule && !isPublished && canEditSchedule && (
                            <button onClick={() => { requestPublish(); setMoreMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-emerald-700 hover:bg-emerald-50">
                              <Lock className="w-4 h-4" /> Finalizar Planejamento
                            </button>
                          )}
                          <div className="border-t border-gray-100 my-1" />
                        </>
                      )}

                      {/* Reabrir (Admin ou Coordenador do setor, só quando publicado) */}
                      {currentSchedule && canReopenPlanning && (
                        <button
                          onClick={() => { requestReopen(); setMoreMenuOpen(false); }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-gray-700 hover:bg-gray-50"
                        >
                          <Unlock className="w-4 h-4 text-gray-400" /> Reabrir planejamento
                        </button>
                      )}

                      {/* Destrutiva, sempre por último, separada */}
                      {currentSchedule && (isAdmin() || canDelete('schedules')) && (
                        <>
                          {((isPublished && isAdmin()) || isMobile) && <div className="border-t border-gray-100 my-1" />}
                          <button
                            onClick={() => { setShowDeleteScheduleModal(true); setMoreMenuOpen(false); }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-red-600 hover:bg-red-50 font-medium"
                          >
                            <Trash2 className="w-4 h-4" /> Excluir Escala
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowAutoFillModal(true)}
                className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                Preenchimento Automático
              </button>
              <button
                onClick={() => setShowClearAllModal(true)}
                title="Apaga todos os plantões desta escala (mantém os profissionais)"
                className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 bg-white text-red-700 border border-red-300 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                Limpar Escala
              </button>
              <button
                onClick={() => setShowAddProfessionalModal(true)}
                className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                Adicionar Profissional
              </button>
              <button
                onClick={handleExportExcel}
                title={`Exporta a escala ${viewMode === 'realizada' ? 'REALIZADA (com ausências aplicadas)' : 'PLANEJADA'}`}
                className={`inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-lg transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  viewMode === 'realizada'
                    ? 'bg-red-50 text-red-700 border border-red-300 hover:bg-red-100 focus:ring-red-500'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 focus:ring-blue-500'
                }`}
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                Exportar Excel
                {viewMode === 'realizada' && <span className="text-[10px] font-bold">(Realizada)</span>}
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
                className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                Salvar e Sair
              </button>
            </>
          )}
        </div>
        </div>
      </header>

      {/* Banner "Modo Edição" e "Visualizando Realizada" foram consolidados
          em um único bloco informativo dentro do header da escala (abaixo). */}

      {!editMode && currentSchedule && isLocked && (
        <div
          className={`rounded-lg p-4 border ${
            isPublished
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-slate-100 border-slate-300'
          }`}
        >
          <div className="flex items-start gap-3">
            <Lock
              className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                isPublished ? 'text-emerald-700' : 'text-slate-600'
              }`}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  isPublished ? 'text-emerald-900' : 'text-slate-800'
                }`}
              >
                {isPublished
                  ? 'Esta escala está publicada e bloqueada para edição.'
                  : 'Esta escala foi fechada (arquivada).'}
              </p>
              <p
                className={`text-xs mt-0.5 ${
                  isPublished ? 'text-emerald-700' : 'text-slate-600'
                }`}
              >
                {isClosed
                  ? 'Escala arquivada (Fechada).'
                  : canReopenPlanning
                  ? 'Para editar a Planejada, reabra o planejamento.'
                  : 'Apenas Administradores ou o Coordenador do setor podem reabri-la.'}
              </p>
            </div>
            {!isClosed && canReopenPlanning && (
              <button
                onClick={requestReopen}
                className="inline-flex items-center gap-2 flex-shrink-0 px-3.5 py-2 bg-white text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-colors text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                <Unlock className="w-4 h-4" aria-hidden="true" />
                Reabrir planejamento
              </button>
            )}
          </div>
        </div>
      )}

      {/* Banner vermelho duplicado removido — info consolidada no header. */}

      <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-100 p-4 sm:p-7">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando escala...</p>
          </div>
        ) : schedules.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Nenhuma escala criada ainda"
            description="Comece criando sua primeira escala mensal. Você poderá adicionar profissionais e montar os turnos em seguida."
            action={{
              label: 'Criar Primeira Escala',
              onClick: () => setShowCreateScheduleModal(true),
              icon: Plus,
            }}
          />
        ) : (
          <>
            {/*
              SUB-HERO DE CONTEXTO — Uma faixa editorial com:
              - Eyebrow "ESCALA" bem discreto
              - Nome da escala em destaque (o dropdown fica embutido no próprio nome)
              - Metadados: Setor · Mês/Ano
              - Chips à direita: Status (Rascunho/Publicada), Edição ativa, Realizada até dia X, Ordenar
              Substitui o antigo "Escala:" + h2 "Mês/Ano" + p "Setor" + linha de chips redundantes.
            */}
            <div className="mb-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 pb-5 border-b border-gray-100">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gray-400">Escala</p>
                <div className="mt-1 relative inline-flex items-center group max-w-full">
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
                    aria-label="Selecionar escala"
                    className="appearance-none bg-transparent border-0 pr-9 pl-0 py-0 text-xl sm:text-2xl font-bold text-gray-900 leading-tight focus:outline-none focus:ring-0 cursor-pointer max-w-full truncate hover:text-gray-700 transition-colors"
                    style={{ WebkitAppearance: 'none' }}
                  >
                    {schedules
                      .filter(s => !selectedDepartment || s.department_id === selectedDepartment)
                      .map((schedule) => (
                        <option key={schedule.id} value={schedule.id}>
                          {schedule.name}
                        </option>
                      ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-0 w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  <span className="uppercase tracking-wider font-semibold text-gray-400">Setor</span>
                  <span className="mx-1.5 text-gray-300">·</span>
                  <span className="text-gray-700 font-medium">
                    {departments.find(d => d.id === selectedDepartment)?.name ?? '—'}
                  </span>
                  <span className="mx-2 text-gray-300">·</span>
                  <span className="uppercase tracking-wider font-semibold text-gray-400">Período</span>
                  <span className="mx-1.5 text-gray-300">·</span>
                  <span className="text-gray-700 font-medium capitalize">{monthName}</span>
                </p>
              </div>

              {currentSchedule && (
                <div className="flex flex-wrap items-center gap-2">
                  {editMode && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200">
                      <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                      Edição ativa
                    </span>
                  )}
                  {isPublished ? (
                    <span
                      title={`Finalizada em ${new Date((currentSchedule as any).published_at).toLocaleString('pt-BR')}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200"
                    >
                      <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                      Publicada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200">
                      <Unlock className="w-3.5 h-3.5" aria-hidden="true" />
                      Rascunho
                    </span>
                  )}
                  {viewMode === 'realizada' && realizadaFilledUntilDay > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-200">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Realizada até dia {realizadaFilledUntilDay}
                    </span>
                  )}
                  {professionals.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-white text-gray-700 ring-1 ring-inset ring-gray-200 hover:ring-gray-300 transition">
                      <ArrowUpDown className="w-3.5 h-3.5 text-gray-500" aria-hidden="true" />
                      <label htmlFor="prof-sort" className="sr-only">Ordenar profissionais</label>
                      <select
                        id="prof-sort"
                        value={profSort}
                        onChange={(e) => setProfSort(e.target.value as SortMode)}
                        className="bg-transparent text-gray-700 font-semibold focus:outline-none cursor-pointer -mr-1"
                        title="Ordenar profissionais na grade"
                      >
                        <option value="custom">Ordem personalizada</option>
                        <option value="alpha_asc">Nome A → Z</option>
                        <option value="alpha_desc">Nome Z → A</option>
                        <option value="alpha_colab_last">A → Z (colaboradores no fim)</option>
                        <option value="created_asc">Mais antigos primeiro</option>
                        <option value="created_desc">Mais recentes primeiro</option>
                      </select>
                    </span>
                  )}
                </div>
              )}
            </div>

            {professionals.length === 0 ? (
              <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <EmptyState
                  icon={Users}
                  title="Nenhum profissional na escala"
                  description={
                    editMode
                      ? 'Adicione profissionais a esta escala para começar a montar os turnos.'
                      : 'Esta escala ainda não tem profissionais. Entre em modo de edição para adicioná-los.'
                  }
                  action={
                    editMode
                      ? {
                          label: 'Adicionar Profissional',
                          onClick: () => setShowAddProfessionalModal(true),
                          icon: UserPlus,
                        }
                      : {
                          label: 'Entrar no Modo Edição',
                          onClick: () => setEditMode(true),
                          icon: Edit3,
                        }
                  }
                />
              </div>
            ) : (
            <div
              className={`origin-top-left ${isMobile ? '' : '-mx-6 px-6'}`}
              style={isMobile ? {} : {
                transform: 'scale(0.85)',
                transformOrigin: 'top left',
                width: 'calc(100% / 0.85)',
              }}
            >
              <div className="overflow-auto" style={{ maxHeight: isMobile ? 'calc(100vh - 260px)' : 'calc((100vh - 280px) / 0.85)' }}>
                <div className="inline-block min-w-full">
                  <table className="schedule-table border-collapse" style={{ fontSize: isMobile ? '10px' : '11px', width: 'max-content' }}>
                    <thead>
                      <tr className="bg-gray-100">
                        {!isMobile && (
                          <th className="col-matricula border border-gray-300 px-2 py-2 text-left font-semibold sticky left-0 top-0 bg-gray-100 z-40 whitespace-nowrap" style={{ minWidth: '70px' }}>
                            MATRÍCULA
                          </th>
                        )}
                        <th className="sticky-name border border-gray-300 px-2 py-2 text-left font-semibold sticky top-0 bg-gray-100 z-40 whitespace-nowrap" style={{ minWidth: isMobile ? '100px' : '180px', left: isMobile ? 0 : '70px' }}>
                          NOME
                        </th>
                        {!isMobile && (
                          <th className="col-funcao border border-gray-300 px-2 py-2 text-left font-semibold sticky top-0 bg-gray-100 z-40 whitespace-nowrap" style={{ minWidth: '120px', left: '250px' }}>
                            FUNÇÃO
                          </th>
                        )}
                        {showCorenColumn && !isMobile && (
                          <th className="col-coren border border-gray-300 px-2 py-2 text-center font-semibold sticky top-0 bg-gray-100 z-40 whitespace-nowrap" style={{ minWidth: '80px', left: '370px' }}>
                            COREN
                          </th>
                        )}
                        <th className="sticky-dias border border-gray-300 px-1 py-2 text-center font-semibold sticky top-0 bg-gray-100 z-40 whitespace-nowrap" style={{ minWidth: isMobile ? '36px' : '60px', left: isMobile ? '100px' : (showCorenColumn ? '450px' : '370px') }}>
                          {isMobile ? 'DT' : <>DIAS<br/>TRAB.</>}
                        </th>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                          const isWeekendHeader = ['SAB', 'DOM'].includes(getDayOfWeek(day));
                          const holiday = getHolidayForDay(day);
                          const highlight = isWeekendHeader || !!holiday;
                          return (
                            <th
                              key={day}
                              title={holiday ? `${holiday.name} (${holiday.type})` : undefined}
                              className={`border border-gray-300 px-1 py-2 text-center font-semibold sticky top-0 z-30 ${
                                highlight ? 'bg-amber-200 text-amber-900' : 'bg-gray-100'
                              }`}
                              style={{ minWidth: isMobile ? '28px' : '32px', maxWidth: isMobile ? '28px' : '32px' }}
                            >
                              {day}
                            </th>
                          );
                        })}
                        {/* Uma coluna por sigla com o total daquele profissional — sticky direita */}
                        {uniqueShiftCodes.map((code, idx) => (
                          <th
                            key={`hcol-${code}`}
                            className={`border border-gray-300 px-1 py-1 text-center font-bold whitespace-nowrap sticky top-0 z-40 ${getCellColorClass(code)}`}
                            style={{ minWidth: `${TOTAL_CODE_W}px`, maxWidth: `${TOTAL_CODE_W}px`, right: `${codeColRight(idx)}px` }}
                            title={`Total de ${code} no mês`}
                          >
                            <span className="block text-[8px] uppercase tracking-wider opacity-70 leading-tight">Total</span>
                            <span className="block text-[11px] leading-tight">{code}</span>
                          </th>
                        ))}
                        <th className="border border-gray-300 px-2 py-2 text-center font-semibold whitespace-nowrap sticky bg-gray-100 z-40" style={{ minWidth: '70px', top: 0, right: editMode ? '50px' : 0 }}>
                          TOTAL<br/>HORAS
                        </th>
                        {editMode && (
                          <th className="border border-gray-300 px-2 py-2 text-center font-semibold bg-gray-100 whitespace-nowrap sticky z-40" style={{ minWidth: '50px', top: 0, right: 0 }}>
                            AÇÕES
                          </th>
                        )}
                      </tr>
                      <tr className="bg-gray-50">
                        {!isMobile && (
                          <th className="col-matricula border border-gray-300 px-2 py-1 sticky left-0 bg-gray-50 z-40" style={{ minWidth: '70px', top: '36px' }}></th>
                        )}
                        <th className="sticky-name border border-gray-300 px-2 py-1 sticky bg-gray-50 z-40" style={{ minWidth: isMobile ? '100px' : '180px', left: isMobile ? 0 : '70px', top: '36px' }}></th>
                        {!isMobile && (
                          <th className="col-funcao border border-gray-300 px-2 py-1 sticky bg-gray-50 z-40" style={{ minWidth: '120px', left: '250px', top: '36px' }}></th>
                        )}
                        {showCorenColumn && !isMobile && (
                          <th className="col-coren border border-gray-300 px-2 py-1 sticky bg-gray-50 z-40" style={{ minWidth: '80px', left: '370px', top: '36px' }}></th>
                        )}
                        <th className="sticky-dias border border-gray-300 px-2 py-1 sticky bg-gray-50 z-40" style={{ minWidth: isMobile ? '36px' : '60px', left: isMobile ? '100px' : (showCorenColumn ? '450px' : '370px'), top: '36px' }}></th>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                          const dow = getDayOfWeek(day);
                          const isWeekendHeader = ['SAB', 'DOM'].includes(dow);
                          const holiday = getHolidayForDay(day);
                          const highlight = isWeekendHeader || !!holiday;
                          return (
                            <th
                              key={day}
                              title={holiday ? `${holiday.name} (${holiday.type})` : undefined}
                              className={`border border-gray-300 px-1 py-1 text-center font-medium sticky z-30 ${
                                highlight
                                  ? 'bg-amber-200 text-amber-900 font-bold'
                                  : 'bg-gray-50 text-gray-600'
                              }`}
                              style={{ fontSize: '9px', top: '36px' }}
                            >
                              {holiday ? 'FER' : dow}
                            </th>
                          );
                        })}
                        {uniqueShiftCodes.map((code, idx) => (
                          <th
                            key={`hcol2-${code}`}
                            className="border border-gray-300 bg-gray-50 sticky z-40"
                            style={{ top: '36px', minWidth: `${TOTAL_CODE_W}px`, maxWidth: `${TOTAL_CODE_W}px`, right: `${codeColRight(idx)}px` }}
                          ></th>
                        ))}
                        <th className="border border-gray-300 px-2 py-1 sticky bg-gray-50 z-30" style={{ top: '36px' }}></th>
                        {editMode && (
                          <th className="border border-gray-300 px-2 py-1 bg-gray-50 sticky z-30" style={{ top: '36px' }}></th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {professionals.map((prof) => (
                        <Fragment key={prof.id}>
                        <tr className={`hover:bg-gray-50 ${isOverWorkload(prof.id) ? 'bg-red-50' : ''}`}>
                          {!isMobile && (
                            <td className={`col-matricula border border-gray-300 px-2 py-2 text-center sticky left-0 z-10 whitespace-nowrap ${isOverWorkload(prof.id) ? 'bg-red-50' : 'bg-white'}`}>
                              {prof.registration_number || '-'}
                            </td>
                          )}
                          <td className={`sticky-name border border-gray-300 px-2 py-1.5 font-medium sticky z-10 whitespace-nowrap truncate ${isOverWorkload(prof.id) ? 'bg-red-50' : 'bg-white'}`} style={{ left: isMobile ? 0 : '70px', maxWidth: isMobile ? '100px' : '180px' }} title={prof.full_name}>
                            {isMobile ? (prof.full_name.length > 12 ? prof.full_name.slice(0, 12) + '…' : prof.full_name) : prof.full_name}
                          </td>
                          {!isMobile && (
                            <td className={`col-funcao border border-gray-300 px-2 py-2 sticky z-10 whitespace-nowrap ${isOverWorkload(prof.id) ? 'bg-red-50' : 'bg-white'}`} style={{ left: '250px' }}>
                              {prof.category?.name}
                            </td>
                          )}
                          {showCorenColumn && !isMobile && (
                            <td className={`col-coren border border-gray-300 px-2 py-2 text-center sticky z-10 whitespace-nowrap text-xs ${isOverWorkload(prof.id) ? 'bg-red-50' : 'bg-white'} ${prof.coren ? 'text-emerald-700 font-semibold' : 'text-gray-300'}`} style={{ left: '370px' }}>
                              {prof.coren || '—'}
                            </td>
                          )}
                          <td className={`sticky-dias border border-gray-300 px-1 py-1.5 text-center font-semibold sticky z-10 whitespace-nowrap ${isOverWorkload(prof.id) ? 'bg-red-50' : 'bg-white'}`} style={{ left: isMobile ? '100px' : (showCorenColumn ? '450px' : '370px') }}>
                            {calculateWorkDays(prof.id)}
                          </td>
                          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                            const codes = getEffectiveShiftCodes(prof.id, day);
                            const code = codes[0] || '';
                            const code2 = codes[1] || '';  // 2º turno (plantão duplo)
                            const hasDouble = !!code2;
                            const plannedCode = getShiftCode(prof.id, day);
                            // Código da PLANEJADA (snapshot original) para comparar com o vigente.
                            // Em troca/realizada destacamos células que divergem da planejada.
                            const snapshotCode = getOriginalShiftCode(prof.id, day);
                            const cellAbsenceForMark = (viewMode === 'troca' || viewMode === 'realizada')
                              ? findAbsenceForCell(prof.id, day) : null;
                            const isChangedFromPlanned =
                              (viewMode === 'troca' || viewMode === 'realizada') &&
                              !!snapshotCode &&
                              (code !== snapshotCode || !!cellAbsenceForMark);
                            const cellAbsence = findAbsenceForCell(prof.id, day);
                            // Indicador visual de divergência DESATIVADO — a Planejada
                            // e a Realizada são vistas independentes e INTACTAS. Sem
                            // bordas vermelhas, sem pontos de aviso. Quem quiser ver
                            // a diferença alterna entre as abas.
                            const isOverridden = false;
                            const holidayForCell = getHolidayForDay(day);
                            const isWeekend = ['SAB', 'DOM'].includes(getDayOfWeek(day)) || !!holidayForCell;
                            // Tooltip: mostra info de ausência sempre que houver
                            const tooltip = cellAbsence
                              ? viewMode === 'realizada'
                                ? `${cellAbsence.reason_name}\nPlanejado: ${plannedCode || '—'}`
                                : `${cellAbsence.reason_name} registrada\nTurno planejado: ${plannedCode || '—'}`
                              : undefined;
                            // Planejada NUNCA é alterada visualmente por absences/trocas.
                            // O overlay vermelho de absence vale só na Realizada
                            // (já tratado pelo getEffectiveShiftCode).
                            const hasAbsenceMarkPlanned = false;
                            // Célula que sofreu troca de plantão aprovada
                            const cellDateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
                            // Trocas só impactam a Realizada visualmente (a Planejada
                            // mostra o estado original imutável).
                            const isSwapped =
                              viewMode === 'realizada' && swappedCells.has(`${prof.id}|${cellDateStr}`);
                            const swapTooltip = isSwapped ? 'Plantão envolvido em troca aprovada' : '';
                            // Verifica se este prof COBRIU uma falta nesse dia
                            const coverageAbsence = scheduleAbsences.find(
                              a => a.coverage_professional_id === prof.id &&
                                   cellDateStr >= a.start_date &&
                                   cellDateStr <= a.end_date
                            );
                            // Coberturas só aparecem na Realizada (Planejada não muda)
                            const isCoverage = viewMode === 'realizada' && !!coverageAbsence;
                            const coverageTooltip = isCoverage ? 'Cobertura — turno extra' : '';
                            const holidayTooltip = holidayForCell
                              ? `Feriado ${holidayForCell.type}: ${holidayForCell.name}`
                              : '';
                            const finalTooltip = [tooltip, swapTooltip, coverageTooltip, holidayTooltip].filter(Boolean).join('\n');
                            // Quando há 2 plantões no mesmo dia (plantão duplo via troca/cobertura)
                            // renderiza a célula dividida na diagonal, cada triângulo com sua cor + sigla.
                            const doubleTooltip = hasDouble ? `${code} + ${code2} (plantão duplo)` : '';
                            return (
                              <td
                                key={day}
                                onClick={(e) => handleCellClick(prof.id, day, e)}
                                title={[finalTooltip, doubleTooltip].filter(Boolean).join('\n') || undefined}
                                className={`border border-gray-300 text-center font-semibold relative p-0 overflow-hidden ${
                                  // Prioridade: troca (verde) > absence (vermelho) > código planejado (1 só) > weekend
                                  isSwapped ? 'bg-emerald-600 text-white ring-2 ring-inset ring-emerald-800' :
                                  hasAbsenceMarkPlanned ? 'bg-red-200 text-red-900 ring-2 ring-inset ring-red-500' :
                                  hasDouble ? '' :
                                  code ? getCellColorClass(code) : ''
                                } ${!isSwapped && !hasAbsenceMarkPlanned && isWeekend && !code && !hasDouble ? 'bg-amber-100' : ''} ${
                                  isWeekend && (code || hasDouble) && !isSwapped && !hasAbsenceMarkPlanned ? 'ring-1 ring-inset ring-amber-400' : ''
                                } ${
                                  'cursor-pointer hover:ring-2 hover:ring-blue-400'
                                } ${isOverridden ? 'ring-1 ring-inset ring-red-400' : ''}`}
                                style={{ minWidth: isMobile ? '28px' : '32px', maxWidth: isMobile ? '28px' : '32px', height: isMobile ? '28px' : '32px' }}
                              >
                                {hasDouble ? (
                                  <div className="relative w-full h-full">
                                    {/* Triângulo superior-esquerdo: 1º plantão */}
                                    <div
                                      className={`absolute inset-0 flex items-start justify-start ${getCellColorClass(code)}`}
                                      style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
                                    >
                                      <span className="text-[9px] font-bold leading-none pl-0.5 pt-0.5">{code}</span>
                                    </div>
                                    {/* Triângulo inferior-direito: 2º plantão */}
                                    <div
                                      className={`absolute inset-0 flex items-end justify-end ${getCellColorClass(code2)}`}
                                      style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
                                    >
                                      <span className="text-[9px] font-bold leading-none pr-0.5 pb-0.5">{code2}</span>
                                    </div>
                                    {/* Linha diagonal divisória */}
                                    <div
                                      className="absolute inset-0 pointer-events-none"
                                      style={{
                                        background: 'linear-gradient(to top right, transparent calc(50% - 0.5px), rgba(0,0,0,0.4) calc(50% - 0.5px), rgba(0,0,0,0.4) calc(50% + 0.5px), transparent calc(50% + 0.5px))'
                                      }}
                                    />
                                  </div>
                                ) : (
                                  <div className="px-1 py-2">{code}</div>
                                )}
                                {/* Indicador em modo Realizada: ponto vermelho quando célula foi sobrescrita */}
                                {isOverridden && (
                                  <span
                                    className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-red-500"
                                    aria-hidden="true"
                                  />
                                )}
                                {/* Indicador de troca: marcador "T" no canto superior */}
                                {isSwapped && (
                                  <span
                                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-800 text-white text-[9px] font-bold flex items-center justify-center shadow"
                                    aria-label="Troca de plantão"
                                    title="Plantão envolvido em troca"
                                  >
                                    T
                                  </span>
                                )}
                                {/* Indicador de cobertura (turno extra cobrindo falta de outro prof) */}
                                {isCoverage && !isSwapped && (
                                  <span
                                    className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-blue-700 text-white text-[10px] font-bold flex items-center justify-center shadow"
                                    aria-label="Cobertura"
                                    title="Cobertura — turno extra"
                                  >
                                    +
                                  </span>
                                )}
                                {/* Divergência da Planejada (troca/realizada): código planejado esmaecido + canto destacado */}
                                {isChangedFromPlanned && !isSwapped && !isCoverage && (
                                  <>
                                    <span
                                      className={`absolute bottom-0 left-0 text-[7px] leading-none font-semibold opacity-40 pl-0.5 ${cellAbsenceForMark ? 'text-red-700' : 'text-gray-600'}`}
                                      aria-hidden="true"
                                    >
                                      {snapshotCode}
                                    </span>
                                    <span
                                      className={`absolute top-0 right-0 w-0 h-0 ${cellAbsenceForMark ? 'border-t-red-500' : 'border-t-indigo-500'}`}
                                      style={{ borderTopWidth: '6px', borderLeftWidth: '6px', borderLeftColor: 'transparent', borderStyle: 'solid' }}
                                      aria-label={cellAbsenceForMark ? 'Faltou (difere da planejada)' : 'Alterado em relação à planejada'}
                                      title={cellAbsenceForMark ? `Faltou — planejado: ${snapshotCode}` : `Alterado — planejado: ${snapshotCode}`}
                                    />
                                  </>
                                )}
                              </td>
                            );
                          })}
                          {/* Total por sigla, na linha do profissional — sticky direita */}
                          {uniqueShiftCodes.map((code, idx) => {
                            // Conta quantos dias esse profissional tem essa sigla
                            let count = 0;
                            for (let d = 1; d <= daysInMonth; d++) {
                              if (getEffectiveShiftCode(prof.id, d) === code) count++;
                            }
                            const cellBg = isOverWorkload(prof.id) ? '#fee2e2' /* red-100 */ : '#f9fafb' /* gray-50 */;
                            return (
                              <td
                                key={`pcol-${prof.id}-${code}`}
                                className={`border border-gray-300 px-1 py-2 text-center text-xs font-bold sticky z-20 ${count > 0 ? 'text-gray-900' : 'text-gray-300'}`}
                                style={{ minWidth: `${TOTAL_CODE_W}px`, maxWidth: `${TOTAL_CODE_W}px`, right: `${codeColRight(idx)}px`, backgroundColor: cellBg }}
                              >
                                {count > 0 ? count : '·'}
                              </td>
                            );
                          })}
                          <td
                            className={`border border-gray-300 px-2 py-2 text-center font-bold sticky z-20 ${
                              isOverWorkload(prof.id)
                                ? 'bg-red-100 text-red-700 border-red-400'
                                : 'bg-white text-gray-900'
                            }`}
                            style={{ right: editMode ? '50px' : 0 }}
                          >
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
                            <td
                              className={`border border-gray-300 px-2 py-2 text-center sticky z-20 ${isOverWorkload(prof.id) ? 'bg-red-50' : 'bg-white'}`}
                              style={{ right: 0 }}
                            >
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
                                  setExpandedSections({ allDays: false, oddDays: false, evenDays: false, weekDays: false, removeDays: false });
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
                        {prof.block_separator_after && (
                          <tr aria-hidden="true">
                            <td
                              colSpan={(isMobile ? 2 : (showCorenColumn ? 5 : 4)) + daysInMonth + uniqueShiftCodes.length + 1 + (editMode ? 1 : 0)}
                              className="bg-gray-100"
                              style={{ height: '14px', padding: 0, border: 0 }}
                            ></td>
                          </tr>
                        )}
                        </Fragment>
                      ))}
                    </tbody>
                    {uniqueShiftCodes.length > 0 && (
                      <tfoot>
                        {/* Separador grosso antes dos totais — sticky no fundo junto com os totais */}
                        <tr aria-hidden="true">
                          <td colSpan={(isMobile ? 2 : (showCorenColumn ? 5 : 4)) + daysInMonth + uniqueShiftCodes.length + 1 + (editMode ? 1 : 0)}
                              className="sticky z-40 bg-gray-800"
                              style={{ height: '4px', padding: 0, border: 0, bottom: `${uniqueShiftCodes.length * 33}px` }}
                          ></td>
                        </tr>
                        {uniqueShiftCodes.map((code, idx) => {
                          const colorCls = getCellColorClass(code);
                          const monthTotal = Array.from(dailyShiftTotals.values())
                            .reduce((acc, m) => acc + (m.get(code) ?? 0), 0);
                          // Fundo SÓLIDO (hex) — usar inline style porque Tailwind JIT
                          // não inclui as variantes -50/-100 dinâmicas geradas via replace().
                          const solidBg = getSolidBgHex(code);
                          // Distância do fundo: a última linha (idx = N-1) fica no bottom 0,
                          // as outras empilhadas acima.
                          const stickyBottom = (uniqueShiftCodes.length - 1 - idx) * 33;
                          return (
                            <tr key={`tot-${code}`} style={{ backgroundColor: solidBg }}>
                              {/* Rótulo "TOTAL <SIGLA>" sticky em baixo E à esquerda */}
                              <th
                                colSpan={isMobile ? 2 : (showCorenColumn ? 5 : 4)}
                                className="border border-gray-300 px-2 sm:px-3 py-1.5 text-right sticky left-0 z-40"
                                style={{
                                  minWidth: isMobile ? '136px' : (showCorenColumn ? '510px' : '430px'),
                                  backgroundColor: '#ffffff',
                                  bottom: `${stickyBottom}px`,
                                }}
                              >
                                <div className="inline-flex items-center gap-2">
                                  <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">Total</span>
                                  <span className={`inline-flex items-center justify-center min-w-[36px] px-2 py-0.5 rounded-md text-xs font-bold shadow-sm ${colorCls}`}>
                                    {code}
                                  </span>
                                </div>
                              </th>
                              {/* Contagem por dia (sticky no fundo) */}
                              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                                const count = dailyShiftTotals.get(day)?.get(code) ?? 0;
                                // Cor de fundo opaca da linha (não pode ser apenas a classe rowBg
                                // porque algumas células ficariam transparentes ao sticky)
                                return (
                                  <td
                                    key={day}
                                    className={`border border-gray-200 px-1 py-1.5 text-center text-xs sticky z-30 ${
                                      count > 0 ? 'text-gray-900 font-bold' : 'text-gray-300 font-normal'
                                    }`}
                                    style={{ minWidth: isMobile ? '28px' : '32px', maxWidth: isMobile ? '28px' : '32px', bottom: `${stickyBottom}px`, backgroundColor: solidBg }}
                                  >
                                    {count > 0 ? count : '·'}
                                  </td>
                                );
                              })}
                              {/* Intersecção com cada coluna "TOTAL <SIGLA>" da direita — sticky direita */}
                              {uniqueShiftCodes.map((colCode, colIdx) => (
                                <td
                                  key={`tfoot-x-${code}-${colCode}`}
                                  className={`border border-gray-300 px-1 py-1.5 text-center text-xs font-bold sticky z-40 ${
                                    code === colCode ? 'bg-gray-800 text-white' : 'bg-gray-50 text-gray-300'
                                  }`}
                                  style={{ bottom: `${stickyBottom}px`, right: `${codeColRight(colIdx)}px`, minWidth: `${TOTAL_CODE_W}px`, maxWidth: `${TOTAL_CODE_W}px` }}
                                >
                                  {code === colCode ? monthTotal : '·'}
                                </td>
                              ))}
                              {/* Total geral — sticky no fundo + à direita */}
                              <td
                                className="border border-gray-300 px-2 py-1.5 text-center text-sm font-extrabold bg-gray-800 text-white sticky z-40"
                                style={{ bottom: `${stickyBottom}px`, right: editMode ? '50px' : 0 }}
                              >
                                {monthTotal}
                              </td>
                              {editMode && (
                                <td className="border border-gray-300 sticky z-40" style={{ bottom: `${stickyBottom}px`, right: 0, backgroundColor: '#ffffff' }}></td>
                              )}
                            </tr>
                          );
                        })}
                      </tfoot>
                    )}
                  </table>

                  {/* Profissionais afastados — DENTRO do scale para colar na tabela */}
                  {onLeaveProfessionals.length > 0 && (
                    <div className="border-x border-b border-amber-200 bg-amber-50/40">
                      <div className="bg-amber-50 px-3 py-1.5 border-b border-amber-200 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-700" aria-hidden="true" />
                        <h3 className="font-semibold text-amber-900 text-xs uppercase tracking-wide">
                          Profissionais Afastados · {onLeaveProfessionals.length}
                        </h3>
                      </div>
                      <div className="divide-y divide-amber-100">
                        {onLeaveProfessionals.map(p => (
                          <div key={p.id} className="px-3 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm hover:bg-amber-100/30">
                            <span className="font-medium text-gray-900">{p.full_name}</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 text-[11px] font-bold ring-1 ring-inset ring-amber-400 uppercase">
                              {p.leave_reason || 'Afastado'}
                            </span>
                            <span className="text-gray-600 text-xs">{p.category?.name}</span>
                            {p.registration_number && (
                              <span className="text-gray-500 text-xs">Mat: {p.registration_number}</span>
                            )}
                            {p.coren && (
                              <span className="text-emerald-700 text-xs font-semibold">COREN: {p.coren}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}

            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">Legenda</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
                {SHIFT_TYPES.map(type => (
                  <div key={type.code} className="flex items-center gap-2.5">
                    <span className={`${SHIFT_BADGE_CLASS} flex-shrink-0 ${getCellColorClass(type.code)}`}>
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
              resetTrocaState();
            }}
          />
          <div
            className={`fixed z-50 bg-white shadow-xl border border-gray-200 flex flex-col ${
              isMobile
                ? 'inset-x-0 bottom-0 rounded-t-2xl max-h-[70vh] w-full'
                : 'rounded-lg w-[260px]'
            }`}
            style={isMobile ? {} : {
              left: menuPosition.x,
              top: menuPosition.y,
              maxHeight: `calc(100vh - ${menuPosition.y}px - 16px)`,
            }}
          >
            {isMobile && (
              <div className="flex justify-center py-2 flex-shrink-0">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
            )}
            <div className={`py-2 space-y-1 overflow-y-auto flex-1 ${isMobile ? 'pb-6' : ''}`}>
              {/* Header informativo — explica o que cada modo permite */}
              {viewMode === 'planejada' && isPublished && (
                <div className="px-3 py-1.5 mx-2 mb-1 bg-blue-50 rounded text-xs text-blue-700">
                  Planejada publicada — somente leitura. Use "Troca e Remanejamento" ou "Realizada" para mudanças.
                </div>
              )}
              {viewMode === 'troca' && (
                <div className="px-3 py-1.5 mx-2 mb-1 bg-indigo-50 rounded text-xs text-indigo-700">
                  Troca e Remanejamento — aplique troca, remanejamento ou liberação por dobra.
                </div>
              )}
              {viewMode === 'realizada' && (
                <div className="px-3 py-1.5 mx-2 mb-1 bg-orange-50 rounded text-xs text-orange-700">
                  Realizada — registre apenas exceções: falta, atestado ou cobertura.
                </div>
              )}
              {viewMode === 'planejada' && !isPublished && (!editMode || isLocked) && (
                <div className="px-3 py-1.5 mx-2 mb-1 bg-gray-50 rounded text-xs text-gray-600">
                  {isLocked
                    ? 'Escala bloqueada — somente registrar ausência ou trocar é permitido.'
                    : 'Modo visualização — entre em edição para alterar turnos.'}
                </div>
              )}

              {/* DESFAZER TROCA — aparece se a célula clicada está envolvida em swap aprovado */}
              {selectedCell && (() => {
                const cellDateStr = `${selectedMonth}-${String(selectedCell.day).padStart(2, '0')}`;
                const swap = swapsByCell.get(`${selectedCell.profId}|${cellDateStr}`);
                if (!swap) return null;
                return (
                  <div className="px-2 mb-1">
                    <button
                      onClick={() => setUndoingSwap(swap)}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 rounded text-left transition border border-emerald-200"
                    >
                      <ArrowLeftRight className="w-4 h-4 text-emerald-700" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-emerald-900">Desfazer troca</div>
                        <div className="text-[11px] text-emerald-700">Volta o plantão para o dono original</div>
                      </div>
                    </button>
                  </div>
                );
              })()}

              {/* DESFAZER AUSÊNCIA — aparece se a célula tem absence registrada */}
              {selectedCell && (() => {
                const absence = findAbsenceForCell(selectedCell.profId, selectedCell.day);
                if (!absence) return null;
                const profName = professionals.find(p => p.id === selectedCell.profId)?.full_name ?? '';
                const cellDateStr = `${selectedMonth}-${String(selectedCell.day).padStart(2, '0')}`;
                return (
                  <div className="px-2 mb-1">
                    <button
                      onClick={() => setUndoingAbsence({
                        professional_id: selectedCell.profId,
                        professional_name: profName,
                        date: cellDateStr,
                        reason_name: absence.reason_name,
                      })}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 rounded text-left transition border border-red-200"
                    >
                      <CalendarX className="w-4 h-4 text-red-700" />
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-red-900">Desfazer ausência</div>
                        <div className="text-[11px] text-red-700 truncate">
                          Remove "{absence.reason_name}" deste dia
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })()}

              {/* TURNOS / AUSÊNCIAS BUILT-IN — paleta crua só na PLANEJADA editável e não publicada */}
              {editMode && !isLocked && viewMode === 'planejada' && !isPublished && (
                <>
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
                      {SHIFT_TYPES.filter(type => ['SN', 'SD', 'M', 'T', 'MT', 'P'].includes(type.code)).map(type => (
                        <button
                          key={type.code}
                          onClick={() => handleShiftSelect(type)}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded text-left transition"
                        >
                          <span className={`${SHIFT_BADGE_CLASS} ${getCellColorClass(type.code)}`}>
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
                          <span className={`${SHIFT_BADGE_CLASS} ${getCellColorClass(type.code)}`}>
                            {type.code}
                          </span>
                          <span className="text-sm text-gray-700 flex-1">{type.name}</span>
                          <span className="text-xs text-gray-500">{type.hours}h</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <hr className="my-2 mx-2" />
                </>
              )}

              {/* ═══ MODO TROCA E REMANEJAMENTO — ações estruturadas ═══ */}
              {viewMode === 'troca' && selectedCell && !isLocked && canCreate('swaps' as any) && (() => {
                const sameDept = allProfessionals.filter(
                  p => p.id !== selectedCell.profId && professionalIdsInSchedule.has(p.id)
                );
                return (
                  <div className="px-2 space-y-1">
                    {/* TROCAR COM */}
                    <button
                      onClick={() => setTrocaAction(prev => prev === 'trocar' ? null : 'trocar')}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-indigo-50 rounded text-left transition text-indigo-700"
                    >
                      <span className="flex items-center gap-2"><ArrowLeftRight className="w-4 h-4" /><span className="text-sm font-medium">Trocar com…</span></span>
                      {trocaAction === 'trocar' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    {trocaAction === 'trocar' && (
                      <div className="px-2 pb-2 space-y-2">
                        <select
                          value={trocaTargetProf}
                          onChange={e => setTrocaTargetProf(e.target.value)}
                          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                        >
                          <option value="">Selecione o profissional…</option>
                          {sameDept.map(p => (
                            <option key={p.id} value={p.id}>{p.full_name}</option>
                          ))}
                        </select>
                        <button
                          disabled={!trocaTargetProf || trocaSaving}
                          onClick={handleTrocarCom}
                          className="w-full px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {trocaSaving ? 'Aplicando…' : 'Aplicar troca'}
                        </button>
                      </div>
                    )}

                    {/* REMANEJAR PARA */}
                    <button
                      onClick={() => setTrocaAction(prev => prev === 'remanejar' ? null : 'remanejar')}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-indigo-50 rounded text-left transition text-indigo-700"
                    >
                      <span className="flex items-center gap-2"><Shuffle className="w-4 h-4" /><span className="text-sm font-medium">Remanejar para…</span></span>
                      {trocaAction === 'remanejar' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    {trocaAction === 'remanejar' && (
                      <div className="px-2 pb-2 grid grid-cols-3 gap-1">
                        {SHIFT_TYPES.filter(t => ['SN', 'SD', 'P', 'MT', 'M', 'T', 'D', 'FG'].includes(t.code)).map(t => (
                          <button
                            key={t.code}
                            disabled={trocaSaving}
                            onClick={() => handleRemanejar(t)}
                            title={t.name}
                            className={`${SHIFT_BADGE_CLASS} ${getCellColorClass(t.code)} disabled:opacity-50`}
                          >
                            {t.code}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* LIBERAR POR DOBRA */}
                    <button
                      onClick={() => setTrocaAction(prev => prev === 'liberar' ? null : 'liberar')}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-indigo-50 rounded text-left transition text-indigo-700"
                    >
                      <span className="flex items-center gap-2"><Coffee className="w-4 h-4" /><span className="text-sm font-medium">Liberar por dobra</span></span>
                      {trocaAction === 'liberar' ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    {trocaAction === 'liberar' && (
                      <div className="px-2 pb-2 space-y-2">
                        <input
                          type="text"
                          value={trocaRefDay}
                          onChange={e => setTrocaRefDay(e.target.value)}
                          placeholder="Dia ref. da dobra (opcional)"
                          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                        />
                        <button
                          disabled={trocaSaving}
                          onClick={handleLiberarPorDobra}
                          className="w-full px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {trocaSaving ? 'Aplicando…' : 'Marcar folga (FG)'}
                        </button>
                      </div>
                    )}

                    {/* Acesso ao fluxo completo de troca (modal) */}
                    {(() => {
                      const [year, month] = selectedMonth.split('-');
                      const dateStr = `${year}-${month}-${selectedCell.day.toString().padStart(2, '0')}`;
                      const existingShift = shifts.find(s => s.professional_id === selectedCell.profId && s.shift_date === dateStr && !(s as any).deleted_in_realizada_at);
                      if (!existingShift) return null;
                      return (
                        <button
                          onClick={() => {
                            setSwapInitialShiftId(existingShift.id);
                            setShowSwapModal(true);
                            setShowQuickMenu(false);
                            setSelectedCell(null);
                            resetTrocaState();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-left transition text-gray-600 text-xs"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                          Troca avançada (solicitação)
                        </button>
                      );
                    })()}
                  </div>
                );
              })()}

              {/* ═══ MODO REALIZADA — exceções: Falta / Atestado / Cobertura ═══ */}
              {viewMode === 'realizada' && selectedCell && currentSchedule && canCreate('absences' as any) && (() => {
                const openAbsence = (kind: 'falta' | 'atestado' | 'cobertura') => {
                  const [year, month] = selectedMonth.split('-');
                  const dateStr = `${year}-${month}-${selectedCell.day.toString().padStart(2, '0')}`;
                  const existingCode = getShiftCode(selectedCell.profId, selectedCell.day);
                  // Trava: não permitir marcar exceção em dia sem plantão.
                  if (!existingCode) {
                    toast.warning('Não há plantão neste dia para registrar exceção.');
                    return;
                  }
                  // Pré-seleciona o motivo correspondente quando existir no catálogo.
                  const norm = (s: string) => s.toLowerCase();
                  const matchReason = (kw: string[]) =>
                    absenceReasons.find(r => kw.some(k => norm(r.name).includes(k)))?.id;
                  const reason_id =
                    kind === 'falta' ? matchReason(['falta'])
                    : kind === 'atestado' ? matchReason(['atestado', 'médic', 'medic'])
                    : matchReason(['cobertura', 'extra']);
                  setAbsenceInitialData({
                    professional_id: selectedCell.profId,
                    department_id: selectedDepartment,
                    schedule_id: currentSchedule.id,
                    start_date: dateStr,
                    end_date: dateStr,
                    shift_type: existingCode || 'SD',
                    reason_id,
                  });
                  setShowAbsenceModal(true);
                  setShowQuickMenu(false);
                  setSelectedCell(null);
                };
                return (
                  <div className="px-2 space-y-1">
                    <button onClick={() => openAbsence('falta')} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 rounded text-left transition text-red-700">
                      <CalendarX className="w-4 h-4" /><span className="text-sm font-medium">Falta</span>
                    </button>
                    <button onClick={() => openAbsence('atestado')} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-amber-50 rounded text-left transition text-amber-700">
                      <AlertCircle className="w-4 h-4" /><span className="text-sm font-medium">Atestado</span>
                    </button>
                    <button onClick={() => openAbsence('cobertura')} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 rounded text-left transition text-blue-700">
                      <UserPlus className="w-4 h-4" /><span className="text-sm font-medium">Cobertura</span>
                    </button>
                  </div>
                );
              })()}

              {/* ═══ MODO PLANEJADA — só ações de criação/edição da grade ═══
                  A Planejada é para MONTAR a escala (turnos + presença de gente).
                  Trocas vão em /troca. Faltas/atestados vão em /realizada. */}
              {viewMode === 'planejada' && editMode && !isLocked && !isPublished && (
                <button
                  onClick={handleDeleteShift}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 rounded text-left transition text-red-600"
                >
                  <X className="w-4 h-4" />
                  <span className="text-sm">Remover</span>
                </button>
              )}

              {/* Planejada publicada — nenhuma ação de célula. O aviso do topo
                  já orienta o usuário a ir para Troca ou Realizada. */}
              {viewMode === 'planejada' && isPublished && (
                <div className="px-3 py-2 text-xs text-gray-500">
                  Nada a fazer aqui na Planejada. Para mudar plantões deste mês,
                  use <span className="font-semibold text-indigo-700">Trocas &amp; Remanejamento</span>;
                  para lançar faltas, use <span className="font-semibold text-emerald-700">Realizada</span>.
                </div>
              )}
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
            className={`fixed z-50 bg-white shadow-xl border border-gray-200 flex flex-col ${
              isMobile
                ? 'inset-x-0 bottom-0 rounded-t-2xl max-h-[70vh] w-full'
                : 'rounded-lg w-[280px]'
            }`}
            style={isMobile ? {} : {
              left: actionsMenuPosition.x,
              top: actionsMenuPosition.y,
              maxHeight: `calc(100vh - ${actionsMenuPosition.y}px - 16px)`,
            }}
          >
            {isMobile && (
              <div className="flex justify-center py-2 flex-shrink-0">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
            )}
            <div className="px-3 py-2 border-b border-gray-200 flex items-center gap-2 flex-shrink-0">
              <Zap className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-gray-900">Ações Rápidas</span>
            </div>

            <div className={`py-2 space-y-1 overflow-y-auto flex-1 ${isMobile ? 'pb-6' : ''}`}>
              {/* Preencher/Limpar Dias — só na Planejada em modo edição.
                  Fora daí, o menu do profissional é só p/ Ausência (Realizada) ou remover (Planejada). */}
              {viewMode === 'planejada' && editMode && !isLocked && !isPublished && (
                <>
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
                      <span className={`${SHIFT_BADGE_CLASS} ${getCellColorClass(type.code)}`}>
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
                      <span className={`${SHIFT_BADGE_CLASS} ${getCellColorClass(type.code)}`}>
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
                      <span className={`${SHIFT_BADGE_CLASS} ${getCellColorClass(type.code)}`}>
                        {type.code}
                      </span>
                      <span className="text-gray-700">{type.name}</span>
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => setExpandedSections(prev => ({ ...prev, weekDays: !prev.weekDays }))}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-purple-50 rounded transition text-sm"
              >
                <div className="flex items-center gap-2">
                  {expandedSections.weekDays ? (
                    <ChevronDown className="w-4 h-4 text-purple-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-purple-600" />
                  )}
                  <span className="text-xs font-semibold text-purple-600 uppercase">Dias Úteis (Seg-Sex)</span>
                </div>
              </button>

              {expandedSections.weekDays && (
                <div className="pl-4 space-y-1">
                  {SHIFT_TYPES.filter(t => ['M', 'M2', 'T', 'MT', 'SD', 'FG'].includes(t.code)).map(type => (
                    <button
                      key={`week-${type.code}`}
                      onClick={() => handleFillWeekDays(showActionsMenu!, type)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-purple-50 rounded text-left transition text-sm"
                    >
                      <span className={`${SHIFT_BADGE_CLASS} ${getCellColorClass(type.code)}`}>
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
                </>
              )}

              {/* Registrar Ausência do menu do profissional — só na Realizada. */}
              {viewMode === 'realizada' && currentSchedule && canCreate('absences' as any) && (
                <button
                  onClick={() => {
                    const profId = showActionsMenu!;
                    setAbsenceInitialData({
                      professional_id: profId,
                      department_id: selectedDepartment,
                      schedule_id: currentSchedule.id,
                      start_date: new Date().toISOString().slice(0, 10),
                    });
                    setShowAbsenceModal(true);
                    setShowActionsMenu(null);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 rounded text-left transition text-red-700"
                >
                  <CalendarX className="w-4 h-4" />
                  <span className="text-sm font-medium">Registrar Ausência</span>
                </button>
              )}

              {/* Remover da Escala — só na Planejada em edição. É uma ação de MONTAGEM da escala. */}
              {viewMode === 'planejada' && editMode && !isLocked && !isPublished && (
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
              )}

              {/* Fallback: nenhuma ação disponível — orienta o usuário para o modo certo. */}
              {(
                (viewMode === 'planejada' && (!editMode || isLocked || isPublished)) ||
                viewMode === 'troca'
              ) && (
                <div className="px-3 py-2 text-xs text-gray-500">
                  {viewMode === 'troca'
                    ? 'Trocas se aplicam por dia/plantão. Clique numa célula.'
                    : isPublished
                      ? 'Escala publicada. Reabra o planejamento para editar profissionais.'
                      : 'Entre em modo edição para alterar profissionais.'}
                </div>
              )}
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

      {/* Modal de histórico de alterações — audit_logs imutável, com filtros */}
      {showAuditLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-gray-900">Histórico de Alterações</h2>
                <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                  <Lock className="w-3 h-3" /> imutável
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={exportAuditCsv}
                  disabled={filteredAuditEntries.length === 0}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 text-[13px] text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40"
                  title="Exportar log filtrado em CSV"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
                <button onClick={() => setShowAuditLog(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Filtros */}
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={auditFilters.search}
                onChange={e => setAuditFilters(f => ({ ...f, search: e.target.value }))}
                placeholder="Buscar descrição, profissional, data..."
                className="flex-1 min-w-[180px] h-8 px-3 text-[13px] bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={auditFilters.action}
                onChange={e => setAuditFilters(f => ({ ...f, action: e.target.value as any }))}
                className="h-8 px-2 text-[13px] bg-white border border-gray-200 rounded-md"
              >
                <option value="all">Todas as ações</option>
                <option value="INSERT">Criou</option>
                <option value="UPDATE">Editou</option>
                <option value="DELETE">Excluiu</option>
              </select>
              <select
                value={auditFilters.table}
                onChange={e => setAuditFilters(f => ({ ...f, table: e.target.value as any }))}
                className="h-8 px-2 text-[13px] bg-white border border-gray-200 rounded-md"
              >
                <option value="all">Tudo</option>
                <option value="shifts">Plantões</option>
                <option value="absences">Ausências</option>
                <option value="shift_swaps">Trocas</option>
                <option value="monthly_schedules">Escala</option>
              </select>
              <select
                value={auditFilters.author}
                onChange={e => setAuditFilters(f => ({ ...f, author: e.target.value }))}
                className="h-8 px-2 text-[13px] bg-white border border-gray-200 rounded-md max-w-[220px]"
              >
                <option value="">Qualquer autor</option>
                {auditAuthors.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              {(auditFilters.search || auditFilters.action !== 'all' || auditFilters.table !== 'all' || auditFilters.author) && (
                <button
                  onClick={() => setAuditFilters({ search: '', action: 'all', table: 'all', author: '' })}
                  className="h-8 px-2 text-[13px] text-gray-600 hover:text-gray-900"
                >
                  Limpar
                </button>
              )}
              <span className="ml-auto text-[12px] text-gray-500">
                {filteredAuditEntries.length} de {auditEntries.length}
              </span>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto">
              {auditLoading ? (
                <div className="text-center py-10 text-gray-500 text-sm">Carregando...</div>
              ) : filteredAuditEntries.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm">
                  {auditEntries.length === 0
                    ? 'Nenhuma alteração registrada nesta escala.'
                    : 'Nenhuma alteração bate com os filtros aplicados.'}
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filteredAuditEntries.map(e => {
                    const when = new Date(e.created_at);
                    const whenStr = when.toLocaleString('pt-BR');
                    const isExpanded = auditExpanded.has(e.id);
                    const actionStyle =
                      e.action === 'INSERT' ? { bg: 'bg-emerald-50', ring: 'ring-emerald-200', dot: 'bg-emerald-500', label: 'Criou' } :
                      e.action === 'DELETE' ? { bg: 'bg-red-50',     ring: 'ring-red-200',     dot: 'bg-red-500',     label: 'Excluiu' } :
                                              { bg: 'bg-blue-50',    ring: 'ring-blue-200',    dot: 'bg-blue-500',    label: 'Editou' };
                    const canExpand = !!e.changed_fields?.length || !!e.old_data || !!e.new_data;
                    return (
                      <li key={e.id} className="px-5 py-3">
                        <div className="flex items-start gap-3">
                          {/* Action dot */}
                          <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${actionStyle.dot}`} aria-hidden="true" />
                          {/* Main */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${actionStyle.bg} ${actionStyle.ring} text-gray-700`}>
                                {e.actionLabel ?? actionStyle.label}
                              </span>
                              <span className="text-[13px] text-gray-900 font-medium">
                                {e.description ?? `${e.action} em ${e.table_name}`}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                              <span title={when.toISOString()}>{whenStr}</span>
                              <span>·</span>
                              <span className="font-medium text-gray-600">{e.user_email ?? 'Sistema'}</span>
                              {e.table_name !== 'shifts' && (
                                <>
                                  <span>·</span>
                                  <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">{e.table_name}</span>
                                </>
                              )}
                            </div>
                            {/* Expansão: diff de campos */}
                            {isExpanded && canExpand && (
                              <div className="mt-2 bg-gray-50 border border-gray-200 rounded p-2 text-[12px]">
                                {(e.changed_fields ?? []).length > 0 && (
                                  <div className="grid grid-cols-[max-content_1fr_max-content_1fr] gap-x-3 gap-y-1 items-baseline">
                                    <div className="text-[10px] text-gray-400 uppercase tracking-wider">Campo</div>
                                    <div className="text-[10px] text-gray-400 uppercase tracking-wider">Antes</div>
                                    <div></div>
                                    <div className="text-[10px] text-gray-400 uppercase tracking-wider">Depois</div>
                                    {(e.changed_fields ?? []).map(k => (
                                      <Fragment key={k}>
                                        <div className="font-mono text-gray-700">{k}</div>
                                        <div className="font-mono text-red-700 line-through truncate">
                                          {e.old_data && e.old_data[k] !== undefined ? JSON.stringify(e.old_data[k]) : '—'}
                                        </div>
                                        <div className="text-gray-400">→</div>
                                        <div className="font-mono text-emerald-700 truncate">
                                          {e.new_data && e.new_data[k] !== undefined ? JSON.stringify(e.new_data[k]) : '—'}
                                        </div>
                                      </Fragment>
                                    ))}
                                  </div>
                                )}
                                {(!e.changed_fields || e.changed_fields.length === 0) && e.new_data && (
                                  <pre className="font-mono text-[11px] text-gray-700 whitespace-pre-wrap break-all">{JSON.stringify(e.new_data, null, 2)}</pre>
                                )}
                              </div>
                            )}
                          </div>
                          {/* Expand toggle */}
                          {canExpand && (
                            <button
                              onClick={() => setAuditExpanded(s => {
                                const n = new Set(s);
                                if (n.has(e.id)) n.delete(e.id); else n.add(e.id);
                                return n;
                              })}
                              className="text-[11px] text-gray-500 hover:text-gray-900 flex-shrink-0 mt-0.5"
                              title="Ver detalhes"
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="px-5 py-2 border-t border-gray-200 text-[11px] text-gray-500 flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              Registros gravados por trigger no banco. Não podem ser editados nem apagados — nem por administradores.
            </div>
          </div>
        </div>
      )}

      {/* Modal de exclusão da escala inteira */}
      {showDeleteScheduleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900">Excluir esta escala?</h2>
                <p className="text-sm text-gray-600 mt-1">
                  A escala
                  {currentSchedule ? <> <strong>"{currentSchedule.name}"</strong></> : null}
                  {' '}será apagada junto com <strong>todos os plantões e trocas associados</strong>.
                  O histórico de alterações é mantido para auditoria.
                </p>
              </div>
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Para confirmar, digite <strong>EXCLUIR</strong>:
            </label>
            <input
              type="text"
              value={deleteScheduleConfirm}
              onChange={(e) => setDeleteScheduleConfirm(e.target.value)}
              placeholder="EXCLUIR"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm font-mono uppercase"
              autoFocus
            />
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowDeleteScheduleModal(false); setDeleteScheduleConfirm(''); }}
                disabled={deletingSchedule}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteSchedule}
                disabled={deleteScheduleConfirm.trim().toUpperCase() !== 'EXCLUIR' || deletingSchedule}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {deletingSchedule ? 'Excluindo...' : 'Excluir Escala'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de limpeza total dos plantões da escala atual */}
      {showClearAllModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900">Limpar todos os plantões desta escala?</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Esta ação remove <strong>todos os plantões</strong> da escala
                  {currentSchedule ? <> <strong>"{currentSchedule.name}"</strong></> : null}.
                  A escala em si <strong>não é apagada</strong> — você pode recomeçar do zero.
                </p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-900">
              <strong>Não pode ser desfeito.</strong> Os profissionais vinculados continuam, e ausências/trocas também — só os plantões da grade são apagados.
            </div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Para confirmar, digite <strong>LIMPAR</strong>:
            </label>
            <input
              type="text"
              value={clearAllConfirmText}
              onChange={(e) => setClearAllConfirmText(e.target.value)}
              placeholder="LIMPAR"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm font-mono uppercase"
              autoFocus
            />
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowClearAllModal(false); setClearAllConfirmText(''); }}
                disabled={clearingAll}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearAllShifts}
                disabled={clearAllConfirmText.trim().toUpperCase() !== 'LIMPAR' || clearingAll}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {clearingAll ? 'Limpando...' : 'Limpar Escala'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AutoFillModal
        isOpen={showAutoFillModal}
        onClose={() => setShowAutoFillModal(false)}
        professionals={
          // Fonte de verdade: todos os profissionais ATIVOS do setor que
          // estão "na escala" (com ou sem turnos), unidos com os já
          // visíveis na tabela. Garante que o auto-fill veja todos.
          allProfessionals.filter(
            p => professionalIdsInSchedule.has(p.id) || professionals.some(ep => ep.id === p.id)
          )
        }
        onApply={applyAutoFillPatterns}
      />

      {showAbsenceModal && (
        <CreateAbsenceModal
          absence={null}
          reasons={absenceReasons}
          departments={departments}
          professionals={
            // Profissionais do setor (ativos) — para o select do absence
            allProfessionals.map(p => ({
              id: p.id,
              full_name: p.full_name,
              department_id: selectedDepartment,
            }))
          }
          initialData={absenceInitialData}
          lockDepartment
          onClose={() => {
            setShowAbsenceModal(false);
            setAbsenceInitialData(undefined);
          }}
          onSuccess={() => {
            setShowAbsenceModal(false);
            setAbsenceInitialData(undefined);
            toast.success('Ausência registrada com sucesso.');
          }}
        />
      )}

      {showSwapModal && (
        <CreateSwapModal
          initialShiftId={swapInitialShiftId ?? undefined}
          onClose={() => {
            setShowSwapModal(false);
            setSwapInitialShiftId(null);
          }}
          onSuccess={() => {
            setShowSwapModal(false);
            setSwapInitialShiftId(null);
            // Recarrega os dados para refletir o swap aplicado
            loadData(true);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={pendingConfirm !== null}
        title={pendingConfirm?.title || ''}
        message={pendingConfirm?.message || ''}
        confirmLabel="Confirmar"
        onConfirm={() => { pendingConfirm?.action(); setPendingConfirm(null); }}
        onCancel={() => setPendingConfirm(null)}
      />

      <ConfirmDialog
        isOpen={statusChangeDialog !== null}
        title={statusChangeDialog?.title ?? ''}
        message={statusChangeDialog?.message ?? ''}
        variant={statusChangeDialog?.variant}
        confirmLabel={statusChangeDialog?.confirmLabel ?? 'Confirmar'}
        loading={statusChangeLoading}
        onConfirm={() => statusChangeDialog && updateScheduleStatus(statusChangeDialog.targetStatus)}
        onCancel={() => setStatusChangeDialog(null)}
      />

      <ConfirmDialog
        isOpen={undoingSwap !== null}
        title="Desfazer troca?"
        message="Os plantões voltam para os profissionais originais e o registro da troca será apagado. Esta ação não pode ser desfeita."
        variant="warning"
        confirmLabel="Desfazer"
        loading={undoSwapLoading}
        onConfirm={handleUndoSwap}
        onCancel={() => setUndoingSwap(null)}
      />

      <ConfirmDialog
        isOpen={undoingAbsence !== null}
        title="Desfazer ausência?"
        message={`Remove o registro de "${undoingAbsence?.reason_name ?? ''}" de ${undoingAbsence?.professional_name ?? ''} no dia ${(undoingAbsence?.date ?? '').split('-').reverse().join('/')}. Se a ausência cobre mais de um dia, todos eles serão removidos. Esta ação não pode ser desfeita.`}
        variant="danger"
        confirmLabel="Desfazer"
        loading={undoAbsenceLoading}
        onConfirm={handleUndoAbsence}
        onCancel={() => setUndoingAbsence(null)}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
