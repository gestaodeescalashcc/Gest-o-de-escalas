-- =============================================================================
-- REMOVER OS 3 POSTOS ANTIGOS DE ENFERMARIA
--
-- Setores:
--   - Enfermarias Posto 1
--   - Enfermaria Posto 2
--   - Enfermaria Posto 3
--
-- Estratégia:
-- 1. Se ainda há profissionais ativos vinculados, falha com aviso
--    (você precisa rodar antes o assign_nursing_staff_maio.sql)
-- 2. Limpa dependências:
--    - shifts vinculados → seta NULL no department_id (ou move pro setor do profissional)
--    - monthly_schedules → seta NULL
--    - allowed_departments dos system_users → remove os IDs
-- 3. Deleta os 3 setores
-- =============================================================================

DO $$
DECLARE
  posto_ids uuid[];
  active_profs integer;
  shifts_count integer;
  schedules_count integer;
BEGIN
  -- Pegar os IDs dos 3 postos pelo nome
  SELECT array_agg(id) INTO posto_ids
  FROM departments
  WHERE name IN ('Enfermarias Posto 1', 'Enfermaria Posto 2', 'Enfermaria Posto 3');

  IF posto_ids IS NULL OR array_length(posto_ids, 1) = 0 THEN
    RAISE NOTICE 'Nenhum dos 3 postos antigos encontrado. Nada a fazer.';
    RETURN;
  END IF;

  RAISE NOTICE 'Postos encontrados: % setor(es)', array_length(posto_ids, 1);

  -- 1. Verificar profissionais ATIVOS ainda vinculados
  SELECT COUNT(*) INTO active_profs
  FROM professionals
  WHERE department_id = ANY(posto_ids) AND active = true;

  IF active_profs > 0 THEN
    RAISE EXCEPTION 'Ainda há % profissional(is) ATIVO(s) vinculado(s) aos postos antigos. Rode o assign_nursing_staff_maio.sql antes.', active_profs;
  END IF;

  -- 2. Profissionais inativos vinculados: deixar como estão (histórico)
  --    Mas vamos mover o department_id para NULL para liberar deletion
  UPDATE professionals
  SET department_id = NULL
  WHERE department_id = ANY(posto_ids);
  GET DIAGNOSTICS active_profs = ROW_COUNT;
  RAISE NOTICE 'Profissionais inativos desvinculados: %', active_profs;

  -- 3. Limpar shifts (turnos) que ainda apontam para os postos antigos
  --    Estratégia: mover para o setor atual do profissional (se tiver), senão NULL
  UPDATE shifts s
  SET department_id = p.department_id
  FROM professionals p
  WHERE s.professional_id = p.id
    AND s.department_id = ANY(posto_ids);
  GET DIAGNOSTICS shifts_count = ROW_COUNT;
  RAISE NOTICE 'Turnos atualizados via profissional: %', shifts_count;

  -- Shifts órfãos (sem profissional) → NULL
  UPDATE shifts SET department_id = NULL WHERE department_id = ANY(posto_ids);
  GET DIAGNOSTICS shifts_count = ROW_COUNT;
  IF shifts_count > 0 THEN
    RAISE NOTICE 'Turnos órfãos desvinculados: %', shifts_count;
  END IF;

  -- 4. Monthly schedules vinculados
  DELETE FROM monthly_schedules WHERE department_id = ANY(posto_ids);
  GET DIAGNOSTICS schedules_count = ROW_COUNT;
  RAISE NOTICE 'Escalas mensais antigas removidas: %', schedules_count;

  -- 5. Limpar allowed_departments dos system_users (remove os IDs dos postos)
  UPDATE system_users
  SET allowed_departments = (
    SELECT array_agg(d_id)
    FROM unnest(allowed_departments) AS d_id
    WHERE d_id <> ALL(posto_ids)
  )
  WHERE allowed_departments && posto_ids;

  -- 6. Finalmente, deletar os 3 postos
  DELETE FROM departments WHERE id = ANY(posto_ids);
  RAISE NOTICE 'Os 3 postos antigos foram removidos com sucesso.';
END $$;

-- Verificação: confirmar que sumiram
SELECT id, name FROM departments
WHERE name IN ('Enfermarias Posto 1', 'Enfermaria Posto 2', 'Enfermaria Posto 3');
-- Deve retornar 0 linhas

-- Listar setores atuais para conferir
SELECT id, name FROM departments ORDER BY name;
