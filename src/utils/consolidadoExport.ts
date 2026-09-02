// Consolidado Mensal de Frequência — formulário FESF 5.11 FML 007.
//
// O arquivo NÃO é desenhado aqui: `public/templates/consolidado-fesf.xlsx` é o
// formulário oficial da FESF e este módulo só escreve as linhas dentro dele.
// Logo, cores, mesclagens, instruções, escala de impressão e bloco de
// assinatura vêm do próprio arquivo — por isso o resultado é o formulário, não
// uma imitação dele.
//
// Layout do molde (não mudar sem reconferir contra um consolidado real):
//   linhas 1..14  cabeçalho FESF (código, diretoria, instruções, mês/ano)
//   linha  15     cabeçalho da tabela
//   linhas 16..N  dados (o molde vem com 23; `duplicateRow` estica)
//   rodapé        GESTOR RESPONSÁVEL / DIRETOR DA UNIDADE (desce sozinho)
//
// Colunas: A nº | B matrícula | C CPF | D nome | E cargo | F CH |
//          G diurnos | H noturnos | I M/T | J total | K horas noturnas |
//          L plantão extra | M faltas (horas) | N datas de faltas |
//          O unidade | P observações
//
// J e K continuam FÓRMULA (`=G+H`, `=H*9`), como no formulário preenchido à
// mão — quem confere no Excel vê a conta, não um número cravado.

import ExcelJS from 'exceljs';
import { sanitizeXlsxBuffer } from './excelExport';

export const CONSOLIDADO_TEMPLATE_URL = '/templates/consolidado-fesf.xlsx';

/** Primeira linha de dados do molde. */
const FIRST_DATA_ROW = 16;
/** Linhas de dados que o molde já traz prontas. */
const TEMPLATE_DATA_ROWS = 23;

/** Códigos de turno que contam como plantão diurno na coluna G. */
const CODIGOS_DIURNOS = ['SD'];
/** Códigos de turno que contam como plantão noturno na coluna H. */
const CODIGOS_NOTURNOS = ['SN'];
/** Turno de dia inteiro (diarista): a coluna I vira número puro. */
const CODIGO_DIA_INTEIRO = 'MT';
/** Meia jornada: a coluna I vira texto ("2M 1T"). */
const CODIGO_MANHA = 'M';
const CODIGO_TARDE = 'T';
/**
 * Plantão de 24h. O formulário só tem coluna diurno e noturno, então ele não
 * tem casa própria: conta como diurno e é sempre denunciado em Observações,
 * nunca somado em silêncio. (Decisão pendente com a FESF/RH.)
 */
const CODIGO_24H = 'P';

export interface ConsolidadoProfessional {
  id: string;
  full_name: string;
  registration_number?: string | null;
  cpf?: string | null;
  cargo?: string | null;
  contracted_hours_per_month?: number | null;
  unidade?: string | null;
}

export interface ConsolidadoShift {
  professional_id: string;
  /** Data no formato YYYY-MM-DD. */
  shift_date: string;
  /** Código do turno já resolvido pelo catálogo (SD, SN, MT, M, T, P…). */
  code: string;
}

export interface ConsolidadoAbsence {
  professional_id: string;
  /** YYYY-MM-DD. */
  start_date: string;
  /** YYYY-MM-DD. */
  end_date: string;
  /** Código do turno perdido (SD, SN…), usado no detalhe "16SD - 24SN". */
  shift_type?: string | null;
  /** Horas perdidas por dia. Sem valor, cai nas horas do turno. */
  hours_per_day?: number | null;
  /**
   * Falta justificada (atestado, licença) x injustificada.
   * É esse campo que decide se a ausência vira HORAS+DATAS (colunas M/N) ou
   * só uma linha em Observações — a regra visível nos consolidados reais.
   */
  is_justified?: boolean | null;
  /** Nome do motivo, usado para reconhecer atestado. */
  reason_name?: string | null;
}

export interface ConsolidadoRow {
  numero: number;
  matricula: string;
  cpf: string;
  nome: string;
  cargo: string;
  ch: number | '';
  diurnos: number | '';
  noturnos: number | '';
  mt: number | string;
  plantaoExtra: number | string;
  faltasHoras: number | '';
  datasFaltas: string;
  unidade: string;
  observacoes: string;
}

export interface ConsolidadoMeta {
  /** "SETEMBRO 2026" — vai na linha 14 e no nome do arquivo. */
  mesAno: string;
  servicoPrograma?: string;
  centroCusto?: string;
}

/** Horas padrão de cada turno, para quando a ausência não trouxer `hours_per_day`. */
const HORAS_POR_CODIGO: Record<string, number> = {
  SD: 12,
  SN: 12,
  P: 24,
  MT: 8,
  M: 6,
  M2: 4,
  T: 6,
  D: 6,
};

/** Dias cobertos por uma ausência que caem dentro do mês pedido. */
function diasDaAusencia(abs: ConsolidadoAbsence, mes: string): number[] {
  const dias: number[] = [];
  const ini = new Date(`${abs.start_date}T00:00:00`);
  const fim = new Date(`${abs.end_date || abs.start_date}T00:00:00`);
  for (const d = new Date(ini); d <= fim; d.setDate(d.getDate() + 1)) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    if (iso.slice(0, 7) === mes) dias.push(d.getDate());
  }
  return dias;
}

function ehAtestado(abs: ConsolidadoAbsence): boolean {
  const nome = (abs.reason_name || '').toLowerCase();
  return nome.includes('atestado') || nome.includes('médic') || nome.includes('medic');
}

/**
 * Coluna I. Turno de dia inteiro vira número ("21"); meias jornadas viram o
 * texto que o RH já usa no formulário ("2M", "1M 1T").
 */
function formatarMT(diaInteiro: number, manhas: number, tardes: number): number | string {
  if (manhas === 0 && tardes === 0) return diaInteiro;
  const partes: string[] = [];
  if (manhas) partes.push(`${manhas}M`);
  if (tardes) partes.push(`${tardes}T`);
  const texto = partes.join(' ');
  return diaInteiro ? `${diaInteiro} ${texto}` : texto;
}

/**
 * Monta as linhas do consolidado a partir do que o sistema sabe do mês.
 *
 * `mes` no formato YYYY-MM. Profissionais sem nenhum plantão e sem nenhuma
 * ausência no mês são omitidos — o formulário lista quem teve frequência.
 */
export function buildConsolidadoRows(input: {
  mes: string;
  professionals: ConsolidadoProfessional[];
  shifts: ConsolidadoShift[];
  absences: ConsolidadoAbsence[];
  extrasPorProfissional?: Record<string, number | string>;
}): ConsolidadoRow[] {
  const { mes, professionals, shifts, absences, extrasPorProfissional = {} } = input;

  const shiftsPorProf = new Map<string, ConsolidadoShift[]>();
  for (const s of shifts) {
    if (s.shift_date.slice(0, 7) !== mes) continue;
    const lista = shiftsPorProf.get(s.professional_id);
    if (lista) lista.push(s);
    else shiftsPorProf.set(s.professional_id, [s]);
  }

  const absPorProf = new Map<string, ConsolidadoAbsence[]>();
  for (const a of absences) {
    const lista = absPorProf.get(a.professional_id);
    if (lista) lista.push(a);
    else absPorProf.set(a.professional_id, [a]);
  }

  const linhas: ConsolidadoRow[] = [];

  for (const prof of professionals) {
    const meus = shiftsPorProf.get(prof.id) || [];
    const minhasAus = (absPorProf.get(prof.id) || []).filter(
      a => diasDaAusencia(a, mes).length > 0
    );
    if (meus.length === 0 && minhasAus.length === 0) continue;

    let diurnos = 0;
    let noturnos = 0;
    let diaInteiro = 0;
    let manhas = 0;
    let tardes = 0;
    let vinteQuatro = 0;

    for (const s of meus) {
      const c = (s.code || '').toUpperCase();
      if (CODIGOS_DIURNOS.includes(c)) diurnos++;
      else if (CODIGOS_NOTURNOS.includes(c)) noturnos++;
      else if (c === CODIGO_24H) {
        vinteQuatro++;
        diurnos++;
      } else if (c === CODIGO_DIA_INTEIRO) diaInteiro++;
      else if (c === CODIGO_MANHA || c === 'M2') manhas++;
      else if (c === CODIGO_TARDE) tardes++;
    }

    // Faltas injustificadas → horas + datas. Atestados e licenças → observações.
    const diasFalta: number[] = [];
    const detalheFalta: string[] = [];
    const diasAtestado: number[] = [];
    let faltasHoras = 0;

    for (const a of minhasAus) {
      const dias = diasDaAusencia(a, mes);
      if (a.is_justified === false) {
        const horas =
          a.hours_per_day ?? HORAS_POR_CODIGO[(a.shift_type || '').toUpperCase()] ?? 0;
        for (const d of dias) {
          diasFalta.push(d);
          faltasHoras += horas;
          detalheFalta.push(`${String(d).padStart(2, '0')}${(a.shift_type || '').toUpperCase()}`);
        }
      } else if (ehAtestado(a)) {
        diasAtestado.push(...dias);
      } else {
        // Férias, licença prêmio, afastamento: só nomeia em observações.
        const nome = (a.reason_name || 'Ausência').toUpperCase();
        const lista = dias.map(d => String(d).padStart(2, '0')).join(', ');
        detalheFalta.push(`${nome}: ${lista}`);
      }
    }

    const obs: string[] = [];
    if (diasAtestado.length) {
      const ordenados = [...new Set(diasAtestado)].sort((a, b) => a - b);
      obs.push(`ATM: ${ordenados.map(d => String(d).padStart(2, '0')).join(', ')}`);
    }
    if (diasFalta.length) obs.push(`FALTA: ${detalheFalta.join(' - ')}`);
    else if (detalheFalta.length) obs.push(detalheFalta.join(' | '));
    if (vinteQuatro) obs.push(`PLANTÃO 24H: ${vinteQuatro} (conferir classificação)`);

    linhas.push({
      numero: linhas.length + 1,
      matricula: prof.registration_number || '',
      cpf: prof.cpf || '',
      nome: prof.full_name,
      cargo: prof.cargo || '',
      ch: prof.contracted_hours_per_month ?? '',
      diurnos: diurnos || '',
      noturnos: noturnos || '',
      mt: formatarMT(diaInteiro, manhas, tardes),
      plantaoExtra: extrasPorProfissional[prof.id] ?? '',
      faltasHoras: faltasHoras || '',
      datasFaltas: [...new Set(diasFalta)]
        .sort((a, b) => a - b)
        .map(d => String(d).padStart(2, '0'))
        .join(','),
      unidade: prof.unidade || 'HECC',
      observacoes: obs.join(' | '),
    });
  }

  return linhas;
}

/**
 * Preenche o formulário da FESF com as linhas e devolve o .xlsx pronto.
 * `template` é o arquivo oficial lido como buffer — nada é desenhado aqui.
 */
export async function fillConsolidadoTemplate(
  template: ArrayBuffer,
  meta: ConsolidadoMeta,
  linhas: ConsolidadoRow[]
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(template);
  const ws = wb.worksheets[0];

  // Estica o molde: duplicar a 1ª linha de dados carrega estilo e empurra o
  // rodapé de assinatura para baixo.
  const faltam = linhas.length - TEMPLATE_DATA_ROWS;
  if (faltam > 0) ws.duplicateRow(FIRST_DATA_ROW, faltam, true);

  // Linha 14: mês/ano de referência e, quando informados, serviço e centro de custo.
  ws.getCell('G14').value = `MÊS/ANO DE REFERÊNCIA: ${meta.mesAno}`;
  ws.getCell('M14').value = meta.mesAno;
  if (meta.servicoPrograma) ws.getCell('A14').value = `SERVIÇO/PROGRAMA: ${meta.servicoPrograma}`;
  if (meta.centroCusto) ws.getCell('D14').value = `CENTRO DE CUSTO ${meta.centroCusto}`;

  const totalLinhas = Math.max(linhas.length, TEMPLATE_DATA_ROWS);
  for (let i = 0; i < totalLinhas; i++) {
    const n = FIRST_DATA_ROW + i;
    const row = ws.getRow(n);
    const d = linhas[i];

    row.getCell(1).value = d ? d.numero : i + 1;
    row.getCell(2).value = d ? d.matricula : null;
    row.getCell(3).value = d ? d.cpf : null;
    row.getCell(4).value = d ? d.nome : null;
    row.getCell(5).value = d ? d.cargo : null;
    row.getCell(6).value = d ? d.ch : null;
    row.getCell(7).value = d ? d.diurnos : null;
    row.getCell(8).value = d ? d.noturnos : null;
    row.getCell(9).value = d ? d.mt : null;
    // J e K seguem fórmula, como no formulário preenchido à mão.
    row.getCell(10).value = { formula: `G${n}+H${n}` };
    row.getCell(11).value = { formula: `H${n}*9` };
    row.getCell(12).value = d ? d.plantaoExtra : null;
    row.getCell(13).value = d ? d.faltasHoras : null;
    row.getCell(14).value = d ? d.datasFaltas : null;
    row.getCell(15).value = d ? d.unidade : 'HECC';
    row.getCell(16).value = d ? d.observacoes : null;
    row.commit();
  }

  // A ExcelJS grava XLSX com inconsistências que fazem o Excel pedir
  // recuperação ao abrir — o mesmo tratamento da exportação de escala.
  const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  return sanitizeXlsxBuffer(buffer);
}

/** Nome do arquivo no padrão que o RH já usa. */
export function consolidadoFileName(meta: ConsolidadoMeta): string {
  const escopo = meta.servicoPrograma ? ` ${meta.servicoPrograma.toUpperCase()}` : '';
  return `CONSOLIDADO${escopo} ${meta.mesAno.toUpperCase()}.xlsx`;
}
