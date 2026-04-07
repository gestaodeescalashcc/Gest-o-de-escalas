/*
  # Limpar Políticas Duplicadas de shift_swaps

  ## Problema Identificado
  
  shift_swaps tem políticas antigas duplicadas que precisam ser removidas:
  - "Authorized users can view swaps"
  - "Authorized users can create swaps" 
  - "Authorized users can update swaps"
  - "Authorized users can delete swaps"
  - "users_can_view_swaps_in_allowed_departments"
  - "users_can_create_swaps_in_allowed_departments"
  - "users_can_update_swaps_in_allowed_departments"

  As novas políticas corretas já foram criadas na migração anterior.
*/

-- Remover políticas antigas de shift_swaps
DROP POLICY IF EXISTS "Authorized users can view swaps" ON shift_swaps;
DROP POLICY IF EXISTS "Authorized users can create swaps" ON shift_swaps;
DROP POLICY IF EXISTS "Authorized users can update swaps" ON shift_swaps;
DROP POLICY IF EXISTS "Authorized users can delete swaps" ON shift_swaps;

-- Remover políticas antigas que usavam user_has_department_access
DROP POLICY IF EXISTS "users_can_view_swaps_in_allowed_departments" ON shift_swaps;
DROP POLICY IF EXISTS "users_can_create_swaps_in_allowed_departments" ON shift_swaps;
DROP POLICY IF EXISTS "users_can_update_swaps_in_allowed_departments" ON shift_swaps;
DROP POLICY IF EXISTS "users_can_delete_swaps_in_allowed_departments" ON shift_swaps;
