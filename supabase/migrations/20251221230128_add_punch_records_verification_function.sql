/*
  # Add function to get punch records for verification
  
  1. New Functions
    - `get_punch_records_for_verification` - Returns punch records with ISO formatted datetime
    
  2. Purpose
    - Ensures the punch_datetime is returned in the exact ISO 8601 format
    - Used by the verify-chain-integrity edge function to recalculate hashes correctly
*/

CREATE OR REPLACE FUNCTION get_punch_records_for_verification(
  p_establishment_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  nsr BIGINT,
  establishment_id UUID,
  professional_id UUID,
  punch_type TEXT,
  punch_datetime TIMESTAMPTZ,
  punch_datetime_iso TEXT,
  previous_hash TEXT,
  record_hash TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pr.id,
    pr.nsr,
    pr.establishment_id,
    pr.professional_id,
    pr.punch_type,
    pr.punch_datetime,
    to_char(pr.punch_datetime AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as punch_datetime_iso,
    pr.previous_hash,
    pr.record_hash
  FROM punch_records pr
  WHERE pr.establishment_id = p_establishment_id
    AND (p_start_date IS NULL OR pr.punch_datetime >= p_start_date::timestamp)
    AND (p_end_date IS NULL OR pr.punch_datetime <= (p_end_date + interval '1 day')::timestamp)
  ORDER BY pr.nsr ASC;
END;
$$;