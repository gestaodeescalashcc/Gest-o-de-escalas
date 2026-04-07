import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AFDRequest {
  establishment_id: string;
  start_date: string;
  end_date: string;
  is_fiscal_request?: boolean;
  fiscal_protocol?: string;
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

function formatDateTimeDH(datetime: string): string {
  const date = new Date(datetime);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${day}${month}${year}${hours}${minutes}${seconds}${ms}000-0300`;
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

function mapDeviceTypeToCollector(deviceType: string | null): string {
  const mapping: Record<string, string> = {
    'MOBILE': '01',
    'WEB': '02',
    'BROWSER': '02',
    'DESKTOP': '03',
    'DEVICE': '04',
    'REP': '04',
    'OTHER': '05'
  };
  return mapping[(deviceType || 'WEB').toUpperCase()] || '02';
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

    const body: AFDRequest = await req.json();
    const { establishment_id, start_date, end_date, is_fiscal_request, fiscal_protocol } = body;

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

    const { data: records, error: recordsError } = await supabase
      .from('punch_records')
      .select(`
        *,
        professional:professionals(
          id, full_name, cpf, pis_number
        )
      `)
      .eq('establishment_id', establishment_id)
      .gte('punch_datetime', start_date + 'T00:00:00')
      .lte('punch_datetime', end_date + 'T23:59:59')
      .order('nsr', { ascending: true });

    if (recordsError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Error fetching records: ' + recordsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lines: string[] = [];
    const now = new Date();

    const tipoIdentificador = establishment.employer_document_type === 'CPF' ? '1' : '2';
    const documentoEmpregador = tipoIdentificador === '1'
      ? cleanCPF(establishment.employer_document).padEnd(14, ' ')
      : cleanCNPJ(establishment.employer_document);

    const tipo1 =
      '1' +
      padLeft(String(records?.length || 0), 9, '0') +
      tipoIdentificador +
      documentoEmpregador +
      padRight(establishment.cei_caepf_cno || '', 12) +
      padRight(establishment.employer_name, 150) +
      padRight(establishment.rep_p_registration || '', 17) +
      formatDateDDMMYYYY(start_date) +
      formatDateDDMMYYYY(end_date) +
      formatDateFromDate(now) +
      formatTime(now);

    lines.push(tipo1);

    const professionalsMap = new Map<string, any>();
    records?.forEach(record => {
      if (record.professional && !professionalsMap.has(record.professional.id)) {
        professionalsMap.set(record.professional.id, record.professional);
      }
    });

    professionalsMap.forEach((prof) => {
      const cpf = cleanCPF(prof.cpf);
      const pis = prof.pis_number ? cleanDocument(prof.pis_number).padStart(11, '0') : cpf;

      const tipo2 =
        '2' +
        cpf +
        pis +
        padRight(prof.full_name, 52);

      lines.push(tipo2);
    });

    records?.forEach(record => {
      const cpf = cleanCPF(record.professional?.cpf || '');
      const punchDateTimeDH = formatDateTimeDH(record.punch_datetime);
      const serverDateTimeDH = formatDateTimeDH(record.server_datetime);
      const collectorId = mapDeviceTypeToCollector(record.device_type);
      const onlineFlag = record.is_online === false ? '1' : '0';
      const recordHash = (record.record_hash || '').padEnd(64, '0').substring(0, 64);

      const tipo7 =
        padLeft(String(record.nsr), 9, '0') +
        '7' +
        punchDateTimeDH +
        padLeft(cpf, 12, '0') +
        serverDateTimeDH +
        collectorId +
        onlineFlag +
        recordHash;

      lines.push(tipo7);
    });

    const afdContent = lines.join('\r\n');
    const afdHash = await sha256(afdContent);

    let exportJobId: string | null = null;

    if (systemUser) {
      const { data: exportJob, error: jobError } = await supabase
        .from('export_jobs')
        .insert({
          export_type: 'AFD',
          establishment_id,
          start_date,
          end_date,
          status: 'COMPLETED',
          file_hash: afdHash,
          is_fiscal_request: is_fiscal_request || false,
          fiscal_protocol: fiscal_protocol || null,
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
        action: 'AFD_GENERATED',
        action_details: {
          establishment_id,
          start_date,
          end_date,
          record_count: records?.length || 0,
          file_hash: afdHash,
          is_fiscal_request
        },
        user_id: user.id
      });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          content: afdContent,
          filename: `AFD_${cleanCNPJ(establishment.employer_document)}_${start_date.replace(/-/g, '')}_${end_date.replace(/-/g, '')}.txt`,
          hash: afdHash,
          record_count: records?.length || 0,
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