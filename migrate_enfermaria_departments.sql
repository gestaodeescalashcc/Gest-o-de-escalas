-- =============================================================================
-- MIGRAÇÃO: Reorganizar setores de Enfermaria
--
-- Antes:
--   - Enfermarias Posto 1 (dc8c10dc-0fc2-48d9-b706-2a709b83df9a)
--   - Enfermaria Posto 2 (86569274-1080-4b15-9bc3-adb8e878a75f)
--   - Enfermaria Posto 3 (a5476766-2123-4790-8794-16648bb61235)
--
-- Depois (3 setores novos):
--   - Enfermeiros
--   - Técnicos de Enfermagem
--   - Técnicos de Enfermagem CME
--
-- Lógica de migração:
--   - Profissionais com categoria "Enfermeiro" → setor "Enfermeiros"
--   - Profissionais com categoria "Técnico de Enfermagem" ou "Técnico Enfermagem"
--       → setor "Técnicos de Enfermagem"
--       (depois você move manualmente quem for CME para o setor "Técnicos de Enfermagem CME")
--   - Outras categorias nos 3 postos antigos: vão para "Enfermeiros" como fallback
--
-- Idempotente: pode rodar várias vezes sem efeito colateral.
-- =============================================================================

DO $$
DECLARE
  enfermeiros_id uuid;
  tecnicos_id uuid;
  tecnicos_cme_id uuid;
  posto_1_id uuid := 'dc8c10dc-0fc2-48d9-b706-2a709b83df9a';
  posto_2_id uuid := '86569274-1080-4b15-9bc3-adb8e878a75f';
  posto_3_id uuid := 'a5476766-2123-4790-8794-16648bb61235';
  cat_enf_id uuid;
  cat_tec_id uuid;
  cat_tec2_id uuid;
  prof_count integer;
  shift_count integer;
  schedule_count integer;
  remaining integer;
BEGIN
  -- 1. Criar (ou pegar) os 3 novos departamentos
  INSERT INTO departments (name, description)
  VALUES ('Enfermeiros', 'Equipe de enfermagem - Enfermeiros')
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO enfermeiros_id FROM departments WHERE name = 'Enfermeiros' LIMIT 1;

  INSERT INTO departments (name, description)
  VALUES ('Técnicos de Enfermagem', 'Equipe de enfermagem - Técnicos')
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO tecnicos_id FROM departments WHERE name = 'Técnicos de Enfermagem' LIMIT 1;

  INSERT INTO departments (name, description)
  VALUES ('Técnicos de Enfermagem CME', 'Técnicos de Enfermagem - Central de Material Esterilizado')
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO tecnicos_cme_id FROM departments WHERE name = 'Técnicos de Enfermagem CME' LIMIT 1;

  RAISE NOTICE 'Setor Enfermeiros: %', enfermeiros_id;
  RAISE NOTICE 'Setor Técnicos de Enfermagem: %', tecnicos_id;
  RAISE NOTICE 'Setor Técnicos de Enfermagem CME: %', tecnicos_cme_id;

  -- 2. Pegar IDs das categorias
  SELECT id INTO cat_enf_id FROM professional_categories WHERE name = 'Enfermeiro' LIMIT 1;
  SELECT id INTO cat_tec_id FROM professional_categories WHERE name = 'Técnico de Enfermagem' LIMIT 1;
  SELECT id INTO cat_tec2_id FROM professional_categories WHERE name = 'Técnico Enfermagem' LIMIT 1;

  -- 3. Migrar profissionais dos 3 postos antigos baseado na categoria
  --    Enfermeiros → setor "Enfermeiros"
  UPDATE professionals
  SET department_id = enfermeiros_id
  WHERE department_id IN (posto_1_id, posto_2_id, posto_3_id)
    AND category_id = cat_enf_id;
  GET DIAGNOSTICS prof_count = ROW_COUNT;
  RAISE NOTICE 'Enfermeiros movidos: %', prof_count;

  --    Técnicos de Enfermagem → setor "Técnicos de Enfermagem"
  UPDATE professionals
  SET department_id = tecnicos_id
  WHERE department_id IN (posto_1_id, posto_2_id, posto_3_id)
    AND category_id IN (cat_tec_id, cat_tec2_id);
  GET DIAGNOSTICS prof_count = ROW_COUNT;
  RAISE NOTICE 'Técnicos movidos: %', prof_count;

  -- 4. Verificar se sobrou alguém nos postos antigos (categoria não-enfermagem)
  SELECT COUNT(*) INTO remaining FROM professionals
  WHERE department_id IN (posto_1_id, posto_2_id, posto_3_id);

  IF remaining > 0 THEN
    RAISE NOTICE 'ATENÇÃO: % profissionais ainda nos postos antigos com categoria não-enfermagem. Movendo para Enfermeiros como fallback.', remaining;
    UPDATE professionals
    SET department_id = enfermeiros_id
    WHERE department_id IN (posto_1_id, posto_2_id, posto_3_id);
  END IF;

  -- 5. Migrar shifts (turnos) — passa o department_id correto baseado no profissional
  UPDATE shifts s
  SET department_id = p.department_id
  FROM professionals p
  WHERE s.professional_id = p.id
    AND s.department_id IN (posto_1_id, posto_2_id, posto_3_id);
  GET DIAGNOSTICS shift_count = ROW_COUNT;
  RAISE NOTICE 'Turnos atualizados: %', shift_count;

  -- 6. Migrar monthly_schedules dos postos antigos para "Enfermeiros"
  --    (depois você duplica manualmente para Técnicos / Técnicos CME se precisar)
  UPDATE monthly_schedules
  SET department_id = enfermeiros_id
  WHERE department_id IN (posto_1_id, posto_2_id, posto_3_id);
  GET DIAGNOSTICS schedule_count = ROW_COUNT;
  RAISE NOTICE 'Escalas mensais atualizadas: %', schedule_count;

  -- 7. Atualizar allowed_departments de coordenadores que tinham acesso aos postos
  --    Substitui qualquer postoX pelo setor "Enfermeiros"
  UPDATE system_users
  SET allowed_departments = (
    SELECT array_agg(DISTINCT new_id) FROM (
      SELECT CASE
        WHEN d_id IN (posto_1_id, posto_2_id, posto_3_id) THEN enfermeiros_id
        ELSE d_id
      END AS new_id
      FROM unnest(allowed_departments) AS d_id
    ) sub
  )
  WHERE allowed_departments && ARRAY[posto_1_id, posto_2_id, posto_3_id]::uuid[];

  -- 8. Para coordenadores com acesso a "Enfermeiros", adicionar acesso aos
  --    setores de Técnicos também (assumindo que coordenador de enfermagem
  --    cobre todos os 3 setores novos)
  UPDATE system_users
  SET allowed_departments =
    array_append(
      array_append(allowed_departments, tecnicos_id),
      tecnicos_cme_id
    )
  WHERE allowed_departments @> ARRAY[enfermeiros_id]::uuid[]
    AND NOT (allowed_departments @> ARRAY[tecnicos_id]::uuid[]);

  -- 9. Deletar os 3 postos antigos (se sem dependências)
  BEGIN
    DELETE FROM departments
    WHERE id IN (posto_1_id, posto_2_id, posto_3_id);
    RAISE NOTICE 'Postos antigos deletados com sucesso.';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE WARNING 'Não foi possível deletar todos os postos antigos por dependências.';
    UPDATE departments
    SET name = name || ' (descontinuado)'
    WHERE id IN (posto_1_id, posto_2_id, posto_3_id)
      AND name NOT LIKE '%descontinuado%';
  END;

  RAISE NOTICE 'Migração concluída com sucesso.';
END $$;

-- =============================================================================
-- VERIFICAÇÃO PÓS-MIGRAÇÃO
-- =============================================================================
SELECT
  d.name AS setor,
  COUNT(DISTINCT p.id) AS profissionais,
  COUNT(DISTINCT s.id) AS turnos
FROM departments d
LEFT JOIN professionals p ON p.department_id = d.id
LEFT JOIN shifts s ON s.department_id = d.id
WHERE d.name IN ('Enfermeiros', 'Técnicos de Enfermagem', 'Técnicos de Enfermagem CME')
GROUP BY d.name
ORDER BY d.name;
