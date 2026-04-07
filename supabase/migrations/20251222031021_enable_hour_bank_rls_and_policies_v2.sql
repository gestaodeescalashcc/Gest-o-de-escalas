/*
  # Banco de Horas - Habilitar RLS e Politicas

  1. RLS em todas as tabelas de banco de horas
  2. Politicas de acesso
  3. Indices
*/

-- Habilitar RLS
ALTER TABLE hour_bank_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE hour_bank_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE hour_bank_compensations ENABLE ROW LEVEL SECURITY;

-- Indices para hour_bank_entries
CREATE INDEX IF NOT EXISTS idx_hb_entries_professional ON hour_bank_entries(professional_id);
CREATE INDEX IF NOT EXISTS idx_hb_entries_date ON hour_bank_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_hb_entries_expires ON hour_bank_entries(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hb_entries_status ON hour_bank_entries(status);

-- Indices para hour_bank_compensations
CREATE INDEX IF NOT EXISTS idx_hb_compensations_professional ON hour_bank_compensations(professional_id);
CREATE INDEX IF NOT EXISTS idx_hb_compensations_date ON hour_bank_compensations(compensation_date);

-- Politicas para hour_bank_config
CREATE POLICY "hb_config_select"
  ON hour_bank_config FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "hb_config_insert"
  ON hour_bank_config FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "hb_config_update"
  ON hour_bank_config FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "hb_config_delete"
  ON hour_bank_config FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Politicas para hour_bank_entries
CREATE POLICY "hb_entries_select"
  ON hour_bank_entries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM professionals p
      JOIN system_users su ON su.id = auth.uid()
      WHERE p.id = hour_bank_entries.professional_id
        AND (
          su.allowed_departments IS NULL
          OR su.allowed_departments = '{}'
          OR p.department_id = ANY(su.allowed_departments)
        )
    )
  );

CREATE POLICY "hb_entries_insert"
  ON hour_bank_entries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "hb_entries_update"
  ON hour_bank_entries FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "hb_entries_delete"
  ON hour_bank_entries FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Politicas para hour_bank_compensations
CREATE POLICY "hb_compensations_select"
  ON hour_bank_compensations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM professionals p
      JOIN system_users su ON su.id = auth.uid()
      WHERE p.id = hour_bank_compensations.professional_id
        AND (
          su.allowed_departments IS NULL
          OR su.allowed_departments = '{}'
          OR p.department_id = ANY(su.allowed_departments)
        )
    )
  );

CREATE POLICY "hb_compensations_insert"
  ON hour_bank_compensations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "hb_compensations_update"
  ON hour_bank_compensations FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "hb_compensations_delete"
  ON hour_bank_compensations FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);