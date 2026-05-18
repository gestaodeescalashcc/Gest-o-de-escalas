import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Building2, FileText, Download, CheckCircle, XCircle, AlertCircle, ChevronLeft, ChevronRight, Printer, Shield, Hash, Edit3, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ToastContainer from '../Common/ToastContainer';
import { useToast } from '../../hooks/useToast';

interface Professional {
  id: string;
  full_name: string;
  registration_number: string;
  category: { name: string };
  department: { name: string };
}

interface Establishment {
  id: string;
  employer_name: string;
  employer_document: string;
  address_city: string;
  address_state: string;
}

interface PunchRecord {
  id: string;
  nsr: number;
  punch_type: string;
  punch_datetime: string;
  record_hash: string;
  is_outside_schedule: boolean;
}

interface Adjustment {
  id: string;
  adjustment_type: string;
  adjusted_datetime: string;
  adjusted_punch_type: string;
  justification: string;
  approval_status: string;
  approved_by: string;
  approved_at: string;
}

interface DaySummary {
  date: string;
  punches: PunchRecord[];
  adjustments: Adjustment[];
  workedMinutes: number;
  overtimeMinutes: number;
}

export default function PunchMirrorView() {
  const { toasts, toast, removeToast } = useToast();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<string>('');
  const [selectedEstablishment, setSelectedEstablishment] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [daySummaries, setDaySummaries] = useState<DaySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [totalWorked, setTotalWorked] = useState(0);
  const [totalOvertime, setTotalOvertime] = useState(0);

  useEffect(() => {
    loadProfessionals();
    loadEstablishments();
  }, []);

  useEffect(() => {
    if (selectedProfessional && selectedEstablishment && selectedMonth) {
      loadMirrorData();
    }
  }, [selectedProfessional, selectedEstablishment, selectedMonth]);

  const loadProfessionals = async () => {
    const { data } = await supabase
      .from('professionals')
      .select(`
        id, full_name, registration_number,
        category:professional_categories!category_id(name),
        department:departments!department_id(name)
      `)
      .eq('active', true)
      .order('full_name');
    if (data) setProfessionals(data as Professional[]);
  };

  const loadEstablishments = async () => {
    const { data } = await supabase
      .from('establishments')
      .select('*')
      .eq('active', true)
      .order('employer_name');
    if (data) setEstablishments(data);
  };

  const loadMirrorData = async () => {
    setLoading(true);

    try {
    const [year, month] = selectedMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const { data: profData, error: profError } = await supabase
      .from('professionals')
      .select(`
        id, full_name, registration_number,
        category:professional_categories!category_id(name),
        department:departments!department_id(name)
      `)
      .eq('id', selectedProfessional)
      .maybeSingle();
    if (profError) throw profError;
    if (profData) setProfessional(profData as Professional);

    const { data: estabData, error: estabError } = await supabase
      .from('establishments')
      .select('*')
      .eq('id', selectedEstablishment)
      .maybeSingle();
    if (estabError) throw estabError;
    if (estabData) setEstablishment(estabData);

    const { data: punches, error: punchesError } = await supabase
      .from('punch_records')
      .select('*')
      .eq('professional_id', selectedProfessional)
      .eq('establishment_id', selectedEstablishment)
      .gte('punch_datetime', startDate.toISOString())
      .lte('punch_datetime', endDate.toISOString())
      .order('punch_datetime');
    if (punchesError) throw punchesError;

    const { data: adjustments, error: adjustmentsError } = await supabase
      .from('punch_adjustments')
      .select('*')
      .eq('professional_id', selectedProfessional)
      .eq('establishment_id', selectedEstablishment)
      .gte('adjusted_datetime', startDate.toISOString())
      .lte('adjusted_datetime', endDate.toISOString());
    if (adjustmentsError) throw adjustmentsError;

    const summaries: DaySummary[] = [];
    let totalWorkedMins = 0;
    let totalOvertimeMins = 0;

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);

      const dayPunches = (punches || []).filter(p =>
        p.punch_datetime.startsWith(dateStr)
      );

      const dayAdjustments = (adjustments || []).filter(a =>
        a.adjusted_datetime?.startsWith(dateStr)
      );

      const entries = dayPunches
        .filter(p => p.punch_type === 'ENTRY' || p.punch_type === 'MEAL_END')
        .map(p => new Date(p.punch_datetime))
        .sort((a, b) => a.getTime() - b.getTime());

      const exits = dayPunches
        .filter(p => p.punch_type === 'EXIT' || p.punch_type === 'MEAL_START')
        .map(p => new Date(p.punch_datetime))
        .sort((a, b) => a.getTime() - b.getTime());

      let workedMinutes = 0;
      const pairs = Math.min(entries.length, exits.length);
      for (let i = 0; i < pairs; i++) {
        const diff = exits[i].getTime() - entries[i].getTime();
        workedMinutes += Math.floor(diff / 60000);
      }

      const dailyLimit = 8 * 60;
      const overtime = Math.max(0, workedMinutes - dailyLimit);

      totalWorkedMins += workedMinutes;
      totalOvertimeMins += overtime;

      summaries.push({
        date: dateStr,
        punches: dayPunches,
        adjustments: dayAdjustments as Adjustment[],
        workedMinutes: Math.max(0, workedMinutes),
        overtimeMinutes: overtime
      });
    }

    setDaySummaries(summaries);
    setTotalWorked(totalWorkedMins);
    setTotalOvertime(totalOvertimeMins);
    } catch (err) {
      console.error('Error loading mirror data:', err);
      toast.error('Erro ao carregar espelho de ponto.');
    } finally {
      setLoading(false);
    }
  };

  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit'
    });
  };

  const formatTime = (datetime: string): string => {
    return new Date(datetime).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPunchTypeLabel = (type: string): string => {
    const types: Record<string, string> = {
      'ENTRY': 'E',
      'EXIT': 'S',
      'MEAL_START': 'SI',
      'MEAL_END': 'RI'
    };
    return types[type] || type;
  };

  const getAdjustmentLabel = (type: string): string => {
    const types: Record<string, string> = {
      'INCLUSION': 'Inclusao',
      'DISREGARD': 'Desconsiderada',
      'PRE_ASSIGNED': 'Pre-assinalada',
      'CORRECTION': 'Correcao'
    };
    return types[type] || type;
  };

  const isWeekend = (dateStr: string): boolean => {
    const date = new Date(dateStr + 'T12:00:00');
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const changeMonth = (delta: number) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const newDate = new Date(year, month - 1 + delta, 1);
    setSelectedMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const downloadMirror = () => {
    if (!professional || !establishment) return;

    const [year, month] = selectedMonth.split('-');
    const monthName = new Date(Number(year), Number(month) - 1, 1)
      .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    let content = `
================================================================================
                    ESPELHO DE PONTO ELETRONICO
                    Conforme Art. 84 - Portaria MTP 671/2021
================================================================================

EMPREGADOR
Nome: ${establishment.employer_name}
CNPJ: ${establishment.employer_document}
Local: ${establishment.address_city}/${establishment.address_state}

TRABALHADOR
Nome: ${professional.full_name}
CPF: ${professional.registration_number}
Cargo: ${professional.category?.name || 'N/A'}
Departamento: ${professional.department?.name || 'N/A'}

PERIODO: ${monthName.toUpperCase()}
Data de Emissao: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}

================================================================================
DATA        | MARCACOES REP                    | AJUSTES        | JORNADA | H.E.
================================================================================
`;

    daySummaries.forEach(day => {
      const dateFormatted = formatDate(day.date).padEnd(11);
      const punches = day.punches.map(p => formatTime(p.punch_datetime)).join(' ').padEnd(33);
      const adjusts = day.adjustments.length > 0 ? 'Sim'.padEnd(14) : '-'.padEnd(14);
      const worked = formatMinutes(day.workedMinutes).padEnd(7);
      const overtime = day.overtimeMinutes > 0 ? formatMinutes(day.overtimeMinutes) : '-';

      content += `${dateFormatted} | ${punches} | ${adjusts} | ${worked} | ${overtime}\n`;
    });

    content += `================================================================================
TOTAIS
--------------------------------------------------------------------------------
Total de Horas Trabalhadas: ${formatMinutes(totalWorked)}
Total de Horas Extras:      ${formatMinutes(totalOvertime)}
================================================================================

LEGENDA
E = Entrada | S = Saida | SI = Saida Intervalo | RI = Retorno Intervalo

Este documento foi gerado eletronicamente e atende aos requisitos do Art. 84
da Portaria MTP 671/2021 para fins de controle de jornada.
================================================================================
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `espelho_ponto_${professional.registration_number}_${selectedMonth}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl flex items-center justify-center">
            <FileText className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Espelho de Ponto Eletronico</h1>
            <p className="text-gray-600">Conforme Art. 84 - Portaria MTP 671/2021</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estabelecimento</label>
            <select
              value={selectedEstablishment}
              onChange={(e) => setSelectedEstablishment(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="">Selecione...</option>
              {establishments.map(e => (
                <option key={e.id} value={e.id}>{e.employer_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Profissional</label>
            <select
              value={selectedProfessional}
              onChange={(e) => setSelectedProfessional(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="">Selecione...</option>
              {professionals.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Periodo</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => changeMonth(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              <button
                onClick={() => changeMonth(1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          <div className="flex items-end">
            <button
              onClick={downloadMirror}
              disabled={!selectedProfessional || !selectedEstablishment}
              className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5" />
              Exportar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando dados...</p>
          </div>
        ) : !selectedProfessional || !selectedEstablishment ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Selecione um estabelecimento e profissional para visualizar o espelho de ponto</p>
          </div>
        ) : (
          <>
            {professional && establishment && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Empregador</h3>
                  <p className="font-semibold text-gray-900">{establishment.employer_name}</p>
                  <p className="text-sm text-gray-600">CNPJ: {establishment.employer_document}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Trabalhador</h3>
                  <p className="font-semibold text-gray-900">{professional.full_name}</p>
                  <p className="text-sm text-gray-600">CPF: {professional.registration_number}</p>
                  <p className="text-sm text-gray-600">{professional.category?.name} - {professional.department?.name}</p>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Data</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Marcacoes REP</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ajustes</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Jornada</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">H. Extra</th>
                  </tr>
                </thead>
                <tbody>
                  {daySummaries.map((day) => (
                    <tr
                      key={day.date}
                      className={`border-b border-gray-100 ${
                        isWeekend(day.date) ? 'bg-gray-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${
                          isWeekend(day.date) ? 'text-gray-500' : 'text-gray-900'
                        }`}>
                          {formatDate(day.date)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {day.punches.length === 0 ? (
                            <span className="text-gray-400 text-sm">-</span>
                          ) : (
                            day.punches.map((punch) => (
                              <span
                                key={punch.id}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                  punch.punch_type === 'ENTRY' ? 'bg-green-100 text-green-800' :
                                  punch.punch_type === 'EXIT' ? 'bg-red-100 text-red-800' :
                                  punch.punch_type === 'MEAL_START' ? 'bg-orange-100 text-orange-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}
                                title={`NSR: ${punch.nsr} | Hash: ${punch.record_hash?.substring(0, 16)}...`}
                              >
                                <span className="font-bold">{getPunchTypeLabel(punch.punch_type)}</span>
                                {formatTime(punch.punch_datetime)}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {day.adjustments.length === 0 ? (
                          <span className="text-gray-400 text-sm">-</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {day.adjustments.map((adj) => (
                              <span
                                key={adj.id}
                                className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                  adj.approval_status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                  adj.approval_status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}
                                title={adj.justification}
                              >
                                {getAdjustmentLabel(adj.adjustment_type)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-mono ${
                          day.workedMinutes > 0 ? 'text-gray-900' : 'text-gray-400'
                        }`}>
                          {day.workedMinutes > 0 ? formatMinutes(day.workedMinutes) : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-mono ${
                          day.overtimeMinutes > 0 ? 'text-orange-600 font-semibold' : 'text-gray-400'
                        }`}>
                          {day.overtimeMinutes > 0 ? formatMinutes(day.overtimeMinutes) : '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-semibold">
                    <td colSpan={3} className="px-4 py-3 text-right text-gray-700">
                      TOTAIS DO PERIODO
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 font-mono">
                      {formatMinutes(totalWorked)}
                    </td>
                    <td className="px-4 py-3 text-right text-orange-600 font-mono">
                      {formatMinutes(totalOvertime)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-emerald-900">
                  <p className="font-semibold mb-1">Conformidade Art. 84 - Portaria MTP 671/2021</p>
                  <p>Este relatorio apresenta todas as marcacoes efetuadas no REP e marcacoes tratadas (incluidas, desconsideradas e pre-assinaladas), conforme exigido pela legislacao.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
