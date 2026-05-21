import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ArrowLeftRight, Clock, AlertCircle, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import ToastContainer from '../Common/ToastContainer';
import { useToast } from '../../hooks/useToast';

const CreateSwapModal = lazy(() => import('../Swaps/CreateSwapModal'));

// Mapa de shift_type → código curto e cor (espelha SHIFT_TYPES de ConsolidatedScheduleView)
const SHIFT_STYLES: Record<string, { code: string; classes: string; label: string }> = {
  'Diarista': { code: 'D', classes: 'bg-cyan-100 text-cyan-900 ring-cyan-200', label: 'Diarista' },
  'Serviço Diurno (7h às 19h) 12h': { code: 'SD', classes: 'bg-sky-100 text-sky-900 ring-sky-200', label: 'Diurno 12h' },
  'Serviço Noturno (19h às 7h) 12h': { code: 'SN', classes: 'bg-indigo-100 text-indigo-900 ring-indigo-200', label: 'Noturno 12h' },
  'Manhã (7h às 13h) 6h': { code: 'M', classes: 'bg-emerald-100 text-emerald-900 ring-emerald-200', label: 'Manhã 6h' },
  'Tarde (12h às 18h) 6h': { code: 'T', classes: 'bg-amber-100 text-amber-900 ring-amber-200', label: 'Tarde 6h' },
  'Plantão 24h (7h às 7h) 24h': { code: 'P', classes: 'bg-blue-100 text-blue-900 ring-blue-200', label: 'Plantão 24h' },
};
const DEFAULT_STYLE = { code: '·', classes: 'bg-gray-100 text-gray-700 ring-gray-200', label: 'Plantão' };

interface MyShift {
  id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  shift_type: string;
  status: string;
  department: { name: string };
}

export default function MyScheduleView() {
  const { user } = useAuth();
  const { toasts, toast, removeToast } = useToast();
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [professionalName, setProfessionalName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [shifts, setShifts] = useState<MyShift[]>([]);
  const [referenceMonth, setReferenceMonth] = useState<Date>(new Date());
  const [swapShiftId, setSwapShiftId] = useState<string | null>(null);

  // Carrega o profissional vinculado ao usuário
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('professionals')
        .select('id, full_name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        console.error('Erro ao carregar profissional:', error);
        toast.error('Não foi possível identificar seu cadastro de profissional.');
        setLoading(false);
        return;
      }
      if (!data) {
        setLoading(false);
        return;
      }
      setProfessionalId(data.id);
      setProfessionalName(data.full_name);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Carrega plantões do mês selecionado
  useEffect(() => {
    if (!professionalId) return;
    (async () => {
      setLoading(true);
      const y = referenceMonth.getFullYear();
      const m = referenceMonth.getMonth();
      const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const end = new Date(y, m + 1, 0).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('shifts')
        .select('id, shift_date, start_time, end_time, shift_type, status, department:departments!department_id(name)')
        .eq('professional_id', professionalId)
        .gte('shift_date', start)
        .lte('shift_date', end)
        .order('shift_date');
      if (error) {
        console.error(error);
        toast.error('Erro ao carregar plantões.');
        setShifts([]);
      } else {
        setShifts((data ?? []) as any);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId, referenceMonth]);

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, MyShift[]>();
    shifts.forEach(s => {
      const arr = map.get(s.shift_date) ?? [];
      arr.push(s);
      map.set(s.shift_date, arr);
    });
    return map;
  }, [shifts]);

  const calendarDays = useMemo(() => {
    const y = referenceMonth.getFullYear();
    const m = referenceMonth.getMonth();
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    const startWeekday = firstDay.getDay(); // 0 = domingo
    const cells: Array<{ date: string | null; day: number | null }> = [];
    for (let i = 0; i < startWeekday; i++) cells.push({ date: null, day: null });
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ date, day: d });
    }
    return cells;
  }, [referenceMonth]);

  const monthLabel = referenceMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const totalShifts = shifts.length;

  const changeMonth = (delta: number) => {
    setReferenceMonth(prev => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + delta);
      return next;
    });
  };

  const formatTime = (t: string) => t.slice(0, 5);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Minha Escala</h2>
          <p className="text-gray-600 mt-1">
            {professionalName
              ? <>Olá, <strong>{professionalName.split(' ')[0]}</strong> — clique em um plantão para solicitar troca.</>
              : 'Seus plantões deste mês.'}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-xl shadow-sm border border-gray-200 px-3 py-2">
          <button
            onClick={() => changeMonth(-1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2 px-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-900 capitalize min-w-[140px] text-center">{monthLabel}</span>
          </div>
          <button
            onClick={() => changeMonth(1)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {!professionalId && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Sua conta ainda não está vinculada a um cadastro de profissional.</p>
            <p className="mt-1">Procure a Diretoria Médica para concluir a vinculação.</p>
          </div>
        </div>
      )}

      {professionalId && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Plantões no mês" value={totalShifts} icon={Calendar} accent="text-blue-600 bg-blue-50" />
            <StatCard
              label="Próximos 7 dias"
              value={shifts.filter(s => {
                const diff = (new Date(s.shift_date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000;
                return diff >= 0 && diff <= 7;
              }).length}
              icon={Clock}
              accent="text-amber-600 bg-amber-50"
            />
            <StatCard
              label="Setores neste mês"
              value={new Set(shifts.map(s => s.department?.name).filter(Boolean)).size}
              icon={Info}
              accent="text-emerald-600 bg-emerald-50"
            />
            <div className="bg-blue-50 rounded-xl p-3 border border-transparent flex items-center gap-2">
              <ArrowLeftRight className="w-8 h-8 text-blue-600" />
              <div className="text-xs text-blue-900">
                <p className="font-semibold">Quer trocar?</p>
                <p>Clique em um plantão para iniciar.</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                <div key={d} className="px-2 py-2 text-center">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 auto-rows-fr">
              {calendarDays.map((cell, idx) => {
                if (!cell.date) {
                  return <div key={`empty-${idx}`} className="border-r border-b border-gray-100 bg-gray-50/40" />;
                }
                const dayShifts = shiftsByDay.get(cell.date) ?? [];
                const isToday = cell.date === today;
                const isPast = cell.date < today;
                return (
                  <div
                    key={cell.date}
                    className={`border-r border-b border-gray-100 p-2 min-h-[88px] flex flex-col gap-1 ${isToday ? 'bg-blue-50/40 ring-1 ring-inset ring-blue-200' : ''}`}
                  >
                    <div className={`text-xs font-semibold ${isToday ? 'text-blue-700' : isPast ? 'text-gray-400' : 'text-gray-700'}`}>
                      {cell.day}
                    </div>
                    {dayShifts.map(s => {
                      const style = SHIFT_STYLES[s.shift_type] ?? DEFAULT_STYLE;
                      const isFuture = cell.date! >= today;
                      return (
                        <button
                          key={s.id}
                          onClick={() => {
                            if (!isFuture) {
                              toast.warning('Não é possível solicitar troca de plantão passado.');
                              return;
                            }
                            setSwapShiftId(s.id);
                          }}
                          className={`text-left px-2 py-1 rounded-md ring-1 ring-inset transition hover:shadow-sm ${style.classes} ${isFuture ? 'cursor-pointer hover:scale-[1.02]' : 'opacity-60 cursor-not-allowed'}`}
                          title={`${style.label} — ${s.department?.name || ''} · ${formatTime(s.start_time)}-${formatTime(s.end_time)}`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded text-[10px] font-bold">{style.code}</span>
                            <span className="text-[11px] truncate flex-1">{s.department?.name || 'Plantão'}</span>
                          </div>
                          <div className="text-[10px] opacity-80 mt-0.5">{formatTime(s.start_time)}-{formatTime(s.end_time)}</div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900 flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              <strong>Como solicitar troca:</strong> clique no plantão que você quer trocar. Você pode escolher outro médico para assumir (cessão simples) ou propor um plantão dele em troca. A Diretoria Médica analisa e aprova.
            </span>
          </div>
        </>
      )}

      {swapShiftId && (
        <Suspense fallback={null}>
          <CreateSwapModal
            initialShiftId={swapShiftId}
            onClose={() => setSwapShiftId(null)}
            onSuccess={() => {
              setSwapShiftId(null);
              toast.success('Solicitação enviada com sucesso.');
            }}
          />
        </Suspense>
      )}

      {loading && (
        <div className="text-center py-12 text-gray-500">Carregando...</div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: number; icon: any; accent: string }) {
  const [textColor, bg] = accent.split(' ');
  return (
    <div className={`${bg} rounded-xl p-3 border border-transparent`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-600">{label}</p>
          <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
        </div>
        <Icon className={`w-8 h-8 ${textColor}`} />
      </div>
    </div>
  );
}
