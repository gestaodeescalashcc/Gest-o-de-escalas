import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type PunchType = 'ENTRY' | 'EXIT' | 'MEAL_START' | 'MEAL_END';

const PUNCH_SEQUENCE: PunchType[] = ['ENTRY', 'MEAL_START', 'MEAL_END', 'EXIT'];

const PUNCH_LABELS: Record<PunchType, string> = {
  'ENTRY': 'Entrada',
  'EXIT': 'Saida',
  'MEAL_START': 'Saida Intervalo',
  'MEAL_END': 'Retorno Intervalo'
};

interface PunchRequest {
  professional_id: string;
  establishment_id: string;
  punch_type: PunchType;
  photo_data_url?: string;
  latitude?: number;
  longitude?: number;
  geo_accuracy?: number;
  device_type?: string;
  liveness_verified?: boolean;
}

function generateVerificationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 16; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function formatPunchType(type: string): string {
  const types: Record<string, string> = {
    'ENTRY': 'Entrada',
    'EXIT': 'Saida',
    'MEAL_START': 'Saida Intervalo',
    'MEAL_END': 'Retorno Intervalo'
  };
  return types[type] || type;
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    ).auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: PunchRequest = await req.json();
    const {
      professional_id,
      establishment_id,
      punch_type,
      photo_data_url,
      latitude,
      longitude,
      geo_accuracy,
      device_type = 'WEB',
      liveness_verified = false
    } = body;

    if (!professional_id || !establishment_id || !punch_type) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (req.headers.get('cf-connecting-ip') || null);
    const userAgent = req.headers.get('user-agent') || 'unknown';

    const { data: professional, error: profError } = await supabase
      .from('professionals')
      .select('id, full_name, registration_number, department_id')
      .eq('id', professional_id)
      .maybeSingle();

    if (profError || !professional) {
      return new Response(
        JSON.stringify({ success: false, error: 'Professional not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

    const { data: todayPunches, error: todayPunchesError } = await supabase
      .from('punch_records')
      .select('punch_type, punch_datetime')
      .eq('professional_id', professional_id)
      .gte('punch_datetime', todayStart)
      .lte('punch_datetime', todayEnd)
      .order('punch_datetime', { ascending: true });

    if (todayPunchesError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao verificar registros do dia' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let expectedPunchType: PunchType;

    if (!todayPunches || todayPunches.length === 0) {
      expectedPunchType = 'ENTRY';
    } else {
      const lastPunch = todayPunches[todayPunches.length - 1];
      const lastPunchType = lastPunch.punch_type as PunchType;
      const currentIndex = PUNCH_SEQUENCE.indexOf(lastPunchType);

      if (currentIndex === -1) {
        expectedPunchType = 'ENTRY';
      } else if (currentIndex === PUNCH_SEQUENCE.length - 1) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `${professional.full_name} ja registrou todos os pontos do dia (Entrada, Intervalo, Retorno e Saida).`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        expectedPunchType = PUNCH_SEQUENCE[currentIndex + 1];
      }
    }

    if (punch_type !== expectedPunchType) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Sequencia incorreta. O proximo registro deve ser "${PUNCH_LABELS[expectedPunchType]}", mas foi solicitado "${PUNCH_LABELS[punch_type]}".`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: nsrResult, error: nsrError } = await supabase
      .rpc('get_next_nsr', { p_establishment_id: establishment_id });

    if (nsrError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to generate NSR: ' + nsrError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const nsr = nsrResult;

    const { data: previousRecord } = await supabase
      .from('punch_records')
      .select('id, record_hash')
      .eq('establishment_id', establishment_id)
      .order('nsr', { ascending: false })
      .limit(1)
      .maybeSingle();

    const previousHash = previousRecord?.record_hash || 'GENESIS';
    const previousRecordId = previousRecord?.id || null;

    const punchDatetime = new Date();
    const hashData = `${nsr}|${establishment_id}|${professional_id}|${punch_type}|${punchDatetime.toISOString()}|${previousHash}`;
    const recordHash = await sha256(hashData);

    const verificationCode = generateVerificationCode();

    const { data: punchRecord, error: punchError } = await supabase
      .from('punch_records')
      .insert({
        nsr,
        establishment_id,
        professional_id,
        punch_type,
        punch_datetime: punchDatetime.toISOString(),
        server_datetime: new Date().toISOString(),
        timezone: 'America/Sao_Paulo',
        is_outside_schedule: false,
        is_online: true,
        device_type,
        ip_address: clientIp,
        user_agent: userAgent,
        latitude,
        longitude,
        geo_accuracy,
        liveness_verified,
        photo_url: photo_data_url,
        photo_hash: photo_data_url ? await sha256(photo_data_url.substring(0, 1000)) : null,
        previous_record_id: previousRecordId,
        previous_hash: previousHash,
        record_hash: recordHash
      })
      .select()
      .single();

    if (punchError) {
      console.error('Punch insert error:', punchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to register punch: ' + punchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const receiptContent = {
      title: 'Comprovante de Registro de Ponto do Trabalhador',
      nsr: nsr,
      employer_name: establishment.employer_name,
      employer_document: establishment.employer_document,
      employer_document_type: establishment.employer_document_type,
      cei_caepf_cno: establishment.cei_caepf_cno,
      establishment_address: `${establishment.address_street}, ${establishment.address_number || 'S/N'} - ${establishment.address_neighborhood || ''}, ${establishment.address_city}/${establishment.address_state}`,
      worker_name: professional.full_name,
      worker_cpf: professional.registration_number,
      punch_datetime: formatDateTime(punchDatetime),
      punch_type: punch_type,
      punch_type_label: formatPunchType(punch_type),
      record_hash: recordHash,
      verification_code: verificationCode,
      rep_p_registration: establishment.rep_p_registration || 'Pendente'
    };

    const { error: receiptError } = await supabase
      .from('punch_receipts')
      .insert({
        punch_record_id: punchRecord.id,
        receipt_content: receiptContent,
        verification_code: verificationCode
      });

    if (receiptError) {
      console.error('Receipt insert error:', receiptError);
    }

    const { error: auditError } = await supabase
      .from('punch_audit_log')
      .insert({
        entity_type: 'punch_record',
        entity_id: punchRecord.id,
        action: 'PUNCH_REGISTERED',
        action_details: {
          nsr,
          punch_type,
          punch_datetime: punchDatetime.toISOString(),
          record_hash: recordHash,
          professional_name: professional.full_name
        },
        user_id: user.id,
        user_email: user.email,
        ip_address: clientIp,
        user_agent: userAgent
      });

    if (auditError) {
      console.error('Audit log error:', auditError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          record_id: punchRecord.id,
          nsr,
          punch_datetime: punchDatetime.toISOString(),
          punch_type,
          punch_type_label: formatPunchType(punch_type),
          professional_name: professional.full_name,
          record_hash: recordHash,
          verification_code: verificationCode,
          receipt: receiptContent
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});