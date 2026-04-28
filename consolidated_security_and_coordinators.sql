-- =============================================================================
-- SCRIPT CONSOLIDADO: SEGURANÇA + NOVOS COORDENADORES
-- Sistema de Gestão de Escalas - HECC/FESF-SUS
-- Gerado em: 2026-04-14
--
-- Este script adiciona tudo que falta ao banco após o database_export.sql:
-- 1. Funções auxiliares (user_has_permission, audit, etc.)
-- 2. ENABLE RLS em todas as tabelas
-- 3. Políticas RLS de segurança
-- 4. Indexes de performance
-- 5. Triggers
-- 6. Atualização de permissões dos roles
-- 7. Criação dos 6 novos coordenadores
--
-- SEGURO PARA RODAR MÚLTIPLAS VEZES (idempotente)
-- =============================================================================

-- =============================================================================
-- PARTE 0: FUNÇÕES AUXILIARES (pré-requisito para as policies)
-- =============================================================================

-- Função principal de verificação de permissões
-- Usada por TODAS as policies RLS para verificar se o usuário tem acesso
DROP FUNCTION IF EXISTS user_has_permission(text, text);
CREATE OR REPLACE FUNCTION user_has_permission(p_module text, p_action text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM system_users su
    JOIN user_roles ur ON su.role_id = ur.id
    WHERE su.id = auth.uid()
      AND su.active = true
      AND (ur.permissions -> p_module ->> p_action)::boolean = true
  );
END;
$$;

-- Função para detectar campos alterados (usada pelo audit trigger)
CREATE OR REPLACE FUNCTION get_changed_fields(old_data jsonb, new_data jsonb)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  changed text[] := '{}';
  key text;
BEGIN
  IF old_data IS NULL OR new_data IS NULL THEN
    RETURN changed;
  END IF;
  FOR key IN SELECT jsonb_object_keys(new_data)
  LOOP
    IF old_data->key IS DISTINCT FROM new_data->key THEN
      changed := array_append(changed, key);
    END IF;
  END LOOP;
  RETURN changed;
END;
$$;

-- Função para gerar descrição legível da auditoria
CREATE OR REPLACE FUNCTION generate_audit_description(
  p_table_name text,
  p_operation text,
  p_old_data jsonb,
  p_new_data jsonb,
  p_changed_fields text[]
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  description text;
  record_name text;
BEGIN
  -- Tentar extrair um nome legível do registro
  record_name := COALESCE(
    p_new_data->>'full_name',
    p_new_data->>'name',
    p_new_data->>'email',
    p_old_data->>'full_name',
    p_old_data->>'name',
    p_old_data->>'email',
    'registro'
  );

  CASE p_operation
    WHEN 'INSERT' THEN
      description := format('%s criado: %s', p_table_name, record_name);
    WHEN 'UPDATE' THEN
      description := format('%s atualizado: %s (campos: %s)',
        p_table_name, record_name, array_to_string(p_changed_fields, ', '));
    WHEN 'DELETE' THEN
      description := format('%s removido: %s', p_table_name, record_name);
    ELSE
      description := format('%s: %s em %s', p_operation, record_name, p_table_name);
  END CASE;

  RETURN description;
END;
$$;

-- Função update_updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para calcular total de refeições
CREATE OR REPLACE FUNCTION calculate_total_meals()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_meals :=
    (CASE WHEN NEW.has_breakfast THEN 1 ELSE 0 END) +
    (CASE WHEN NEW.has_lunch THEN 1 ELSE 0 END) +
    (CASE WHEN NEW.has_dinner THEN 1 ELSE 0 END) +
    (CASE WHEN NEW.has_supper THEN 1 ELSE 0 END);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função de auditoria com suporte a service_role
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_data_json jsonb;
  new_data_json jsonb;
  changed_fields text[];
  description text;
  current_user_email text;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NOT NULL THEN
    BEGIN
      SELECT email INTO current_user_email
      FROM auth.users
      WHERE id = current_user_id;
    EXCEPTION WHEN OTHERS THEN
      current_user_email := NULL;
    END;
  ELSE
    current_user_email := 'system@service_role';
  END IF;

  IF (TG_OP = 'DELETE') THEN
    old_data_json := row_to_json(OLD)::jsonb;
    new_data_json := NULL;
    changed_fields := '{}';
  ELSIF (TG_OP = 'INSERT') THEN
    old_data_json := NULL;
    new_data_json := row_to_json(NEW)::jsonb;
    changed_fields := '{}';
  ELSIF (TG_OP = 'UPDATE') THEN
    old_data_json := row_to_json(OLD)::jsonb;
    new_data_json := row_to_json(NEW)::jsonb;
    changed_fields := get_changed_fields(old_data_json, new_data_json);
  END IF;

  description := generate_audit_description(
    TG_TABLE_NAME,
    TG_OP,
    old_data_json,
    new_data_json,
    changed_fields
  );

  BEGIN
    INSERT INTO audit_logs (
      table_name, record_id, action, old_data, new_data,
      changed_fields, user_id, user_email, description
    ) VALUES (
      TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), TG_OP,
      old_data_json, new_data_json, changed_fields,
      current_user_id, current_user_email, description
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Falha ao inserir log de auditoria: %', SQLERRM;
  END;

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Funções do sistema REP-P
CREATE OR REPLACE FUNCTION get_next_nsr(p_establishment_id uuid)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  next_val bigint;
BEGIN
  INSERT INTO nsr_sequences (establishment_id, last_nsr)
  VALUES (p_establishment_id, 1)
  ON CONFLICT (establishment_id) DO UPDATE
  SET last_nsr = nsr_sequences.last_nsr + 1,
      updated_at = now()
  RETURNING last_nsr INTO next_val;
  RETURN next_val;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_punch_hash(
  p_nsr bigint,
  p_punch_datetime timestamptz,
  p_punch_type text,
  p_professional_id uuid,
  p_previous_hash text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  hash_input text;
BEGIN
  hash_input := COALESCE(p_previous_hash, '') || '|' ||
    p_nsr::text || '|' ||
    to_char(p_punch_datetime, 'YYYY-MM-DD HH24:MI:SS') || '|' ||
    p_punch_type || '|' ||
    p_professional_id::text;
  RETURN encode(digest(hash_input, 'sha256'), 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION get_punch_records_for_verification(
  p_establishment_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_professional_id uuid DEFAULT NULL
)
RETURNS TABLE (
  nsr bigint,
  punch_datetime text,
  punch_type text,
  professional_name text,
  pis_number text,
  record_hash text,
  is_online boolean
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.nsr,
    to_char(pr.punch_datetime AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI:SS') as punch_datetime,
    pr.punch_type,
    p.full_name as professional_name,
    p.pis_number,
    pr.record_hash,
    pr.is_online
  FROM punch_records pr
  JOIN professionals p ON pr.professional_id = p.id
  WHERE (p_establishment_id IS NULL OR pr.establishment_id = p_establishment_id)
    AND (p_start_date IS NULL OR pr.punch_datetime::date >= p_start_date)
    AND (p_end_date IS NULL OR pr.punch_datetime::date <= p_end_date)
    AND (p_professional_id IS NULL OR pr.professional_id = p_professional_id)
  ORDER BY pr.nsr ASC;
END;
$$;

-- =============================================================================
-- PARTE 1: ENABLE ROW LEVEL SECURITY EM TODAS AS TABELAS
-- =============================================================================

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_facial_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_category_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE nsr_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE punch_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE punch_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE punch_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE punch_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE hour_bank_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE hour_bank_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE hour_bank_compensations ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PARTE 2: LIMPAR TODAS AS POLICIES EXISTENTES (garantir estado limpo)
-- =============================================================================

-- departments
DROP POLICY IF EXISTS "Usuários autenticados podem ver departamentos" ON departments;
DROP POLICY IF EXISTS "Usuários autenticados podem criar departamentos" ON departments;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar departamentos" ON departments;
DROP POLICY IF EXISTS "Authorized users can view departments" ON departments;
DROP POLICY IF EXISTS "Authorized users can create departments" ON departments;
DROP POLICY IF EXISTS "Authorized users can update departments" ON departments;
DROP POLICY IF EXISTS "Authorized users can delete departments" ON departments;
DROP POLICY IF EXISTS "All authenticated users can view departments" ON departments;

-- professional_categories
DROP POLICY IF EXISTS "Usuários autenticados podem ver categorias" ON professional_categories;
DROP POLICY IF EXISTS "Usuários autenticados podem criar categorias" ON professional_categories;
DROP POLICY IF EXISTS "Authorized users can view categories" ON professional_categories;
DROP POLICY IF EXISTS "Authorized users can create categories" ON professional_categories;
DROP POLICY IF EXISTS "Authorized users can update categories" ON professional_categories;
DROP POLICY IF EXISTS "Authorized users can delete categories" ON professional_categories;
DROP POLICY IF EXISTS "All authenticated users can view categories" ON professional_categories;

-- professionals
DROP POLICY IF EXISTS "Usuários autenticados podem ver profissionais" ON professionals;
DROP POLICY IF EXISTS "Usuários autenticados podem criar profissionais" ON professionals;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar profissionais" ON professionals;
DROP POLICY IF EXISTS "Authorized users can view professionals" ON professionals;
DROP POLICY IF EXISTS "Authorized users can create professionals" ON professionals;
DROP POLICY IF EXISTS "Authorized users can update professionals" ON professionals;
DROP POLICY IF EXISTS "Authorized users can delete professionals" ON professionals;
DROP POLICY IF EXISTS "Permission required to view professionals" ON professionals;
DROP POLICY IF EXISTS "Permission required to create professionals" ON professionals;
DROP POLICY IF EXISTS "Permission required to update professionals" ON professionals;
DROP POLICY IF EXISTS "Permission required to delete professionals" ON professionals;
DROP POLICY IF EXISTS "Users can only access professionals from their departments" ON professionals;
DROP POLICY IF EXISTS "Users can only create professionals in their departments" ON professionals;
DROP POLICY IF EXISTS "Users can only update professionals in their departments" ON professionals;
DROP POLICY IF EXISTS "Users can only delete professionals in their departments" ON professionals;
DROP POLICY IF EXISTS "professionals_select_policy" ON professionals;
DROP POLICY IF EXISTS "professionals_insert_policy" ON professionals;
DROP POLICY IF EXISTS "professionals_update_policy" ON professionals;
DROP POLICY IF EXISTS "professionals_delete_policy" ON professionals;

-- shifts
DROP POLICY IF EXISTS "Usuários autenticados podem ver plantões" ON shifts;
DROP POLICY IF EXISTS "Usuários autenticados podem criar plantões" ON shifts;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar plantões" ON shifts;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar plantões" ON shifts;
DROP POLICY IF EXISTS "Authorized users can view shifts" ON shifts;
DROP POLICY IF EXISTS "Authorized users can create shifts" ON shifts;
DROP POLICY IF EXISTS "Authorized users can update shifts" ON shifts;
DROP POLICY IF EXISTS "Authorized users can delete shifts" ON shifts;
DROP POLICY IF EXISTS "Permission required to view shifts" ON shifts;
DROP POLICY IF EXISTS "Permission required to create shifts" ON shifts;
DROP POLICY IF EXISTS "Permission required to update shifts" ON shifts;
DROP POLICY IF EXISTS "Permission required to delete shifts" ON shifts;
DROP POLICY IF EXISTS "Users can only access shifts from their allowed departments" ON shifts;
DROP POLICY IF EXISTS "Users can only create shifts in their allowed departments" ON shifts;
DROP POLICY IF EXISTS "Users can only update shifts in their allowed departments" ON shifts;
DROP POLICY IF EXISTS "Users can only delete shifts in their allowed departments" ON shifts;

-- shift_swaps
DROP POLICY IF EXISTS "Usuários autenticados podem ver trocas" ON shift_swaps;
DROP POLICY IF EXISTS "Usuários autenticados podem criar trocas" ON shift_swaps;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar trocas" ON shift_swaps;
DROP POLICY IF EXISTS "Usuários autenticados podem ver trocas de plantões" ON shift_swaps;
DROP POLICY IF EXISTS "Usuários autenticados podem criar trocas de plantões" ON shift_swaps;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar trocas de plantões" ON shift_swaps;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar trocas de plantões" ON shift_swaps;
DROP POLICY IF EXISTS "Authorized users can view swaps" ON shift_swaps;
DROP POLICY IF EXISTS "Authorized users can create swaps" ON shift_swaps;
DROP POLICY IF EXISTS "Authorized users can update swaps" ON shift_swaps;
DROP POLICY IF EXISTS "Authorized users can delete swaps" ON shift_swaps;
DROP POLICY IF EXISTS "Permission required to view swaps" ON shift_swaps;
DROP POLICY IF EXISTS "Permission required to create swaps" ON shift_swaps;
DROP POLICY IF EXISTS "Permission required to update swaps" ON shift_swaps;
DROP POLICY IF EXISTS "Permission required to delete swaps" ON shift_swaps;
DROP POLICY IF EXISTS "swap_dept_select" ON shift_swaps;
DROP POLICY IF EXISTS "swap_dept_insert" ON shift_swaps;
DROP POLICY IF EXISTS "swap_dept_update" ON shift_swaps;
DROP POLICY IF EXISTS "swap_dept_delete" ON shift_swaps;

-- shift_history
DROP POLICY IF EXISTS "Usuários autenticados podem ver histórico" ON shift_history;
DROP POLICY IF EXISTS "Usuários autenticados podem criar histórico" ON shift_history;
DROP POLICY IF EXISTS "Authorized users can view shift history" ON shift_history;
DROP POLICY IF EXISTS "System can insert shift history" ON shift_history;
DROP POLICY IF EXISTS "Permission required to view shift history" ON shift_history;
DROP POLICY IF EXISTS "shift_history_dept_select" ON shift_history;

-- monthly_schedules
DROP POLICY IF EXISTS "Users can view monthly schedules" ON monthly_schedules;
DROP POLICY IF EXISTS "Users can create monthly schedules" ON monthly_schedules;
DROP POLICY IF EXISTS "Users can update monthly schedules" ON monthly_schedules;
DROP POLICY IF EXISTS "Users can delete monthly schedules" ON monthly_schedules;
DROP POLICY IF EXISTS "Authorized users can view monthly schedules" ON monthly_schedules;
DROP POLICY IF EXISTS "Authorized users can create monthly schedules" ON monthly_schedules;
DROP POLICY IF EXISTS "Authorized users can update monthly schedules" ON monthly_schedules;
DROP POLICY IF EXISTS "Authorized users can delete monthly schedules" ON monthly_schedules;
DROP POLICY IF EXISTS "Permission required to view monthly schedules" ON monthly_schedules;
DROP POLICY IF EXISTS "Permission required to create monthly schedules" ON monthly_schedules;
DROP POLICY IF EXISTS "Permission required to update monthly schedules" ON monthly_schedules;
DROP POLICY IF EXISTS "Permission required to delete monthly schedules" ON monthly_schedules;
DROP POLICY IF EXISTS "Users can only access monthly schedules from their departments" ON monthly_schedules;
DROP POLICY IF EXISTS "Users can only create monthly schedules in their departments" ON monthly_schedules;
DROP POLICY IF EXISTS "Users can only update monthly schedules in their departments" ON monthly_schedules;
DROP POLICY IF EXISTS "Users can only delete monthly schedules in their departments" ON monthly_schedules;

-- user_roles
DROP POLICY IF EXISTS "Authenticated users can read roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON user_roles;

-- system_users
DROP POLICY IF EXISTS "Users can view own data" ON system_users;
DROP POLICY IF EXISTS "Users with permission can view all" ON system_users;
DROP POLICY IF EXISTS "Authorized users can create users" ON system_users;
DROP POLICY IF EXISTS "authorized_create_users" ON system_users;
DROP POLICY IF EXISTS "service_role_and_authorized_can_create_users" ON system_users;
DROP POLICY IF EXISTS "service_role_can_insert" ON system_users;
DROP POLICY IF EXISTS "authorized_users_can_insert" ON system_users;
DROP POLICY IF EXISTS "Authorized users can update users" ON system_users;
DROP POLICY IF EXISTS "Authorized users can delete users" ON system_users;

-- companies
DROP POLICY IF EXISTS "Users can view companies" ON companies;
DROP POLICY IF EXISTS "Users can insert companies" ON companies;
DROP POLICY IF EXISTS "Users can update companies" ON companies;
DROP POLICY IF EXISTS "Users can delete companies" ON companies;
DROP POLICY IF EXISTS "Authorized users can view companies" ON companies;
DROP POLICY IF EXISTS "Authorized users can create companies" ON companies;
DROP POLICY IF EXISTS "Authorized users can update companies" ON companies;
DROP POLICY IF EXISTS "Authorized users can delete companies" ON companies;
DROP POLICY IF EXISTS "All authenticated users can view companies" ON companies;

-- professional_facial_data
DROP POLICY IF EXISTS "Users can view facial data" ON professional_facial_data;
DROP POLICY IF EXISTS "Users can insert facial data" ON professional_facial_data;
DROP POLICY IF EXISTS "Users can update facial data" ON professional_facial_data;
DROP POLICY IF EXISTS "Users can delete facial data" ON professional_facial_data;
DROP POLICY IF EXISTS "Authorized users can view facial data" ON professional_facial_data;
DROP POLICY IF EXISTS "Authorized users can create facial data" ON professional_facial_data;
DROP POLICY IF EXISTS "Authorized users can update facial data" ON professional_facial_data;
DROP POLICY IF EXISTS "Authorized users can delete facial data" ON professional_facial_data;
DROP POLICY IF EXISTS "Permission required to view facial data" ON professional_facial_data;
DROP POLICY IF EXISTS "facial_dept_select" ON professional_facial_data;
DROP POLICY IF EXISTS "facial_dept_insert" ON professional_facial_data;
DROP POLICY IF EXISTS "facial_dept_update" ON professional_facial_data;
DROP POLICY IF EXISTS "facial_dept_delete" ON professional_facial_data;
DROP POLICY IF EXISTS "Authenticated users can view facial data" ON professional_facial_data;

-- timesheet_records
DROP POLICY IF EXISTS "Users can view timesheet records" ON timesheet_records;
DROP POLICY IF EXISTS "Users can insert timesheet records" ON timesheet_records;
DROP POLICY IF EXISTS "Users can update timesheet records" ON timesheet_records;
DROP POLICY IF EXISTS "Users can delete timesheet records" ON timesheet_records;
DROP POLICY IF EXISTS "Authorized users can view timesheet" ON timesheet_records;
DROP POLICY IF EXISTS "Authorized users can create timesheet" ON timesheet_records;
DROP POLICY IF EXISTS "Authorized users can update timesheet" ON timesheet_records;
DROP POLICY IF EXISTS "Authorized users can delete timesheet" ON timesheet_records;
DROP POLICY IF EXISTS "Permission required to view timesheet" ON timesheet_records;
DROP POLICY IF EXISTS "timesheet_dept_select" ON timesheet_records;
DROP POLICY IF EXISTS "timesheet_dept_insert" ON timesheet_records;
DROP POLICY IF EXISTS "timesheet_dept_update" ON timesheet_records;
DROP POLICY IF EXISTS "timesheet_dept_delete" ON timesheet_records;

-- meal_category_config
DROP POLICY IF EXISTS "Users can view meal category config" ON meal_category_config;
DROP POLICY IF EXISTS "Users can create meal category config" ON meal_category_config;
DROP POLICY IF EXISTS "Users can update meal category config" ON meal_category_config;
DROP POLICY IF EXISTS "Users can delete meal category config" ON meal_category_config;
DROP POLICY IF EXISTS "Authorized users can view meal config" ON meal_category_config;
DROP POLICY IF EXISTS "Authorized users can create meal config" ON meal_category_config;
DROP POLICY IF EXISTS "Authorized users can update meal config" ON meal_category_config;
DROP POLICY IF EXISTS "Authorized users can delete meal config" ON meal_category_config;
DROP POLICY IF EXISTS "meal_config_restrictive_select" ON meal_category_config;
DROP POLICY IF EXISTS "meal_config_restrictive_insert" ON meal_category_config;
DROP POLICY IF EXISTS "meal_config_restrictive_update" ON meal_category_config;
DROP POLICY IF EXISTS "meal_config_restrictive_delete" ON meal_category_config;
DROP POLICY IF EXISTS "meal_config_permissive_select" ON meal_category_config;
DROP POLICY IF EXISTS "meal_config_permissive_insert" ON meal_category_config;
DROP POLICY IF EXISTS "meal_config_permissive_update" ON meal_category_config;
DROP POLICY IF EXISTS "meal_config_permissive_delete" ON meal_category_config;

-- meal_schedules
DROP POLICY IF EXISTS "Users can view meal schedules" ON meal_schedules;
DROP POLICY IF EXISTS "Users can create meal schedules" ON meal_schedules;
DROP POLICY IF EXISTS "Users can update meal schedules" ON meal_schedules;
DROP POLICY IF EXISTS "Users can delete meal schedules" ON meal_schedules;
DROP POLICY IF EXISTS "Authorized users can view meal schedules" ON meal_schedules;
DROP POLICY IF EXISTS "Authorized users can create meal schedules" ON meal_schedules;
DROP POLICY IF EXISTS "Authorized users can update meal schedules" ON meal_schedules;
DROP POLICY IF EXISTS "Authorized users can delete meal schedules" ON meal_schedules;
DROP POLICY IF EXISTS "meal_schedule_restrictive_select" ON meal_schedules;
DROP POLICY IF EXISTS "meal_schedule_restrictive_insert" ON meal_schedules;
DROP POLICY IF EXISTS "meal_schedule_restrictive_update" ON meal_schedules;
DROP POLICY IF EXISTS "meal_schedule_restrictive_delete" ON meal_schedules;
DROP POLICY IF EXISTS "meal_schedule_dept_select" ON meal_schedules;
DROP POLICY IF EXISTS "meal_schedule_dept_insert" ON meal_schedules;
DROP POLICY IF EXISTS "meal_schedule_dept_update" ON meal_schedules;
DROP POLICY IF EXISTS "meal_schedule_dept_delete" ON meal_schedules;

-- audit_logs
DROP POLICY IF EXISTS "authenticated_read_audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
DROP POLICY IF EXISTS "only_trigger_can_insert_audit_logs" ON audit_logs;

-- punch/REP-P tables
DROP POLICY IF EXISTS "Authenticated users can view establishments" ON establishments;
DROP POLICY IF EXISTS "Admins can manage establishments" ON establishments;
DROP POLICY IF EXISTS "Service role can manage nsr" ON nsr_sequences;
DROP POLICY IF EXISTS "Admins can view nsr" ON nsr_sequences;
DROP POLICY IF EXISTS "Authenticated users can view punch records" ON punch_records;
DROP POLICY IF EXISTS "Authorized users can insert punch records" ON punch_records;
DROP POLICY IF EXISTS "Authenticated users can view receipts" ON punch_receipts;
DROP POLICY IF EXISTS "System can insert receipts" ON punch_receipts;
DROP POLICY IF EXISTS "Authenticated users can view adjustments" ON punch_adjustments;
DROP POLICY IF EXISTS "Authorized users can create adjustments" ON punch_adjustments;
DROP POLICY IF EXISTS "Authorized users can update adjustments" ON punch_adjustments;
DROP POLICY IF EXISTS "Authenticated users can view punch audit" ON punch_audit_log;
DROP POLICY IF EXISTS "System can insert punch audit" ON punch_audit_log;
DROP POLICY IF EXISTS "Authenticated users can view export jobs" ON export_jobs;
DROP POLICY IF EXISTS "Authorized users can manage export jobs" ON export_jobs;

-- hour_bank tables
DROP POLICY IF EXISTS "hour_bank_config_select" ON hour_bank_config;
DROP POLICY IF EXISTS "hour_bank_config_insert" ON hour_bank_config;
DROP POLICY IF EXISTS "hour_bank_config_update" ON hour_bank_config;
DROP POLICY IF EXISTS "hour_bank_config_delete" ON hour_bank_config;
DROP POLICY IF EXISTS "hour_bank_entries_select" ON hour_bank_entries;
DROP POLICY IF EXISTS "hour_bank_entries_select_auth" ON hour_bank_entries;
DROP POLICY IF EXISTS "hour_bank_entries_insert" ON hour_bank_entries;
DROP POLICY IF EXISTS "hour_bank_entries_update" ON hour_bank_entries;
DROP POLICY IF EXISTS "hour_bank_entries_delete" ON hour_bank_entries;
DROP POLICY IF EXISTS "hour_bank_compensations_select" ON hour_bank_compensations;
DROP POLICY IF EXISTS "hour_bank_compensations_select_auth" ON hour_bank_compensations;
DROP POLICY IF EXISTS "hour_bank_compensations_insert" ON hour_bank_compensations;
DROP POLICY IF EXISTS "hour_bank_compensations_update" ON hour_bank_compensations;
DROP POLICY IF EXISTS "hour_bank_compensations_delete" ON hour_bank_compensations;

-- =============================================================================
-- PARTE 3: CRIAR POLICIES FINAIS (estado desejado)
-- =============================================================================

-- ===================== USER_ROLES =====================
CREATE POLICY "Authenticated users can read roles"
  ON user_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage roles"
  ON user_roles FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN user_roles ur ON su.role_id = ur.id
      WHERE su.id = auth.uid() AND su.active = true
      AND (ur.permissions->>'users')::jsonb->>'update' = 'true'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN user_roles ur ON su.role_id = ur.id
      WHERE su.id = auth.uid() AND su.active = true
      AND (ur.permissions->>'users')::jsonb->>'update' = 'true'
    )
  );

-- ===================== SYSTEM_USERS =====================
CREATE POLICY "Users can view own data"
  ON system_users FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users with permission can view all"
  ON system_users FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN user_roles ur ON su.role_id = ur.id
      WHERE su.id = auth.uid() AND su.active = true
      AND (ur.permissions->>'users')::jsonb->>'read' = 'true'
    )
  );

CREATE POLICY "service_role_can_insert"
  ON system_users FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "authorized_users_can_insert"
  ON system_users FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN user_roles ur ON su.role_id = ur.id
      WHERE su.id = auth.uid() AND su.active = true
      AND ((ur.permissions->'users'->>'create')::boolean = true)
    )
  );

CREATE POLICY "Authorized users can update users"
  ON system_users FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN user_roles ur ON su.role_id = ur.id
      WHERE su.id = auth.uid() AND su.active = true
      AND (ur.permissions->>'users')::jsonb->>'update' = 'true'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN user_roles ur ON su.role_id = ur.id
      WHERE su.id = auth.uid() AND su.active = true
      AND (ur.permissions->>'users')::jsonb->>'update' = 'true'
    )
  );

CREATE POLICY "Authorized users can delete users"
  ON system_users FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN user_roles ur ON su.role_id = ur.id
      WHERE su.id = auth.uid() AND su.active = true
      AND (ur.permissions->>'users')::jsonb->>'delete' = 'true'
    )
  );

-- ===================== DEPARTMENTS =====================
-- SELECT aberto (usado em JOINs por todos)
CREATE POLICY "All authenticated users can view departments"
  ON departments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized users can create departments"
  ON departments FOR INSERT TO authenticated
  WITH CHECK (user_has_permission('departments', 'create'));

CREATE POLICY "Authorized users can update departments"
  ON departments FOR UPDATE TO authenticated
  USING (user_has_permission('departments', 'update'))
  WITH CHECK (user_has_permission('departments', 'update'));

CREATE POLICY "Authorized users can delete departments"
  ON departments FOR DELETE TO authenticated
  USING (user_has_permission('departments', 'delete'));

-- ===================== PROFESSIONAL_CATEGORIES =====================
CREATE POLICY "All authenticated users can view categories"
  ON professional_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized users can create categories"
  ON professional_categories FOR INSERT TO authenticated
  WITH CHECK (user_has_permission('professional_categories', 'create'));

CREATE POLICY "Authorized users can update categories"
  ON professional_categories FOR UPDATE TO authenticated
  USING (user_has_permission('professional_categories', 'update'))
  WITH CHECK (user_has_permission('professional_categories', 'update'));

CREATE POLICY "Authorized users can delete categories"
  ON professional_categories FOR DELETE TO authenticated
  USING (user_has_permission('professional_categories', 'delete'));

-- ===================== COMPANIES =====================
CREATE POLICY "All authenticated users can view companies"
  ON companies FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authorized users can create companies"
  ON companies FOR INSERT TO authenticated
  WITH CHECK (user_has_permission('companies', 'create'));

CREATE POLICY "Authorized users can update companies"
  ON companies FOR UPDATE TO authenticated
  USING (user_has_permission('companies', 'update'))
  WITH CHECK (user_has_permission('companies', 'update'));

CREATE POLICY "Authorized users can delete companies"
  ON companies FOR DELETE TO authenticated
  USING (user_has_permission('companies', 'delete'));

-- ===================== PROFESSIONALS (RESTRICTIVE + PERMISSIVE) =====================
-- Final state: unified policies checking both permission AND department
CREATE POLICY "professionals_select_policy"
  ON professionals FOR SELECT TO authenticated
  USING (
    user_has_permission('professionals', 'read')
    AND (
      EXISTS (
        SELECT 1 FROM system_users
        WHERE system_users.id = auth.uid() AND system_users.active = true
        AND (system_users.allowed_departments IS NULL
             OR professionals.department_id = ANY(system_users.allowed_departments))
      )
    )
  );

CREATE POLICY "professionals_insert_policy"
  ON professionals FOR INSERT TO authenticated
  WITH CHECK (
    user_has_permission('professionals', 'create')
    AND (
      EXISTS (
        SELECT 1 FROM system_users
        WHERE system_users.id = auth.uid() AND system_users.active = true
        AND (system_users.allowed_departments IS NULL
             OR professionals.department_id = ANY(system_users.allowed_departments))
      )
    )
  );

CREATE POLICY "professionals_update_policy"
  ON professionals FOR UPDATE TO authenticated
  USING (
    user_has_permission('professionals', 'update')
    AND (
      EXISTS (
        SELECT 1 FROM system_users
        WHERE system_users.id = auth.uid() AND system_users.active = true
        AND (system_users.allowed_departments IS NULL
             OR professionals.department_id = ANY(system_users.allowed_departments))
      )
    )
  )
  WITH CHECK (
    user_has_permission('professionals', 'update')
    AND (
      EXISTS (
        SELECT 1 FROM system_users
        WHERE system_users.id = auth.uid() AND system_users.active = true
        AND (system_users.allowed_departments IS NULL
             OR professionals.department_id = ANY(system_users.allowed_departments))
      )
    )
  );

CREATE POLICY "professionals_delete_policy"
  ON professionals FOR DELETE TO authenticated
  USING (
    user_has_permission('professionals', 'delete')
    AND (
      EXISTS (
        SELECT 1 FROM system_users
        WHERE system_users.id = auth.uid() AND system_users.active = true
        AND (system_users.allowed_departments IS NULL
             OR professionals.department_id = ANY(system_users.allowed_departments))
      )
    )
  );

-- ===================== SHIFTS (RESTRICTIVE permission + PERMISSIVE department) =====================
CREATE POLICY "Permission required to view shifts"
  ON shifts AS RESTRICTIVE FOR SELECT TO authenticated
  USING (user_has_permission('schedules', 'read'));

CREATE POLICY "Permission required to create shifts"
  ON shifts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (user_has_permission('schedules', 'create'));

CREATE POLICY "Permission required to update shifts"
  ON shifts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (user_has_permission('schedules', 'update'))
  WITH CHECK (user_has_permission('schedules', 'update'));

CREATE POLICY "Permission required to delete shifts"
  ON shifts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (user_has_permission('schedules', 'delete'));

-- PERMISSIVE department check for shifts
CREATE POLICY "Users can only access shifts from their allowed departments"
  ON shifts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid() AND system_users.active = true
      AND (system_users.allowed_departments IS NULL
           OR shifts.department_id = ANY(system_users.allowed_departments))
    )
  );

CREATE POLICY "Users can only create shifts in their allowed departments"
  ON shifts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid() AND system_users.active = true
      AND (system_users.allowed_departments IS NULL
           OR shifts.department_id = ANY(system_users.allowed_departments))
    )
  );

CREATE POLICY "Users can only update shifts in their allowed departments"
  ON shifts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid() AND system_users.active = true
      AND (system_users.allowed_departments IS NULL
           OR shifts.department_id = ANY(system_users.allowed_departments))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid() AND system_users.active = true
      AND (system_users.allowed_departments IS NULL
           OR shifts.department_id = ANY(system_users.allowed_departments))
    )
  );

CREATE POLICY "Users can only delete shifts in their allowed departments"
  ON shifts FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid() AND system_users.active = true
      AND (system_users.allowed_departments IS NULL
           OR shifts.department_id = ANY(system_users.allowed_departments))
    )
  );

-- ===================== SHIFT_SWAPS (RESTRICTIVE + PERMISSIVE via shift department) =====================
CREATE POLICY "Permission required to view swaps"
  ON shift_swaps AS RESTRICTIVE FOR SELECT TO authenticated
  USING (user_has_permission('swaps', 'read'));

CREATE POLICY "Permission required to create swaps"
  ON shift_swaps AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (user_has_permission('swaps', 'create'));

CREATE POLICY "Permission required to update swaps"
  ON shift_swaps AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (user_has_permission('swaps', 'update'))
  WITH CHECK (user_has_permission('swaps', 'update'));

CREATE POLICY "Permission required to delete swaps"
  ON shift_swaps AS RESTRICTIVE FOR DELETE TO authenticated
  USING (user_has_permission('swaps', 'delete'));

CREATE POLICY "swap_dept_select"
  ON shift_swaps FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shifts s
      JOIN system_users su ON su.id = auth.uid()
      WHERE s.id = shift_swaps.original_shift_id
      AND su.active = true
      AND (su.allowed_departments IS NULL OR s.department_id = ANY(su.allowed_departments))
    )
  );

CREATE POLICY "swap_dept_insert"
  ON shift_swaps FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shifts s
      JOIN system_users su ON su.id = auth.uid()
      WHERE s.id = shift_swaps.original_shift_id
      AND su.active = true
      AND (su.allowed_departments IS NULL OR s.department_id = ANY(su.allowed_departments))
    )
  );

CREATE POLICY "swap_dept_update"
  ON shift_swaps FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shifts s
      JOIN system_users su ON su.id = auth.uid()
      WHERE s.id = shift_swaps.original_shift_id
      AND su.active = true
      AND (su.allowed_departments IS NULL OR s.department_id = ANY(su.allowed_departments))
    )
  );

CREATE POLICY "swap_dept_delete"
  ON shift_swaps FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shifts s
      JOIN system_users su ON su.id = auth.uid()
      WHERE s.id = shift_swaps.original_shift_id
      AND su.active = true
      AND (su.allowed_departments IS NULL OR s.department_id = ANY(su.allowed_departments))
    )
  );

-- ===================== SHIFT_HISTORY (RESTRICTIVE + PERMISSIVE) =====================
CREATE POLICY "Permission required to view shift history"
  ON shift_history AS RESTRICTIVE FOR SELECT TO authenticated
  USING (user_has_permission('schedules', 'read'));

CREATE POLICY "System can insert shift history"
  ON shift_history FOR INSERT TO authenticated
  WITH CHECK (user_has_permission('schedules', 'create'));

CREATE POLICY "shift_history_dept_select"
  ON shift_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shifts s
      JOIN system_users su ON su.id = auth.uid()
      WHERE s.id = shift_history.shift_id
      AND su.active = true
      AND (su.allowed_departments IS NULL OR s.department_id = ANY(su.allowed_departments))
    )
  );

-- ===================== MONTHLY_SCHEDULES (RESTRICTIVE + PERMISSIVE) =====================
CREATE POLICY "Permission required to view monthly schedules"
  ON monthly_schedules AS RESTRICTIVE FOR SELECT TO authenticated
  USING (user_has_permission('schedules', 'read'));

CREATE POLICY "Permission required to create monthly schedules"
  ON monthly_schedules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (user_has_permission('schedules', 'create'));

CREATE POLICY "Permission required to update monthly schedules"
  ON monthly_schedules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (user_has_permission('schedules', 'update'))
  WITH CHECK (user_has_permission('schedules', 'update'));

CREATE POLICY "Permission required to delete monthly schedules"
  ON monthly_schedules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (user_has_permission('schedules', 'delete'));

CREATE POLICY "Users can only access monthly schedules from their departments"
  ON monthly_schedules FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid() AND system_users.active = true
      AND (system_users.allowed_departments IS NULL
           OR monthly_schedules.department_id = ANY(system_users.allowed_departments))
    )
  );

CREATE POLICY "Users can only create monthly schedules in their departments"
  ON monthly_schedules FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid() AND system_users.active = true
      AND (system_users.allowed_departments IS NULL
           OR monthly_schedules.department_id = ANY(system_users.allowed_departments))
    )
  );

CREATE POLICY "Users can only update monthly schedules in their departments"
  ON monthly_schedules FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid() AND system_users.active = true
      AND (system_users.allowed_departments IS NULL
           OR monthly_schedules.department_id = ANY(system_users.allowed_departments))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid() AND system_users.active = true
      AND (system_users.allowed_departments IS NULL
           OR monthly_schedules.department_id = ANY(system_users.allowed_departments))
    )
  );

CREATE POLICY "Users can only delete monthly schedules in their departments"
  ON monthly_schedules FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid() AND system_users.active = true
      AND (system_users.allowed_departments IS NULL
           OR monthly_schedules.department_id = ANY(system_users.allowed_departments))
    )
  );

-- ===================== PROFESSIONAL_FACIAL_DATA =====================
-- Simplificado: todos autenticados podem ver (necessário para timesheet)
CREATE POLICY "Authenticated users can view facial data"
  ON professional_facial_data FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authorized users can create facial data"
  ON professional_facial_data FOR INSERT TO authenticated
  WITH CHECK (user_has_permission('professionals', 'create'));

CREATE POLICY "Authorized users can update facial data"
  ON professional_facial_data FOR UPDATE TO authenticated
  USING (user_has_permission('professionals', 'update'))
  WITH CHECK (user_has_permission('professionals', 'update'));

CREATE POLICY "Authorized users can delete facial data"
  ON professional_facial_data FOR DELETE TO authenticated
  USING (user_has_permission('professionals', 'delete'));

-- ===================== TIMESHEET_RECORDS (permission-based) =====================
CREATE POLICY "Authorized users can view timesheet"
  ON timesheet_records FOR SELECT TO authenticated
  USING (user_has_permission('schedules', 'read'));

CREATE POLICY "Authorized users can create timesheet"
  ON timesheet_records FOR INSERT TO authenticated
  WITH CHECK (user_has_permission('schedules', 'create'));

CREATE POLICY "Authorized users can update timesheet"
  ON timesheet_records FOR UPDATE TO authenticated
  USING (user_has_permission('schedules', 'update'))
  WITH CHECK (user_has_permission('schedules', 'update'));

CREATE POLICY "Authorized users can delete timesheet"
  ON timesheet_records FOR DELETE TO authenticated
  USING (user_has_permission('schedules', 'delete'));

-- ===================== MEAL_CATEGORY_CONFIG (RESTRICTIVE + PERMISSIVE) =====================
CREATE POLICY "meal_config_restrictive_select"
  ON meal_category_config AS RESTRICTIVE FOR SELECT TO authenticated
  USING (user_has_permission('schedules', 'read'));

CREATE POLICY "meal_config_restrictive_insert"
  ON meal_category_config AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (user_has_permission('schedules', 'create'));

CREATE POLICY "meal_config_restrictive_update"
  ON meal_category_config AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (user_has_permission('schedules', 'update'))
  WITH CHECK (user_has_permission('schedules', 'update'));

CREATE POLICY "meal_config_restrictive_delete"
  ON meal_category_config AS RESTRICTIVE FOR DELETE TO authenticated
  USING (user_has_permission('schedules', 'delete'));

CREATE POLICY "meal_config_permissive_select"
  ON meal_category_config FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "meal_config_permissive_insert"
  ON meal_category_config FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "meal_config_permissive_update"
  ON meal_category_config FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "meal_config_permissive_delete"
  ON meal_category_config FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ===================== MEAL_SCHEDULES (RESTRICTIVE + PERMISSIVE department) =====================
CREATE POLICY "meal_schedule_restrictive_select"
  ON meal_schedules AS RESTRICTIVE FOR SELECT TO authenticated
  USING (user_has_permission('schedules', 'read'));

CREATE POLICY "meal_schedule_restrictive_insert"
  ON meal_schedules AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (user_has_permission('schedules', 'create'));

CREATE POLICY "meal_schedule_restrictive_update"
  ON meal_schedules AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (user_has_permission('schedules', 'update'))
  WITH CHECK (user_has_permission('schedules', 'update'));

CREATE POLICY "meal_schedule_restrictive_delete"
  ON meal_schedules AS RESTRICTIVE FOR DELETE TO authenticated
  USING (user_has_permission('schedules', 'delete'));

CREATE POLICY "meal_schedule_dept_select"
  ON meal_schedules FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shifts s
      JOIN system_users su ON su.id = auth.uid()
      WHERE s.id = meal_schedules.shift_id
      AND su.active = true
      AND (su.allowed_departments IS NULL OR s.department_id = ANY(su.allowed_departments))
    )
  );

CREATE POLICY "meal_schedule_dept_insert"
  ON meal_schedules FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shifts s
      JOIN system_users su ON su.id = auth.uid()
      WHERE s.id = meal_schedules.shift_id
      AND su.active = true
      AND (su.allowed_departments IS NULL OR s.department_id = ANY(su.allowed_departments))
    )
  );

CREATE POLICY "meal_schedule_dept_update"
  ON meal_schedules FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shifts s
      JOIN system_users su ON su.id = auth.uid()
      WHERE s.id = meal_schedules.shift_id
      AND su.active = true
      AND (su.allowed_departments IS NULL OR s.department_id = ANY(su.allowed_departments))
    )
  );

CREATE POLICY "meal_schedule_dept_delete"
  ON meal_schedules FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shifts s
      JOIN system_users su ON su.id = auth.uid()
      WHERE s.id = meal_schedules.shift_id
      AND su.active = true
      AND (su.allowed_departments IS NULL OR s.department_id = ANY(su.allowed_departments))
    )
  );

-- ===================== AUDIT_LOGS =====================
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN user_roles ur ON su.role_id = ur.id
      WHERE su.id = auth.uid() AND ur.name = 'Administrador' AND su.active = true
    )
  );

CREATE POLICY "only_trigger_can_insert_audit_logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);

-- ===================== ESTABLISHMENTS =====================
CREATE POLICY "Authenticated users can view establishments"
  ON establishments FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage establishments"
  ON establishments FOR ALL TO authenticated
  USING (user_has_permission('settings', 'update'))
  WITH CHECK (user_has_permission('settings', 'update'));

-- ===================== NSR_SEQUENCES =====================
CREATE POLICY "Service role can manage nsr"
  ON nsr_sequences FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins can view nsr"
  ON nsr_sequences FOR SELECT TO authenticated
  USING (user_has_permission('settings', 'read'));

-- ===================== PUNCH_RECORDS =====================
CREATE POLICY "Authenticated users can view punch records"
  ON punch_records FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authorized users can insert punch records"
  ON punch_records FOR INSERT TO authenticated
  WITH CHECK (user_has_permission('schedules', 'create'));

-- ===================== PUNCH_RECEIPTS =====================
CREATE POLICY "Authenticated users can view receipts"
  ON punch_receipts FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert receipts"
  ON punch_receipts FOR INSERT TO authenticated
  WITH CHECK (true);

-- ===================== PUNCH_ADJUSTMENTS =====================
CREATE POLICY "Authenticated users can view adjustments"
  ON punch_adjustments FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authorized users can create adjustments"
  ON punch_adjustments FOR INSERT TO authenticated
  WITH CHECK (user_has_permission('schedules', 'create'));

CREATE POLICY "Authorized users can update adjustments"
  ON punch_adjustments FOR UPDATE TO authenticated
  USING (user_has_permission('schedules', 'update'))
  WITH CHECK (user_has_permission('schedules', 'update'));

-- ===================== PUNCH_AUDIT_LOG =====================
CREATE POLICY "Authenticated users can view punch audit"
  ON punch_audit_log FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert punch audit"
  ON punch_audit_log FOR INSERT
  WITH CHECK (true);

-- ===================== EXPORT_JOBS =====================
CREATE POLICY "Authenticated users can view export jobs"
  ON export_jobs FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authorized users can manage export jobs"
  ON export_jobs FOR ALL TO authenticated
  USING (user_has_permission('reports', 'export'))
  WITH CHECK (user_has_permission('reports', 'export'));

-- ===================== HOUR_BANK TABLES =====================
CREATE POLICY "hour_bank_config_select"
  ON hour_bank_config FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "hour_bank_config_insert"
  ON hour_bank_config FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "hour_bank_config_update"
  ON hour_bank_config FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "hour_bank_config_delete"
  ON hour_bank_config FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "hour_bank_entries_select_auth"
  ON hour_bank_entries FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "hour_bank_entries_insert"
  ON hour_bank_entries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "hour_bank_entries_update"
  ON hour_bank_entries FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "hour_bank_entries_delete"
  ON hour_bank_entries FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "hour_bank_compensations_select_auth"
  ON hour_bank_compensations FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "hour_bank_compensations_insert"
  ON hour_bank_compensations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "hour_bank_compensations_update"
  ON hour_bank_compensations FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "hour_bank_compensations_delete"
  ON hour_bank_compensations FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- =============================================================================
-- PARTE 4: INDEXES DE PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_professionals_user_id ON professionals(user_id);
CREATE INDEX IF NOT EXISTS idx_professionals_category ON professionals(category_id);
CREATE INDEX IF NOT EXISTS idx_professionals_department ON professionals(department_id);
CREATE INDEX IF NOT EXISTS idx_professionals_company ON professionals(company_id);
CREATE INDEX IF NOT EXISTS idx_shifts_professional ON shifts(professional_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_department ON shifts(department_id);
CREATE INDEX IF NOT EXISTS idx_shifts_schedule_id ON shifts(schedule_id);
CREATE INDEX IF NOT EXISTS idx_shifts_dept_date ON shifts(department_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_professional_date ON shifts(professional_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_status ON shift_swaps(status);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_requesting ON shift_swaps(requesting_professional_id);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_target ON shift_swaps(target_professional_id);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_original_shift ON shift_swaps(original_shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_offered_shift ON shift_swaps(offered_shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_approved_by ON shift_swaps(approved_by);
CREATE INDEX IF NOT EXISTS idx_shift_history_shift_id ON shift_history(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_history_performed_by ON shift_history(performed_by);
CREATE INDEX IF NOT EXISTS idx_monthly_schedules_dept_month ON monthly_schedules(department_id, month);
CREATE INDEX IF NOT EXISTS idx_system_users_email ON system_users(email);
CREATE INDEX IF NOT EXISTS idx_system_users_role_id ON system_users(role_id);
CREATE INDEX IF NOT EXISTS idx_system_users_active ON system_users(active);
CREATE INDEX IF NOT EXISTS idx_system_users_allowed_departments ON system_users USING GIN(allowed_departments);
CREATE INDEX IF NOT EXISTS idx_user_roles_name ON user_roles(name);
CREATE INDEX IF NOT EXISTS idx_facial_data_professional ON professional_facial_data(professional_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_professional ON timesheet_records(professional_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_shift ON timesheet_records(shift_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_date ON timesheet_records(check_in_time);
CREATE INDEX IF NOT EXISTS idx_timesheet_professional_date ON timesheet_records(professional_id, check_in_time);
CREATE INDEX IF NOT EXISTS idx_meal_category_config_category ON meal_category_config(category_id);
CREATE INDEX IF NOT EXISTS idx_meal_schedules_date ON meal_schedules(shift_date);
CREATE INDEX IF NOT EXISTS idx_meal_schedules_professional ON meal_schedules(professional_id);
CREATE INDEX IF NOT EXISTS idx_meal_schedules_shift ON meal_schedules(shift_id);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS shifts_unique_with_schedule
  ON shifts (professional_id, department_id, shift_date, start_time, end_time, schedule_id)
  WHERE schedule_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS shifts_unique_without_schedule
  ON shifts (professional_id, department_id, shift_date, start_time, end_time)
  WHERE schedule_id IS NULL;

-- =============================================================================
-- PARTE 5: TRIGGERS
-- =============================================================================

DROP TRIGGER IF EXISTS update_user_roles_updated_at ON user_roles;
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON user_roles FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_users_updated_at ON system_users;
CREATE TRIGGER update_system_users_updated_at
  BEFORE UPDATE ON system_users FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_calculate_total_meals ON meal_schedules;
CREATE TRIGGER trigger_calculate_total_meals
  BEFORE INSERT OR UPDATE ON meal_schedules FOR EACH ROW
  EXECUTE FUNCTION calculate_total_meals();

-- Remover trigger de auto-registro (conflita com Edge Function)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- =============================================================================
-- PARTE 6: ATUALIZAR PERMISSÕES DOS ROLES
-- =============================================================================

-- Administrador: adicionar settings e garantir acesso total
UPDATE user_roles
SET permissions = '{
  "professionals": {"create": true, "read": true, "update": true, "delete": true},
  "schedules": {"create": true, "read": true, "update": true, "delete": true},
  "swaps": {"create": true, "read": true, "approve": true, "delete": true},
  "departments": {"create": true, "read": true, "update": true, "delete": true},
  "professional_categories": {"create": true, "read": true, "update": true, "delete": true},
  "companies": {"create": true, "read": true, "update": true, "delete": true},
  "reports": {"read": true, "export": true},
  "users": {"create": true, "read": true, "update": true, "delete": true},
  "settings": {"read": true, "create": true, "update": true, "delete": true}
}'::jsonb
WHERE name = 'Administrador';

-- Gestor: sem acesso a users/dept/categories/companies management
UPDATE user_roles
SET permissions = '{
  "professionals": {"create": true, "read": true, "update": true, "delete": true},
  "schedules": {"create": true, "read": true, "update": true, "delete": true},
  "swaps": {"create": true, "read": true, "approve": true, "delete": true},
  "departments": {"read": true, "create": false, "update": false, "delete": false},
  "professional_categories": {"read": true, "create": false, "update": false, "delete": false},
  "companies": {"read": true, "create": false, "update": false, "delete": false},
  "reports": {"read": true, "export": true},
  "users": {"read": false, "create": false, "update": false, "delete": false}
}'::jsonb
WHERE name = 'Gestor';

-- Coordenador: criar/editar escalas, aprovar trocas, leitura em dept/cat/companies
UPDATE user_roles
SET permissions = '{
  "professionals": {"create": false, "read": true, "update": false, "delete": false},
  "schedules": {"create": true, "read": true, "update": true, "delete": false},
  "swaps": {"create": true, "read": true, "approve": true, "delete": false},
  "departments": {"read": true, "create": false, "update": false, "delete": false},
  "professional_categories": {"read": true, "create": false, "update": false, "delete": false},
  "companies": {"read": true, "create": false, "update": false, "delete": false},
  "reports": {"read": true, "export": true},
  "users": {"read": false, "create": false, "update": false, "delete": false}
}'::jsonb
WHERE name = 'Coordenador';

-- Visualizador: apenas leitura
UPDATE user_roles
SET permissions = '{
  "professionals": {"create": false, "read": true, "update": false, "delete": false},
  "schedules": {"create": false, "read": true, "update": false, "delete": false},
  "swaps": {"create": false, "read": true, "approve": false, "delete": false},
  "departments": {"read": true, "create": false, "update": false, "delete": false},
  "professional_categories": {"read": true, "create": false, "update": false, "delete": false},
  "companies": {"read": true, "create": false, "update": false, "delete": false},
  "reports": {"read": true, "export": true},
  "users": {"read": false, "create": false, "update": false, "delete": false}
}'::jsonb
WHERE name = 'Visualizador';

-- =============================================================================
-- PARTE 7: CRIAR OS 6 NOVOS COORDENADORES
-- =============================================================================

DO $$
DECLARE
  coord_role_id uuid;
  new_user_id uuid;
  user_record RECORD;
BEGIN
  SELECT id INTO coord_role_id FROM user_roles WHERE name = 'Coordenador' LIMIT 1;

  IF coord_role_id IS NULL THEN
    RAISE EXCEPTION 'Role Coordenador not found.';
  END IF;

  FOR user_record IN (
    SELECT *
    FROM (VALUES
      ('anafarini@fesfsus.ba.gov.br',    'Ana Rafaela Meneses Farini'),
      ('caresoares@fesfsus.ba.gov.br',    'Care Caroline Santos Soares'),
      ('deivsonventura@fesfsus.ba.gov.br','Deivson Nunes Ventura'),
      ('laisestrela@fesfsus.ba.gov.br',   'Lais Cardoso dos Anjos'),
      ('Milenapereira@fesfsus.ba.gov.br', 'Milena Borges Pereira'),
      ('Sandraregines@fesfsus.ba.gov.br', 'Sandra Regines Paixao dos Reis')
    ) AS t(email, full_name)
  ) LOOP
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = user_record.email) THEN
      RAISE NOTICE 'User % already exists, skipping.', user_record.email;
      CONTINUE;
    END IF;

    new_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', new_user_id,
      'authenticated', 'authenticated', user_record.email,
      crypt('Hecc2026!', gen_salt('bf')),
      NOW(), NOW(), NOW(), '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), new_user_id, user_record.email,
      jsonb_build_object('sub', new_user_id::text, 'email', user_record.email),
      'email', NOW(), NOW(), NOW()
    );

    INSERT INTO system_users (id, email, full_name, role_id, active, allowed_departments)
    VALUES (new_user_id, user_record.email, user_record.full_name, coord_role_id, true, null)
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Coordinator created: % (%)', user_record.full_name, user_record.email;
  END LOOP;

  RAISE NOTICE 'All coordinators processed.';
END $$;

-- =============================================================================
-- FIM DO SCRIPT CONSOLIDADO
-- =============================================================================
