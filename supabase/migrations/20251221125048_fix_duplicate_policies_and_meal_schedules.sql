/*
  # Corrigir Políticas Duplicadas e Adicionar Restrições Faltantes

  ## Problemas Identificados

  1. **Políticas Duplicadas**
     - shifts, professionals e monthly_schedules têm políticas antigas usando user_has_department_access()
     - Estas estão duplicadas com as novas políticas criadas
     - Precisa remover as antigas para evitar confusão

  2. **meal_schedules Sem Restrição de Departamento**
     - meal_schedules não tem coluna department_id direta
     - Mas está relacionada via shift_id que tem department_id
     - Precisa adicionar políticas com JOIN

  3. **shift_swaps Sem Restrição de Departamento**
     - Trocas de plantões também precisam verificar departamentos
     - Via original_shift_id que tem department_id

  ## Correções Aplicadas

  1. Remover políticas antigas duplicadas
  2. Adicionar restrições por departamento em meal_schedules
  3. Adicionar restrições por departamento em shift_swaps
*/

-- =====================================================
-- 1. REMOVER POLÍTICAS ANTIGAS DUPLICADAS
-- =====================================================

-- SHIFTS - Remover políticas antigas
DROP POLICY IF EXISTS "users_can_view_shifts_in_allowed_departments" ON shifts;
DROP POLICY IF EXISTS "users_can_create_shifts_in_allowed_departments" ON shifts;
DROP POLICY IF EXISTS "users_can_update_shifts_in_allowed_departments" ON shifts;
DROP POLICY IF EXISTS "users_can_delete_shifts_in_allowed_departments" ON shifts;

-- PROFESSIONALS - Remover políticas antigas
DROP POLICY IF EXISTS "users_can_view_professionals_in_allowed_departments" ON professionals;
DROP POLICY IF EXISTS "users_can_create_professionals_in_allowed_departments" ON professionals;
DROP POLICY IF EXISTS "users_can_update_professionals_in_allowed_departments" ON professionals;
DROP POLICY IF EXISTS "users_can_delete_professionals_in_allowed_departments" ON professionals;

-- MONTHLY_SCHEDULES - Remover políticas antigas
DROP POLICY IF EXISTS "users_can_view_schedules_in_allowed_departments" ON monthly_schedules;
DROP POLICY IF EXISTS "users_can_create_schedules_in_allowed_departments" ON monthly_schedules;
DROP POLICY IF EXISTS "users_can_update_schedules_in_allowed_departments" ON monthly_schedules;
DROP POLICY IF EXISTS "users_can_delete_schedules_in_allowed_departments" ON monthly_schedules;

-- =====================================================
-- 2. MEAL_SCHEDULES - Converter para RESTRICTIVE + Adicionar Departamento
-- =====================================================

-- Remover políticas antigas inseguras
DROP POLICY IF EXISTS "Authorized users can view meal schedules" ON meal_schedules;
DROP POLICY IF EXISTS "Authorized users can create meal schedules" ON meal_schedules;
DROP POLICY IF EXISTS "Authorized users can update meal schedules" ON meal_schedules;
DROP POLICY IF EXISTS "Authorized users can delete meal schedules" ON meal_schedules;

-- Adicionar políticas RESTRICTIVE para permissões gerais
CREATE POLICY "Permission required to view meal schedules"
  ON meal_schedules AS RESTRICTIVE FOR SELECT
  TO authenticated
  USING (user_has_permission('schedules', 'read'));

CREATE POLICY "Permission required to create meal schedules"
  ON meal_schedules AS RESTRICTIVE FOR INSERT
  TO authenticated
  WITH CHECK (user_has_permission('schedules', 'create'));

CREATE POLICY "Permission required to update meal schedules"
  ON meal_schedules AS RESTRICTIVE FOR UPDATE
  TO authenticated
  USING (user_has_permission('schedules', 'update'))
  WITH CHECK (user_has_permission('schedules', 'update'));

CREATE POLICY "Permission required to delete meal schedules"
  ON meal_schedules AS RESTRICTIVE FOR DELETE
  TO authenticated
  USING (user_has_permission('schedules', 'delete'));

-- Adicionar políticas PERMISSIVE para verificar departamento via shift
CREATE POLICY "Users can only view meal schedules from allowed departments"
  ON meal_schedules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN shifts s ON s.id = meal_schedules.shift_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (
        su.allowed_departments IS NULL
        OR s.department_id = ANY(su.allowed_departments)
      )
    )
  );

CREATE POLICY "Users can only create meal schedules in allowed departments"
  ON meal_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN shifts s ON s.id = meal_schedules.shift_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (
        su.allowed_departments IS NULL
        OR s.department_id = ANY(su.allowed_departments)
      )
    )
  );

CREATE POLICY "Users can only update meal schedules in allowed departments"
  ON meal_schedules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN shifts s ON s.id = meal_schedules.shift_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (
        su.allowed_departments IS NULL
        OR s.department_id = ANY(su.allowed_departments)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN shifts s ON s.id = meal_schedules.shift_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (
        su.allowed_departments IS NULL
        OR s.department_id = ANY(su.allowed_departments)
      )
    )
  );

CREATE POLICY "Users can only delete meal schedules in allowed departments"
  ON meal_schedules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN shifts s ON s.id = meal_schedules.shift_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (
        su.allowed_departments IS NULL
        OR s.department_id = ANY(su.allowed_departments)
      )
    )
  );

-- =====================================================
-- 3. SHIFT_SWAPS - Adicionar Restrições por Departamento
-- =====================================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Usuários autenticados podem ver trocas" ON shift_swaps;
DROP POLICY IF EXISTS "Usuários autenticados podem criar trocas" ON shift_swaps;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar trocas" ON shift_swaps;

-- Adicionar políticas RESTRICTIVE para permissões gerais
CREATE POLICY "Permission required to view shift swaps"
  ON shift_swaps AS RESTRICTIVE FOR SELECT
  TO authenticated
  USING (user_has_permission('schedules', 'read'));

CREATE POLICY "Permission required to create shift swaps"
  ON shift_swaps AS RESTRICTIVE FOR INSERT
  TO authenticated
  WITH CHECK (user_has_permission('schedules', 'create'));

CREATE POLICY "Permission required to update shift swaps"
  ON shift_swaps AS RESTRICTIVE FOR UPDATE
  TO authenticated
  USING (user_has_permission('schedules', 'update'))
  WITH CHECK (user_has_permission('schedules', 'update'));

CREATE POLICY "Permission required to delete shift swaps"
  ON shift_swaps AS RESTRICTIVE FOR DELETE
  TO authenticated
  USING (user_has_permission('schedules', 'delete'));

-- Adicionar políticas PERMISSIVE para verificar departamento via shift original
CREATE POLICY "Users can only view swaps from allowed departments"
  ON shift_swaps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN shifts s ON s.id = shift_swaps.original_shift_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (
        su.allowed_departments IS NULL
        OR s.department_id = ANY(su.allowed_departments)
      )
    )
  );

CREATE POLICY "Users can only create swaps in allowed departments"
  ON shift_swaps FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN shifts s ON s.id = shift_swaps.original_shift_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (
        su.allowed_departments IS NULL
        OR s.department_id = ANY(su.allowed_departments)
      )
    )
  );

CREATE POLICY "Users can only update swaps in allowed departments"
  ON shift_swaps FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN shifts s ON s.id = shift_swaps.original_shift_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (
        su.allowed_departments IS NULL
        OR s.department_id = ANY(su.allowed_departments)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN shifts s ON s.id = shift_swaps.original_shift_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (
        su.allowed_departments IS NULL
        OR s.department_id = ANY(su.allowed_departments)
      )
    )
  );

CREATE POLICY "Users can only delete swaps in allowed departments"
  ON shift_swaps FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN shifts s ON s.id = shift_swaps.original_shift_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (
        su.allowed_departments IS NULL
        OR s.department_id = ANY(su.allowed_departments)
      )
    )
  );
