import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface VerifyRequest {
  establishment_id: string;
  start_date?: string;
  end_date?: string;
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: VerifyRequest = await req.json();
    const { establishment_id, start_date, end_date } = body;

    if (!establishment_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'establishment_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: records, error: recordsError } = await supabase.rpc('get_punch_records_for_verification', {
      p_establishment_id: establishment_id,
      p_start_date: start_date || null,
      p_end_date: end_date || null
    });

    if (recordsError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Error fetching records: ' + recordsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!records || records.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            total_records: 0,
            valid_records: 0,
            invalid_records: 0,
            chain_intact: true,
            issues: []
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const issues: any[] = [];
    let validCount = 0;
    let invalidCount = 0;
    let previousHash: string | null = null;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const punchDateISO = record.punch_datetime_iso;

      const hashData = `${record.nsr}|${record.establishment_id}|${record.professional_id}|${record.punch_type}|${punchDateISO}|${previousHash || 'GENESIS'}`;
      const expectedHash = await sha256(hashData);

      const expectedNsr = i === 0 ? records[0].nsr : records[i - 1].nsr + 1;
      if (record.nsr !== expectedNsr && i > 0) {
        issues.push({
          type: 'NSR_GAP',
          record_id: record.id,
          nsr: record.nsr,
          expected_nsr: expectedNsr,
          message: `Gap detected: expected NSR ${expectedNsr}, found ${record.nsr}`
        });
      }

      if (record.previous_hash !== previousHash && previousHash !== null) {
        issues.push({
          type: 'CHAIN_BROKEN',
          record_id: record.id,
          nsr: record.nsr,
          expected_previous_hash: previousHash,
          actual_previous_hash: record.previous_hash,
          message: `Chain broken at NSR ${record.nsr}: previous_hash mismatch`
        });
        invalidCount++;
      } else if (record.record_hash !== expectedHash) {
        issues.push({
          type: 'HASH_MISMATCH',
          record_id: record.id,
          nsr: record.nsr,
          expected_hash: expectedHash,
          actual_hash: record.record_hash,
          message: `Hash mismatch at NSR ${record.nsr}: record may have been tampered`
        });
        invalidCount++;
      } else {
        validCount++;
      }

      previousHash = record.record_hash;
    }

    const chainIntact = issues.length === 0;

    await supabase
      .from('punch_audit_log')
      .insert({
        entity_type: 'integrity_check',
        entity_id: establishment_id,
        action: 'CHAIN_INTEGRITY_VERIFIED',
        action_details: {
          establishment_id,
          start_date,
          end_date,
          total_records: records.length,
          valid_records: validCount,
          invalid_records: invalidCount,
          chain_intact: chainIntact,
          issues_count: issues.length
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          total_records: records.length,
          valid_records: validCount,
          invalid_records: invalidCount,
          chain_intact: chainIntact,
          first_nsr: records[0]?.nsr,
          last_nsr: records[records.length - 1]?.nsr,
          issues: issues.slice(0, 100)
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