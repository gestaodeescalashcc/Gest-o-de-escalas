// Replica tryExportFromTemplate em Node, salvando direto no disco
import ExcelJS from 'exceljs';
import { readFileSync, writeFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://sbncaocybjiiynktxfqq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibmNhb2N5YmppaXlua3R4ZnFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1ODE2MDQsImV4cCI6MjA5MTE1NzYwNH0.IKKxST21SBc9Zpjj_KRpZFkotP9eXfhiTnlcsrgKQYM'
);

await sb.auth.signInWithPassword({email:'anafarini@fesfsus.ba.gov.br',password:'HECC@2026'});

const schedId = '67f42d87-c973-4de2-a948-f96d5a197f58';
const { data: sched } = await sb.from('monthly_schedules')
  .select('*, department:departments(id, name)')
  .eq('id', schedId).maybeSingle();
const { data: profs } = await sb.from('professionals')
  .select('id, full_name, registration_number, coren, contracted_hours_per_month, category:professional_categories!category_id(name), department:departments!department_id(name)')
  .eq('department_id', sched.department.id).eq('active', true).order('full_name');
const { data: shifts } = await sb.from('shifts')
  .select('professional_id, shift_date, shift_type, original_shift_type, deleted_in_realizada_at')
  .eq('schedule_id', schedId);

// Mapa shift_type → código
const TYPES = {
  'Serviço Noturno (19h às 7h) 12h':'SN', 'Serviço Diurno (7h às 19h) 12h':'SD',
  'Plantão 24h (7h às 7h) 24h':'P', 'Manhã (7h às 13h) 6h':'M',
  'Manhã (8h às 12h) 4h':'M2', 'Tarde (12h às 18h) 6h':'T', 'Tarde (13h às 19h) 6h':'T',
  'Manhã e Tarde (8h às 17h) 8h':'MT', 'Folga':'FG', 'Feriado':'FR', 'Férias':'FE',
  'Falta':'FA', 'Licença Prêmio':'LP', 'Licença Médica':'LM', 'Licença Gestação':'LG',
  'Afastamento À Serviço':'AS',
};

// Load template
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(readFileSync('public/templates/escala-enfermagem.xlsx'));
const ws = wb.worksheets[0];

// Renomear aba para "MAIO 26"
ws.name = 'MAIO 26';

// Localizar header NOME
let headerRow = 6;  // sabemos do template
let nameCol = 2;    // B = NOME
let firstDayCol = 7; // G = dia 1

// Limpa linhas de dados (rows 7+)
for (let r = 7; r <= 30; r++) {
  const row = ws.getRow(r);
  for (let c = 1; c <= 50; c++) {
    row.getCell(c).value = null;
  }
}

// Preenche
let row = 7;
for (const p of profs) {
  ws.getCell(row, 1).value = p.registration_number || '';  // matrícula
  ws.getCell(row, 2).value = p.full_name;                  // nome
  ws.getCell(row, 3).value = p.category?.name || '';       // função
  ws.getCell(row, 4).value = p.coren || '';                // coren (D)
  ws.getCell(row, 5).value = p.contracted_hours_per_month || 0;  // CH (E)

  // shifts deste profissional (Realizada: pula soft-deletados, usa shift_type)
  const profShifts = shifts.filter(s => s.professional_id === p.id && !s.deleted_in_realizada_at);
  let workDays = 0;
  let totalHours = 0;
  const hoursMap = { P:24, SD:12, SN:12, MT:8, M:6, M2:4, T:6 };
  for (const s of profShifts) {
    const day = parseInt(s.shift_date.slice(8,10));
    const code = TYPES[s.shift_type];
    if (code) {
      ws.getCell(row, firstDayCol + day - 1).value = code;
      if (!['FG','FR','FE','FA','LP','LM','LG','AS'].includes(code)) workDays++;
      totalHours += hoursMap[code] || 0;
    }
  }
  ws.getCell(row, 6).value = workDays;   // F = dias trab
  ws.getCell(row, 40).value = totalHours; // AN = total horas
  row++;
}

// Atualiza mês/ano (AH2)
const [yy, mm] = sched.month.split('-');
ws.getCell('AH2').value = new Date(parseInt(yy), parseInt(mm)-1, 1);

// Atualiza setor (B4)
ws.getCell('B4').value = sched.department.name.toUpperCase();

// Salva
const buf = await wb.xlsx.writeBuffer();

// Pós-processa: remove a declaração VML órfã do Content_Types (exceljs sempre adiciona)
import('jszip').then(async ({ default: JSZip }) => {
  const zip = await JSZip.loadAsync(Buffer.from(buf));
  let ct = await zip.file('[Content_Types].xml').async('string');
  ct = ct.replace(/<Default Extension="vml" ContentType="[^"]*"\s*\/>/g, '');
  zip.file('[Content_Types].xml', ct);
  const cleaned = await zip.generateAsync({ type: 'nodebuffer' });
  writeFileSync('Escala_Enfermeiros_-_Maio_de_2026.xlsx', cleaned);
  console.log(`OK ${cleaned.byteLength} bytes (limpo), ${profs.length} profs, ${shifts.length} shifts`);
});
