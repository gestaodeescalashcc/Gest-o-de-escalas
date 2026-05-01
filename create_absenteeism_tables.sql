-- =============================================================================
-- SISTEMA DE ABSENTEÍSMO (faltas, atestados, desligamentos, etc.)
--
-- Modelo:
-- - absence_reasons: motivos cadastrados (Falta injustificada, Atestado, etc.)
-- - absences:        registros individuais de exceções na escala
--
-- Conceito:
-- A escala em `shifts` continua sendo o PLANEJADO. Os registros de absences
-- representam exceções que se aplicam sobre o planejado para gerar a escala
-- REALIZADA (na visualização e exportação).
-- =============================================================================

-- =====================================================
-- 1. TABELA absence_reasons (motivos cadastrados)
-- =====================================================
CREATE TABLE IF NOT EXISTS absence_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  shift_code text NOT NULL,                    -- código curto p/ exibir na célula (FA, LM, etc.)
  default_justified boolean NOT NULL DEFAULT false,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_absence_reasons_active ON absence_reasons(active);

-- Seed dos motivos padrão
INSERT INTO absence_reasons (name, shift_code, default_justified, description)
SELECT * FROM (VALUES
  ('Falta injustificada', 'FA', false, 'Profissional não compareceu sem apresentar justificativa'),
  ('Atestado médico',     'LM', true,  'Apresentou atestado médico'),
  ('Licença gestação',    'LG', true,  'Licença maternidade'),
  ('Licença prêmio',      'LP', true,  'Licença prêmio por tempo de serviço'),
  ('Férias',              'FE', true,  'Período de férias'),
  ('Afastamento à serviço','AS', true, 'Afastamento por motivo de serviço'),
  ('Desligamento',        'DG', true,  'Profissional foi desligado'),
  ('Folga compensatória', 'FG', true,  'Folga em compensação')
) AS t(name, shift_code, default_justified, description)
WHERE NOT EXISTS (
  SELECT 1 FROM absence_reasons WHERE absence_reasons.name = t.name
);

-- =====================================================
-- 2. TABELA absences (registros individuais)
-- =====================================================
CREATE TABLE IF NOT EXISTS absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id),
  schedule_id uuid REFERENCES monthly_schedules(id) ON DELETE SET NULL,
  reason_id uuid NOT NULL REFERENCES absence_reasons(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  shift_type text,                             -- SD, SN, MT, P, etc. (tipo do turno afetado)
  hours_per_day numeric(5,2) DEFAULT 12,
  is_justified boolean NOT NULL DEFAULT false,
  has_coverage boolean NOT NULL DEFAULT false,
  coverage_professional_id uuid REFERENCES professionals(id),
  observation text,
  created_by uuid REFERENCES system_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_absences_prof_dates
  ON absences(professional_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_absences_dept ON absences(department_id);
CREATE INDEX IF NOT EXISTS idx_absences_reason ON absences(reason_id);
CREATE INDEX IF NOT EXISTS idx_absences_start_date ON absences(start_date);
CREATE INDEX IF NOT EXISTS idx_absences_schedule ON absences(schedule_id);

-- Trigger updated_at
CREATE TRIGGER trg_absences_updated_at
  BEFORE UPDATE ON absences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_absence_reasons_updated_at
  BEFORE UPDATE ON absence_reasons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 3. PERMISSÕES — adicionar 'absences' aos user_roles
-- =====================================================

-- Adicionar permissão 'absences' em todos os roles (com defaults)
UPDATE user_roles
SET permissions = jsonb_set(
  permissions,
  '{absences}',
  '{"create": true, "read": true, "update": true, "delete": true}'::jsonb,
  true
)
WHERE name = 'Administrador';

UPDATE user_roles
SET permissions = jsonb_set(
  permissions,
  '{absences}',
  '{"create": true, "read": true, "update": true, "delete": true}'::jsonb,
  true
)
WHERE name IN ('Gestor', 'Coordenador');

UPDATE user_roles
SET permissions = jsonb_set(
  permissions,
  '{absences}',
  '{"create": false, "read": true, "update": false, "delete": false}'::jsonb,
  true
)
WHERE name = 'Visualizador';

-- =====================================================
-- 4. RLS POLICIES
-- =====================================================

ALTER TABLE absence_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;

-- absence_reasons: todos autenticados leem; só admin escreve
DROP POLICY IF EXISTS "All authenticated read absence_reasons" ON absence_reasons;
CREATE POLICY "All authenticated read absence_reasons"
  ON absence_reasons FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin manage absence_reasons" ON absence_reasons;
CREATE POLICY "Admin manage absence_reasons"
  ON absence_reasons FOR ALL TO authenticated
  USING (user_has_permission('settings', 'update'))
  WITH CHECK (user_has_permission('settings', 'update'));

-- absences: leitura/escrita conforme permissão + departamento
DROP POLICY IF EXISTS "Read absences with permission" ON absences;
CREATE POLICY "Read absences with permission"
  ON absences FOR SELECT TO authenticated
  USING (user_has_permission('absences', 'read'));

DROP POLICY IF EXISTS "Read absences department check" ON absences;
CREATE POLICY "Read absences department check"
  ON absences FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid() AND system_users.active = true
      AND (system_users.allowed_departments IS NULL
           OR absences.department_id = ANY(system_users.allowed_departments))
    )
  );

DROP POLICY IF EXISTS "Create absences with permission" ON absences;
CREATE POLICY "Create absences with permission"
  ON absences FOR INSERT TO authenticated
  WITH CHECK (user_has_permission('absences', 'create'));

DROP POLICY IF EXISTS "Update absences with permission" ON absences;
CREATE POLICY "Update absences with permission"
  ON absences FOR UPDATE TO authenticated
  USING (user_has_permission('absences', 'update'))
  WITH CHECK (user_has_permission('absences', 'update'));

DROP POLICY IF EXISTS "Delete absences with permission" ON absences;
CREATE POLICY "Delete absences with permission"
  ON absences FOR DELETE TO authenticated
  USING (user_has_permission('absences', 'delete'));

-- Verificação
SELECT 'absence_reasons' AS tabela, COUNT(*) AS qtd FROM absence_reasons
UNION ALL
SELECT 'absences' AS tabela, COUNT(*) FROM absences;
