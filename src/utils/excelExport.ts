import ExcelJS, { Worksheet, Cell, Style } from 'exceljs';

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
    const outBuffer = await workbook.xlsx.writeBuffer();
    const filename = `${sanitizeFilename(data.scheduleName)}.xlsx`;
    downloadBuffer(outBuffer as ArrayBuffer, filename);
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
  for (let day = 1; day <= 31; day++) {
    const col = layout.firstDayCol + (day - 1);
    const cell = row.getCell(col);
    if (day <= daysInMonth) {
      const dow = new Date(year, month - 1, day).getDay();
      cell.value = DAY_OF_WEEK_PT[dow];
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
    }
    if (layout.funcaoCol) targetRow.getCell(layout.funcaoCol).value = prof.category_name ?? '';

    // Preencher turnos
    const profShifts = data.shiftsByProf.get(prof.id);
    let workDays = 0;
    let totalHours = 0;
    if (profShifts) {
      for (let day = 1; day <= daysInMonth; day++) {
        const code = profShifts.get(day);
        const col = layout.firstDayCol + (day - 1);
        const cell = targetRow.getCell(col);
        if (code) {
          cell.value = code;
          // Aplicar cor baseada no código
          const colors = SHIFT_COLORS[code] ?? DEFAULT_COLOR;
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: colors.bg },
          };
          cell.font = {
            ...(cell.font ?? {}),
            color: { argb: colors.font },
            bold: true,
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          // Contar horas trabalhadas (P=24, MT=8, SD/SN=12, M/T=6, M2=4)
          const hours: Record<string, number> = {
            P: 24, '24': 24, MT: 8, SD: 12, SN: 12, M: 6, T: 6, M2: 4,
          };
          if (hours[code]) {
            workDays++;
            totalHours += hours[code];
          }
        }
      }
    }

    if (layout.diasTrabCol) targetRow.getCell(layout.diasTrabCol).value = workDays;
    if (layout.totalHorasCol) targetRow.getCell(layout.totalHorasCol).value = totalHours;
  });
}

// ============================================================================
// FALLBACK: gera Excel formatado quando não há template para o setor
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

  const ws = workbook.addWorksheet(`${monthName} ${String(year).slice(-2)}`, {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
    views: [{ state: 'frozen', xSplit: 4, ySplit: 4 }],
  });

  // Linha 1: título
  ws.mergeCells(1, 1, 1, 4 + daysInMonth + 1);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = `ESCALA DE SERVIÇO - ${data.departmentName}`;
  titleCell.font = { name: 'Arial', size: 14, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' },
  };
  titleCell.font = { ...titleCell.font, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).height = 28;

  // Linha 2: setor / mês
  ws.mergeCells(2, 1, 2, 4 + daysInMonth + 1);
  const subtitleCell = ws.getCell(2, 1);
  subtitleCell.value = `Setor: ${data.departmentName}    |    Mês/Ano: ${monthName} / ${year}`;
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subtitleCell.font = { name: 'Arial', size: 11, bold: true };
  ws.getRow(2).height = 22;

  // Linha 3: dias da semana
  // Linha 4: números dos dias (header)
  const headerRow = 4;
  const weekdayRow = 3;

  ws.getCell(headerRow, 1).value = 'MATRÍCULA';
  ws.getCell(headerRow, 2).value = 'NOME';
  ws.getCell(headerRow, 3).value = 'FUNÇÃO';
  ws.getCell(headerRow, 4).value = 'DIAS TRAB.';

  for (let day = 1; day <= daysInMonth; day++) {
    const col = 4 + day;
    ws.getCell(headerRow, col).value = day;
    const dow = new Date(year, monthNum - 1, day).getDay();
    ws.getCell(weekdayRow, col).value = DAY_OF_WEEK_PT[dow];
  }
  const totalCol = 4 + daysInMonth + 1;
  ws.getCell(headerRow, totalCol).value = 'TOTAL HORAS';

  // Estilizar header
  for (let c = 1; c <= totalCol; c++) {
    const cell = ws.getCell(headerRow, c);
    cell.font = { name: 'Arial', size: 9, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = {
      type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' },
    };
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    };
  }
  for (let c = 5; c <= 4 + daysInMonth; c++) {
    const cell = ws.getCell(weekdayRow, c);
    cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF6B7280' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    };
  }

  // Larguras das colunas
  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 30;
  ws.getColumn(3).width = 22;
  ws.getColumn(4).width = 8;
  for (let c = 5; c <= 4 + daysInMonth; c++) ws.getColumn(c).width = 4.5;
  ws.getColumn(totalCol).width = 10;

  // Dados
  const dataStartRow = headerRow + 1;
  data.professionals.forEach((prof, idx) => {
    const r = dataStartRow + idx;
    const row = ws.getRow(r);
    row.height = 22;

    row.getCell(1).value = prof.registration_number ?? '';
    if (prof.coren) {
      row.getCell(2).value = {
        richText: [
          { text: prof.full_name, font: { name: 'Arial', size: 9, bold: true } },
          { text: `\nCOREN: ${prof.coren}`, font: { name: 'Arial', size: 8, color: { argb: 'FF065F46' }, italic: true } },
        ],
      };
    } else {
      row.getCell(2).value = prof.full_name;
    }
    row.getCell(2).alignment = { wrapText: true, vertical: 'middle' };
    row.getCell(3).value = prof.category_name ?? '';

    let workDays = 0;
    let totalHours = 0;
    const profShifts = data.shiftsByProf.get(prof.id);
    if (profShifts) {
      for (let day = 1; day <= daysInMonth; day++) {
        const code = profShifts.get(day);
        const col = 4 + day;
        const cell = row.getCell(col);
        if (code) {
          cell.value = code;
          const colors = SHIFT_COLORS[code] ?? DEFAULT_COLOR;
          cell.fill = {
            type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg },
          };
          cell.font = {
            name: 'Arial', size: 9, bold: true, color: { argb: colors.font },
          };
          const hours: Record<string, number> = {
            P: 24, '24': 24, MT: 8, SD: 12, SN: 12, M: 6, T: 6, M2: 4,
          };
          if (hours[code]) {
            workDays++;
            totalHours += hours[code];
          }
        }
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        };
      }
    }
    row.getCell(4).value = workDays;
    row.getCell(totalCol).value = totalHours > 0 ? `${totalHours}h` : '';

    // Bordas e estilo das células fixas
    for (const c of [1, 2, 3, 4, totalCol]) {
      const cell = row.getCell(c);
      cell.alignment = { horizontal: c === 2 || c === 3 ? 'left' : 'center', vertical: 'middle' };
      cell.font = { name: 'Arial', size: 9 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      };
    }
  });

  // Legenda no fim
  const legendRow = dataStartRow + data.professionals.length + 2;
  ws.getCell(legendRow, 1).value = 'LEGENDA';
  ws.getCell(legendRow, 1).font = { name: 'Arial', size: 10, bold: true };
  const legends: Array<[string, string]> = [
    ['P', 'Plantão 24h (7h às 7h)'],
    ['SD', 'Serviço Diurno (7h às 19h)'],
    ['D', 'Diarista'],
    ['SN', 'Serviço Noturno (19h às 7h)'],
    ['MT', 'Manhã e Tarde (8h às 17h)'],
    ['M', 'Manhã (7h às 13h)'],
    ['T', 'Tarde (12h às 18h)'],
    ['FG', 'Folga'],
    ['FE', 'Férias'],
    ['LM', 'Licença Médica'],
    ['LG', 'Licença Gestação'],
    ['LP', 'Licença Prêmio'],
    ['FA', 'Falta'],
    ['FR', 'Feriado'],
    ['AS', 'Afastamento à Serviço'],
  ];
  legends.forEach(([code, desc], i) => {
    const lr = legendRow + 1 + Math.floor(i / 4);
    const lc = 1 + (i % 4) * 2;
    const codeCell = ws.getCell(lr, lc);
    codeCell.value = code;
    const colors = SHIFT_COLORS[code] ?? DEFAULT_COLOR;
    codeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
    codeCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: colors.font } };
    codeCell.alignment = { horizontal: 'center', vertical: 'middle' };
    codeCell.border = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    };
    ws.getCell(lr, lc + 1).value = desc;
    ws.getCell(lr, lc + 1).font = { name: 'Arial', size: 9 };
  });

  const outBuffer = await workbook.xlsx.writeBuffer();
  const filename = `${sanitizeFilename(data.scheduleName)}.xlsx`;
  downloadBuffer(outBuffer as ArrayBuffer, filename);
}

/**
 * Função pública para exportar uma escala em Excel.
 *
 * 1. Tenta usar template oficial (.xlsx) se houver para o setor
 * 2. Caso contrário, gera Excel formatado por código (fallback genérico)
 */
export async function exportScheduleToExcel(data: ExportData): Promise<void> {
  const usedTemplate = await tryExportFromTemplate(data);
  if (!usedTemplate) {
    await exportGeneric(data);
  }
}
