import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Upload, FileSpreadsheet, X, Loader2, AlertTriangle,
  Building2, Calendar, UserPlus, UserCheck,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../Common/ToastContainer';
import ConfirmDialog from '../Common/ConfirmDialog';
import { parseScheduleWorkbook, ParsedSchedule } from '../../utils/excelImport';
import { getShiftByName } from '../../lib/shiftTypes';

interface ImportScheduleModalProps {
  onClose: () => void;
  onSuccess: (scheduleId: string) => void;
}

interface DeptRow { id: string; name: string }
interface ProfRow { id: string; full_name: string; registration_number: string | null; department_id: string | null }
interface CatRow { id: string; name: string }

type RowAction = 'use' | 'create' | 'skip';
interface MatchRow {
  row: number;
  name: string;
  registration: string | null;
  role: string | null;
  ch: number | null;
  shiftCount: number;
  matchedId: string | null;
  matchedBy: 'registration' | 'name' | null;
  action: RowAction;
}

const norm = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim().replace(/\s+/g, ' ');

// remove sufixos comuns de setor ("- HECC", "HCC") para casar com o departamento
const normDept = (s: string | null | undefined) =>
  norm(s).replace(/\s*-\s*HECC\b/g, '').replace(/\bHECC\b/g, '').replace(/\bHCC\b/g, '').trim();

export default function ImportScheduleModal({ onClose, onSuccess }: ImportScheduleModalProps) {
  const { user } = useAuth();
  const { allowedDepartments, isAdmin } = usePermissions();
  const { toasts, toast, removeToast } = useToast();

  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedSchedule | null>(null);
  const [fileName, setFileName] = useState('');

  const [departments, setDepartments] = useState<DeptRow[]>([]);
  const [professionals, setProfessionals] = useState<ProfRow[]>([]);
  const [categories, setCategories] = useState<CatRow[]>([]);

  const [deptId, setDeptId] = useState('');
  const [monthValue, setMonthValue] = useState(''); // YYYY-MM
  const [actions, setActions] = useState<Record<number, RowAction>>({});

  const [existingScheduleId, setExistingScheduleId] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [importing, setImporting] = useState(false);

  // Carrega dados de apoio uma vez
  useEffect(() => {
    (async () => {
      let dq = supabase.from('departments').select('id, name').eq('active', true).order('name');
      if (!isAdmin() && allowedDepartments && allowedDepartments.length > 0) {
        dq = dq.in('id', allowedDepartments);
      }
      const [{ data: depts }, { data: profs }, { data: cats }] = await Promise.all([
        dq,
        supabase.from('professionals').select('id, full_name, registration_number, department_id'),
        supabase.from('professional_categories').select('id, name'),
      ]);
      setDepartments((depts as DeptRow[]) ?? []);
      setProfessionals((profs as ProfRow[]) ?? []);
      setCategories((cats as CatRow[]) ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const ab = await file.arrayBuffer();
      const result = await parseScheduleWorkbook(ab, file.name);
      setParsed(result);
      setFileName(file.name);
      // pré-seleção de setor e mês
      if (result.month && result.year) {
        setMonthValue(`${result.year}-${String(result.month).padStart(2, '0')}`);
      }
    } catch (err: any) {
      console.error('Erro ao ler planilha:', err);
      toast.error('Não foi possível ler a planilha: ' + (err.message ?? 'arquivo inválido'));
    } finally {
      setParsing(false);
    }
  };

  // Auto-casar setor quando parsed + departments prontos
  useEffect(() => {
    if (!parsed || departments.length === 0 || deptId) return;
    const target = normDept(parsed.sector);
    const found =
      departments.find(d => normDept(d.name) === target) ||
      departments.find(d => target && (normDept(d.name).includes(target) || target.includes(normDept(d.name))));
    if (found) setDeptId(found.id);
  }, [parsed, departments, deptId]);

  // Matching de profissionais (por matrícula, depois nome)
  const matches = useMemo<MatchRow[]>(() => {
    if (!parsed) return [];
    const byReg = new Map<string, ProfRow>();
    const byName = new Map<string, ProfRow>();
    professionals.forEach(p => {
      if (p.registration_number) byReg.set(norm(p.registration_number), p);
      byName.set(norm(p.full_name), p);
    });
    return parsed.professionals.map(ip => {
      let matchedId: string | null = null;
      let matchedBy: 'registration' | 'name' | null = null;
      if (ip.registration && byReg.has(norm(ip.registration))) {
        matchedId = byReg.get(norm(ip.registration))!.id; matchedBy = 'registration';
      } else if (byName.has(norm(ip.name))) {
        matchedId = byName.get(norm(ip.name))!.id; matchedBy = 'name';
      }
      return {
        row: ip.row, name: ip.name, registration: ip.registration, role: ip.role, ch: ip.ch,
        shiftCount: ip.shifts.filter(s => s.resolvedName).length,
        matchedId, matchedBy,
        action: matchedId ? 'use' : (actions[ip.row] ?? 'create'),
      };
    });
  }, [parsed, professionals, actions]);

  // Detecta escala existente p/ o setor+mês escolhidos
  const checkExisting = useCallback(async () => {
    if (!deptId || !monthValue) { setExistingScheduleId(null); return; }
    const { data } = await supabase
      .from('monthly_schedules').select('id')
      .eq('department_id', deptId).eq('month', `${monthValue}-01`).maybeSingle();
    setExistingScheduleId(data?.id ?? null);
  }, [deptId, monthValue]);
  useEffect(() => { checkExisting(); }, [checkExisting]);

  const matchedCount = matches.filter(m => m.matchedId).length;
  const unmatched = matches.filter(m => !m.matchedId);
  const toCreate = unmatched.filter(m => m.action === 'create').length;
  const toSkip = unmatched.filter(m => m.action === 'skip').length;
  const importableProfs = matches.filter(m => m.action !== 'skip');
  const totalShifts = parsed
    ? parsed.professionals
        .filter(ip => importableProfs.some(m => m.row === ip.row))
        .reduce((acc, ip) => acc + ip.shifts.filter(s => s.resolvedName).length, 0)
    : 0;
  const canImport = !!parsed && !!deptId && /^\d{4}-\d{2}$/.test(monthValue) && totalShifts > 0 && !importing;

  const startImport = () => {
    if (existingScheduleId) setConfirmReplace(true);
    else doImport();
  };

  const doImport = async () => {
    setConfirmReplace(false);
    if (!parsed || !deptId || !monthValue) return;
    setImporting(true);
    try {
      const [yStr, mStr] = monthValue.split('-');
      const year = parseInt(yStr, 10);
      const dayStr = (d: number) => `${yStr}-${mStr}-${String(d).padStart(2, '0')}`;
      const dept = departments.find(d => d.id === deptId);

      // 1) Criar profissionais marcados como "create"
      const rowToProfId = new Map<number, string>();
      matches.forEach(m => { if (m.matchedId) rowToProfId.set(m.row, m.matchedId); });

      const toCreateRows = parsed.professionals.filter(ip =>
        matches.find(m => m.row === ip.row && m.action === 'create')
      );
      for (const ip of toCreateRows) {
        const catId = categories.find(c => norm(c.name) === norm(ip.role))?.id ?? null;
        const { data, error } = await supabase.from('professionals').insert({
          full_name: ip.name,
          registration_number: ip.registration,
          department_id: deptId,
          category_id: catId,
          contracted_hours_per_month: ip.ch ?? undefined,
          active: true,
        } as any).select('id').single();
        if (error) throw new Error(`Falha ao criar profissional "${ip.name}": ${error.message}`);
        rowToProfId.set(ip.row, data!.id);
      }

      // 2) Escala: substituir existente ou criar nova (Rascunho → publica no fim)
      let scheduleId = existingScheduleId;
      if (scheduleId) {
        await supabase.from('shifts').delete().eq('schedule_id', scheduleId);
        await supabase.from('monthly_schedules')
          .update({ published_at: null, status: 'Rascunho' } as any).eq('id', scheduleId);
      } else {
        const monthName = new Date(year, parseInt(mStr, 10) - 1, 15)
          .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const name = `Escala ${dept?.name ?? ''} - ${monthName.charAt(0).toUpperCase() + monthName.slice(1)}`;
        const { data, error } = await supabase.from('monthly_schedules').insert({
          department_id: deptId, month: `${monthValue}-01`, name,
          status: 'Rascunho', created_by: user?.id,
        } as any).select('id').single();
        if (error) throw new Error('Falha ao criar a escala: ' + error.message);
        scheduleId = data!.id;
      }

      // 3) Montar shifts (Planejada: original_* = mesmos valores)
      const rows: any[] = [];
      for (const ip of parsed.professionals) {
        const profId = rowToProfId.get(ip.row);
        if (!profId) continue; // pulado
        for (const s of ip.shifts) {
          if (!s.resolvedName) continue; // código desconhecido → ignora célula
          const cat = s; // já resolvido
          const { start, end } = resolveTimes(cat.resolvedName!);
          rows.push({
            professional_id: profId, department_id: deptId, schedule_id: scheduleId,
            shift_date: dayStr(s.day), shift_type: s.resolvedName,
            start_time: start, end_time: end, status: 'Agendado',
            original_shift_type: s.resolvedName, original_start_time: start,
            original_end_time: end, original_professional_id: profId,
            created_by: user?.id,
          });
        }
      }

      // 4) Inserir em lotes
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from('shifts').insert(rows.slice(i, i + 500) as any);
        if (error) throw new Error('Falha ao inserir plantões: ' + error.message);
      }

      // 5) Publicar/congelar a Planejada (dispara auditoria 'publish')
      await supabase.from('monthly_schedules')
        .update({ published_at: new Date().toISOString(), status: 'Publicada', published_by: user?.id } as any)
        .eq('id', scheduleId);

      toast.success(`Escala importada: ${rows.length} plantões, ${toCreateRows.length} profissionais criados.`);
      onSuccess(scheduleId!);
    } catch (err: any) {
      console.error('Erro na importação:', err);
      toast.error(err.message ?? 'Erro na importação.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-gray-200 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">Importar Escala do Excel</h2>
              <p className="text-sm text-gray-500 mt-0.5">Modelo padrão (planilha por setor)</p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg" disabled={importing}>
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {!parsed ? (
              /* ---------- UPLOAD ---------- */
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl py-12 px-6 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/40 transition">
                {parsing ? (
                  <><Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" /><span className="text-sm text-gray-600">Lendo planilha...</span></>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-400 mb-3" />
                    <span className="text-sm font-medium text-gray-700">Clique para selecionar o arquivo .xlsx</span>
                    <span className="text-xs text-gray-500 mt-1">Setor, mês e profissionais são lidos automaticamente</span>
                  </>
                )}
                <input
                  type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden" disabled={parsing}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </label>
            ) : (
              /* ---------- PREVIEW ---------- */
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <FileSpreadsheet className="w-4 h-4" /> {fileName}
                  <button onClick={() => { setParsed(null); setDeptId(''); setActions({}); }} className="ml-auto text-blue-600 hover:underline">trocar arquivo</button>
                </div>

                {/* Avisos do parser */}
                {parsed.warnings.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
                    {parsed.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-800 flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{w}</p>
                    ))}
                  </div>
                )}

                {/* Setor + Mês */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <Building2 className="w-4 h-4 inline mr-1" />Setor (planilha: <em>{parsed.sector ?? '—'}</em>)
                    </label>
                    <select value={deptId} onChange={e => setDeptId(e.target.value)}
                      className="w-full min-h-[42px] px-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500">
                      <option value="">Selecione o setor…</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <Calendar className="w-4 h-4 inline mr-1" />Mês/Ano
                      {parsed.monthSource !== 'cell' && <span className="text-amber-600 text-xs ml-1">(confira)</span>}
                    </label>
                    <input type="month" value={monthValue} onChange={e => setMonthValue(e.target.value)}
                      className="w-full min-h-[42px] px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>

                {existingScheduleId && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    Já existe uma escala para este setor e mês. Ao importar, ela será <strong>substituída</strong> (pedirá confirmação).
                  </div>
                )}

                {/* Resumo */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-emerald-50 rounded-lg py-2"><div className="text-lg font-bold text-emerald-700">{matchedCount}</div><div className="text-xs text-emerald-800">encontrados</div></div>
                  <div className="bg-blue-50 rounded-lg py-2"><div className="text-lg font-bold text-blue-700">{toCreate}</div><div className="text-xs text-blue-800">a criar</div></div>
                  <div className="bg-gray-100 rounded-lg py-2"><div className="text-lg font-bold text-gray-700">{toSkip}</div><div className="text-xs text-gray-600">a pular</div></div>
                </div>

                {/* Profissionais */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="text-left px-3 py-2">Profissional</th>
                        <th className="text-left px-3 py-2">Matrícula</th>
                        <th className="text-center px-3 py-2">Plantões</th>
                        <th className="text-left px-3 py-2">Situação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {matches.map(m => (
                        <tr key={m.row}>
                          <td className="px-3 py-2 text-gray-900">{m.name}</td>
                          <td className="px-3 py-2 text-gray-500">{m.registration ?? '—'}</td>
                          <td className="px-3 py-2 text-center text-gray-600">{m.shiftCount}</td>
                          <td className="px-3 py-2">
                            {m.matchedId ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 text-xs">
                                <UserCheck className="w-3.5 h-3.5" /> encontrado{m.matchedBy === 'name' ? ' (por nome)' : ''}
                              </span>
                            ) : (
                              <select
                                value={m.action}
                                onChange={e => setActions(a => ({ ...a, [m.row]: e.target.value as RowAction }))}
                                className="text-xs border border-gray-300 rounded px-1.5 py-1 bg-white"
                              >
                                <option value="create">Criar novo</option>
                                <option value="skip">Pular</option>
                              </select>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {parsed.unknownCodes.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">
                    <strong>Códigos desconhecidos (serão ignorados):</strong>{' '}
                    {parsed.unknownCodes.map(u => `${u.code} (${u.count})`).join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {parsed && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {totalShifts} plantões · {importableProfs.length} profissionais
              </span>
              <div className="ml-auto flex gap-3">
                <button onClick={onClose} disabled={importing}
                  className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={startImport} disabled={!canImport}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  {importing ? 'Importando...' : 'Importar e Publicar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmReplace}
        title="Substituir escala existente?"
        message="Já existe uma escala para este setor e mês. Os plantões atuais dela serão apagados e recriados a partir da planilha. Esta ação não pode ser desfeita."
        confirmLabel="Substituir"
        variant="danger"
        onConfirm={doImport}
        onCancel={() => setConfirmReplace(false)}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}

// Horários do código (a partir do nome gravado), via catálogo compartilhado.
function resolveTimes(name: string): { start: string; end: string } {
  const st = getShiftByName(name);
  return { start: st?.start ?? '00:00', end: st?.end ?? '00:00' };
}
