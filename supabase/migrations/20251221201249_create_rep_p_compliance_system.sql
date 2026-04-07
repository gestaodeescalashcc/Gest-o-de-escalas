/*
  # Sistema REP-P - Registro Eletronico de Ponto via Programa
  
  Conformidade com Portaria MTP 671/2021 e CLT Art. 74
  
  ## 1. Novas Tabelas
  
  ### establishments (Estabelecimentos)
    - Cada unidade tem seu proprio NSR sequencial
    - Dados para identificacao no comprovante (CNPJ, endereco)
  
  ### punch_records (Registros de Ponto - IMUTAVEIS)
    - NSR sequencial por estabelecimento
    - Hash encadeado SHA-256 para integridade
    - Sem restricao de horario (Art. 74, I)
    - Sem marcacao automatica (Art. 74, II)
  
  ### punch_receipts (Comprovantes Digitais)
    - Formato PDF assinado eletronicamente
    - Acessivel ao trabalhador (Art. 80)
  
  ### punch_adjustments (Ajustes Administrativos)
    - Nunca altera o registro original
    - Requer justificativa e aprovacao
  
  ### punch_audit_log (Log de Auditoria Append-Only)
    - Registro de todas as operacoes
    - Imutavel (append-only)
*/

-- Tabela de Estabelecimentos
CREATE TABLE IF NOT EXISTS establishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_name text NOT NULL,
  employer_document text NOT NULL,
  employer_document_type text NOT NULL DEFAULT 'CNPJ' CHECK (employer_document_type IN ('CNPJ', 'CPF')),
  cei_caepf_cno text,
  address_street text NOT NULL,
  address_number text,
  address_complement text,
  address_neighborhood text,
  address_city text NOT NULL,
  address_state text NOT NULL,
  address_zip text NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  rep_p_registration text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE establishments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view establishments"
  ON establishments FOR SELECT
  TO authenticated
  USING (active = true);

CREATE POLICY "Admin can manage establishments"
  ON establishments FOR ALL
  TO authenticated
  USING (user_has_permission('settings', 'update'))
  WITH CHECK (user_has_permission('settings', 'update'));

-- Tabela de Sequencias NSR por Estabelecimento
CREATE TABLE IF NOT EXISTS nsr_sequences (
  establishment_id uuid PRIMARY KEY REFERENCES establishments(id),
  current_nsr bigint NOT NULL DEFAULT 0,
  last_updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nsr_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can read NSR sequences"
  ON nsr_sequences FOR SELECT
  TO authenticated
  USING (true);

-- Funcao para obter proximo NSR atomicamente
CREATE OR REPLACE FUNCTION get_next_nsr(p_establishment_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_nsr bigint;
BEGIN
  INSERT INTO nsr_sequences (establishment_id, current_nsr, last_updated_at)
  VALUES (p_establishment_id, 1, now())
  ON CONFLICT (establishment_id) DO UPDATE
  SET current_nsr = nsr_sequences.current_nsr + 1,
      last_updated_at = now()
  RETURNING current_nsr INTO v_nsr;
  
  RETURN v_nsr;
END;
$$;

-- Tabela Principal de Registros de Ponto (IMUTAVEL)
CREATE TABLE IF NOT EXISTS punch_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  nsr bigint NOT NULL,
  establishment_id uuid NOT NULL REFERENCES establishments(id),
  professional_id uuid NOT NULL REFERENCES professionals(id),
  
  punch_type text NOT NULL CHECK (punch_type IN ('ENTRY', 'EXIT', 'MEAL_START', 'MEAL_END')),
  punch_datetime timestamptz NOT NULL,
  server_datetime timestamptz NOT NULL DEFAULT now(),
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  
  is_outside_schedule boolean NOT NULL DEFAULT false,
  schedule_alert text,
  
  device_id text,
  device_type text CHECK (device_type IN ('WEB', 'MOBILE', 'KIOSK', 'API')),
  ip_address inet,
  user_agent text,
  
  latitude numeric(10, 8),
  longitude numeric(11, 8),
  geo_accuracy numeric,
  
  biometric_verification_id uuid,
  biometric_confidence numeric,
  liveness_verified boolean NOT NULL DEFAULT false,
  
  photo_url text,
  photo_hash text,
  
  previous_record_id uuid REFERENCES punch_records(id),
  previous_hash text,
  record_hash text NOT NULL,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE (establishment_id, nsr)
);

CREATE INDEX IF NOT EXISTS idx_punch_records_professional ON punch_records(professional_id);
CREATE INDEX IF NOT EXISTS idx_punch_records_datetime ON punch_records(punch_datetime);
CREATE INDEX IF NOT EXISTS idx_punch_records_establishment ON punch_records(establishment_id);
CREATE INDEX IF NOT EXISTS idx_punch_records_hash ON punch_records(record_hash);

ALTER TABLE punch_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Punch records are immutable - no updates"
  ON punch_records FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "Punch records are immutable - no deletes"
  ON punch_records FOR DELETE
  TO authenticated
  USING (false);

CREATE POLICY "Users can view punch records from allowed departments"
  ON punch_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN professionals p ON p.id = punch_records.professional_id
      WHERE su.id = auth.uid()
        AND su.active = true
        AND (su.allowed_departments IS NULL OR p.department_id = ANY(su.allowed_departments))
    )
  );

CREATE POLICY "Punch records insert allowed"
  ON punch_records FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Tabela de Comprovantes
CREATE TABLE IF NOT EXISTS punch_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  punch_record_id uuid NOT NULL REFERENCES punch_records(id),
  
  receipt_content jsonb NOT NULL,
  
  pdf_url text,
  pdf_hash text,
  signature_type text DEFAULT 'PAdES',
  signed_at timestamptz,
  
  verification_code text NOT NULL UNIQUE,
  verification_url text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  accessed_at timestamptz,
  access_count integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_punch_receipts_record ON punch_receipts(punch_record_id);
CREATE INDEX IF NOT EXISTS idx_punch_receipts_verification ON punch_receipts(verification_code);

ALTER TABLE punch_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view receipts"
  ON punch_receipts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM punch_records pr
      JOIN professionals p ON p.id = pr.professional_id
      JOIN system_users su ON su.id = auth.uid()
      WHERE pr.id = punch_receipts.punch_record_id
        AND su.active = true
        AND (su.allowed_departments IS NULL OR p.department_id = ANY(su.allowed_departments))
    )
  );

CREATE POLICY "Receipts can be inserted"
  ON punch_receipts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Tabela de Ajustes Administrativos
CREATE TABLE IF NOT EXISTS punch_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  original_punch_id uuid REFERENCES punch_records(id),
  professional_id uuid NOT NULL REFERENCES professionals(id),
  establishment_id uuid NOT NULL REFERENCES establishments(id),
  
  adjustment_type text NOT NULL CHECK (adjustment_type IN (
    'INCLUSION', 'DISREGARD', 'PRE_ASSIGNED', 'CORRECTION'
  )),
  
  adjusted_datetime timestamptz,
  adjusted_punch_type text CHECK (adjusted_punch_type IN ('ENTRY', 'EXIT', 'MEAL_START', 'MEAL_END')),
  
  justification text NOT NULL,
  supporting_document_url text,
  
  requested_by uuid NOT NULL REFERENCES system_users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid REFERENCES system_users(id),
  approved_at timestamptz,
  approval_status text NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  rejection_reason text,
  
  adjustment_hash text NOT NULL,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_punch_adjustments_professional ON punch_adjustments(professional_id);
CREATE INDEX IF NOT EXISTS idx_punch_adjustments_status ON punch_adjustments(approval_status);

ALTER TABLE punch_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view adjustments"
  ON punch_adjustments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN professionals p ON p.id = punch_adjustments.professional_id
      WHERE su.id = auth.uid()
        AND su.active = true
        AND (su.allowed_departments IS NULL OR p.department_id = ANY(su.allowed_departments))
    )
  );

CREATE POLICY "Authorized users can create adjustments"
  ON punch_adjustments FOR INSERT
  TO authenticated
  WITH CHECK (user_has_permission('schedules', 'update'));

CREATE POLICY "Authorized users can approve adjustments"
  ON punch_adjustments FOR UPDATE
  TO authenticated
  USING (user_has_permission('schedules', 'update'));

-- Log de Auditoria Append-Only
CREATE TABLE IF NOT EXISTS punch_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  
  action text NOT NULL,
  action_details jsonb,
  
  user_id uuid,
  user_email text,
  ip_address inet,
  user_agent text,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_punch_audit_log_entity ON punch_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_punch_audit_log_created ON punch_audit_log(created_at);

ALTER TABLE punch_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit log is append-only - no updates"
  ON punch_audit_log FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "Audit log is append-only - no deletes"
  ON punch_audit_log FOR DELETE
  TO authenticated
  USING (false);

CREATE POLICY "Authorized users can view audit log"
  ON punch_audit_log FOR SELECT
  TO authenticated
  USING (user_has_permission('settings', 'read'));

CREATE POLICY "System can insert audit log"
  ON punch_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Tabela de Jobs de Exportacao
CREATE TABLE IF NOT EXISTS export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  export_type text NOT NULL CHECK (export_type IN ('AFD', 'AEJ', 'MIRROR', 'CUSTOM')),
  
  establishment_id uuid REFERENCES establishments(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  professional_ids uuid[],
  
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  progress integer DEFAULT 0,
  error_message text,
  
  file_url text,
  file_hash text,
  signature_file_url text,
  
  requested_by uuid NOT NULL REFERENCES system_users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  
  is_fiscal_request boolean NOT NULL DEFAULT false,
  fiscal_protocol text
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status);

ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can manage exports"
  ON export_jobs FOR ALL
  TO authenticated
  USING (user_has_permission('reports', 'read'))
  WITH CHECK (user_has_permission('reports', 'create'));

-- Funcao para calcular hash do registro
CREATE OR REPLACE FUNCTION calculate_punch_hash(
  p_nsr bigint,
  p_establishment_id uuid,
  p_professional_id uuid,
  p_punch_type text,
  p_punch_datetime timestamptz,
  p_previous_hash text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_data text;
BEGIN
  v_data := p_nsr::text || '|' ||
            p_establishment_id::text || '|' ||
            p_professional_id::text || '|' ||
            p_punch_type || '|' ||
            to_char(p_punch_datetime, 'YYYY-MM-DD HH24:MI:SS') || '|' ||
            COALESCE(p_previous_hash, 'GENESIS');
  
  RETURN encode(sha256(v_data::bytea), 'hex');
END;
$$;

-- Adicionar coluna establishment_id aos professionals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'professionals' AND column_name = 'establishment_id'
  ) THEN
    ALTER TABLE professionals ADD COLUMN establishment_id uuid REFERENCES establishments(id);
  END IF;
END $$;

-- Criar estabelecimento padrao
INSERT INTO establishments (
  id,
  employer_name,
  employer_document,
  employer_document_type,
  address_street,
  address_city,
  address_state,
  address_zip
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Empresa Padrao',
  '00.000.000/0001-00',
  'CNPJ',
  'Rua Principal',
  'Salvador',
  'BA',
  '40000-000'
) ON CONFLICT (id) DO NOTHING;

-- Atualizar professionals sem establishment
UPDATE professionals 
SET establishment_id = 'a0000000-0000-0000-0000-000000000001'
WHERE establishment_id IS NULL;
