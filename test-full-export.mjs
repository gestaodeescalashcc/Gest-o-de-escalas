// Reproduz a lógica de export completo (template + preenchimento) com ExcelJS
import ExcelJS from 'exceljs';
import { readFileSync, writeFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://sbncaocybjiiynktxfqq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibmNhb2N5YmppaXlua3R4ZnFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1ODE2MDQsImV4cCI6MjA5MTE1NzYwNH0.IKKxST21SBc9Zpjj_KRpZFkotP9eXfhiTnlcsrgKQYM'
);

await sb.auth.signInWithPassword({email:'anafarini@fesfsus.ba.gov.br',password:'HECC@2026'});

// Carrega template
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(readFileSync('public/templates/escala-enfermagem.xlsx'));
console.log('Sheets:', wb.worksheets.map(w => w.name));

// Salva direto sem nenhuma alteração
const buf = await wb.xlsx.writeBuffer();
writeFileSync('test-pure-roundtrip.xlsx', Buffer.from(buf));
console.log('Pure roundtrip:', buf.byteLength, 'bytes');

// Inspeciona o XML interno
const AdmZip = (await import('adm-zip')).default || (await import('adm-zip'));
import('adm-zip').then(m => {
  const z = new (m.default || m)('test-pure-roundtrip.xlsx');
  const entries = z.getEntries().map(e => e.entryName);
  console.log('Entries:', entries);
  for (const n of ['xl/workbook.xml', 'xl/_rels/workbook.xml.rels', '[Content_Types].xml']) {
    const e = z.getEntry(n);
    if (e) {
      const t = e.getData().toString('utf-8');
      console.log(`\n=== ${n} ===\n${t}`);
    }
  }
});
