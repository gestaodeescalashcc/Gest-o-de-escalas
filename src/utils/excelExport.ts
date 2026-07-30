import ExcelJS, { Worksheet, Cell, Style } from 'exceljs';
import JSZip from 'jszip';

// ExcelJS produz XLSX com inconsistências que fazem o Excel pedir recovery
// ao abrir o arquivo. Pós-processamos o zip antes do download para limpar.
async function sanitizeXlsxBuffer(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer);

  // 1) [Content_Types].xml: remover <Default Extension="vml"> órfão
  const ctFile = zip.file('[Content_Types].xml');
  if (ctFile) {
    const ct = await ctFile.async('string');
    const hasVmlFile = Object.keys(zip.files).some(name => name.toLowerCase().endsWith('.vml'));
    if (!hasVmlFile) {
      const cleaned = ct.replace(/<Default Extension="vml"[^>]*\/>/g, '');
      if (cleaned !== ct) zip.file('[Content_Types].xml', cleaned);
    }
  }

  // 2) xl/workbook.xml: limpar inconsistências
  const wbFile = zip.file('xl/workbook.xml');
  if (wbFile) {
    const wb = await wbFile.async('string');
    const cleaned = sanitizeWorkbookXml(wb);
    if (cleaned !== wb) zip.file('xl/workbook.xml', cleaned);
  }

  // 3) Cada worksheet: reordenar <sheetPr> children + limpar
  const sheetFiles = Object.keys(zip.files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/i.test(n));
  for (const name of sheetFiles) {
    const xml = await zip.file(name)!.async('string');
    const fixed = sanitizeSheetXml(xml);
    if (fixed !== xml) zip.file(name, fixed);
  }

  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}

function sanitizeWorkbookXml(xml: string): string {
  let out = xml;
  // filterPrivacy="1" em workbookPr sem filtros é o ponto que aciona o recovery
  // em alguns Excels. Removemos.
  out = out.replace(/(\s)filterPrivacy="[^"]*"/g, '');
  // Print_Area com referência mista ($A1:$AN12) — Excel é mais feliz com tudo
  // absoluto ($A$1:$AN$12). Normaliza qualquer ref no <definedName>.
  out = out.replace(/<definedName([^>]*)>([^<]+)<\/definedName>/g, (_m, attrs, ref) => {
    // Adiciona $ antes de números de linha que não tenham
    const fixed = ref.replace(/(\$?[A-Z]+)(\d+)/g, (_mm: string, col: string, row: string) => {
      const fixedCol = col.startsWith('$') ? col : '$' + col;
      return `${fixedCol}$${row}`;
    });
    return `<definedName${attrs}>${fixed}</definedName>`;
  });
  // Remove <fileVersion .../> (opcional, e às vezes problemático com appName/rupBuild fake)
  out = out.replace(/<fileVersion[^>]*\/>/g, '');
  // Remove namespaces mc:Ignorable + xmlns:x15 se não houver nenhum elemento x15:
  if (!/<x15:|x15:[a-zA-Z]/.test(out)) {
    out = out.replace(/\s+mc:Ignorable="x15"/g, '');
    out = out.replace(/\s+xmlns:x15="[^"]*"/g, '');
    // Se mc:Ignorable ficou vazio, remove namespace mc também
    if (!/mc:Ignorable=/.test(out) && !/<mc:/.test(out)) {
      out = out.replace(/\s+xmlns:mc="[^"]*"/g, '');
    }
  }
  return out;
}

function sanitizeSheetXml(xml: string): string {
  let out = xml;
  // Reordenar filhos de <sheetPr>: tabColor, outlinePr, pageSetUpPr
  out = out.replace(/<sheetPr(\s[^>]*)?>([\s\S]*?)<\/sheetPr>/g, (_full, attrs, inner) => {
    const tabColor = (inner.match(/<tabColor[^>]*\/>/) || [''])[0];
    const outlinePr = (inner.match(/<outlinePr[^>]*\/>/) || [''])[0];
    const pageSetUpPr = (inner.match(/<pageSetUpPr[^>]*\/>/) || [''])[0];
    let rest = inner;
    for (const k of [tabColor, outlinePr, pageSetUpPr]) if (k) rest = rest.replace(k, '');
    rest = rest.trim();
    return `<sheetPr${attrs || ''}>${tabColor}${outlinePr}${pageSetUpPr}${rest}</sheetPr>`;
  });

  // Bug crítico do ExcelJS: emite x14ac:dyDescent com valores fora de faixa
  // (visto "55" em sheetFormatPr) — Excel pede recovery e descarta a planilha.
  // dyDescent é opcional; melhor é remover qualquer valor inválido (>1 ou <0).
  out = out.replace(/\sx14ac:dyDescent="([^"]+)"/g, (_full, val) => {
    const n = parseFloat(val);
    if (!isFinite(n) || n < 0 || n > 1) return '';
    return ` x14ac:dyDescent="${val}"`;
  });

  // Remove namespaces órfãos no <worksheet> root também
  if (!/<x14ac:|x14ac:[a-zA-Z]/.test(out.replace(/^<\?xml[^>]*\?>/, ''))) {
    // ainda pode estar referenciado em x14ac:dyDescent etc — verifica
    if (!/\sx14ac:[a-zA-Z]+=/.test(out)) {
      out = out.replace(/\s+mc:Ignorable="x14ac"/g, '');
      out = out.replace(/\s+xmlns:x14ac="[^"]*"/g, '');
    }
  }
  return out;
}

export interface ProfessionalInfo {
  id: string;
  full_name: string;
  registration_number: string | null;
  category_name?: string;
  contracted_hours?: number | string;
  coren?: string | null;
  location?: string | null;
}

export interface ExportData {
  scheduleName: string;
  departmentName: string;
  /** YYYY-MM format */
  month: string;
  professionals: ProfessionalInfo[];
  /** professional_id -> day (1..31) -> shift code (e.g. 'P', 'SD', 'M', 'FG') */
  shiftsByProf: Map<string, Map<number, string>>;
}

const MONTH_NAMES_PT = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

const DAY_OF_WEEK_PT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

// Templates oficiais (devem estar em /public/templates/)
// Modelo unificado de enfermagem — todos os setores de enfermagem usam o mesmo modelo (ESCALA MODELO.xlsx)
const ENFERMAGEM_TEMPLATE = '/templates/escala-enfermagem.xlsx';
const TEMPLATE_BY_DEPT: Record<string, string> = {
  'Enfermeiros': ENFERMAGEM_TEMPLATE,
  'Técnicos de Enfermagem': ENFERMAGEM_TEMPLATE,
  'Técnicos de Enfermagem CME': ENFERMAGEM_TEMPLATE,
  'Enfermeira Administrativa': ENFERMAGEM_TEMPLATE,
};

// Cores de fundo por código de turno (estilo das siglas no app)
const SHIFT_COLORS: Record<string, { bg: string; font: string }> = {
  P:  { bg: 'FFDBEAFE', font: 'FF1E3A8A' }, // azul
  SD: { bg: 'FFE0F2FE', font: 'FF075985' }, // sky
  SN: { bg: 'FFE0E7FF', font: 'FF312E81' }, // indigo
  M:  { bg: 'FFD1FAE5', font: 'FF064E3B' }, // emerald
  M2: { bg: 'FFECFCCB', font: 'FF365314' }, // lime
  T:  { bg: 'FFFEF3C7', font: 'FF78350F' }, // amber
  MT: { bg: 'FFCCFBF1', font: 'FF134E4A' }, // teal
  FG: { bg: 'FFF3F4F6', font: 'FF374151' }, // gray
  FR: { bg: 'FFFFE4E6', font: 'FF881337' }, // rose
  FE: { bg: 'FFFEF9C3', font: 'FF713F12' }, // yellow
  FA: { bg: 'FFFECACA', font: 'FF7F1D1D' }, // red
  LP: { bg: 'FFEDE9FE', font: 'FF4C1D95' }, // purple
  LM: { bg: 'FFFEE2E2', font: 'FF7F1D1D' }, // red light
  LG: { bg: 'FFFCE7F3', font: 'FF831843' }, // pink
  AS: { bg: 'FFFFEDD5', font: 'FF7C2D12' }, // orange
};

const DEFAULT_COLOR = { bg: 'FFFFFFFF', font: 'FF000000' };

// Cores para destacar SAB (azul) e DOM (rosa) nas colunas inteiras
const SAT_BG = 'FFBFDBFE';
const SUN_BG = 'FFFECDD3';

function weekendBg(year: number, month: number, day: number): string | null {
  const dow = new Date(year, month - 1, day).getDay();
  if (dow === 6) return SAT_BG;
  if (dow === 0) return SUN_BG;
  return null;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(s: string): string {
  return s.replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, '_');
}

/**
 * Carrega o template, identifica o layout, limpa dados antigos e preenche com novos.
 * Retorna true se o template foi usado com sucesso.
 */
async function tryExportFromTemplate(data: ExportData): Promise<boolean> {
  const templateUrl = TEMPLATE_BY_DEPT[data.departmentName];
  if (!templateUrl) return false;

  try {
    const response = await fetch(templateUrl);
    if (!response.ok) return false;
    const buffer = await response.arrayBuffer();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    // Encontrar a aba mais recente (ou primeira) — vamos clonar como base
    // A aba "MAIO 26" é boa referência para Enfermeiros/Técnicos
    let sourceSheetName = '';
    const preferredOrder = ['MAIO 26', 'MAIO UNIFICADO', 'CME MAIO', 'ABRIL 26', 'ABRIL'];
    for (const name of preferredOrder) {
      if (workbook.worksheets.some(ws => ws.name === name)) {
        sourceSheetName = name;
        break;
      }
    }
    if (!sourceSheetName && workbook.worksheets.length > 0) {
      sourceSheetName = workbook.worksheets[workbook.worksheets.length - 1].name;
    }
    if (!sourceSheetName) return false;

    const sourceWs = workbook.getWorksheet(sourceSheetName)!;

    // Vamos manter SOMENTE a aba modelo, removendo as outras
    workbook.eachSheet(ws => {
      if (ws.name !== sourceSheetName) {
        workbook.removeWorksheet(ws.id);
      }
    });

    // Detectar o layout (linha do header, coluna do nome, primeira coluna de dia)
    const layout = detectLayout(sourceWs);
    if (!layout) {
      console.warn('Layout do template não pôde ser detectado, usando fallback genérico');
      return false;
    }

    // Renomear aba para o mês corrente
    const [yearStr, monthStr] = data.month.split('-');
    const year = parseInt(yearStr);
    const monthNum = parseInt(monthStr);
    const monthName = MONTH_NAMES_PT[monthNum - 1];
    const newSheetName = `${monthName} ${String(year).slice(-2)}`;
    sourceWs.name = newSheetName;

    // Atualizar cabeçalho do mês (se houver célula com nome do mês antigo)
    updateMonthHeader(sourceWs, monthName, year);

    // Atualizar linha de dias da semana (se houver)
    updateWeekdayHeader(sourceWs, layout, year, monthNum);

    // Atualizar números dos dias na linha de header
    updateDayNumbers(sourceWs, layout, monthNum, year);

    // Limpar linhas de dados antigos (preservando estilos)
    clearDataRows(sourceWs, layout);

    // Preencher com novos dados
    fillData(sourceWs, layout, data, year, monthNum);

    // Download
    const rawBuffer = await workbook.xlsx.writeBuffer();
    const outBuffer = await sanitizeXlsxBuffer(rawBuffer as ArrayBuffer);
    const filename = `${sanitizeFilename(data.scheduleName)}.xlsx`;
    downloadBuffer(outBuffer, filename);
    return true;
  } catch (err) {
    console.error('Erro ao exportar usando template:', err);
    return false;
  }
}

interface SheetLayout {
  headerRow: number;        // linha onde estão os números 1..31 dos dias
  weekdayRow: number;       // linha com SEG/TER/etc (geralmente headerRow+1 ou -1)
  matriculaCol: number;     // coluna da matrícula
  nameCol: number;          // coluna do nome
  funcaoCol: number;        // coluna da função
  diasTrabCol: number;      // coluna de DIAS TRAB.
  firstDayCol: number;      // primeira coluna de dia (dia 1)
  totalHorasCol: number | null; // coluna de TOTAL HORAS (opcional)
  modelDataRow: number;     // linha que serve de modelo de estilo (primeira linha de dados)
  lastDataRow: number;      // última linha de dados original
}

function detectLayout(ws: Worksheet): SheetLayout | null {
  let headerRow = 0;
  let nameCol = 0;
  let firstDayCol = 0;

  // Procurar linha que contém "NOME"
  for (let r = 1; r <= 15 && r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= 50; c++) {
      const v = row.getCell(c).value;
      if (typeof v === 'string' && v.trim().toUpperCase().startsWith('NOME')) {
        headerRow = r;
        nameCol = c;
        break;
      }
    }
    if (headerRow > 0) break;
  }
  if (!headerRow) return null;

  // Encontrar a primeira coluna de dia (procura "1" como número ou string)
  const headerRowObj = ws.getRow(headerRow);
  for (let c = nameCol + 1; c <= 60; c++) {
    const v = headerRowObj.getCell(c).value;
    if (v === 1 || v === '1' || (v instanceof Date && v.getDate() === 1)) {
      firstDayCol = c;
      break;
    }
  }
  if (!firstDayCol) {
    // Tentar procurar por DIAS TRAB. e usar a próxima coluna
    for (let c = nameCol + 1; c <= 60; c++) {
      const v = headerRowObj.getCell(c).value;
      if (typeof v === 'string' && /DIAS\s*TRAB/i.test(v)) {
        firstDayCol = c + 1;
        break;
      }
    }
  }
  if (!firstDayCol) return null;

  // Detectar outras colunas
  let matriculaCol = 1;
  let funcaoCol = 0;
  let diasTrabCol = 0;
  let totalHorasCol: number | null = null;

  for (let c = 1; c <= 60; c++) {
    const v = headerRowObj.getCell(c).value;
    if (typeof v === 'string') {
      const upper = v.trim().toUpperCase();
      if (upper.startsWith('MATRICULA') || upper.startsWith('MATRÍCULA')) matriculaCol = c;
      else if (upper.startsWith('FUNÇÃO') || upper.startsWith('FUNCAO')) funcaoCol = c;
      else if (/DIAS\s*TRAB/i.test(upper)) diasTrabCol = c;
      else if (/TOTAL\s*HORAS/i.test(upper)) totalHorasCol = c;
    }
  }

  // Linha modelo: primeira linha após o header com algum dado
  const modelDataRow = headerRow + 1;

  // Última linha com dados (procurar até linha 100, parar quando vazio)
  let lastDataRow = modelDataRow;
  for (let r = modelDataRow; r <= 200 && r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const nameVal = row.getCell(nameCol).value;
    if (nameVal && String(nameVal).trim() && !String(nameVal).toUpperCase().includes('ASSINATURA')) {
      lastDataRow = r;
    }
  }

  // Linha de dias da semana — pode ser headerRow+1 ou headerRow-1
  let weekdayRow = headerRow + 1;
  const tryRow = ws.getRow(weekdayRow);
  const tryCell = tryRow.getCell(firstDayCol).value;
  const isWeekday = typeof tryCell === 'string' && /^(SEG|TER|QUA|QUI|SEX|SÁB|SAB|DOM)$/i.test(tryCell.trim());
  if (!isWeekday) {
    // Tentar headerRow - 1
    const altRow = ws.getRow(headerRow - 1);
    const altCell = altRow.getCell(firstDayCol).value;
    if (typeof altCell === 'string' && /^(SEG|TER|QUA|QUI|SEX|SÁB|SAB|DOM)$/i.test(altCell.trim())) {
      weekdayRow = headerRow - 1;
    }
  }

  return {
    headerRow,
    weekdayRow,
    matriculaCol,
    nameCol,
    funcaoCol,
    diasTrabCol,
    firstDayCol,
    totalHorasCol,
    modelDataRow,
    lastDataRow,
  };
}

function updateMonthHeader(ws: Worksheet, monthName: string, year: number) {
  // Procura células que parecem ser cabeçalho de mês (curto, todo maiúsculas, com nome de mês)
  for (let r = 1; r <= 8; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= 50; c++) {
      const cell = row.getCell(c);
      const v = cell.value;
      if (typeof v !== 'string') continue;
      const upper = v.toUpperCase();
      // Se contém nome de mês conhecido, substituir
      for (const mn of MONTH_NAMES_PT) {
        if (upper.includes(mn)) {
          cell.value = `${monthName} / ${year}`;
          return;
        }
      }
    }
  }
}

function updateWeekdayHeader(ws: Worksheet, layout: SheetLayout, year: number, month: number) {
  if (layout.weekdayRow === layout.headerRow) return;
  const daysInMonth = getDaysInMonth(year, month);
  const row = ws.getRow(layout.weekdayRow);
  const dayNumRow = ws.getRow(layout.headerRow);
  for (let day = 1; day <= 31; day++) {
    const col = layout.firstDayCol + (day - 1);
    const cell = row.getCell(col);
    const dayCell = dayNumRow.getCell(col);
    if (day <= daysInMonth) {
      const dow = new Date(year, month - 1, day).getDay();
      cell.value = DAY_OF_WEEK_PT[dow];
      // Distinguir SAB (azul claro) e DOM (rosa/salmão) — também no número do dia
      if (dow === 6) { // SAB
        const fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: SAT_BG } };
        cell.fill = fill;
        dayCell.fill = fill;
      } else if (dow === 0) { // DOM
        const fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: SUN_BG } };
        cell.fill = fill;
        dayCell.fill = fill;
      }
    } else {
      cell.value = null;
    }
  }
}

function updateDayNumbers(ws: Worksheet, layout: SheetLayout, month: number, year: number) {
  const daysInMonth = getDaysInMonth(year, month);
  const row = ws.getRow(layout.headerRow);
  for (let day = 1; day <= 31; day++) {
    const col = layout.firstDayCol + (day - 1);
    const cell = row.getCell(col);
    cell.value = day <= daysInMonth ? day : null;
  }
}

function clearDataRows(ws: Worksheet, layout: SheetLayout) {
  // Para cada linha de dados, limpar VALORES das colunas de matrícula, nome, função, dias trab, dias 1-31, total horas
  // Mantém os ESTILOS das células
  for (let r = layout.modelDataRow; r <= layout.lastDataRow; r++) {
    const row = ws.getRow(r);
    [layout.matriculaCol, layout.nameCol, layout.funcaoCol, layout.diasTrabCol, layout.totalHorasCol].forEach(col => {
      if (col && col > 0) {
        const cell = row.getCell(col);
        cell.value = null;
      }
    });
    for (let day = 1; day <= 31; day++) {
      const col = layout.firstDayCol + (day - 1);
      const cell = row.getCell(col);
      cell.value = null;
      // Resetar fill da célula (vamos recolorir conforme dado novo)
      cell.fill = { type: 'pattern', pattern: 'none' };
    }
  }
}

function copyStyle(source: Cell, target: Cell) {
  target.style = JSON.parse(JSON.stringify(source.style)) as Partial<Style>;
}

function fillData(
  ws: Worksheet,
  layout: SheetLayout,
  data: ExportData,
  year: number,
  month: number
) {
  const daysInMonth = getDaysInMonth(year, month);
  const modelRow = ws.getRow(layout.modelDataRow);

  data.professionals.forEach((prof, idx) => {
    const targetRowNum = layout.modelDataRow + idx;
    const targetRow = ws.getRow(targetRowNum);

    // Se passou da última linha original, copiar estilos da linha modelo
    if (targetRowNum > layout.lastDataRow) {
      for (let c = 1; c <= 60; c++) {
        copyStyle(modelRow.getCell(c), targetRow.getCell(c));
      }
    }

    // Preencher dados básicos
    if (layout.matriculaCol)
      targetRow.getCell(layout.matriculaCol).value = prof.registration_number ?? '';
    if (layout.nameCol) {
      const nameCell = targetRow.getCell(layout.nameCol);
      // Inclui COREN como segunda linha dentro da mesma célula (mantém layout do template)
      nameCell.value = prof.coren
        ? { richText: [
            { text: prof.full_name, font: { name: 'Arial', size: 9, bold: true } },
            { text: `\nCOREN: ${prof.coren}`, font: { name: 'Arial', size: 8, color: { argb: 'FF065F46' }, italic: true } },
          ] }
        : prof.full_name;
      nameCell.alignment = { ...(nameCell.alignment ?? {}), wrapText: true, vertical: 'middle' };
      // Linha mais alta para acomodar nome + COREN sem sobreposição
      if (prof.coren) targetRow.height = 28;
    }
    if (layout.funcaoCol) targetRow.getCell(layout.funcaoCol).value = prof.category_name ?? '';

    // Preencher turnos
    const profShifts = data.shiftsByProf.get(prof.id);
    let workDays = 0;
    let totalHours = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const code = profShifts?.get(day);
      const col = layout.firstDayCol + (day - 1);
      const cell = targetRow.getCell(col);
      const wkBg = weekendBg(year, month, day);
      if (code) {
        cell.value = code;
        const colors = SHIFT_COLORS[code] ?? DEFAULT_COLOR;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
        cell.font = { ...(cell.font ?? {}), color: { argb: colors.font }, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        const hours: Record<string, number> = {
          P: 24, '24': 24, MT: 8, SD: 12, SN: 12, M: 6, T: 6, M2: 4,
        };
        if (hours[code]) {
          workDays++;
          totalHours += hours[code];
        }
      } else if (wkBg) {
        // Célula vazia em fim de semana: aplicar tinta SAB/DOM
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: wkBg } };
      }
    }

    if (layout.diasTrabCol) targetRow.getCell(layout.diasTrabCol).value = workDays;
    if (layout.totalHorasCol) targetRow.getCell(layout.totalHorasCol).value = totalHours;
  });

  // Linha(s) de TOTAL por dia, para cada código de turno que aparece nos dados
  appendDailyTotals(ws, layout, data, year, month);
}

function appendDailyTotals(
  ws: Worksheet,
  layout: SheetLayout,
  data: ExportData,
  year: number,
  month: number,
) {
  const daysInMonth = getDaysInMonth(year, month);
  // Coletar todos os códigos usados
  const codesPresent = new Set<string>();
  data.shiftsByProf.forEach(byDay => byDay.forEach(c => c && codesPresent.add(c)));
  // Ordem preferida: SD, SN, P, MT, M, M2, T — depois resto
  const orderedCodes = ['SD', 'SN', 'P', 'MT', 'M', 'M2', 'T']
    .filter(c => codesPresent.has(c))
    .concat([...codesPresent].filter(c => !['SD', 'SN', 'P', 'MT', 'M', 'M2', 'T'].includes(c)).sort());

  if (orderedCodes.length === 0) return;

  const startRow = layout.modelDataRow + data.professionals.length;

  orderedCodes.forEach((code, idx) => {
    const r = startRow + idx;
    const row = ws.getRow(r);
    row.height = 18;

    // Rótulo "TOTAL <CODE>" — ocupa colunas de matricula+nome (ou só nome)
    if (layout.matriculaCol && layout.nameCol) {
      const labelCell = row.getCell(layout.matriculaCol);
      labelCell.value = `TOTAL ${code}`;
      labelCell.font = { name: 'Arial', size: 9, bold: true };
      labelCell.alignment = { horizontal: 'right', vertical: 'middle' };
      const colors = SHIFT_COLORS[code] ?? DEFAULT_COLOR;
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
      labelCell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      };
    }

    // Contar por dia e preencher
    for (let day = 1; day <= daysInMonth; day++) {
      let count = 0;
      data.shiftsByProf.forEach(byDay => { if (byDay.get(day) === code) count++; });
      const col = layout.firstDayCol + (day - 1);
      const cell = row.getCell(col);
      cell.value = count || null;
      cell.font = { name: 'Arial', size: 9, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      };
      const wkBg = weekendBg(year, month, day);
      if (count > 0) {
        const colors = SHIFT_COLORS[code] ?? DEFAULT_COLOR;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
      } else if (wkBg) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: wkBg } };
      }
    }
  });
}

// ============================================================================
// Gerador que replica o modelo oficial /public/templates/escala-enfermagem.xlsx
// célula a célula — mas montado do zero para evitar os defeitos estruturais
// do arquivo original (mergeCells conflitantes, colunas hidden bagunçadas,
// formulas array problemáticas).
// ============================================================================
async function exportGeneric(data: ExportData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MedScale';
  workbook.created = new Date();

  const [yearStr, monthStr] = data.month.split('-');
  const year = parseInt(yearStr);
  const monthNum = parseInt(monthStr);
  const monthName = MONTH_NAMES_PT[monthNum - 1];
  const daysInMonth = getDaysInMonth(year, monthNum);

  // Layout do modelo oficial:
  //   A=MATRÍCULA, B=NOME, C=FUNÇÃO, D=LOTAÇÃO, E=CH, F=DIAS TRAB.
  //   G..AK = dias 1..31 (sempre 31 colunas; dias inexistentes ficam vazios)
  //   AL,AM = sub-totais (não usado; ocultos no modelo)
  //   AN = TOTAL HORAS
  const firstDayCol = 7;          // G
  const totalCol = 40;            // AN
  const subDayCol1 = 38;          // AL
  const subDayCol2 = 39;          // AM

  const ws = workbook.addWorksheet(`${monthName} ${String(year).slice(-2)}`, {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      verticalCentered: true,
      margins: {
        left: 0.16, right: 0.16, top: 0.2, bottom: 0.4,
        header: 0.51, footer: 0.24,
      },
    },
    views: [{ state: 'frozen', xSplit: 6, ySplit: 6 }],
    properties: { defaultColWidth: 9.14, defaultRowHeight: 12.75 },
  });

  const HOURS_BY_CODE: Record<string, number> = {
    P: 24, '24': 24, MT: 8, SD: 12, SN: 12, M: 6, T: 6, M2: 4,
  };

  // Bordas thin pretas (padrão do modelo)
  const allBorder = {
    top: { style: 'thin' as const, color: { argb: 'FF000000' } },
    bottom: { style: 'thin' as const, color: { argb: 'FF000000' } },
    left: { style: 'thin' as const, color: { argb: 'FF000000' } },
    right: { style: 'thin' as const, color: { argb: 'FF000000' } },
  };

  // === Linhas 1-3 ===
  // A1:A3 — espaço de logo esquerdo
  ws.mergeCells(1, 1, 3, 1);
  ws.getCell(1, 1).border = allBorder;
  ws.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' };
  // B1:B3 — espaço de logo central
  ws.mergeCells(1, 2, 3, 2);
  ws.getCell(1, 2).border = allBorder;
  // C1:AG3 — Título "E S C A L A   D E   S E R V I Ç O"
  ws.mergeCells(1, 3, 3, 33);
  const titleCell = ws.getCell(1, 3);
  titleCell.value = 'E S C A L A   D E   S E R V I Ç O';
  titleCell.font = { name: 'Arial', size: 14, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.border = allBorder;
  // AH1:AN1 — " MÊS/ANO:"
  ws.mergeCells(1, 34, 1, 40);
  const mesAnoLbl = ws.getCell(1, 34);
  mesAnoLbl.value = ' MÊS/ANO:';
  mesAnoLbl.font = { name: 'Arial', size: 10.5, bold: true };
  mesAnoLbl.alignment = { horizontal: 'left', vertical: 'middle' };
  mesAnoLbl.border = allBorder;
  // AH2:AN3 — valor do mês/ano
  ws.mergeCells(2, 34, 3, 40);
  const mesAnoVal = ws.getCell(2, 34);
  mesAnoVal.value = `${monthName} / ${year}`;
  mesAnoVal.font = { name: 'Arial', size: 13, bold: true };
  mesAnoVal.alignment = { horizontal: 'center', vertical: 'middle' };
  mesAnoVal.border = allBorder;

  ws.getRow(1).height = 13.5;
  ws.getRow(2).height = 15;
  ws.getRow(3).height = 36.75;

  // === Linhas 4-5 ===
  // A4:A5 — " SETOR:"
  ws.mergeCells(4, 1, 5, 1);
  const setorLbl = ws.getCell(4, 1);
  setorLbl.value = ' SETOR:';
  setorLbl.font = { name: 'Arial', size: 10, bold: true };
  setorLbl.alignment = { horizontal: 'left', vertical: 'middle' };
  setorLbl.border = allBorder;
  // B4:E5 — nome do hospital
  ws.mergeCells(4, 2, 5, 5);
  const hospCell = ws.getCell(4, 2);
  hospCell.value = 'HOSPITAL COSTA DOS COQUEIROS';
  hospCell.font = { name: 'Arial', size: 10, bold: true };
  hospCell.alignment = { horizontal: 'center', vertical: 'middle' };
  hospCell.border = allBorder;
  // F4:F5 — vazio (espaço entre setor e dias)
  ws.mergeCells(4, 6, 5, 6);
  ws.getCell(4, 6).border = allBorder;
  // G4:AN4 — "D I A S    D A    S E M A N A"
  ws.mergeCells(4, firstDayCol, 4, totalCol);
  const diasSemLbl = ws.getCell(4, firstDayCol);
  diasSemLbl.value = 'D I A S    D A    S E M A N A';
  diasSemLbl.font = { name: 'Arial', size: 10, bold: true };
  diasSemLbl.alignment = { horizontal: 'center', vertical: 'middle' };
  diasSemLbl.border = allBorder;

  // Linha 5: dias da semana + S, D, TOTAL
  const weekdayRow = 5;
  const headerRow = 6;
  for (let day = 1; day <= 31; day++) {
    const col = firstDayCol + (day - 1);
    const cell = ws.getCell(weekdayRow, col);
    let wkBg: string | null = null;
    if (day <= daysInMonth) {
      const dow = new Date(year, monthNum - 1, day).getDay();
      cell.value = DAY_OF_WEEK_PT[dow];
      wkBg = dow === 6 ? SAT_BG : dow === 0 ? SUN_BG : null;
      if (wkBg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: wkBg } };
    }
    cell.font = { name: 'Arial', size: 10, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = wkBg ? {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'medium', color: { argb: wkBg === SAT_BG ? 'FF3B82F6' : 'FFE11D48' } },
      right: { style: 'medium', color: { argb: wkBg === SAT_BG ? 'FF3B82F6' : 'FFE11D48' } },
    } : allBorder;
  }
  // AL5='S', AM5='D', AN5='TOTAL'
  for (const [col, label] of [[subDayCol1, 'S'], [subDayCol2, 'D'], [totalCol, 'TOTAL']] as Array<[number, string]>) {
    const c = ws.getCell(weekdayRow, col);
    c.value = label;
    c.font = { name: 'Arial', size: 10, bold: true };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = allBorder;
  }

  ws.getRow(4).height = 14.1;
  ws.getRow(5).height = 19.5;

  // === Linha 6: cabeçalhos de coluna ===
  const colHeaders: Array<[number, string]> = [
    [1, 'MATRÍCULA'],
    [2, 'NOME'],
    [3, 'FUNÇÃO'],
    [4, 'LOTAÇÃO'],
    [5, 'CH'],
    [6, 'DIAS TRAB.'],
  ];
  for (const [col, label] of colHeaders) {
    const c = ws.getCell(headerRow, col);
    c.value = label;
    c.font = { name: 'Arial', size: 10, bold: true };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = allBorder;
  }
  // Números dos dias G6..AK6
  for (let day = 1; day <= 31; day++) {
    const col = firstDayCol + (day - 1);
    const cell = ws.getCell(headerRow, col);
    let wkBg: string | null = null;
    if (day <= daysInMonth) {
      cell.value = day;
      const dow = new Date(year, monthNum - 1, day).getDay();
      wkBg = dow === 6 ? SAT_BG : dow === 0 ? SUN_BG : null;
      if (wkBg) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: wkBg } };
    }
    cell.font = { name: 'Arial', size: 10, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = wkBg ? {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'medium', color: { argb: wkBg === SAT_BG ? 'FF3B82F6' : 'FFE11D48' } },
      right: { style: 'medium', color: { argb: wkBg === SAT_BG ? 'FF3B82F6' : 'FFE11D48' } },
    } : allBorder;
  }
  // AL6, AM6 vazias (sub-totais ocultos); AN6 = 'HORAS'
  ws.getCell(headerRow, subDayCol1).border = allBorder;
  ws.getCell(headerRow, subDayCol2).border = allBorder;
  const horasCell = ws.getCell(headerRow, totalCol);
  horasCell.value = 'HORAS';
  horasCell.font = { name: 'Arial', size: 10, bold: true };
  horasCell.alignment = { horizontal: 'center', vertical: 'middle' };
  horasCell.border = allBorder;

  ws.getRow(headerRow).height = 47.25;

  // === Larguras das colunas (do modelo oficial) ===
  ws.getColumn(1).width = 16.29; // A — MATRÍCULA
  ws.getColumn(2).width = 39.86; // B — NOME
  ws.getColumn(3).width = 26.57; // C — FUNÇÃO
  ws.getColumn(4).width = 12.71; // D — LOTAÇÃO
  ws.getColumn(5).width = 8.43;  // E — CH
  ws.getColumn(6).width = 9.43;  // F — DIAS TRAB.
  // G..AK — colunas dos dias
  const dayWidths = [4.71, 4.71, 5.29, 5.00, 5.00, 5.43, 4.71, 4.86, 4.71, 5.71, 5.71,
                     4.71, 4.86, 4.71, 4.86, 4.71, 5.43, 5.00, 4.86, 5.29, 4.71, 4.71,
                     4.71, 5.29, 5.29, 4.57, 4.71, 4.71, 4.71, 4.71, 5.00];
  for (let i = 0; i < 31; i++) ws.getColumn(firstDayCol + i).width = dayWidths[i];
  ws.getColumn(subDayCol1).hidden = true;  // AL
  ws.getColumn(subDayCol2).hidden = true;  // AM
  ws.getColumn(totalCol).width = 11.71;

  // === Dados dos profissionais (linha 7 em diante) ===
  const dataStartRow = headerRow + 1; // 7
  data.professionals.forEach((prof, idx) => {
    const r = dataStartRow + idx;
    const row = ws.getRow(r);
    row.height = prof.coren ? 24 : 14.45;

    // A: matrícula
    const mCell = row.getCell(1);
    mCell.value = prof.registration_number ?? '';
    mCell.alignment = { horizontal: 'center', vertical: 'middle' };
    mCell.font = { name: 'Arial', size: 10 };
    mCell.border = allBorder;

    // B: nome (com COREN em segunda linha se houver)
    const nCell = row.getCell(2);
    if (prof.coren) {
      nCell.value = {
        richText: [
          { text: prof.full_name ?? '', font: { name: 'Arial', size: 10, bold: true } },
          { text: `\nCOREN: ${prof.coren}`, font: { name: 'Arial', size: 8, italic: true, color: { argb: 'FF065F46' } } },
        ],
      };
    } else {
      nCell.value = prof.full_name ?? '';
      nCell.font = { name: 'Arial', size: 10, bold: true };
    }
    nCell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'left', indent: 1 };
    nCell.border = allBorder;

    // C: função
    const fCell = row.getCell(3);
    fCell.value = prof.category_name ?? '';
    fCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    fCell.font = { name: 'Arial', size: 10 };
    fCell.border = allBorder;

    // D: lotação (vazio — pode ser preenchido depois)
    const lCell = row.getCell(4);
    lCell.alignment = { horizontal: 'center', vertical: 'middle' };
    lCell.font = { name: 'Arial', size: 10 };
    lCell.border = allBorder;

    // E: CH (carga horária — vazio por enquanto)
    const chCell = row.getCell(5);
    chCell.alignment = { horizontal: 'center', vertical: 'middle' };
    chCell.font = { name: 'Arial', size: 10 };
    chCell.border = allBorder;

    // Cálculo de dias trabalhados + horas
    let workDays = 0;
    let totalHours = 0;
    const profShifts = data.shiftsByProf.get(prof.id);
    for (let day = 1; day <= 31; day++) {
      const col = firstDayCol + (day - 1);
      const cell = row.getCell(col);
      const code = day <= daysInMonth ? profShifts?.get(day) : undefined;
      const wkBg = day <= daysInMonth ? weekendBg(year, monthNum, day) : null;

      if (code) {
        cell.value = code;
        const colors = SHIFT_COLORS[code] ?? DEFAULT_COLOR;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: colors.font } };
        if (HOURS_BY_CODE[code]) {
          workDays++;
          totalHours += HOURS_BY_CODE[code];
        }
      } else if (wkBg) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: wkBg } };
      }
      cell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Bordas laterais coloridas em SAB/DOM mesmo quando há código:
      // mantém a coluna visualmente marcada do topo ao fim da grade
      if (wkBg) {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'medium', color: { argb: wkBg === SAT_BG ? 'FF3B82F6' : 'FFE11D48' } },
          right: { style: 'medium', color: { argb: wkBg === SAT_BG ? 'FF3B82F6' : 'FFE11D48' } },
        };
      } else {
        cell.border = allBorder;
      }
    }

    // F: DIAS TRAB. — calculado
    const dtCell = row.getCell(6);
    dtCell.value = workDays;
    dtCell.font = { name: 'Arial', size: 10, bold: true };
    dtCell.alignment = { horizontal: 'center', vertical: 'middle' };
    dtCell.border = allBorder;

    // AL, AM — sub-totais ocultos (vazios mas com borda)
    ws.getCell(r, subDayCol1).border = allBorder;
    ws.getCell(r, subDayCol2).border = allBorder;

    // AN: TOTAL HORAS
    const thCell = row.getCell(totalCol);
    thCell.value = totalHours;
    thCell.font = { name: 'Arial', size: 10, bold: true };
    thCell.alignment = { horizontal: 'center', vertical: 'middle' };
    thCell.border = allBorder;
  });

  // === Linhas de TOTAL por código de turno, logo após o último profissional ===
  const codesPresent = new Set<string>();
  data.shiftsByProf.forEach(byDay => byDay.forEach(c => c && codesPresent.add(c)));
  const orderedCodes = ['SD', 'SN', 'P', 'MT', 'M', 'M2', 'T']
    .filter(c => codesPresent.has(c))
    .concat([...codesPresent].filter(c => !['SD', 'SN', 'P', 'MT', 'M', 'M2', 'T'].includes(c)).sort());

  const totalsStartRow = dataStartRow + data.professionals.length;
  orderedCodes.forEach((code, idx) => {
    const r = totalsStartRow + idx;
    const row = ws.getRow(r);
    row.height = 18;
    const colors = SHIFT_COLORS[code] ?? DEFAULT_COLOR;
    const totalFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: colors.bg } };

    // Mescla colunas A..E para o rótulo "TOTAL <CODE>"
    ws.mergeCells(r, 1, r, 5);
    const lblCell = ws.getCell(r, 1);
    lblCell.value = `TOTAL ${code}`;
    lblCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: colors.font } };
    lblCell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
    lblCell.fill = totalFill;
    lblCell.border = allBorder;

    // F: grand total do código no mês
    let grandTotal = 0;
    const perDayCounts: number[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      let count = 0;
      data.shiftsByProf.forEach(byDay => { if (byDay.get(day) === code) count++; });
      perDayCounts.push(count);
      grandTotal += count;
    }
    const gtCell = row.getCell(6);
    gtCell.value = grandTotal || null;
    gtCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: colors.font } };
    gtCell.alignment = { horizontal: 'center', vertical: 'middle' };
    gtCell.fill = totalFill;
    gtCell.border = allBorder;

    // G..AK: contagem por dia
    for (let day = 1; day <= 31; day++) {
      const col = firstDayCol + (day - 1);
      const cell = row.getCell(col);
      const wkBg = day <= daysInMonth ? weekendBg(year, monthNum, day) : null;
      if (day <= daysInMonth) {
        const count = perDayCounts[day - 1];
        cell.value = count || null;
      }
      cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: colors.font } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = totalFill;
      cell.border = wkBg ? {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'medium', color: { argb: wkBg === SAT_BG ? 'FF3B82F6' : 'FFE11D48' } },
        right: { style: 'medium', color: { argb: wkBg === SAT_BG ? 'FF3B82F6' : 'FFE11D48' } },
      } : allBorder;
    }

    // AL, AM, AN: vazias mas com borda + fill
    ws.getCell(r, subDayCol1).fill = totalFill;
    ws.getCell(r, subDayCol1).border = allBorder;
    ws.getCell(r, subDayCol2).fill = totalFill;
    ws.getCell(r, subDayCol2).border = allBorder;
    const totHorasCell = row.getCell(totalCol);
    totHorasCell.fill = totalFill;
    totHorasCell.border = allBorder;
  });

  // === Após os totais, a legenda do modelo ===
  const lastDataRow = Math.max(totalsStartRow + orderedCodes.length - 1, dataStartRow + data.professionals.length - 1, 26);
  const legendBaseRow = lastDataRow + 3;

  // A30: 'DATA:    /    /'  (Arial 10 bold)
  const dataCell = ws.getCell(legendBaseRow, 1);
  dataCell.value = 'DATA:    /    /';
  dataCell.font = { name: 'Arial', size: 10, bold: true };
  dataCell.alignment = { horizontal: 'left', vertical: 'middle' };

  // A33:A35 + B33:B35 — assinaturas
  const assinRow = legendBaseRow + 3;
  ws.mergeCells(assinRow, 1, assinRow + 2, 1);
  ws.mergeCells(assinRow, 2, assinRow + 2, 2);
  const assinA = ws.getCell(assinRow, 1);
  assinA.value = 'ASSINATURA/CARIMBO  -  CHEFE IMEDIATO';
  assinA.font = { name: 'Arial', size: 8, bold: true };
  assinA.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  assinA.border = allBorder;
  const assinB = ws.getCell(assinRow, 2);
  assinB.value = 'ASSINATURA/CARIMBO  -  DIRETOR';
  assinB.font = { name: 'Arial', size: 8, bold: true };
  assinB.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  assinB.border = allBorder;

  // Legenda em duas colunas mescladas N..X e Y..AK
  const legendRows: Array<[string, string]> = [
    ['MT -  MANHÃ E TARDE 8H',                         'LM -  LICENÇA MÉDICA'],
    ['M2 -   MANHÃ (08:00h às 12:00h)  4H',           'LG - LICENÇA GESTAÇÃO'],
    ['SD -  SERVIÇO DIURNO (07:00h às 19:00h)  12H',  'FE - FÉRIAS'],
    ['SN -  SERVIÇO NOTURNO (19:00h às 07:00h)  12H', 'OU - OUTROS (Especificar no campo de "Observação")'],
    ['INSS - AFASTAMENTO POR DOENÇA',                  'FC - FACULTATIVO'],
    ['',                                                'FD - FERIADO'],
  ];
  legendRows.forEach(([left, right], i) => {
    const lr = legendBaseRow + i;
    // N..X (cols 14..24)
    ws.mergeCells(lr, 14, lr, 24);
    const lc = ws.getCell(lr, 14);
    lc.value = left;
    lc.font = { name: 'Arial', size: 9.5, bold: true };
    lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

    // Y..AK (cols 25..37)
    ws.mergeCells(lr, 25, lr, 37);
    const rc = ws.getCell(lr, 25);
    rc.value = right;
    rc.font = { name: 'Arial', size: 9.5, bold: true };
    rc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

    ws.getRow(lr).height = 12.75;
  });

  const rawBuffer = await workbook.xlsx.writeBuffer();
  const outBuffer = await sanitizeXlsxBuffer(rawBuffer as ArrayBuffer);
  const filename = `${sanitizeFilename(data.scheduleName)}.xlsx`;
  return { buffer: outBuffer, filename };
}

/**
 * Função pública para exportar uma escala em Excel.
 *
 * 1. Tenta usar template oficial (.xlsx) se houver para o setor
 * 2. Caso contrário, gera Excel formatado por código (fallback genérico)
 */
export async function exportScheduleToExcel(data: ExportData): Promise<void> {
  // Gerador limpo é sempre usado. O template antigo (.xlsx) tinha células
  // mescladas, colunas escondidas e headers rotacionados — gerava saídas
  // bagunçadas após inserir os dados. Agora montamos o arquivo do zero,
  // com layout consistente, dias trabalhados calculados de fato, tinta
  // de SAB/DOM em toda a coluna e linhas de total por código.
  const { buffer, filename } = await exportGeneric(data);
  downloadBuffer(buffer, filename);
}

/**
 * Mesma geração de exportScheduleToExcel, mas retorna o buffer em vez de
 * baixar — usado pra exportação em lote (ScheduleView), que empacota
 * vários arquivos num único .zip em vez de disparar N downloads.
 */
export async function generateScheduleExcelBuffer(
  data: ExportData
): Promise<{ buffer: ArrayBuffer; filename: string }> {
  return exportGeneric(data);
}

// Função tryExportFromTemplate ainda existe acima mas não é mais chamada,
// mantida temporariamente caso queiramos reativar com outro template.
void tryExportFromTemplate;
