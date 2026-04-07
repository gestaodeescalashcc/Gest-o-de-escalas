/*
  # Forçar Restrições por Departamento com Políticas RESTRICTIVE

  ## Problema Identificado
  
  Atualmente existem DUAS políticas PERMISSIVE para cada operação em shifts, professionals e monthly_schedules:
  
  1. **Política baseada em PERMISSÕES gerais** (user_has_permission)
  2. **Política baseada em DEPARTAMENTOS** (user_has_department_access)
  
  No PostgreSQL, políticas PERMISSIVE funcionam com lógica **OR**:
  - Se QUALQUER política retorna TRUE, o acesso é PERMITIDO
  
  **Exemplo do Bug:**
  - Usuário tem `schedules.update = true` 
  - Usuário tem `allowed_departments = [NIR]` (restrito a apenas NIR)
  - Usuário tenta editar shift do departamento "Urgência":
    - Política 1 (permissão geral): TRUE ✓
    - Política 2 (departamento): FALSE ✗
    - **Resultado: ACESSO PERMITIDO** ❌ (deveria ser NEGADO)
  
  ## Solução Implementada
  
  Converter as políticas baseadas em PERMISSÕES para **RESTRICTIVE**.
  
  Com RESTRICTIVE, a lógica muda para **AND**:
  - TODAS as políticas (PERMISSIVE + RESTRICTIVE) devem retornar TRUE
  
  **Após a correção:**
  - Usuário tem `schedules.update = true` 
  - Usuário tem `allowed_departments = [NIR]`
  - Usuário tenta editar shift de "Urgência":
    - Política RESTRICTIVE (permissão geral): TRUE ✓
    - Política PERMISSIVE (departamento): FALSE ✗
    - **Resultado: ACESSO NEGADO** ✓ (correto!)
  
  ## Tabelas Afetadas
  - shifts
  - professionals
  - monthly_schedules
  
  ## Segurança
  - Usuários precisam TER a permissão geral E TER acesso ao departamento específico
  - Administradores continuam tendo acesso total (allowed_departments = NULL)
  - Restrições por departamento agora são EFETIVAMENTE aplicadas
*/

-- =====================================================
-- SHIFTS - Converter políticas de permissão para RESTRICTIVE
-- =====================================================

-- Remover políticas PERMISSIVE baseadas em permissões
DROP POLICY IF EXISTS "Authorized users can view shifts" ON shifts;
DROP POLICY IF EXISTS "Authorized users can create shifts" ON shifts;
DROP POLICY IF EXISTS "Authorized users can update shifts" ON shifts;
DROP POLICY IF EXISTS "Authorized users can delete shifts" ON shifts;

-- Criar políticas RESTRICTIVE - estas DEVEM ser satisfeitas junto com as PERMISSIVE
CREATE POLICY "Permission required to view shifts"
  ON shifts AS RESTRICTIVE FOR SELECT
  TO authenticated
  USING (user_has_permission('schedules', 'read'));

CREATE POLICY "Permission required to create shifts"
  ON shifts AS RESTRICTIVE FOR INSERT
  TO authenticated
  WITH CHECK (user_has_permission('schedules', 'create'));

CREATE POLICY "Permission required to update shifts"
  ON shifts AS RESTRICTIVE FOR UPDATE
  TO authenticated
  USING (user_has_permission('schedules', 'update'))
  WITH CHECK (user_has_permission('schedules', 'update'));

CREATE POLICY "Permission required to delete shifts"
  ON shifts AS RESTRICTIVE FOR DELETE
  TO authenticated
  USING (user_has_permission('schedules', 'delete'));

-- =====================================================
-- PROFESSIONALS - Converter políticas de permissão para RESTRICTIVE
-- =====================================================

DROP POLICY IF EXISTS "Authorized users can view professionals" ON professionals;
DROP POLICY IF EXISTS "Authorized users can create professionals" ON professionals;
DROP POLICY IF EXISTS "Authorized users can update professionals" ON professionals;
DROP POLICY IF EXISTS "Authorized users can delete professionals" ON professionals;

CREATE POLICY "Permission required to view professionals"
  ON professionals AS RESTRICTIVE FOR SELECT
  TO authenticated
  USING (user_has_permission('professionals', 'read'));

CREATE POLICY "Permission required to create professionals"
  ON professionals AS RESTRICTIVE FOR INSERT
  TO authenticated
  WITH CHECK (user_has_permission('professionals', 'create'));

CREATE POLICY "Permission required to update professionals"
  ON professionals AS RESTRICTIVE FOR UPDATE
  TO authenticated
  USING (user_has_permission('professionals', 'update'))
  WITH CHECK (user_has_permission('professionals', 'update'));

CREATE POLICY "Permission required to delete professionals"
  ON professionals AS RESTRICTIVE FOR DELETE
  TO authenticated
  USING (user_has_permission('professionals', 'delete'));

-- =====================================================
-- MONTHLY_SCHEDULES - Converter políticas de permissão para RESTRICTIVE
-- =====================================================

DROP POLICY IF EXISTS "Authorized users can view monthly schedules" ON monthly_schedules;
DROP POLICY IF EXISTS "Authorized users can create monthly schedules" ON monthly_schedules;
DROP POLICY IF EXISTS "Authorized users can update monthly schedules" ON monthly_schedules;
DROP POLICY IF EXISTS "Authorized users can delete monthly schedules" ON monthly_schedules;

CREATE POLICY "Permission required to view monthly schedules"
  ON monthly_schedules AS RESTRICTIVE FOR SELECT
  TO authenticated
  USING (user_has_permission('schedules', 'read'));

CREATE POLICY "Permission required to create monthly schedules"
  ON monthly_schedules AS RESTRICTIVE FOR INSERT
  TO authenticated
  WITH CHECK (user_has_permission('schedules', 'create'));

CREATE POLICY "Permission required to update monthly schedules"
  ON monthly_schedules AS RESTRICTIVE FOR UPDATE
  TO authenticated
  USING (user_has_permission('schedules', 'update'))
  WITH CHECK (user_has_permission('schedules', 'update'));

CREATE POLICY "Permission required to delete monthly schedules"
  ON monthly_schedules AS RESTRICTIVE FOR DELETE
  TO authenticated
  USING (user_has_permission('schedules', 'delete'));
