/*
  # Corrigir RLS para dados faciais no Registrar Ponto

  1. Problema
    - As políticas RESTRICTIVE estavam muito restritivas
    - A verificação de departamentos estava causando problemas de acesso

  2. Solução
    - Simplificar as políticas SELECT para permitir que usuários autenticados 
      com permissão de leitura em professionals possam ver os dados faciais
    - Manter a segurança mas garantir que o Registrar Ponto funcione
*/

-- Remover política RESTRICTIVE antiga para SELECT
DROP POLICY IF EXISTS "Permission required to view facial data" ON professional_facial_data;

-- Remover política PERMISSIVE antiga para SELECT
DROP POLICY IF EXISTS "Users can only view facial data from allowed departments" ON professional_facial_data;

-- Criar nova política PERMISSIVE simples para SELECT
-- Usuários autenticados com permissão de leitura em professionals podem ver dados faciais
CREATE POLICY "Authenticated users can view facial data"
  ON professional_facial_data
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN user_roles ur ON ur.id = su.role_id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND COALESCE((ur.permissions -> 'professionals' ->> 'read')::boolean, false) = true
    )
  );