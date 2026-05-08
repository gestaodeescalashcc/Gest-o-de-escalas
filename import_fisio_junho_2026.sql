-- =============================================================================
-- IMPORT FISIOTERAPIA — JUNHO/2026 (escala da planilha "Abr 2026")
-- 20 profissionais · 172 turnos
-- =============================================================================
-- Passos:
-- 1) Lista profs atuais de Fisioterapia (revisao)
-- 2) Apaga escala de teste de junho/2026
-- 3) Cria/atualiza os 20 profissionais da planilha
-- 4) Desativa profs de Fisio que NAO estao na planilha
-- 5) Cria a nova escala de junho e insere os turnos
-- =============================================================================

CREATE OR REPLACE FUNCTION norm_name(s text) RETURNS text AS $func$
  SELECT lower(translate(s,
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'));
$func$ LANGUAGE SQL IMMUTABLE;

CREATE TEMP TABLE _planilha_profs (
  nome text PRIMARY KEY,
  matricula text
);
INSERT INTO _planilha_profs (nome, matricula) VALUES
  ('Aieza dos Santos Cardoso', '17905'),
  ('Luana Costa Santos Carvalho', '1835272592'),
  ('Rosineide Loreto de Jesus', '170212'),
  ('Edna Francisca da Conceição Correia Neta', '6990'),
  ('Raiane Santos Lima', '1132'),
  ('Rosangela dos Santos Nascimento', '12138'),
  ('Leila Maria Cintra da Cunha Sampaio', '17890'),
  ('Deivid Silva de Araujo Esquivel', '17914'),
  ('Manuela Silva Costa', '17923'),
  ('Luciano Hayne Mettig', '6989'),
  ('Luciana Almeida dos Santos', '17929'),
  ('Liane Rego Caribe Ramos', '17118'),
  ('Camila Souza Guimaraes', '1133'),
  ('Isabela Lomba Paranhos', '17887'),
  ('Juliana Lima Alexandre Monteiro', '17913'),
  ('Michele Coelho Serra Gama', '17909'),
  ('Tais Conceição Damasceno', '17894'),
  ('Wagner Ferreira Figueredo', '17450'),
  ('Érica Vinhas Macedo Magalhães', '1127'),
  ('Gabriela Quirino Belo', '1136');

-- PASSO 1: panorama
SELECT
  p.id, p.full_name, p.registration_number AS matricula, p.active,
  CASE
    WHEN EXISTS(SELECT 1 FROM _planilha_profs pp WHERE norm_name(pp.nome) = norm_name(p.full_name))
    THEN 'na planilha'
    ELSE 'FORA - duplicata/demitido'
  END AS status_planilha
FROM professionals p
JOIN departments d ON d.id = p.department_id
WHERE d.name = 'Fisioterapia'
ORDER BY status_planilha, p.full_name;

-- PASSO 2: apaga escala de junho de teste + shifts/swaps
WITH old_schedules AS (
  SELECT ms.id FROM monthly_schedules ms
  JOIN departments d ON d.id = ms.department_id
  WHERE d.name = 'Fisioterapia'
    AND EXTRACT(year FROM ms.month) = 2026
    AND EXTRACT(month FROM ms.month) = 6
),
old_shifts AS (
  SELECT id FROM shifts WHERE schedule_id IN (SELECT id FROM old_schedules)
)
DELETE FROM shift_swaps
WHERE original_shift_id IN (SELECT id FROM old_shifts)
   OR offered_shift_id IN (SELECT id FROM old_shifts);

DELETE FROM shifts WHERE schedule_id IN (
  SELECT ms.id FROM monthly_schedules ms
  JOIN departments d ON d.id = ms.department_id
  WHERE d.name = 'Fisioterapia'
    AND EXTRACT(year FROM ms.month) = 2026 AND EXTRACT(month FROM ms.month) = 6
);

DELETE FROM monthly_schedules ms
USING departments d
WHERE ms.department_id = d.id
  AND d.name = 'Fisioterapia'
  AND EXTRACT(year FROM ms.month) = 2026 AND EXTRACT(month FROM ms.month) = 6;

-- PASSO 3a: cria os profs da planilha que ainda nao existem
WITH src AS (
  SELECT pp.nome, pp.matricula,
    (SELECT id FROM professionals p
     WHERE norm_name(p.full_name) = norm_name(pp.nome)
     ORDER BY p.created_at LIMIT 1) AS existing_id
  FROM _planilha_profs pp
)
INSERT INTO professionals (
  full_name, registration_number,
  category_id, department_id, company_id, active
)
SELECT
  src.nome,
  NULLIF(src.matricula, ''),
  (SELECT id FROM professional_categories WHERE name ILIKE 'Fisio%' LIMIT 1),
  (SELECT id FROM departments WHERE name = 'Fisioterapia' LIMIT 1),
  (SELECT id FROM companies WHERE name ILIKE 'FESF%' LIMIT 1),
  true
FROM src
WHERE src.existing_id IS NULL;

-- PASSO 3b: reativa e ajusta os que ja existiam
UPDATE professionals p
SET active = true,
    department_id = (SELECT id FROM departments WHERE name = 'Fisioterapia' LIMIT 1),
    company_id = COALESCE(p.company_id,
                  (SELECT id FROM companies WHERE name ILIKE 'FESF%' LIMIT 1)),
    registration_number = COALESCE(NULLIF(p.registration_number, ''), pp.matricula),
    updated_at = now()
FROM _planilha_profs pp
WHERE norm_name(p.full_name) = norm_name(pp.nome);

-- PASSO 4: desativa profs de Fisio fora da planilha
UPDATE professionals p
SET active = false, updated_at = now()
FROM departments d
WHERE p.department_id = d.id
  AND d.name = 'Fisioterapia'
  AND p.active = true
  AND NOT EXISTS (
    SELECT 1 FROM _planilha_profs pp
    WHERE norm_name(pp.nome) = norm_name(p.full_name)
  );

-- PASSO 5a: cria a escala
INSERT INTO monthly_schedules (department_id, name, month, status)
SELECT
  d.id,
  'Escala Fisioterapia - Junho de 2026',
  '2026-06-01'::date,
  'Rascunho'
FROM departments d
WHERE d.name = 'Fisioterapia';

-- PASSO 5b: insere os turnos
WITH shifts_data(nome, day, shift_type, start_t, end_t) AS (
  VALUES
  ('Aieza dos Santos Cardoso', 2, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Aieza dos Santos Cardoso', 5, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Aieza dos Santos Cardoso', 11, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Aieza dos Santos Cardoso', 14, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Aieza dos Santos Cardoso', 17, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Aieza dos Santos Cardoso', 20, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Aieza dos Santos Cardoso', 23, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Aieza dos Santos Cardoso', 26, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Aieza dos Santos Cardoso', 29, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Luana Costa Santos Carvalho', 2, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Luana Costa Santos Carvalho', 5, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Luana Costa Santos Carvalho', 11, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Luana Costa Santos Carvalho', 14, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Luana Costa Santos Carvalho', 17, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Luana Costa Santos Carvalho', 20, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Luana Costa Santos Carvalho', 23, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Luana Costa Santos Carvalho', 26, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Luana Costa Santos Carvalho', 29, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Rosineide Loreto de Jesus', 2, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Rosineide Loreto de Jesus', 5, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Rosineide Loreto de Jesus', 11, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Rosineide Loreto de Jesus', 14, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Rosineide Loreto de Jesus', 17, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Rosineide Loreto de Jesus', 20, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Rosineide Loreto de Jesus', 23, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Rosineide Loreto de Jesus', 26, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Rosineide Loreto de Jesus', 29, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Edna Francisca da Conceição Correia Neta', 2, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Edna Francisca da Conceição Correia Neta', 5, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Edna Francisca da Conceição Correia Neta', 11, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Edna Francisca da Conceição Correia Neta', 14, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Edna Francisca da Conceição Correia Neta', 17, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Edna Francisca da Conceição Correia Neta', 20, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Edna Francisca da Conceição Correia Neta', 23, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Edna Francisca da Conceição Correia Neta', 26, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Edna Francisca da Conceição Correia Neta', 29, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Raiane Santos Lima', 2, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Raiane Santos Lima', 5, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Raiane Santos Lima', 11, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Raiane Santos Lima', 14, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Raiane Santos Lima', 17, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Raiane Santos Lima', 20, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Raiane Santos Lima', 23, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Raiane Santos Lima', 26, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Raiane Santos Lima', 29, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Rosangela dos Santos Nascimento', 2, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Rosangela dos Santos Nascimento', 5, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Rosangela dos Santos Nascimento', 11, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Rosangela dos Santos Nascimento', 14, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Rosangela dos Santos Nascimento', 17, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Rosangela dos Santos Nascimento', 20, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Rosangela dos Santos Nascimento', 26, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Rosangela dos Santos Nascimento', 29, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Leila Maria Cintra da Cunha Sampaio', 3, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Leila Maria Cintra da Cunha Sampaio', 9, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Leila Maria Cintra da Cunha Sampaio', 15, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Leila Maria Cintra da Cunha Sampaio', 18, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Leila Maria Cintra da Cunha Sampaio', 21, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Leila Maria Cintra da Cunha Sampaio', 24, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Leila Maria Cintra da Cunha Sampaio', 27, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Leila Maria Cintra da Cunha Sampaio', 30, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Deivid Silva de Araujo Esquivel', 3, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Deivid Silva de Araujo Esquivel', 9, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Deivid Silva de Araujo Esquivel', 15, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Deivid Silva de Araujo Esquivel', 18, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Deivid Silva de Araujo Esquivel', 21, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Deivid Silva de Araujo Esquivel', 24, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Deivid Silva de Araujo Esquivel', 27, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Deivid Silva de Araujo Esquivel', 30, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Manuela Silva Costa', 3, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Manuela Silva Costa', 9, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Manuela Silva Costa', 15, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Manuela Silva Costa', 18, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Manuela Silva Costa', 21, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Manuela Silva Costa', 24, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Manuela Silva Costa', 27, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Manuela Silva Costa', 30, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Luciano Hayne Mettig', 3, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Luciano Hayne Mettig', 9, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Luciano Hayne Mettig', 15, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Luciano Hayne Mettig', 18, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Luciano Hayne Mettig', 21, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Luciano Hayne Mettig', 24, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Luciano Hayne Mettig', 27, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Luciano Hayne Mettig', 30, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Luciana Almeida dos Santos', 3, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Luciana Almeida dos Santos', 9, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Luciana Almeida dos Santos', 15, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Luciana Almeida dos Santos', 18, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Luciana Almeida dos Santos', 21, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Luciana Almeida dos Santos', 24, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Luciana Almeida dos Santos', 27, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Luciana Almeida dos Santos', 30, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Liane Rego Caribe Ramos', 3, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Liane Rego Caribe Ramos', 9, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Liane Rego Caribe Ramos', 15, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Liane Rego Caribe Ramos', 18, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Liane Rego Caribe Ramos', 21, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Liane Rego Caribe Ramos', 24, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Liane Rego Caribe Ramos', 27, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Liane Rego Caribe Ramos', 30, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Camila Souza Guimaraes', 3, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Camila Souza Guimaraes', 9, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Camila Souza Guimaraes', 15, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Camila Souza Guimaraes', 18, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Camila Souza Guimaraes', 21, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Camila Souza Guimaraes', 24, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Camila Souza Guimaraes', 27, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Camila Souza Guimaraes', 30, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Isabela Lomba Paranhos', 1, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Isabela Lomba Paranhos', 7, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Isabela Lomba Paranhos', 10, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Isabela Lomba Paranhos', 13, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Isabela Lomba Paranhos', 16, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Isabela Lomba Paranhos', 19, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Isabela Lomba Paranhos', 22, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Isabela Lomba Paranhos', 25, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Isabela Lomba Paranhos', 28, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Juliana Lima Alexandre Monteiro', 1, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Juliana Lima Alexandre Monteiro', 7, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Juliana Lima Alexandre Monteiro', 10, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Juliana Lima Alexandre Monteiro', 13, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Juliana Lima Alexandre Monteiro', 16, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Juliana Lima Alexandre Monteiro', 19, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Juliana Lima Alexandre Monteiro', 22, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Juliana Lima Alexandre Monteiro', 25, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Juliana Lima Alexandre Monteiro', 28, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Michele Coelho Serra Gama', 1, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Michele Coelho Serra Gama', 7, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Michele Coelho Serra Gama', 10, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Michele Coelho Serra Gama', 13, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Michele Coelho Serra Gama', 16, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Michele Coelho Serra Gama', 19, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Michele Coelho Serra Gama', 22, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Michele Coelho Serra Gama', 25, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Michele Coelho Serra Gama', 28, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Tais Conceição Damasceno', 1, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Tais Conceição Damasceno', 7, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Tais Conceição Damasceno', 10, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Tais Conceição Damasceno', 13, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Tais Conceição Damasceno', 16, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Tais Conceição Damasceno', 19, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Tais Conceição Damasceno', 22, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Tais Conceição Damasceno', 25, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Tais Conceição Damasceno', 28, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Wagner Ferreira Figueredo', 1, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Wagner Ferreira Figueredo', 7, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Wagner Ferreira Figueredo', 10, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Wagner Ferreira Figueredo', 13, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Wagner Ferreira Figueredo', 16, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Wagner Ferreira Figueredo', 19, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Wagner Ferreira Figueredo', 22, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Wagner Ferreira Figueredo', 25, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Wagner Ferreira Figueredo', 28, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Érica Vinhas Macedo Magalhães', 1, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Érica Vinhas Macedo Magalhães', 7, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Érica Vinhas Macedo Magalhães', 10, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Érica Vinhas Macedo Magalhães', 13, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Érica Vinhas Macedo Magalhães', 16, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Érica Vinhas Macedo Magalhães', 19, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Érica Vinhas Macedo Magalhães', 22, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Érica Vinhas Macedo Magalhães', 25, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Érica Vinhas Macedo Magalhães', 28, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Gabriela Quirino Belo', 1, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Gabriela Quirino Belo', 7, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Gabriela Quirino Belo', 10, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Gabriela Quirino Belo', 13, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Gabriela Quirino Belo', 16, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Gabriela Quirino Belo', 19, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Gabriela Quirino Belo', 22, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Gabriela Quirino Belo', 25, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Gabriela Quirino Belo', 28, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time)
),
prof_resolved AS (
  SELECT
    sd.*,
    (SELECT p.id FROM professionals p
     WHERE norm_name(p.full_name) = norm_name(sd.nome)
       AND p.active = true
     ORDER BY p.created_at LIMIT 1) AS prof_id
  FROM shifts_data sd
)
INSERT INTO shifts (
  professional_id, schedule_id, department_id,
  shift_date, shift_type, start_time, end_time
)
SELECT
  pr.prof_id,
  ms.id,
  d.id,
  make_date(2026, 6, pr.day),
  pr.shift_type,
  pr.start_t,
  pr.end_t
FROM prof_resolved pr
JOIN departments d ON d.name = 'Fisioterapia'
JOIN monthly_schedules ms
  ON ms.department_id = d.id AND ms.month = '2026-06-01'::date
WHERE pr.prof_id IS NOT NULL;

-- VERIFICACAO
SELECT
  d.name AS setor,
  COUNT(*) AS total_turnos
FROM shifts s
JOIN monthly_schedules ms ON ms.id = s.schedule_id
JOIN departments d ON d.id = ms.department_id
WHERE EXTRACT(year FROM ms.month) = 2026 AND EXTRACT(month FROM ms.month) = 6
  AND d.name = 'Fisioterapia'
GROUP BY d.name;

SELECT pp.nome, pp.matricula, 'nao casou' AS aviso
FROM _planilha_profs pp
WHERE NOT EXISTS (
  SELECT 1 FROM professionals p
  WHERE norm_name(p.full_name) = norm_name(pp.nome) AND p.active = true
);
