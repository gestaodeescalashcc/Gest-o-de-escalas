/*
  # Adicionar Restrições de Departamento ao Histórico de Turnos

  ## Problema Identificado
  
  shift_history tem shift_id que está relacionado a um departamento específico.
  Usuários restritos a um departamento não devem ver histórico de turnos de outros departamentos.

  ## Solução
  
  Converter as políticas de PERMISSIVE para RESTRICTIVE (permissões gerais)
  e adicionar políticas PERMISSIVE para verificar acesso ao departamento via shift.
*/

-- Remover políticas antigas
DROP POLICY IF EXISTS "Authorized users can view shift history" ON shift_history;
DROP POLICY IF EXISTS "System can insert shift history" ON shift_history;

-- Adicionar políticas RESTRICTIVE para permissões gerais
CREATE POLICY "Permission required to view shift history"
  ON shift_history AS RESTRICTIVE FOR SELECT
  TO authenticated
  USING (user_has_permission('schedules', 'read'));

CREATE POLICY "Permission required to insert shift history"
  ON shift_history AS RESTRICTIVE FOR INSERT
  TO authenticated
  WITH CHECK (user_has_permission('schedules', 'create'));

-- Adicionar políticas PERMISSIVE para verificar departamento via shift
CREATE POLICY "Users can only view history from allowed departments"
  ON shift_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN shifts s ON s.id = shift_history.shift_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (
        su.allowed_departments IS NULL
        OR s.department_id = ANY(su.allowed_departments)
      )
    )
  );

CREATE POLICY "Users can only insert history in allowed departments"
  ON shift_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN shifts s ON s.id = shift_history.shift_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (
        su.allowed_departments IS NULL
        OR s.department_id = ANY(su.allowed_departments)
      )
    )
  );
