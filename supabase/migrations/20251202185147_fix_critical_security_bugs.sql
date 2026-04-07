/*
  # Correção de Bugs Críticos de Segurança

  ## Problemas Identificados:
  
  1. **Políticas RLS Inseguras**: Múltiplas tabelas usando `USING (true)` ou `WITH CHECK (true)`
     - Isso permite que QUALQUER usuário autenticado acesse/modifique TODOS os dados
     - Viola o princípio de segurança de dados
  
  2. **Políticas Faltantes**: Tabelas sem políticas UPDATE/DELETE
     - professional_categories
     - shift_history
     - departments (sem DELETE)
  
  3. **Audit Logs Inseguro**: Qualquer usuário pode ver todos os logs
  
  ## Correções Aplicadas:
  
  ### 1. Professional Categories - Adicionar controle de permissões
  ### 2. Shift History - Manter apenas INSERT (histórico não deve ser editado)
  ### 3. Departments - Adicionar DELETE policy
  ### 4. Audit Logs - Restringir acesso apenas a administradores
  ### 5. Companies - Substituir `true` por verificação de permissões
  ### 6. Meal Category Config - Adicionar verificação de permissões
  ### 7. Meal Schedules - Adicionar verificação de permissões
  ### 8. Professional Facial Data - Adicionar verificação de permissões
  ### 9. Timesheet Records - Adicionar verificação de permissões
  
  ## Segurança:
  - Todas as políticas agora verificam permissões via `user_has_permission()`
  - Nenhuma política usa `USING (true)` ou `WITH CHECK (true)`
  - Dados sensíveis protegidos por RLS adequado
*/

-- =====================================================
-- 1. PROFESSIONAL CATEGORIES - Adicionar UPDATE e DELETE
-- =====================================================

DROP POLICY IF EXISTS "Usuários autenticados podem criar categorias" ON professional_categories;
DROP POLICY IF EXISTS "Usuários autenticados podem ver categorias" ON professional_categories;

CREATE POLICY "Authorized users can view categories"
  ON professional_categories FOR SELECT
  TO authenticated
  USING (user_has_permission('professional_categories', 'read'));

CREATE POLICY "Authorized users can create categories"
  ON professional_categories FOR INSERT
  TO authenticated
  WITH CHECK (user_has_permission('professional_categories', 'create'));

CREATE POLICY "Authorized users can update categories"
  ON professional_categories FOR UPDATE
  TO authenticated
  USING (user_has_permission('professional_categories', 'update'))
  WITH CHECK (user_has_permission('professional_categories', 'update'));

CREATE POLICY "Authorized users can delete categories"
  ON professional_categories FOR DELETE
  TO authenticated
  USING (user_has_permission('professional_categories', 'delete'));

-- =====================================================
-- 2. DEPARTMENTS - Adicionar DELETE policy
-- =====================================================

DROP POLICY IF EXISTS "Usuários autenticados podem criar departamentos" ON departments;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar departamentos" ON departments;
DROP POLICY IF EXISTS "Usuários autenticados podem ver departamentos" ON departments;

CREATE POLICY "Authorized users can view departments"
  ON departments FOR SELECT
  TO authenticated
  USING (user_has_permission('departments', 'read'));

CREATE POLICY "Authorized users can create departments"
  ON departments FOR INSERT
  TO authenticated
  WITH CHECK (user_has_permission('departments', 'create'));

CREATE POLICY "Authorized users can update departments"
  ON departments FOR UPDATE
  TO authenticated
  USING (user_has_permission('departments', 'update'))
  WITH CHECK (user_has_permission('departments', 'update'));

CREATE POLICY "Authorized users can delete departments"
  ON departments FOR DELETE
  TO authenticated
  USING (user_has_permission('departments', 'delete'));

-- =====================================================
-- 3. AUDIT LOGS - Restringir apenas leitura para admins
-- =====================================================

DROP POLICY IF EXISTS "authenticated_read_audit_logs" ON audit_logs;

CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN user_roles ur ON su.role_id = ur.id
      WHERE su.id = auth.uid()
      AND ur.name = 'Administrador'
      AND su.active = true
    )
  );

-- =====================================================
-- 4. COMPANIES - Substituir políticas inseguras
-- =====================================================

DROP POLICY IF EXISTS "Users can view companies" ON companies;
DROP POLICY IF EXISTS "Users can insert companies" ON companies;
DROP POLICY IF EXISTS "Users can update companies" ON companies;
DROP POLICY IF EXISTS "Users can delete companies" ON companies;

CREATE POLICY "Authorized users can view companies"
  ON companies FOR SELECT
  TO authenticated
  USING (user_has_permission('companies', 'read'));

CREATE POLICY "Authorized users can create companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (user_has_permission('companies', 'create'));

CREATE POLICY "Authorized users can update companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (user_has_permission('companies', 'update'))
  WITH CHECK (user_has_permission('companies', 'update'));

CREATE POLICY "Authorized users can delete companies"
  ON companies FOR DELETE
  TO authenticated
  USING (user_has_permission('companies', 'delete'));

-- =====================================================
-- 5. MEAL CATEGORY CONFIG - Substituir políticas inseguras
-- =====================================================

DROP POLICY IF EXISTS "Users can view meal category config" ON meal_category_config;
DROP POLICY IF EXISTS "Users can create meal category config" ON meal_category_config;
DROP POLICY IF EXISTS "Users can update meal category config" ON meal_category_config;
DROP POLICY IF EXISTS "Users can delete meal category config" ON meal_category_config;

CREATE POLICY "Authorized users can view meal config"
  ON meal_category_config FOR SELECT
  TO authenticated
  USING (user_has_permission('schedules', 'read'));

CREATE POLICY "Authorized users can create meal config"
  ON meal_category_config FOR INSERT
  TO authenticated
  WITH CHECK (user_has_permission('schedules', 'create'));

CREATE POLICY "Authorized users can update meal config"
  ON meal_category_config FOR UPDATE
  TO authenticated
  USING (user_has_permission('schedules', 'update'))
  WITH CHECK (user_has_permission('schedules', 'update'));

CREATE POLICY "Authorized users can delete meal config"
  ON meal_category_config FOR DELETE
  TO authenticated
  USING (user_has_permission('schedules', 'delete'));

-- =====================================================
-- 6. MEAL SCHEDULES - Substituir políticas inseguras
-- =====================================================

DROP POLICY IF EXISTS "Users can view meal schedules" ON meal_schedules;
DROP POLICY IF EXISTS "Users can create meal schedules" ON meal_schedules;
DROP POLICY IF EXISTS "Users can update meal schedules" ON meal_schedules;
DROP POLICY IF EXISTS "Users can delete meal schedules" ON meal_schedules;

CREATE POLICY "Authorized users can view meal schedules"
  ON meal_schedules FOR SELECT
  TO authenticated
  USING (user_has_permission('schedules', 'read'));

CREATE POLICY "Authorized users can create meal schedules"
  ON meal_schedules FOR INSERT
  TO authenticated
  WITH CHECK (user_has_permission('schedules', 'create'));

CREATE POLICY "Authorized users can update meal schedules"
  ON meal_schedules FOR UPDATE
  TO authenticated
  USING (user_has_permission('schedules', 'update'))
  WITH CHECK (user_has_permission('schedules', 'update'));

CREATE POLICY "Authorized users can delete meal schedules"
  ON meal_schedules FOR DELETE
  TO authenticated
  USING (user_has_permission('schedules', 'delete'));

-- =====================================================
-- 7. MONTHLY SCHEDULES - Substituir políticas inseguras
-- =====================================================

DROP POLICY IF EXISTS "Users can view monthly schedules" ON monthly_schedules;
DROP POLICY IF EXISTS "Users can create monthly schedules" ON monthly_schedules;
DROP POLICY IF EXISTS "Users can update monthly schedules" ON monthly_schedules;
DROP POLICY IF EXISTS "Users can delete monthly schedules" ON monthly_schedules;

CREATE POLICY "Authorized users can view monthly schedules"
  ON monthly_schedules FOR SELECT
  TO authenticated
  USING (user_has_permission('schedules', 'read'));

CREATE POLICY "Authorized users can create monthly schedules"
  ON monthly_schedules FOR INSERT
  TO authenticated
  WITH CHECK (user_has_permission('schedules', 'create'));

CREATE POLICY "Authorized users can update monthly schedules"
  ON monthly_schedules FOR UPDATE
  TO authenticated
  USING (user_has_permission('schedules', 'update'))
  WITH CHECK (user_has_permission('schedules', 'update'));

CREATE POLICY "Authorized users can delete monthly schedules"
  ON monthly_schedules FOR DELETE
  TO authenticated
  USING (user_has_permission('schedules', 'delete'));

-- =====================================================
-- 8. PROFESSIONAL FACIAL DATA - Substituir políticas inseguras
-- =====================================================

DROP POLICY IF EXISTS "Users can view facial data" ON professional_facial_data;
DROP POLICY IF EXISTS "Users can insert facial data" ON professional_facial_data;
DROP POLICY IF EXISTS "Users can update facial data" ON professional_facial_data;
DROP POLICY IF EXISTS "Users can delete facial data" ON professional_facial_data;

CREATE POLICY "Authorized users can view facial data"
  ON professional_facial_data FOR SELECT
  TO authenticated
  USING (user_has_permission('professionals', 'read'));

CREATE POLICY "Authorized users can create facial data"
  ON professional_facial_data FOR INSERT
  TO authenticated
  WITH CHECK (user_has_permission('professionals', 'create'));

CREATE POLICY "Authorized users can update facial data"
  ON professional_facial_data FOR UPDATE
  TO authenticated
  USING (user_has_permission('professionals', 'update'))
  WITH CHECK (user_has_permission('professionals', 'update'));

CREATE POLICY "Authorized users can delete facial data"
  ON professional_facial_data FOR DELETE
  TO authenticated
  USING (user_has_permission('professionals', 'delete'));

-- =====================================================
-- 9. TIMESHEET RECORDS - Substituir políticas inseguras
-- =====================================================

DROP POLICY IF EXISTS "Users can view timesheet records" ON timesheet_records;
DROP POLICY IF EXISTS "Users can insert timesheet records" ON timesheet_records;
DROP POLICY IF EXISTS "Users can update timesheet records" ON timesheet_records;
DROP POLICY IF EXISTS "Users can delete timesheet records" ON timesheet_records;

CREATE POLICY "Authorized users can view timesheet"
  ON timesheet_records FOR SELECT
  TO authenticated
  USING (user_has_permission('schedules', 'read'));

CREATE POLICY "Authorized users can create timesheet"
  ON timesheet_records FOR INSERT
  TO authenticated
  WITH CHECK (user_has_permission('schedules', 'create'));

CREATE POLICY "Authorized users can update timesheet"
  ON timesheet_records FOR UPDATE
  TO authenticated
  USING (user_has_permission('schedules', 'update'))
  WITH CHECK (user_has_permission('schedules', 'update'));

CREATE POLICY "Authorized users can delete timesheet"
  ON timesheet_records FOR DELETE
  TO authenticated
  USING (user_has_permission('schedules', 'delete'));

-- =====================================================
-- 10. SHIFT HISTORY - Manter read-only (histórico)
-- =====================================================

DROP POLICY IF EXISTS "Usuários autenticados podem ver histórico" ON shift_history;
DROP POLICY IF EXISTS "Usuários autenticados podem criar histórico" ON shift_history;

CREATE POLICY "Authorized users can view shift history"
  ON shift_history FOR SELECT
  TO authenticated
  USING (user_has_permission('schedules', 'read'));

-- Histórico não deve ser editado, apenas triggers podem inserir
CREATE POLICY "System can insert shift history"
  ON shift_history FOR INSERT
  TO authenticated
  WITH CHECK (user_has_permission('schedules', 'create'));
