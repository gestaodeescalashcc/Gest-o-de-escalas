import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AEJRequest {
  establishment_id: string;
  start_date: string;
  end_date: string;
  professional_ids?: string[];
}

function padLeft(str: string, length: number, char: string = '0'): string {
  return String(str).padStart(length, char);
}

function padRight(str: string, length: number, char: string = ' '): string {
  return String(str || '').padEnd(length, char).substring(0, length);
}

function formatDateDDMMYYYY(dateStr: string): string {
  const date = new Date(dateStr);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}${month}${year}`;
}

function formatDateFromDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}${month}${year}`;
}

function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}${minutes}`;
}

function formatTimeFromDatetime(datetime: string): string {
  const date = new Date(datetime);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}${minutes}`;
}

function cleanDocument(doc: string): string {
  return (doc || '').replace(/[^0-9]/g, '');
}

function cleanCNPJ(cnpj: string): string {
  return cleanDocument(cnpj).padStart(14, '0');
}

function cleanCPF(cpf: string): string {
  return cleanDocument(cpf).padStart(11, '0');
}

function formatMinutesToHHMM(minutes: number): string {
  const hours = Math.floor(Math.abs(minutes) / 60);
  const mins = Math.abs(minutes) % 60;
  return `${String(hours).padStart(2, '0')}${String(mins).padStart(2, '0')}`;
}

function isNightHour(date: Date): boolean {
  const hour = date.getHours();
  return hour >= 22 || hour < 5;
}

function calculateWorkedTime(punches: { type: string; datetime: Date }[]): {
  totalDiurno: number;
  totalNoturno: number;
} {
  let totalDiurno = 0;
  let totalNoturno = 0;

  const entries: Date[] = [];
  const exits: Date[] = [];

  punches.forEach(p => {
    if (p.type === 'ENTRY' || p.type === 'MEAL_END') {
      entries.push(p.datetime);
    } else if (p.type === 'EXIT' || p.type === 'MEAL_START') {
      exits.push(p.datetime);
    }
  });

  entries.sort((a, b) => a.getTime() - b.getTime());
  exits.sort((a, b) => a.getTime() - b.getTime());

  const pairs = Math.min(entries.length, exits.length);

  for (let i = 0; i < pairs; i++) {
    const start = entries[i];
    const end = exits[i];

    if (end.getTime() <= start.getTime()) continue;

    const diffMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);

    if (isNightHour(start) || isNightHour(end)) {
      totalNoturno += diffMinutes;
    } else {
      totalDiurno += diffMinutes;
    }
  }

  return { totalDiurno, totalNoturno };
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: systemUser } = await supabase
      .from('system_users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    const body: AEJRequest = await req.json();
    const { establishment_id, start_date, end_date, professional_ids } = body;

    if (!establishment_id || !start_date || !end_date) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: establishment, error: estabError } = await supabase
      .from('establishments')
      .select('*')
      .eq('id', establishment_id)
      .maybeSingle();

    if (estabError || !establishment) {
      return new Response(
        JSON.stringify({ success: false, error: 'Establishment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let query = supabase
      .from('punch_records')
      .select(`
        *,
        professional:professionals(
          id, full_name, registration_number, pis_number, hire_date
        )
      `)
      .eq('establishment_id', establishment_id)
      .gte('punch_datetime', start_date + 'T00:00:00')
      .lte('punch_datetime', end_date + 'T23:59:59')
      .order('professional_id')
      .order('punch_datetime', { ascending: true });

    if (professional_ids && professional_ids.length > 0) {
      query = query.in('professional_id', professional_ids);
    }

    const { data: records, error: recordsError } = await query;

    if (recordsError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Error fetching records: ' + recordsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: adjustments } = await supabase
      .from('punch_adjustments')
      .select('*')
      .eq('establishment_id', establishment_id)
      .eq('approval_status', 'APPROVED')
      .gte('adjusted_datetime', start_date + 'T00:00:00')
      .lte('adjusted_datetime', end_date + 'T23:59:59');

    const recordsByProfessional = new Map<string, any[]>();
    records?.forEach(record => {
      const profId = record.professional_id;
      if (!recordsByProfessional.has(profId)) {
        recordsByProfessional.set(profId, []);
      }
      recordsByProfessional.get(profId)!.push(record);
    });

    const lines: string[] = [];
    const now = new Date();

    const tipoIdentificador = establishment.employer_document_type === 'CPF' ? '1' : '2';
    const documentoEmpregador = tipoIdentificador === '1'
      ? cleanCPF(establishment.employer_document).padEnd(14, ' ')
      : cleanCNPJ(establishment.employer_document);

    const tipo1 =
      '1' +
      tipoIdentificador +
      documentoEmpregador +
      padRight(establishment.cei_caepf_cno || '', 12) +
      padRight(establishment.employer_name, 150) +
      formatDateDDMMYYYY(start_date) +
      formatDateDDMMYYYY(end_date) +
      formatDateFromDate(now) +
      formatTime(now);

    lines.push(tipo1);

    recordsByProfessional.forEach((profRecords, profId) => {
      const prof = profRecords[0]?.professional;
      if (!prof) return;

      const cpf = cleanCPF(prof.registration_number);
      const pis = prof.pis_number ? cleanDocument(prof.pis_number).padStart(11, '0') : cpf;
      const hireDate = prof.hire_date ? formatDateDDMMYYYY(prof.hire_date) : '00000000';

      const tipo2 =
        '2' +
        cpf +
        pis +
        padRight(prof.full_name, 52) +
        hireDate;

      lines.push(tipo2);

      const recordsByDate = new Map<string, any[]>();
      profRecords.forEach(record => {
        const dateKey = record.punch_datetime.substring(0, 10);
        if (!recordsByDate.has(dateKey)) {
          recordsByDate.set(dateKey, []);
        }
        recordsByDate.get(dateKey)!.push(record);
      });

      recordsByDate.forEach((dayRecords, dateKey) => {
        const punches: { type: string; datetime: Date }[] = dayRecords.map(r => ({
          type: r.punch_type,
          datetime: new Date(r.punch_datetime)
        }));

        const { totalDiurno, totalNoturno } = calculateWorkedTime(punches);

        const dayAdjustments = adjustments?.filter(
          adj => adj.professional_id === profId &&
            adj.adjusted_datetime?.startsWith(dateKey)
        ) || [];

        let marcacoesOriginais = '';
        dayRecords.slice(0, 8).forEach(record => {
          marcacoesOriginais += formatTimeFromDatetime(record.punch_datetime);
        });
        marcacoesOriginais = padRight(marcacoesOriginais, 32);

        let marcacoesTratadas = '';
        if (dayAdjustments.length > 0) {
          dayAdjustments.slice(0, 8).forEach(adj => {
            if (adj.adjusted_datetime) {
              marcacoesTratadas += formatTimeFromDatetime(adj.adjusted_datetime);
            }
          });
        } else {
          marcacoesTratadas = marcacoesOriginais;
        }
        marcacoesTratadas = padRight(marcacoesTratadas, 32);

        const tipo3 =
          '3' +
          cpf +
          formatDateDDMMYYYY(dateKey) +
          marcacoesOriginais +
          marcacoesTratadas +
          formatMinutesToHHMM(totalDiurno) +
          formatMinutesToHHMM(totalNoturno) +
          '0000' +
          '0000' +
          '0000' +
          '0000' +
          '0000' +
          '0000' +
          '00';

        lines.push(tipo3);
      });
    });

    const tipo9 = '9';
    lines.push(tipo9);

    const aejContent = lines.join('\r\n');
    const aejHash = await sha256(aejContent);

    let exportJobId: string | null = null;

    if (systemUser) {
      const { data: exportJob, error: jobError } = await supabase
        .from('export_jobs')
        .insert({
          export_type: 'AEJ',
          establishment_id,
          start_date,
          end_date,
          professional_ids: professional_ids || null,
          status: 'COMPLETED',
          file_hash: aejHash,
          requested_by: systemUser.id,
          completed_at: new Date().toISOString()
        })
        .select()
        .maybeSingle();

      if (jobError) {
        console.error('Error creating export job:', jobError);
      } else {
        exportJobId = exportJob?.id;
      }
    }

    await supabase
      .from('punch_audit_log')
      .insert({
        entity_type: 'export_job',
        entity_id: exportJobId || crypto.randomUUID(),
        action: 'AEJ_GENERATED',
        action_details: {
          establishment_id,
          start_date,
          end_date,
          professional_count: recordsByProfessional.size,
          record_count: records?.length || 0,
          file_hash: aejHash
        },
        user_id: user.id
      });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          content: aejContent,
          filename: `AEJ_${cleanCNPJ(establishment.employer_document)}_${start_date.replace(/-/g, '')}_${end_date.replace(/-/g, '')}.txt`,
          hash: aejHash,
          record_count: records?.length || 0,
          professional_count: recordsByProfessional.size,
          export_job_id: exportJobId
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});