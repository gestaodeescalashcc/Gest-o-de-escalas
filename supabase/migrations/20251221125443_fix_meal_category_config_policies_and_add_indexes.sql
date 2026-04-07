/*
  # Corrigir Políticas de meal_category_config e Adicionar Índices Faltantes

  ## Problemas Identificados

  1. **meal_category_config Sem Políticas RESTRICTIVE**
     - Atualmente tem apenas políticas PERMISSIVE
     - Precisa de políticas RESTRICTIVE para verificar permissões
     - Mantém o padrão de segurança das outras tabelas

  2. **Índices Faltando em Foreign Keys Críticos**
     - shift_history.shift_id (usado em JOINs nas políticas de departamento)
     - shift_swaps.original_shift_id e offered_shift_id (usados em JOINs)
     - Sem índices, as consultas com políticas RLS podem ficar lentas

  ## Correções Aplicadas

  1. Converter políticas de meal_category_config para RESTRICTIVE + PERMISSIVE
  2. Adicionar índices nas foreign keys que estão sendo usadas em JOINs
*/

-- =====================================================
-- 1. MEAL_CATEGORY_CONFIG - Converter para RESTRICTIVE
-- =====================================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Authorized users can view meal config" ON meal_category_config;
DROP POLICY IF EXISTS "Authorized users can create meal config" ON meal_category_config;
DROP POLICY IF EXISTS "Authorized users can update meal config" ON meal_category_config;
DROP POLICY IF EXISTS "Authorized users can delete meal config" ON meal_category_config;

-- Adicionar políticas RESTRICTIVE para permissões gerais
CREATE POLICY "Permission required to view meal config"
  ON meal_category_config AS RESTRICTIVE FOR SELECT
  TO authenticated
  USING (user_has_permission('schedules', 'read'));

CREATE POLICY "Permission required to create meal config"
  ON meal_category_config AS RESTRICTIVE FOR INSERT
  TO authenticated
  WITH CHECK (user_has_permission('schedules', 'create'));

CREATE POLICY "Permission required to update meal config"
  ON meal_category_config AS RESTRICTIVE FOR UPDATE
  TO authenticated
  USING (user_has_permission('schedules', 'update'))
  WITH CHECK (user_has_permission('schedules', 'update'));

CREATE POLICY "Permission required to delete meal config"
  ON meal_category_config AS RESTRICTIVE FOR DELETE
  TO authenticated
  USING (user_has_permission('schedules', 'delete'));

-- Adicionar políticas PERMISSIVE para acesso geral
-- meal_category_config é uma tabela de configuração global, então todos os usuários
-- autenticados com as permissões corretas devem poder acessar
CREATE POLICY "Authenticated users can view meal config"
  ON meal_category_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage meal config"
  ON meal_category_config FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- 2. ADICIONAR ÍNDICES FALTANTES
-- =====================================================

-- Índices para shift_history (usado nas políticas de departamento)
CREATE INDEX IF NOT EXISTS idx_shift_history_shift_id 
  ON shift_history(shift_id);

CREATE INDEX IF NOT EXISTS idx_shift_history_performed_by 
  ON shift_history(performed_by);

-- Índices para shift_swaps (usados nas políticas de departamento)
CREATE INDEX IF NOT EXISTS idx_shift_swaps_original_shift 
  ON shift_swaps(original_shift_id);

CREATE INDEX IF NOT EXISTS idx_shift_swaps_offered_shift 
  ON shift_swaps(offered_shift_id);

CREATE INDEX IF NOT EXISTS idx_shift_swaps_approved_by 
  ON shift_swaps(approved_by);

-- Índice para professionals.company_id (para futuras consultas)
CREATE INDEX IF NOT EXISTS idx_professionals_company 
  ON professionals(company_id);

-- Índices compostos para melhorar performance de consultas comuns
CREATE INDEX IF NOT EXISTS idx_shifts_dept_date 
  ON shifts(department_id, shift_date);

CREATE INDEX IF NOT EXISTS idx_shifts_professional_date 
  ON shifts(professional_id, shift_date);

CREATE INDEX IF NOT EXISTS idx_timesheet_professional_date 
  ON timesheet_records(professional_id, check_in_time);

CREATE INDEX IF NOT EXISTS idx_timesheet_shift 
  ON timesheet_records(shift_id, check_in_time);
