/*
  # Corrigir Função de Auditoria para Suportar Service Role

  1. Problema
    - A função audit_trigger_function falha quando chamada via service_role
    - auth.uid() retorna NULL no contexto service_role
    - Isso impede a criação de usuários via Edge Function

  2. Solução
    - Modificar audit_trigger_function para lidar com contexto service_role
    - Permitir user_id e user_email NULL quando auth.uid() é NULL
    - Registrar operações system quando não há usuário autenticado

  3. Mudanças
    - Remover NOT NULL constraint de user_id e user_email em audit_logs (já permite NULL)
    - Atualizar função para não falhar quando auth.uid() é NULL
    - Adicionar fallback para operações do sistema
*/

-- Recriar a função de auditoria com suporte a service_role
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_data_json jsonb;
  new_data_json jsonb;
  changed_fields text[];
  description text;
  current_user_email text;
  current_user_id uuid;
BEGIN
  -- Obter ID do usuário atual (pode ser NULL se service_role)
  current_user_id := auth.uid();
  
  -- Tentar obter email do usuário atual (se existir)
  IF current_user_id IS NOT NULL THEN
    BEGIN
      SELECT email INTO current_user_email
      FROM auth.users
      WHERE id = current_user_id;
    EXCEPTION WHEN OTHERS THEN
      current_user_email := NULL;
    END;
  ELSE
    -- Se não há auth.uid(), é uma operação do sistema (service_role)
    current_user_email := 'system@service_role';
  END IF;

  -- Preparar dados baseado na operação
  IF (TG_OP = 'DELETE') THEN
    old_data_json := row_to_json(OLD)::jsonb;
    new_data_json := NULL;
    changed_fields := '{}';
  ELSIF (TG_OP = 'INSERT') THEN
    old_data_json := NULL;
    new_data_json := row_to_json(NEW)::jsonb;
    changed_fields := '{}';
  ELSIF (TG_OP = 'UPDATE') THEN
    old_data_json := row_to_json(OLD)::jsonb;
    new_data_json := row_to_json(NEW)::jsonb;
    changed_fields := get_changed_fields(old_data_json, new_data_json);
  END IF;

  -- Gerar descrição
  description := generate_audit_description(
    TG_TABLE_NAME,
    TG_OP,
    old_data_json,
    new_data_json,
    changed_fields
  );

  -- Inserir log de auditoria (permite NULL em user_id e user_email)
  BEGIN
    INSERT INTO audit_logs (
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_fields,
      user_id,
      user_email,
      description
    ) VALUES (
      TG_TABLE_NAME,
      COALESCE(NEW.id, OLD.id),
      TG_OP,
      old_data_json,
      new_data_json,
      changed_fields,
      current_user_id, -- Pode ser NULL
      current_user_email, -- Pode ser NULL ou 'system@service_role'
      description
    );
  EXCEPTION WHEN OTHERS THEN
    -- Se falhar ao inserir auditoria, logar erro mas não impedir operação
    RAISE WARNING 'Falha ao inserir log de auditoria: %', SQLERRM;
  END;

  -- Retornar o registro apropriado
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;