-- =============================================================================
-- IMPORTAR REGISTROS DA PLANILHA DE ABSENTEISMO (CSV original)
--
-- Pré-requisito: rodar antes o create_absenteeism_tables.sql
-- =============================================================================

DO $$
DECLARE
  v_admin_id uuid;
  v_dept_tec uuid;
  rec RECORD;
  v_prof_id uuid;
  v_cov_prof_id uuid;
  v_reason_id uuid;
  imported integer := 0;
  not_found integer := 0;
BEGIN
  SELECT id INTO v_admin_id FROM system_users
  WHERE role_id = (SELECT id FROM user_roles WHERE name = 'Administrador' LIMIT 1)
  AND active = true ORDER BY created_at LIMIT 1;

  SELECT id INTO v_dept_tec FROM departments WHERE name = 'Técnicos de Enfermagem' LIMIT 1;

  FOR rec IN (
    SELECT * FROM (VALUES
      ('Viviane Texeira', 'viviane', 'texeira', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-01'::date, '2026-04-01'::date, true, true, 'ana', 'claudia', false, 'Ana Claudia cobriu o SD'),
      ('Vanessa Coelho', 'vanessa', 'coelho', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Desligamento', '2026-04-01'::date, '2026-04-01'::date, true, false, '', '', false, ''),
      ('Daiane dos Anjos', 'daiane', 'anjos', false, 'Técnicos de Enfermagem', 'SN', 12.0, 'Falta injustificada', '2026-04-01'::date, '2026-04-01'::date, false, false, '', '', false, ''),
      ('Taina B de Jesus Trigueiros Sá', 'taina', 'sa', false, 'Técnicos de Enfermagem', 'SN', 12.0, 'Atestado médico', '2026-04-01'::date, '2026-04-01'::date, false, false, '', '', false, ''),
      ('Tatiana Said', 'tatiana', 'said', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-02'::date, '2026-04-02'::date, false, true, 'renata', '', true, 'Renata cobriu o SD'),
      ('Erica Ferreira Mendonça', 'erica', 'mendonca', false, 'Técnicos de Enfermagem', 'SN', 12.0, 'Falta injustificada', '2026-04-02'::date, '2026-04-02'::date, false, false, '', '', false, ''),
      ('Elaine Reis dos Santos', 'elaine', 'santos', false, 'Técnicos de Enfermagem', 'SN', 12.0, 'Falta injustificada', '2026-04-03'::date, '2026-04-03'::date, false, false, '', '', false, ''),
      ('Erica Ferreira Mendonça', 'erica', 'mendonca', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-03'::date, '2026-04-03'::date, false, false, '', '', false, ''),
      ('Vanessa Coelho', 'vanessa', 'coelho', false, 'Técnicos de Enfermagem', 'SN', 12.0, 'Desligamento', '2026-04-03'::date, '2026-04-03'::date, false, false, '', '', false, ''),
      ('Bruno Cerqueira e Silva', 'bruno', 'silva', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-04'::date, '2026-04-04'::date, false, false, '', '', false, ''),
      ('Taina B de Jesus Trigueiros Sá', 'taina', 'sa', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Atestado médico', '2026-04-04'::date, '2026-04-04'::date, false, false, '', '', false, ''),
      ('Aline Cristiane', 'aline', 'cristiane', false, 'Técnicos de Enfermagem', 'SN', 12.0, 'Falta injustificada', '2026-04-04'::date, '2026-04-04'::date, false, false, '', '', false, ''),
      ('Emerson', 'emerson', '', true, 'Técnicos de Enfermagem', 'SN', 12.0, 'Falta injustificada', '2026-04-04'::date, '2026-04-04'::date, false, false, '', '', false, ''),
      ('Alexandre', 'alexandre', '', true, 'Técnicos de Enfermagem', 'SN', 12.0, 'Falta injustificada', '2026-04-04'::date, '2026-04-04'::date, false, false, '', '', false, ''),
      ('Silene', 'silene', '', true, 'Técnicos de Enfermagem', 'SD', 12.0, 'Atestado médico', '2026-04-04'::date, '2026-04-04'::date, false, false, '', '', false, ''),
      ('Ana Paula Macedo Sa', 'ana', 'sa', false, 'Técnicos de Enfermagem', 'SN', 12.0, 'Falta injustificada', '2026-04-04'::date, '2026-04-04'::date, false, false, '', '', false, ''),
      ('Patricia de Araujo', 'patricia', 'araujo', false, 'Técnicos de Enfermagem', 'SN', 12.0, 'Falta injustificada', '2026-04-04'::date, '2026-04-04'::date, false, false, '', '', false, ''),
      ('Wellington E. dos Santos', 'wellington', 'santos', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-05'::date, '2026-04-05'::date, false, false, '', '', false, ''),
      ('Ana Paula Macedo Sa', 'ana', 'sa', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-05'::date, '2026-04-05'::date, false, false, '', '', false, ''),
      ('Flavio Santos Souza', 'flavio', 'souza', false, 'Técnicos de Enfermagem', 'SN', 12.0, 'Atestado médico', '2026-04-05'::date, '2026-04-05'::date, true, false, '', '', false, ''),
      ('Thaina Santana', 'thaina', 'santana', false, 'Técnicos de Enfermagem', 'SN', 12.0, 'Falta injustificada', '2026-04-05'::date, '2026-04-05'::date, false, false, '', '', false, ''),
      ('Flavio Santos Souza', 'flavio', 'souza', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Atestado médico', '2026-04-06'::date, '2026-04-06'::date, true, false, '', '', false, ''),
      ('Vanessa Coelho', 'vanessa', 'coelho', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Desligamento', '2026-04-06'::date, '2026-04-06'::date, false, false, '', '', false, ''),
      ('Miucha Mara', 'miucha', 'mara', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Atestado médico', '2026-04-06'::date, '2026-04-06'::date, false, false, '', '', false, ''),
      ('Thaina Santana', 'thaina', 'santana', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-06'::date, '2026-04-06'::date, false, false, '', '', false, ''),
      ('Tatiana Said', 'tatiana', 'said', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-06'::date, '2026-04-06'::date, true, false, '', '', false, ''),
      ('Taina B de Jesus Trigueiros Sá', 'taina', 'sa', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Atestado médico', '2026-04-06'::date, '2026-04-06'::date, true, false, '', '', false, ''),
      ('Daiane dos Anjos', 'daiane', 'anjos', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-07'::date, '2026-04-07'::date, false, false, '', '', false, ''),
      ('Ana Maria', 'ana', 'maria', false, 'Técnicos de Enfermagem', 'SN', 12.0, 'Falta injustificada', '2026-04-08'::date, '2026-04-08'::date, false, false, '', '', false, ''),
      ('Ana Paula Macedo Sa', 'ana', 'sa', false, 'Técnicos de Enfermagem', 'SN', 12.0, 'Falta injustificada', '2026-04-08'::date, '2026-04-08'::date, false, false, '', '', false, ''),
      ('Ana Paula Macedo Sa', 'ana', 'sa', false, 'Técnicos de Enfermagem', 'SD', 13.0, 'Falta injustificada', '2026-04-09'::date, '2026-04-09'::date, false, false, '', '', false, ''),
      ('Stefanie', 'stefanie', '', true, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-09'::date, '2026-04-09'::date, false, false, '', '', false, ''),
      ('Daiane dos Anjos', 'daiane', 'anjos', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-09'::date, '2026-04-09'::date, false, false, '', '', false, ''),
      ('Vera Lucia', 'vera', 'lucia', false, 'Técnicos de Enfermagem', 'MT', 8.0, 'Falta injustificada', '2026-04-09'::date, '2026-04-09'::date, false, false, '', '', false, ''),
      ('Flavio Santos', 'flavio', 'santos', false, 'Técnicos de Enfermagem', 'SN', 12.0, 'Falta injustificada', '2026-04-09'::date, '2026-04-09'::date, false, false, '', '', false, ''),
      ('Erica Ferreira Mendonça', 'erica', 'mendonca', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-10'::date, '2026-04-10'::date, false, false, '', '', false, ''),
      ('Emerson', 'emerson', '', true, 'Técnicos de Enfermagem', 'SD', 12.0, 'Atestado médico', '2026-04-10'::date, '2026-04-10'::date, true, false, '', '', false, ''),
      ('Aline Cristiane', 'aline', 'cristiane', false, 'Técnicos de Enfermagem', 'SN', 12.0, 'Falta injustificada', '2026-04-10'::date, '2026-04-10'::date, false, false, '', '', false, ''),
      ('Eliane Reis', 'eliane', 'reis', false, 'Técnicos de Enfermagem', 'SN', 12.0, 'Falta injustificada', '2026-04-10'::date, '2026-04-10'::date, false, false, '', '', false, ''),
      ('Ana Maria', 'ana', 'maria', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-11'::date, '2026-04-11'::date, false, false, '', '', false, ''),
      ('Tatiana Said', 'tatiana', 'said', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-11'::date, '2026-04-11'::date, false, false, '', '', false, ''),
      ('Emerson', 'emerson', '', true, 'Técnicos de Enfermagem', 'SD', 12.0, 'Atestado médico', '2026-04-12'::date, '2026-04-12'::date, false, false, '', '', false, ''),
      ('Thaina Gomes', 'thaina', 'gomes', false, 'Técnicos de Enfermagem', 'P', 24.0, 'Falta injustificada', '2026-04-12'::date, '2026-04-12'::date, false, false, '', '', false, ''),
      ('Viviane Texeira', 'viviane', 'texeira', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-12'::date, '2026-04-12'::date, false, false, '', '', false, ''),
      ('Silene', 'silene', '', true, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-12'::date, '2026-04-12'::date, false, false, '', '', false, ''),
      ('Aline Cristiane', 'aline', 'cristiane', false, 'Técnicos de Enfermagem', 'SN', 12.0, 'Falta injustificada', '2026-04-13'::date, '2026-04-13'::date, false, false, '', '', false, ''),
      ('Flavio Santos Souza', 'flavio', 'souza', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-13'::date, '2026-04-13'::date, false, false, '', '', false, ''),
      ('Daiane dos Anjos', 'daiane', 'anjos', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-13'::date, '2026-04-13'::date, false, false, '', '', false, ''),
      ('Aline Cristiane', 'aline', 'cristiane', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-13'::date, '2026-04-13'::date, false, false, '', '', false, ''),
      ('Taina B de Jesus Trigueiros Sá', 'taina', 'sa', false, 'Técnicos de Enfermagem', 'SN', 12.0, 'Falta injustificada', '2026-04-13'::date, '2026-04-13'::date, false, false, '', '', false, ''),
      ('Thaina Santana', 'thaina', 'santana', false, 'Técnicos de Enfermagem', 'SN', 12.0, 'Falta injustificada', '2026-04-13'::date, '2026-04-13'::date, false, false, '', '', false, ''),
      ('Naiara Keli', 'naiara', 'keli', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-14'::date, '2026-04-14'::date, false, false, '', '', false, ''),
      ('Thaina Santana', 'thaina', 'santana', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-14'::date, '2026-04-14'::date, false, false, '', '', false, ''),
      ('Telma Regina de J do Monte', 'telma', 'monte', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-14'::date, '2026-04-14'::date, false, false, '', '', false, 'dobrou do 11sn para 12sd'),
      ('Emerson', 'emerson', '', true, 'Técnicos de Enfermagem', 'SN', 12.0, 'Atestado médico', '2026-04-14'::date, '2026-04-14'::date, false, false, '', '', false, ''),
      ('Daiane dos Anjos', 'daiane', 'anjos', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-15'::date, '2026-04-15'::date, false, false, '', '', false, ''),
      ('Naiara Keli', 'naiara', 'keli', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-15'::date, '2026-04-15'::date, false, false, '', '', false, ''),
      ('Nilma', 'nilma', '', true, 'Técnicos de Enfermagem', 'SN', nan, 'nan', '2026-04-17'::date, '2026-04-17'::date, false, false, '', '', false, ''),
      ('Patricia', 'patricia', '', true, 'Técnicos de Enfermagem', 'SD', nan, 'nan', '2026-04-18'::date, '2026-04-18'::date, false, false, '', '', false, ''),
      ('Taina B de Jesus Trigueiros Sá', 'taina', 'sa', false, 'Técnicos de Enfermagem', 'SN', nan, 'nan', '2026-04-18'::date, '2026-04-18'::date, false, false, '', '', false, ''),
      ('Andreia Silva de Lima', 'andreia', 'lima', false, 'Técnicos de Enfermagem', 'SN', nan, 'nan', '2026-04-19'::date, '2026-04-19'::date, false, false, '', '', false, ''),
      ('Andreia Silva de Lima', 'andreia', 'lima', false, 'Técnicos de Enfermagem', 'SD', nan, 'nan', '2026-04-20'::date, '2026-04-20'::date, false, false, '', '', false, ''),
      ('Thaina Santana', 'thaina', 'santana', false, 'Técnicos de Enfermagem', 'SN', nan, 'nan', '2026-04-20'::date, '2026-04-20'::date, false, false, '', '', false, ''),
      ('Bruno Cerqueira e Silva', 'bruno', 'silva', false, 'Técnicos de Enfermagem', 'SN', nan, 'nan', '2026-04-20'::date, '2026-04-20'::date, false, false, '', '', false, ''),
      ('Ana Maria', 'ana', 'maria', false, 'Técnicos de Enfermagem', 'SD', 12.0, 'Falta injustificada', '2026-04-21'::date, '2026-04-21'::date, false, false, '', '', false, ''),
      ('Thaina Santana', 'thaina', 'santana', false, 'Técnicos de Enfermagem', 'SN', nan, 'nan', '2026-04-21'::date, '2026-04-21'::date, false, false, '', '', false, ''),
      ('Emerson Silva Filho', 'emerson', 'filho', false, 'Técnicos de Enfermagem', 'SD', nan, 'nan', '2026-04-21'::date, '2026-04-21'::date, false, false, '', '', false, ''),
      ('Taina B de Jesus Trigueiros Sá', 'taina', 'sa', false, 'Técnicos de Enfermagem', 'SN', nan, 'nan', '2016-04-21'::date, '2016-04-21'::date, false, false, '', '', false, ''),
      ('Bruno Cerqueira e Silva', 'bruno', 'silva', false, 'Técnicos de Enfermagem', 'SD', nan, 'nan', '2026-04-22'::date, '2026-04-22'::date, false, false, '', '', false, ''),
      ('Rosilene Lage de Almeida', 'rosilene', 'almeida', false, 'Técnicos de Enfermagem', 'SD', nan, 'nan', '2026-04-22'::date, '2026-04-22'::date, false, false, '', '', false, ''),
      ('Tatiane Santos', 'tatiane', 'santos', false, 'Técnicos de Enfermagem', 'SD', nan, 'nan', '2026-04-22'::date, '2026-04-22'::date, false, false, '', '', false, ''),
      ('Thaina Gomes', 'thaina', 'gomes', false, 'Técnicos de Enfermagem', 'SD', nan, 'nan', '2026-04-22'::date, '2026-04-22'::date, false, false, '', '', false, ''),
      ('Wellington E dos Santos', 'wellington', 'santos', false, 'Técnicos de Enfermagem', 'SD', nan, 'nan', '2026-04-24'::date, '2026-04-24'::date, false, false, '', '', false, ''),
      ('Andreia Silva de Lima', 'andreia', 'lima', false, 'Técnicos de Enfermagem', 'SN', nan, 'nan', '2026-04-24'::date, '2026-04-24'::date, false, false, '', '', false, ''),
      ('Ana Paula Macedo Sa', 'ana', 'sa', false, 'Técnicos de Enfermagem', 'SN', nan, 'nan', '2026-04-24'::date, '2026-04-24'::date, false, false, '', '', false, ''),
      ('Erica Ferreira Mendonça', 'erica', 'mendonca', false, 'Técnicos de Enfermagem', 'SD', nan, 'nan', '2026-04-25'::date, '2026-04-25'::date, false, false, '', '', false, ''),
      ('Aline Cristiane', 'aline', 'cristiane', false, 'Técnicos de Enfermagem', 'SN', nan, 'nan', '2026-04-25'::date, '2026-04-25'::date, false, false, '', '', false, ''),
      ('Andreia Silva de Lima', 'andreia', 'lima', false, 'Técnicos de Enfermagem', 'SN', nan, 'nan', '2026-04-25'::date, '2026-04-25'::date, false, false, '', '', false, ''),
      ('Juliana Freitas Silva', 'juliana', 'silva', false, 'Técnicos de Enfermagem', 'SN', nan, 'Atestado médico', '2026-04-26'::date, '2026-04-26'::date, false, false, '', '', false, ''),
      ('Juliana Freitas Silva', 'juliana', 'silva', false, 'Técnicos de Enfermagem', 'SD', nan, 'Atestado médico', '2026-04-27'::date, '2026-04-27'::date, false, false, '', '', false, ''),
      ('Bruno Cerqueira e Silva', 'bruno', 'silva', false, 'Técnicos de Enfermagem', 'SD', nan, 'nan', '2026-04-27'::date, '2026-04-27'::date, false, false, '', '', false, ''),
      ('Nilma dos Santos', 'nilma', 'santos', false, 'Técnicos de Enfermagem', 'SN', nan, 'nan', '2026-04-27'::date, '2026-04-27'::date, false, false, '', '', false, ''),
      ('Taina B de Jesus Trigueiros Sá', 'taina', 'sa', false, 'Técnicos de Enfermagem', 'SD', nan, 'nan', '2026-04-28'::date, '2026-04-28'::date, false, false, '', '', false, ''),
      ('Emerson Silva Filho', 'emerson', 'filho', false, 'Técnicos de Enfermagem', 'SD', nan, 'nan', '2026-04-28'::date, '2026-04-28'::date, false, false, '', '', false, ''),
      ('Telma Regina de J do Monte', 'telma', 'monte', false, 'Técnicos de Enfermagem', 'SN', nan, 'nan', '2026-04-28'::date, '2026-04-28'::date, false, false, '', '', false, '')
    ) AS t(sheet_name, first_word, last_word, single_word, setor, turno, horas, motivo,
           data_inicio, data_fim, justificada, cobertura,
           cov_first, cov_last, cov_single, observacao)
  ) LOOP
    -- Profissional principal: se tem 2 palavras, match exato; se 1 só, match ILIKE
    IF rec.single THEN
      SELECT id INTO v_prof_id
      FROM professionals
      WHERE department_id IN (SELECT id FROM departments WHERE name LIKE '%Enfermagem%' OR name LIKE '%Enfermeiros%')
        AND unaccent(lower(split_part(full_name, ' ', 1))) = rec.first_word
      ORDER BY active DESC, created_at
      LIMIT 1;
    ELSE
      SELECT id INTO v_prof_id
      FROM professionals
      WHERE unaccent(lower(split_part(full_name, ' ', 1))) = rec.first_word
        AND unaccent(lower(reverse(split_part(reverse(full_name), ' ', 1)))) = rec.last_word
      ORDER BY active DESC, created_at
      LIMIT 1;
    END IF;

    IF v_prof_id IS NULL THEN
      RAISE NOTICE 'Profissional não encontrado: %', rec.sheet_name;
      not_found := not_found + 1;
      CONTINUE;
    END IF;

    -- Cobertura
    v_cov_prof_id := NULL;
    IF rec.cov_first IS NOT NULL AND rec.cov_first <> '' THEN
      IF rec.cov_single THEN
        SELECT id INTO v_cov_prof_id
        FROM professionals
        WHERE active = true
          AND department_id IN (SELECT id FROM departments WHERE name LIKE '%Enfermagem%' OR name LIKE '%Enfermeiros%')
          AND unaccent(lower(split_part(full_name, ' ', 1))) = rec.cov_first
        ORDER BY created_at
        LIMIT 1;
      ELSE
        SELECT id INTO v_cov_prof_id
        FROM professionals
        WHERE active = true
          AND unaccent(lower(split_part(full_name, ' ', 1))) = rec.cov_first
          AND unaccent(lower(reverse(split_part(reverse(full_name), ' ', 1)))) = rec.cov_last
        ORDER BY created_at
        LIMIT 1;
      END IF;
    END IF;

    SELECT id INTO v_reason_id FROM absence_reasons WHERE name = rec.motivo LIMIT 1;
    IF v_reason_id IS NULL THEN
      RAISE NOTICE 'Motivo não cadastrado: % (registro de %)', rec.motivo, rec.sheet_name;
      CONTINUE;
    END IF;

    INSERT INTO absences (
      professional_id, department_id, reason_id,
      start_date, end_date, shift_type, hours_per_day,
      is_justified, has_coverage, coverage_professional_id,
      observation, created_by
    ) VALUES (
      v_prof_id, v_dept_tec, v_reason_id,
      rec.data_inicio, rec.data_fim, rec.turno, rec.horas,
      rec.justificada, rec.cobertura, v_cov_prof_id,
      NULLIF(rec.observacao, ''), v_admin_id
    );
    imported := imported + 1;
  END LOOP;

  RAISE NOTICE '------------------------------------------';
  RAISE NOTICE 'Registros importados: %', imported;
  RAISE NOTICE 'Não encontrados: %', not_found;
END $$;

SELECT
  ar.name AS motivo,
  COUNT(*) AS total,
  SUM(CASE WHEN a.is_justified THEN 1 ELSE 0 END) AS justificadas,
  SUM(CASE WHEN a.has_coverage THEN 1 ELSE 0 END) AS com_cobertura
FROM absences a
JOIN absence_reasons ar ON ar.id = a.reason_id
GROUP BY ar.name
ORDER BY total DESC;
