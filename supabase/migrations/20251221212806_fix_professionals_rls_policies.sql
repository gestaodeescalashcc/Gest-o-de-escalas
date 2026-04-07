/*
  # Corrigir Politicas RLS de Profissionais

  ## Problema
  As politicas RESTRICTIVE e PERMISSIVE podem estar causando conflito,
  resultando em nenhum registro sendo retornado.

  ## Solucao
  Remover as politicas existentes e criar novas politicas PERMISSIVE
  que combinam a verificacao de permissao E departamento em uma unica politica.

  ## Alteracoes
  1. Remover politicas SELECT existentes
  2. Criar nova politica SELECT que verifica:
     - Usuario tem permissao professionals.read
     - E (allowed_departments IS NULL OU department_id esta em allowed_departments)
*/

-- Remover politicas SELECT existentes para professionals
DROP POLICY IF EXISTS "Permission required to view professionals" ON professionals;
DROP POLICY IF EXISTS "Users can only access professionals from their allowed departme" ON professionals;
DROP POLICY IF EXISTS "Users can only access professionals from their allowed departments" ON professionals;

-- Criar nova politica unificada para SELECT
CREATE POLICY "Authenticated users can view professionals with permission"
  ON professionals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM system_users su
      JOIN user_roles ur ON su.role_id = ur.id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND COALESCE((ur.permissions -> 'professionals' ->> 'read')::boolean, false) = true
      AND (
        su.allowed_departments IS NULL
        OR professionals.department_id = ANY(su.allowed_departments)
      )
    )
  );

-- Remover politicas INSERT existentes para professionals
DROP POLICY IF EXISTS "Permission required to create professionals" ON professionals;
DROP POLICY IF EXISTS "Users can only create professionals in their allowed department" ON professionals;
DROP POLICY IF EXISTS "Users can only create professionals in their allowed departments" ON professionals;

-- Criar nova politica unificada para INSERT
CREATE POLICY "Authenticated users can create professionals with permission"
  ON professionals FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM system_users su
      JOIN user_roles ur ON su.role_id = ur.id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND COALESCE((ur.permissions -> 'professionals' ->> 'create')::boolean, false) = true
      AND (
        su.allowed_departments IS NULL
        OR professionals.department_id = ANY(su.allowed_departments)
      )
    )
  );

-- Remover politicas UPDATE existentes para professionals
DROP POLICY IF EXISTS "Permission required to update professionals" ON professionals;
DROP POLICY IF EXISTS "Users can only update professionals in their allowed department" ON professionals;
DROP POLICY IF EXISTS "Users can only update professionals in their allowed departments" ON professionals;

-- Criar nova politica unificada para UPDATE
CREATE POLICY "Authenticated users can update professionals with permission"
  ON professionals FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM system_users su
      JOIN user_roles ur ON su.role_id = ur.id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND COALESCE((ur.permissions -> 'professionals' ->> 'update')::boolean, false) = true
      AND (
        su.allowed_departments IS NULL
        OR professionals.department_id = ANY(su.allowed_departments)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM system_users su
      JOIN user_roles ur ON su.role_id = ur.id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND COALESCE((ur.permissions -> 'professionals' ->> 'update')::boolean, false) = true
      AND (
        su.allowed_departments IS NULL
        OR professionals.department_id = ANY(su.allowed_departments)
      )
    )
  );

-- Remover politicas DELETE existentes para professionals
DROP POLICY IF EXISTS "Permission required to delete professionals" ON professionals;
DROP POLICY IF EXISTS "Users can only delete professionals in their allowed department" ON professionals;
DROP POLICY IF EXISTS "Users can only delete professionals in their allowed departments" ON professionals;

-- Criar nova politica unificada para DELETE
CREATE POLICY "Authenticated users can delete professionals with permission"
  ON professionals FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM system_users su
      JOIN user_roles ur ON su.role_id = ur.id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND COALESCE((ur.permissions -> 'professionals' ->> 'delete')::boolean, false) = true
      AND (
        su.allowed_departments IS NULL
        OR professionals.department_id = ANY(su.allowed_departments)
      )
    )
  );
