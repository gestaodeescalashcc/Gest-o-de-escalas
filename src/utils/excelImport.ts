// Parser do modelo de planilha de escala (template "CGR" FESF/HECC).
//
// Layout (confirmado em 2 arquivos reais — Nutrição/Julho e Farmácia/Junho):
//   B4               -> SETOR (nome, pode ter sufixo "- HECC")
//   AH2              -> MÊS/ANO (data; pode estar vazio → fallback nome do arquivo)
//   linha 5, col G+  -> dia da semana (G = dia 1) — usado para validar o mês
//   linha 6, A..F    -> MATRÍCULA | NOME | FUNÇÃO | LOTAÇÃO | CH | DIAS TRAB.
//   linha 6, G..     -> números dos dias (1..31)  [col 7 em diante]
//   linha 7+         -> profissionais (NOME na col B) com o código por dia
//
// O parser só EXTRAI e resolve códigos; o casamento com setor/profissionais do
// banco e a inserção acontecem na tela de importação.

import ExcelJS from 'exceljs';
import { resolveShiftCode } from '../lib/shiftTypes';

export interface ImportedShift {
  day: number;
  raw: string;
  resolvedCode: string | null;
  resolvedName: string | null;
}

export interface ImportedProfessional {
  row: number;
  registration: string | null;
  name: string;
  role: string | null;
  lotacao: string | null;
  ch: number | null;
  shifts: ImportedShift[];
}

export interface ParsedSchedule {
  sheetName: string;
  sector: string | null;
  month: number | null; // 1-12
  year: number | null;
  monthSource: 'cell' | 'filename' | 'none';
  daysInMonth: number;
  firstDayWeekday: string | null;
  weekdayMatchesMonth: boolean | null;
  professionals: ImportedProfessional[];
  unknownCodes: { code: string; count: number }[];
  warnings: string[];
}

const FIRST_DAY_COL = 7; // coluna G
const HEADER_ROW = 6;
const WEEKDAY_ROW = 5;
const FIRST_DATA_ROW = 7;
const SECTOR_CELL = 'B4';
const MONTH_CELL = 'AH2';

const WEEKDAYS_PT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
const MONTHS_PT: Record<string, number> = {
  JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6,
  JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12,
};

function cellText(value: ExcelJS.CellValue | undefined): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    // formula result / rich text / hyperlink
    const anyV = value as any;
    if (anyV.result != null) return String(anyV.result);
    if (anyV.text != null) return String(anyV.text);
    if (Array.isArray(anyV.richText)) return anyV.richText.map((r: any) => r.text).join('');
    return '';
  }
  return String(value);
}

function stripAccentsUpper(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim().replace(/\s+/g, ' ');
}

function parseCH(value: ExcelJS.CellValue | undefined): number | null {
  const t = cellText(value).replace(/[^\d]/g, '');
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

// Tenta extrair mês/ano de uma célula (data ou texto) ou do nome do arquivo.
function fromText(s: string): { month: number | null; year: number | null } | null {
  if (!s) return null;
  for (const [name, m] of Object.entries(MONTHS_PT)) {
    if (s.includes(name)) {
      const y = s.match(/(\d{4})|(\d{2})(?!\d)/);
      return { month: m, year: y ? normalizeYear(y[0]) : null };
    }
  }
  const mm = s.match(/(\d{1,2})\s*[\/\-.]\s*(\d{2,4})/);
  if (mm) {
    const month = parseInt(mm[1], 10);
    if (month >= 1 && month <= 12) return { month, year: normalizeYear(mm[2]) };
  }
  return null;
}

function resolveMonthYear(
  monthCell: ExcelJS.CellValue | undefined,
  fileName?: string
): { month: number | null; year: number | null; source: 'cell' | 'filename' | 'none' } {
  // Célula: Date (ExcelJS guarda em UTC — usar getters UTC p/ não cair no dia
  // anterior em fusos negativos) ou texto ("JULHO/2026", "07/2026").
  let cellRes: { month: number | null; year: number | null } | null = null;
  if (monthCell instanceof Date) {
    cellRes = { month: monthCell.getUTCMonth() + 1, year: monthCell.getUTCFullYear() };
  } else {
    cellRes = fromText(stripAccentsUpper(cellText(monthCell)));
  }
  const fileRes = fromText(stripAccentsUpper(fileName ?? ''));

  const month = cellRes?.month ?? fileRes?.month ?? null;
  // ano pode vir da célula; se faltar, completa pelo nome do arquivo
  const year = cellRes?.year ?? fileRes?.year ?? null;
  const source: 'cell' | 'filename' | 'none' = cellRes?.month
    ? 'cell'
    : fileRes?.month
    ? 'filename'
    : 'none';
  return { month, year, source };
}

function normalizeYear(raw: string): number {
  const n = parseInt(raw, 10);
  if (raw.length === 2) return 2000 + n;
  return n;
}

export async function parseScheduleWorkbook(
  input: ArrayBuffer,
  fileName?: string
): Promise<ParsedSchedule> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(input);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('Planilha vazia ou ilegível.');

  const warnings: string[] = [];

  // Setor
  const sectorRaw = cellText(ws.getCell(SECTOR_CELL).value).trim();
  const sector = sectorRaw || null;
  if (!sector) warnings.push('Setor não encontrado na célula B4.');

  // Mês/ano
  const { month, year, source: monthSource } = resolveMonthYear(
    ws.getCell(MONTH_CELL).value,
    fileName
  );
  if (!month || !year) {
    warnings.push('Mês/ano não identificado (célula AH2 vazia e nome do arquivo inconclusivo). Confirme manualmente.');
  }

  // Colunas de dia: linha 6, a partir de G, dias contíguos 1..N
  const dayCols: { col: number; day: number }[] = [];
  let expected = 1;
  for (let c = FIRST_DAY_COL; c <= FIRST_DAY_COL + 40; c++) {
    const v = ws.getRow(HEADER_ROW).getCell(c).value;
    const n = typeof v === 'number' ? v : parseInt(cellText(v), 10);
    if (n === expected && expected <= 31) {
      dayCols.push({ col: c, day: expected });
      expected++;
    } else if (dayCols.length > 0) {
      break; // acabou a sequência de dias
    }
  }
  const daysInMonth = dayCols.length;
  if (daysInMonth === 0) warnings.push('Não foi possível identificar as colunas de dias (linha 6).');

  // Dia da semana do dia 1 (linha 5, col G) + validação contra o mês
  const firstDayWeekday = stripAccentsUpper(cellText(ws.getRow(WEEKDAY_ROW).getCell(FIRST_DAY_COL).value)).slice(0, 3) || null;
  let weekdayMatchesMonth: boolean | null = null;
  if (month && year && firstDayWeekday) {
    const expectedWd = WEEKDAYS_PT[new Date(year, month - 1, 1).getDay()];
    weekdayMatchesMonth = expectedWd === firstDayWeekday;
    if (!weekdayMatchesMonth) {
      warnings.push(
        `O dia 1 na planilha é "${firstDayWeekday}", mas ${String(month).padStart(2, '0')}/${year} começa numa "${expectedWd}". Verifique o mês/ano.`
      );
    }
  }

  // Profissionais. O bloco é contíguo a partir da linha 7; abaixo dele vêm
  // linhas vazias e o rodapé (legenda/assinaturas). Paramos ao encontrar o
  // rodapé ou uma sequência de linhas vazias, para não capturar lixo.
  const FOOTER_MARKERS = ['ASSINATURA', 'CARIMBO', 'LEGENDA', 'OBSERVA', 'CHEFE', 'DIRETOR', 'DATA:'];
  const professionals: ImportedProfessional[] = [];
  const unknown = new Map<string, number>();
  let emptyStreak = 0;
  for (let r = FIRST_DATA_ROW; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const name = cellText(row.getCell(2).value).trim();
    const normName = stripAccentsUpper(name);

    if (!name || normName === 'NOME') {
      // dentro do bloco toleramos poucas linhas vazias; muitas = fim do bloco
      if (professionals.length > 0 && ++emptyStreak >= 4) break;
      continue;
    }
    // Linha de rodapé (assinatura/legenda) → fim do bloco
    if (FOOTER_MARKERS.some(m => normName.includes(m))) break;
    emptyStreak = 0;

    const shifts: ImportedShift[] = [];
    for (const { col, day } of dayCols) {
      const raw = cellText(row.getCell(col).value).trim();
      if (!raw) continue;
      const resolved = resolveShiftCode(raw);
      if (!resolved) unknown.set(stripAccentsUpper(raw), (unknown.get(stripAccentsUpper(raw)) ?? 0) + 1);
      shifts.push({ day, raw, resolvedCode: resolved?.code ?? null, resolvedName: resolved?.name ?? null });
    }

    professionals.push({
      row: r,
      registration: cellText(row.getCell(1).value).trim() || null,
      name,
      role: cellText(row.getCell(3).value).trim() || null,
      lotacao: cellText(row.getCell(4).value).trim() || null,
      ch: parseCH(row.getCell(5).value),
      shifts,
    });
  }
  if (professionals.length === 0) warnings.push('Nenhum profissional encontrado (a partir da linha 7).');

  const unknownCodes = Array.from(unknown.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);

  return {
    sheetName: ws.name,
    sector,
    month,
    year,
    monthSource,
    daysInMonth,
    firstDayWeekday,
    weekdayMatchesMonth,
    professionals,
    unknownCodes,
    warnings,
  };
}
