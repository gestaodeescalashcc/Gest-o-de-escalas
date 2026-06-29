import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { parseScheduleWorkbook } from '../../utils/excelImport';

// Monta uma planilha no layout do template "CGR" (FESF/HECC).
async function buildWorkbook(opts: {
  sector?: string;
  monthCell?: Date | string | null;
  weekdayDay1?: string;
  days?: number;
  rows?: Array<{ reg?: string | number | null; name: string; role?: string; ch?: string | number; codes?: Record<number, string> }>;
}): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('CGR');
  ws.getCell('A4').value = 'SETOR:';
  ws.getCell('B4').value = opts.sector ?? 'NUTRIÇÃO - HECC';
  if (opts.monthCell !== null) ws.getCell('AH2').value = opts.monthCell ?? new Date(2026, 6, 1);
  // dia da semana do dia 1
  ws.getRow(5).getCell(7).value = opts.weekdayDay1 ?? 'QUA';
  // cabeçalho
  const headers = ['MATRÍCULA', 'NOME', 'FUNÇÃO', 'LOTAÇÃO', 'CH', 'DIAS TRAB.'];
  headers.forEach((h, i) => (ws.getRow(6).getCell(i + 1).value = h));
  const days = opts.days ?? 31;
  for (let d = 1; d <= days; d++) ws.getRow(6).getCell(6 + d).value = d;
  // profissionais
  (opts.rows ?? []).forEach((p, idx) => {
    const r = ws.getRow(7 + idx);
    r.getCell(1).value = p.reg ?? null;
    r.getCell(2).value = p.name;
    r.getCell(3).value = p.role ?? 'NUTRICIONISTA';
    r.getCell(5).value = p.ch ?? 40;
    for (const [day, code] of Object.entries(p.codes ?? {})) {
      r.getCell(6 + Number(day)).value = code;
    }
  });
  return wb.xlsx.writeBuffer();
}

describe('parseScheduleWorkbook', () => {
  it('extrai setor, mês/ano (célula Date), dias e valida o dia da semana', async () => {
    const buf = await buildWorkbook({
      monthCell: new Date(2026, 6, 1), // julho/2026 começa numa quarta (QUA)
      weekdayDay1: 'QUA',
      rows: [{ reg: 17893, name: 'ROSENI MUNIZ', codes: { 2: 'SD', 5: 'SD', 16: 'MT' } }],
    });
    const p = await parseScheduleWorkbook(buf);
    expect(p.sector).toBe('NUTRIÇÃO - HECC');
    expect(p.month).toBe(7);
    expect(p.year).toBe(2026);
    expect(p.monthSource).toBe('cell');
    expect(p.daysInMonth).toBe(31);
    expect(p.weekdayMatchesMonth).toBe(true);
    expect(p.professionals).toHaveLength(1);
    const prof = p.professionals[0];
    expect(prof.registration).toBe('17893');
    expect(prof.shifts.find(s => s.day === 2)?.resolvedName).toBe('Serviço Diurno (7h às 19h) 12h');
    expect(prof.shifts.find(s => s.day === 16)?.resolvedCode).toBe('MT');
  });

  it('normaliza CH com "H" e matrícula ausente; resolve SN', async () => {
    const buf = await buildWorkbook({
      sector: 'FARMÁCIA',
      monthCell: new Date(2026, 5, 1),
      weekdayDay1: 'SEG',
      rows: [
        { reg: null, name: 'ANDRESSA SILVA', ch: '40H', codes: { 1: 'MT', 2: 'SD' } },
        { reg: 17891, name: 'JEAN LOURENÇO', ch: '36H', codes: { 6: 'SN' } },
      ],
    });
    const p = await parseScheduleWorkbook(buf, '6 Junho 2026 - Escala Farmácia HECC.xlsx');
    expect(p.sector).toBe('FARMÁCIA');
    expect(p.month).toBe(6);
    expect(p.professionals[0].registration).toBeNull();
    expect(p.professionals[0].ch).toBe(40);
    expect(p.professionals[1].ch).toBe(36);
    expect(p.professionals[1].shifts[0].resolvedCode).toBe('SN');
  });

  it('cai para o nome do arquivo quando a célula de mês está vazia', async () => {
    const buf = await buildWorkbook({ monthCell: null, rows: [{ name: 'X' }] });
    const p = await parseScheduleWorkbook(buf, 'Escala Julho 26.xlsx');
    expect(p.month).toBe(7);
    expect(p.year).toBe(2026);
    expect(p.monthSource).toBe('filename');
  });

  it('reporta códigos desconhecidos e mapeia FC/FD/OU/INSS', async () => {
    const buf = await buildWorkbook({
      rows: [{ name: 'Y', codes: { 1: 'FC', 2: 'FD', 3: 'OU', 4: 'INSS', 5: 'ZZZ' } }],
    });
    const p = await parseScheduleWorkbook(buf);
    const prof = p.professionals[0];
    expect(prof.shifts.find(s => s.day === 1)?.resolvedName).toBe('Facultativo');
    expect(prof.shifts.find(s => s.day === 2)?.resolvedName).toBe('Feriado'); // FD → FR
    expect(prof.shifts.find(s => s.day === 3)?.resolvedCode).toBe('OU');
    expect(prof.shifts.find(s => s.day === 4)?.resolvedCode).toBe('INSS');
    expect(p.unknownCodes.find(u => u.code === 'ZZZ')?.count).toBe(1);
  });

  it('avisa quando o dia da semana não bate com o mês', async () => {
    const buf = await buildWorkbook({
      monthCell: new Date(2026, 6, 1), // QUA
      weekdayDay1: 'SEG', // errado de propósito
      rows: [{ name: 'Z' }],
    });
    const p = await parseScheduleWorkbook(buf);
    expect(p.weekdayMatchesMonth).toBe(false);
    expect(p.warnings.some(w => w.includes('começa numa'))).toBe(true);
  });
});
