/*
  # Adicionar Políticas de Restrição por Departamento

  ## Problema Identificado
  
  As políticas RESTRICTIVE criadas na migração anterior verificam apenas se o usuário tem
  a permissão geral (ex: schedules.update), mas NÃO verificam se o usuário tem acesso ao
  departamento específico do recurso que está sendo acessado.
  
  Resultado: Usuários com restrição de departamento podem editar/visualizar recursos de
  QUALQUER departamento, desde que tenham a permissão geral.
  
  ## Solução
  
  Adicionar políticas PERMISSIVE que verificam se:
  1. O usuário tem allowed_departments = NULL (admin, acessa tudo) OU
  2. O department_id do recurso está no array allowed_departments do usuário
  
  Com a combinação de RESTRICTIVE (permissões) + PERMISSIVE (departamentos):
  - O usuário precisa TER a permissão geral E TER acesso ao departamento
  
  ## Tabelas Afetadas
  - shifts
  - professionals
  - monthly_schedules
*/

-- =====================================================
-- SHIFTS - Adicionar verificação de departamento
-- =====================================================

-- Política PERMISSIVE: usuário deve ter acesso ao departamento do shift
CREATE POLICY "Users can only access shifts from their allowed departments"
  ON shifts FOR SELECT
  TO authenticated
  USING (
    -- Admin tem acesso total (allowed_departments IS NULL)
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid()
      AND system_users.active = true
      AND (
        system_users.allowed_departments IS NULL
        OR shifts.department_id = ANY(system_users.allowed_departments)
      )
    )
  );

CREATE POLICY "Users can only create shifts in their allowed departments"
  ON shifts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid()
      AND system_users.active = true
      AND (
        system_users.allowed_departments IS NULL
        OR shifts.department_id = ANY(system_users.allowed_departments)
      )
    )
  );

CREATE POLICY "Users can only update shifts in their allowed departments"
  ON shifts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid()
      AND system_users.active = true
      AND (
        system_users.allowed_departments IS NULL
        OR shifts.department_id = ANY(system_users.allowed_departments)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid()
      AND system_users.active = true
      AND (
        system_users.allowed_departments IS NULL
        OR shifts.department_id = ANY(system_users.allowed_departments)
      )
    )
  );

CREATE POLICY "Users can only delete shifts in their allowed departments"
  ON shifts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid()
      AND system_users.active = true
      AND (
        system_users.allowed_departments IS NULL
        OR shifts.department_id = ANY(system_users.allowed_departments)
      )
    )
  );

-- =====================================================
-- PROFESSIONALS - Adicionar verificação de departamento
-- =====================================================

CREATE POLICY "Users can only access professionals from their allowed departments"
  ON professionals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid()
      AND system_users.active = true
      AND (
        system_users.allowed_departments IS NULL
        OR professionals.department_id = ANY(system_users.allowed_departments)
      )
    )
  );

CREATE POLICY "Users can only create professionals in their allowed departments"
  ON professionals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid()
      AND system_users.active = true
      AND (
        system_users.allowed_departments IS NULL
        OR professionals.department_id = ANY(system_users.allowed_departments)
      )
    )
  );

CREATE POLICY "Users can only update professionals in their allowed departments"
  ON professionals FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid()
      AND system_users.active = true
      AND (
        system_users.allowed_departments IS NULL
        OR professionals.department_id = ANY(system_users.allowed_departments)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid()
      AND system_users.active = true
      AND (
        system_users.allowed_departments IS NULL
        OR professionals.department_id = ANY(system_users.allowed_departments)
      )
    )
  );

CREATE POLICY "Users can only delete professionals in their allowed departments"
  ON professionals FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid()
      AND system_users.active = true
      AND (
        system_users.allowed_departments IS NULL
        OR professionals.department_id = ANY(system_users.allowed_departments)
      )
    )
  );

-- =====================================================
-- MONTHLY_SCHEDULES - Adicionar verificação de departamento
-- =====================================================

CREATE POLICY "Users can only access monthly schedules from their allowed departments"
  ON monthly_schedules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid()
      AND system_users.active = true
      AND (
        system_users.allowed_departments IS NULL
        OR monthly_schedules.department_id = ANY(system_users.allowed_departments)
      )
    )
  );

CREATE POLICY "Users can only create monthly schedules in their allowed departments"
  ON monthly_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid()
      AND system_users.active = true
      AND (
        system_users.allowed_departments IS NULL
        OR monthly_schedules.department_id = ANY(system_users.allowed_departments)
      )
    )
  );

CREATE POLICY "Users can only update monthly schedules in their allowed departments"
  ON monthly_schedules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid()
      AND system_users.active = true
      AND (
        system_users.allowed_departments IS NULL
        OR monthly_schedules.department_id = ANY(system_users.allowed_departments)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid()
      AND system_users.active = true
      AND (
        system_users.allowed_departments IS NULL
        OR monthly_schedules.department_id = ANY(system_users.allowed_departments)
      )
    )
  );

CREATE POLICY "Users can only delete monthly schedules in their allowed departments"
  ON monthly_schedules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid()
      AND system_users.active = true
      AND (
        system_users.allowed_departments IS NULL
        OR monthly_schedules.department_id = ANY(system_users.allowed_departments)
      )
    )
  );
