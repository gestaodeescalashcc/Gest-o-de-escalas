// Busca os dados do mês e entrega o Consolidado Mensal de Frequência da FESF
// pronto para download.
//
// Fica fora de ConsolidatedScheduleView de propósito: o mesmo gerador serve o
// coordenador (um setor) e o RH (hospital inteiro), a partir de telas
// diferentes. Quem chama só informa o mês e, opcionalmente, os setores.

import { supabase } from '../lib/supabase';
import { getShiftByName } from '../lib/shiftTypes';
import {
  buildConsolidadoRows,
  fillConsolidadoTemplate,
  consolidadoFileName,
  CONSOLIDADO_TEMPLATE_URL,
  type ConsolidadoMeta,
  type ConsolidadoProfessional,
  type ConsolidadoShift,
  type ConsolidadoAbsence,
} from '../utils/consolidadoExport';

const MESES_PT = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

/** "2026-09" → "SETEMBRO 2026", como o RH escreve no formulário. */
export function mesAnoPorExtenso(mes: string): string {
  const [ano, m] = mes.split('-');
  return `${MESES_PT[parseInt(m, 10) - 1]} ${ano}`;
}

function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const [ano, m] = mes.split('-').map(Number);
  const ultimo = new Date(ano, m, 0).getDate();
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimo).padStart(2, '0')}` };
}

/**
 * PostgREST devolve no máximo 1000 linhas por chamada. O hospital inteiro passa
 * de 2.300 plantões num mês, então paginamos — sempre com ordem estável, senão
 * páginas consecutivas pulam ou repetem linhas.
 */
async function buscarTudo<T>(
  monta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const PAGINA = 1000;
  const todos: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await monta(de, de + PAGINA - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    todos.push(...data);
    if (data.length < PAGINA) break;
  }
  return todos;
}

export interface GerarConsolidadoOpts {
  /** YYYY-MM. */
  mes: string;
  /** Setores a incluir. Vazio ou ausente = hospital inteiro (uso do RH). */
  departmentIds?: string[];
  /** Preenche SERVIÇO/PROGRAMA na linha 14 — normalmente o nome do setor. */
  servicoPrograma?: string;
  centroCusto?: string;
}

export interface GerarConsolidadoResultado {
  linhas: number;
  arquivo: string;
}

/**
 * Gera o consolidado e dispara o download. Devolve quantas pessoas entraram,
 * para a tela poder avisar quando o mês está vazio.
 */
export async function gerarConsolidado(
  opts: GerarConsolidadoOpts
): Promise<GerarConsolidadoResultado> {
  const { mes, departmentIds, servicoPrograma, centroCusto } = opts;
  const { inicio, fim } = limitesDoMes(mes);
  const porSetor = departmentIds && departmentIds.length > 0;

  const profs = await buscarTudo<any>((de, ate) => {
    let q = supabase
      .from('professionals')
      .select(
        'id, full_name, registration_number, cpf, contracted_hours_per_month, category:professional_categories!category_id(name)'
      )
      .order('id', { ascending: true })
      .range(de, ate);
    if (porSetor) q = q.in('department_id', departmentIds!);
    return q;
  });

  const shifts = await buscarTudo<any>((de, ate) => {
    let q = supabase
      .from('shifts')
      .select('professional_id, shift_date, shift_type, deleted_in_realizada_at')
      .gte('shift_date', inicio)
      .lte('shift_date', fim)
      .order('id', { ascending: true })
      .range(de, ate);
    if (porSetor) q = q.in('department_id', departmentIds!);
    return q;
  });

  const ausencias = await buscarTudo<any>((de, ate) => {
    let q = supabase
      .from('absences')
      .select(
        'professional_id, start_date, end_date, shift_type, hours_per_day, is_justified, reason:absence_reasons(name, default_justified)'
      )
      .lte('start_date', fim)
      .gte('end_date', inicio)
      .order('id', { ascending: true })
      .range(de, ate);
    if (porSetor) q = q.in('department_id', departmentIds!);
    return q;
  });

  const professionals: ConsolidadoProfessional[] = profs.map(p => ({
    id: p.id,
    full_name: p.full_name,
    registration_number: p.registration_number,
    cpf: p.cpf,
    cargo: p.category?.name ?? '',
    contracted_hours_per_month: p.contracted_hours_per_month,
  }));

  // O formulário lista por cargo e, dentro dele, por nome — o mesmo arranjo dos
  // consolidados que o RH já entrega.
  professionals.sort(
    (a, b) =>
      (a.cargo || '').localeCompare(b.cargo || '', 'pt-BR') ||
      a.full_name.localeCompare(b.full_name, 'pt-BR')
  );

  const consolidadoShifts: ConsolidadoShift[] = shifts
    // Plantão excluído só na Realizada não foi trabalhado: fora da contagem.
    .filter(s => !s.deleted_in_realizada_at)
    .map(s => ({
      professional_id: s.professional_id,
      shift_date: s.shift_date,
      code: getShiftByName(s.shift_type)?.code ?? s.shift_type,
    }));

  const consolidadoAbsences: ConsolidadoAbsence[] = ausencias.map(a => ({
    professional_id: a.professional_id,
    start_date: a.start_date,
    end_date: a.end_date,
    shift_type: a.shift_type,
    hours_per_day: a.hours_per_day,
    // O registro manda; o motivo é só o padrão de quando ninguém marcou.
    is_justified: a.is_justified ?? a.reason?.default_justified ?? true,
    reason_name: a.reason?.name,
  }));

  const linhas = buildConsolidadoRows({
    mes,
    professionals,
    shifts: consolidadoShifts,
    absences: consolidadoAbsences,
  });

  const meta: ConsolidadoMeta = {
    mesAno: mesAnoPorExtenso(mes),
    servicoPrograma,
    centroCusto,
  };

  const resp = await fetch(CONSOLIDADO_TEMPLATE_URL);
  if (!resp.ok) throw new Error('Modelo do consolidado não encontrado no servidor.');
  const template = await resp.arrayBuffer();

  const buffer = await fillConsolidadoTemplate(template, meta, linhas);
  const arquivo = consolidadoFileName(meta);

  const { downloadBuffer } = await import('../utils/excelExport');
  downloadBuffer(buffer, arquivo);

  return { linhas: linhas.length, arquivo };
}
