/*
  # Fix Remaining Insecure RLS Policies

  1. Problem
    - Tables professionals, shifts, and shift_swaps still have insecure policies using USING (true)
    - This allows ANY authenticated user to access/modify ALL data without permission checks
    - Critical security vulnerability that bypasses the permission system

  2. Tables Fixed
    - professionals: Replace all USING (true) policies with proper permission checks
    - shifts: Replace all USING (true) policies with proper permission checks
    - shift_swaps: Replace all USING (true) policies with proper permission checks

  3. Security
    - All policies now use user_has_permission() to enforce access control
    - No policies use USING (true) or WITH CHECK (true)
    - Proper separation of duties enforced at database level
*/

-- =====================================================
-- 1. PROFESSIONALS - Replace insecure policies
-- =====================================================

DROP POLICY IF EXISTS "Usuários autenticados podem ver profissionais" ON professionals;
DROP POLICY IF EXISTS "Usuários autenticados podem criar profissionais" ON professionals;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar profissionais" ON professionals;

CREATE POLICY "Authorized users can view professionals"
  ON professionals FOR SELECT
  TO authenticated
  USING (user_has_permission('professionals', 'read'));

CREATE POLICY "Authorized users can create professionals"
  ON professionals FOR INSERT
  TO authenticated
  WITH CHECK (user_has_permission('professionals', 'create'));

CREATE POLICY "Authorized users can update professionals"
  ON professionals FOR UPDATE
  TO authenticated
  USING (user_has_permission('professionals', 'update'))
  WITH CHECK (user_has_permission('professionals', 'update'));

CREATE POLICY "Authorized users can delete professionals"
  ON professionals FOR DELETE
  TO authenticated
  USING (user_has_permission('professionals', 'delete'));

-- =====================================================
-- 2. SHIFTS - Replace insecure policies
-- =====================================================

DROP POLICY IF EXISTS "Usuários autenticados podem ver plantões" ON shifts;
DROP POLICY IF EXISTS "Usuários autenticados podem criar plantões" ON shifts;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar plantões" ON shifts;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar plantões" ON shifts;

CREATE POLICY "Authorized users can view shifts"
  ON shifts FOR SELECT
  TO authenticated
  USING (user_has_permission('schedules', 'read'));

CREATE POLICY "Authorized users can create shifts"
  ON shifts FOR INSERT
  TO authenticated
  WITH CHECK (user_has_permission('schedules', 'create'));

CREATE POLICY "Authorized users can update shifts"
  ON shifts FOR UPDATE
  TO authenticated
  USING (user_has_permission('schedules', 'update'))
  WITH CHECK (user_has_permission('schedules', 'update'));

CREATE POLICY "Authorized users can delete shifts"
  ON shifts FOR DELETE
  TO authenticated
  USING (user_has_permission('schedules', 'delete'));

-- =====================================================
-- 3. SHIFT_SWAPS - Replace insecure policies
-- =====================================================

DROP POLICY IF EXISTS "Usuários autenticados podem ver trocas de plantões" ON shift_swaps;
DROP POLICY IF EXISTS "Usuários autenticados podem criar trocas de plantões" ON shift_swaps;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar trocas de plantões" ON shift_swaps;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar trocas de plantões" ON shift_swaps;

CREATE POLICY "Authorized users can view swaps"
  ON shift_swaps FOR SELECT
  TO authenticated
  USING (user_has_permission('swaps', 'read'));

CREATE POLICY "Authorized users can create swaps"
  ON shift_swaps FOR INSERT
  TO authenticated
  WITH CHECK (user_has_permission('swaps', 'create'));

CREATE POLICY "Authorized users can update swaps"
  ON shift_swaps FOR UPDATE
  TO authenticated
  USING (user_has_permission('swaps', 'update'))
  WITH CHECK (user_has_permission('swaps', 'update'));

CREATE POLICY "Authorized users can delete swaps"
  ON shift_swaps FOR DELETE
  TO authenticated
  USING (user_has_permission('swaps', 'delete'));