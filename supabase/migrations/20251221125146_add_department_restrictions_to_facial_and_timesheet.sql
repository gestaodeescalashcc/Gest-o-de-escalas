/*
  # Adicionar Restrições de Departamento a Facial Data e Timesheet

  ## Problema Identificado
  
  Duas tabelas ainda não têm restrições por departamento:
  
  1. **professional_facial_data**
     - Tem professional_id que pertence a um departamento
     - Usuários restritos não devem ver dados faciais de profissionais de outros departamentos
  
  2. **timesheet_records**
     - Tem professional_id e shift_id, ambos relacionados a departamentos
     - Usuários restritos não devem ver/editar registros de ponto de outros departamentos

  ## Solução
  
  Converter as políticas de PERMISSIVE para RESTRICTIVE (permissões gerais)
  e adicionar políticas PERMISSIVE para verificar acesso ao departamento.
*/

-- =====================================================
-- PROFESSIONAL_FACIAL_DATA - Adicionar Restrições por Departamento
-- =====================================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Authorized users can view facial data" ON professional_facial_data;
DROP POLICY IF EXISTS "Authorized users can create facial data" ON professional_facial_data;
DROP POLICY IF EXISTS "Authorized users can update facial data" ON professional_facial_data;
DROP POLICY IF EXISTS "Authorized users can delete facial data" ON professional_facial_data;

-- Adicionar políticas RESTRICTIVE para permissões gerais
CREATE POLICY "Permission required to view facial data"
  ON professional_facial_data AS RESTRICTIVE FOR SELECT
  TO authenticated
  USING (user_has_permission('professionals', 'read'));

CREATE POLICY "Permission required to create facial data"
  ON professional_facial_data AS RESTRICTIVE FOR INSERT
  TO authenticated
  WITH CHECK (user_has_permission('professionals', 'create'));

CREATE POLICY "Permission required to update facial data"
  ON professional_facial_data AS RESTRICTIVE FOR UPDATE
  TO authenticated
  USING (user_has_permission('professionals', 'update'))
  WITH CHECK (user_has_permission('professionals', 'update'));

CREATE POLICY "Permission required to delete facial data"
  ON professional_facial_data AS RESTRICTIVE FOR DELETE
  TO authenticated
  USING (user_has_permission('professionals', 'delete'));

-- Adicionar políticas PERMISSIVE para verificar departamento via professional
CREATE POLICY "Users can only view facial data from allowed departments"
  ON professional_facial_data FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN professionals p ON p.id = professional_facial_data.professional_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (
        su.allowed_departments IS NULL
        OR p.department_id = ANY(su.allowed_departments)
      )
    )
  );

CREATE POLICY "Users can only create facial data in allowed departments"
  ON professional_facial_data FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN professionals p ON p.id = professional_facial_data.professional_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (
        su.allowed_departments IS NULL
        OR p.department_id = ANY(su.allowed_departments)
      )
    )
  );

CREATE POLICY "Users can only update facial data in allowed departments"
  ON professional_facial_data FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN professionals p ON p.id = professional_facial_data.professional_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (
        su.allowed_departments IS NULL
        OR p.department_id = ANY(su.allowed_departments)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN professionals p ON p.id = professional_facial_data.professional_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (
        su.allowed_departments IS NULL
        OR p.department_id = ANY(su.allowed_departments)
      )
    )
  );

CREATE POLICY "Users can only delete facial data in allowed departments"
  ON professional_facial_data FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN professionals p ON p.id = professional_facial_data.professional_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (
        su.allowed_departments IS NULL
        OR p.department_id = ANY(su.allowed_departments)
      )
    )
  );

-- =====================================================
-- TIMESHEET_RECORDS - Adicionar Restrições por Departamento
-- =====================================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Authorized users can view timesheet" ON timesheet_records;
DROP POLICY IF EXISTS "Authorized users can create timesheet" ON timesheet_records;
DROP POLICY IF EXISTS "Authorized users can update timesheet" ON timesheet_records;
DROP POLICY IF EXISTS "Authorized users can delete timesheet" ON timesheet_records;

-- Adicionar políticas RESTRICTIVE para permissões gerais
CREATE POLICY "Permission required to view timesheet"
  ON timesheet_records AS RESTRICTIVE FOR SELECT
  TO authenticated
  USING (user_has_permission('schedules', 'read'));

CREATE POLICY "Permission required to create timesheet"
  ON timesheet_records AS RESTRICTIVE FOR INSERT
  TO authenticated
  WITH CHECK (user_has_permission('schedules', 'create'));

CREATE POLICY "Permission required to update timesheet"
  ON timesheet_records AS RESTRICTIVE FOR UPDATE
  TO authenticated
  USING (user_has_permission('schedules', 'update'))
  WITH CHECK (user_has_permission('schedules', 'update'));

CREATE POLICY "Permission required to delete timesheet"
  ON timesheet_records AS RESTRICTIVE FOR DELETE
  TO authenticated
  USING (user_has_permission('schedules', 'delete'));

-- Adicionar políticas PERMISSIVE para verificar departamento
-- Verificar via professional E shift (ambos devem estar no departamento permitido)
CREATE POLICY "Users can only view timesheet from allowed departments"
  ON timesheet_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN professionals p ON p.id = timesheet_records.professional_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (
        su.allowed_departments IS NULL
        OR p.department_id = ANY(su.allowed_departments)
      )
    )
  );

CREATE POLICY "Users can only create timesheet in allowed departments"
  ON timesheet_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN professionals p ON p.id = timesheet_records.professional_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (
        su.allowed_departments IS NULL
        OR p.department_id = ANY(su.allowed_departments)
      )
    )
  );

CREATE POLICY "Users can only update timesheet in allowed departments"
  ON timesheet_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN professionals p ON p.id = timesheet_records.professional_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (
        su.allowed_departments IS NULL
        OR p.department_id = ANY(su.allowed_departments)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN professionals p ON p.id = timesheet_records.professional_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (
        su.allowed_departments IS NULL
        OR p.department_id = ANY(su.allowed_departments)
      )
    )
  );

CREATE POLICY "Users can only delete timesheet in allowed departments"
  ON timesheet_records FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN professionals p ON p.id = timesheet_records.professional_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (
        su.allowed_departments IS NULL
        OR p.department_id = ANY(su.allowed_departments)
      )
    )
  );
