-- =============================================================================
-- CORRIGIR WELLINGTON: garantir que o Wellington técnico de enfermagem
-- é quem aparece nas escalas dos Técnicos.
--
-- Estratégia:
-- 1. Identifica todos os profissionais "Wellington" no banco
-- 2. O CORRETO é o que tem categoria "Técnico de Enfermagem"
-- 3. O ERRADO (se houver) é qualquer outro Wellington atualmente no setor "Técnicos de Enfermagem"
-- 4. Move turnos de junho 2026 do errado → correto
-- 5. Move o correto pro setor "Técnicos de Enfermagem"
-- 6. Tira o errado do setor "Técnicos" (department_id = NULL)
-- =============================================================================

DO $$
DECLARE
  v_tec_dept_id uuid;
  v_cat_tec_id uuid;
  v_wellington_correct uuid;
  v_correct_name text;
  v_correct_cat text;
  shifts_moved integer := 0;
  wrongs_moved integer := 0;
  rec RECORD;
BEGIN
  -- Setor Técnicos de Enfermagem
  SELECT id INTO v_tec_dept_id FROM departments WHERE name = 'Técnicos de Enfermagem' LIMIT 1;
  IF v_tec_dept_id IS NULL THEN
    RAISE EXCEPTION 'Setor "Técnicos de Enfermagem" não encontrado.';
  END IF;

  -- Categoria Técnico de Enfermagem
  SELECT id INTO v_cat_tec_id
  FROM professional_categories
  WHERE name IN ('Técnico de Enfermagem', 'Técnico Enfermagem')
  ORDER BY name LIMIT 1;

  -- Listar todos os Wellingtons
  RAISE NOTICE 'Wellingtons encontrados no banco:';
  FOR rec IN (
    SELECT p.id, p.full_name, p.active, c.name AS cat, d.name AS dept
    FROM professionals p
    LEFT JOIN professional_categories c ON c.id = p.category_id
    LEFT JOIN departments d ON d.id = p.department_id
    WHERE unaccent(lower(p.full_name)) LIKE '%wellington%'
    ORDER BY p.full_name
  ) LOOP
    RAISE NOTICE '  % | cat=% | setor=% | ativo=%', rec.full_name, rec.cat, rec.dept, rec.active;
  END LOOP;

  -- Identificar o Wellington CORRETO: tem categoria "Técnico de Enfermagem"
  SELECT p.id, p.full_name, c.name
  INTO v_wellington_correct, v_correct_name, v_correct_cat
  FROM professionals p
  LEFT JOIN professional_categories c ON c.id = p.category_id
  WHERE unaccent(lower(p.full_name)) LIKE '%wellington%'
    AND p.category_id = v_cat_tec_id
    AND p.active = true
  LIMIT 1;

  IF v_wellington_correct IS NULL THEN
    RAISE EXCEPTION 'Não foi encontrado nenhum Wellington com categoria "Técnico de Enfermagem". Verifique manualmente.';
  END IF;

  RAISE NOTICE '------------------------------------------';
  RAISE NOTICE 'Wellington CORRETO: % (% / %)', v_correct_name, v_correct_cat, v_wellington_correct;

  -- Mover turnos de junho 2026 dos Wellingtons ERRADOS para o correto
  UPDATE shifts s
  SET professional_id = v_wellington_correct
  FROM professionals p
  WHERE s.professional_id = p.id
    AND p.id != v_wellington_correct
    AND unaccent(lower(p.full_name)) LIKE '%wellington%'
    AND s.shift_date >= '2026-06-01'
    AND s.shift_date <= '2026-06-30';
  GET DIAGNOSTICS shifts_moved = ROW_COUNT;
  RAISE NOTICE 'Turnos de junho/2026 movidos para o Wellington correto: %', shifts_moved;

  -- Garantir que o Wellington correto está no setor Técnicos
  UPDATE professionals
  SET department_id = v_tec_dept_id
  WHERE id = v_wellington_correct
    AND (department_id IS NULL OR department_id != v_tec_dept_id);

  -- Tirar Wellingtons errados do setor Técnicos (deixar sem setor para revisão manual)
  UPDATE professionals
  SET department_id = NULL
  WHERE department_id = v_tec_dept_id
    AND id != v_wellington_correct
    AND unaccent(lower(full_name)) LIKE '%wellington%';
  GET DIAGNOSTICS wrongs_moved = ROW_COUNT;
  RAISE NOTICE 'Wellingtons errados removidos do setor Técnicos: %', wrongs_moved;

  RAISE NOTICE '------------------------------------------';
  RAISE NOTICE 'Correção concluída.';
END $$;

-- Verificação: estado final
SELECT
  p.id,
  p.full_name,
  c.name AS categoria,
  d.name AS setor,
  (SELECT COUNT(*) FROM shifts s
    WHERE s.professional_id = p.id
    AND s.shift_date >= '2026-06-01'
    AND s.shift_date <= '2026-06-30') AS turnos_junho_2026
FROM professionals p
LEFT JOIN professional_categories c ON c.id = p.category_id
LEFT JOIN departments d ON d.id = p.department_id
WHERE unaccent(lower(p.full_name)) LIKE '%wellington%'
ORDER BY p.full_name;
