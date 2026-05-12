-- =============================================================================
-- IMPORT FARMACIA -- JUNHO/2026 (planilha "6 Junho 2026 - Escala Farmacia HECC.xlsx")
-- 11 profissionais, 138 turnos
-- =============================================================================
-- Estrategia:
-- 1) panorama da Farmacia (quem casa com a planilha)
-- 2) limpa escala existente de junho/2026 da Farmacia (shifts/swaps/monthly_schedule)
-- 3a) cria profs novos da planilha (Andressa)
-- 3b) atualiza profs existentes: matricula da planilha sobrescreve, ativa e fixa categoria/departamento
-- 4) NAO desativa profs fora da planilha (Lais Cardoso coord + Simara podem ser ferias/coord)
--    Mas: consolida duplicata "Lais Cardosos dos Anjos" (sem matricula) -> desativa
--    Desativa duplicatas do depto CAF (lixo legado sem matricula)
-- 5) cria a escala de junho/2026 e insere os turnos
-- =============================================================================

CREATE OR REPLACE FUNCTION norm_name(s text) RETURNS text AS $func$
  SELECT lower(translate(s,
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'));
$func$ LANGUAGE SQL IMMUTABLE;

CREATE TEMP TABLE _planilha_profs (
  nome text PRIMARY KEY,
  matricula text,
  categoria text
);
INSERT INTO _planilha_profs (nome, matricula, categoria) VALUES
  ('Andressa Silva de Souza', '', 'Farmacêutico'),
  ('Pedro Paulo Silva de Assis Junior', '12385', 'Farmacêutico'),
  ('Roselia Delgado das Chagas', '17938', 'Farmacêutico'),
  ('Jean Claúdio Lourenço Alves', '17891', 'Atendente de Farmácia'),
  ('Cerineide da Silva Oliveira de Oliveira', '17995', 'Atendente de Farmácia'),
  ('Flávia Madalena de Oliveira Cruz', '12121170', 'Atendente de Farmácia'),
  ('Jócelia Alcântara Pereira', '17885', 'Atendente de Farmácia'),
  ('Marli de Assis Santos Bispo', '17920', 'Atendente de Farmácia'),
  ('Renilton de Jesus Oliveira', '17907', 'Atendente de Farmácia'),
  ('Uenderson de Jesus Santos', '12121081', 'Atendente de Farmácia'),
  ('Vivian Keila Campos Abreu Tavares', '17925', 'Atendente de Farmácia');

-- PASSO 1: panorama
SELECT
  p.id, p.full_name, p.registration_number AS matricula, c.name AS categoria, p.active,
  CASE
    WHEN EXISTS(SELECT 1 FROM _planilha_profs pp WHERE norm_name(pp.nome) = norm_name(p.full_name))
    THEN 'na planilha'
    ELSE 'FORA da planilha'
  END AS status_planilha
FROM professionals p
JOIN departments d ON d.id = p.department_id
LEFT JOIN professional_categories c ON c.id = p.category_id
WHERE d.name = 'Farmácia'
ORDER BY status_planilha, p.full_name;

-- PASSO 2: limpa junho/2026 da Farmacia
WITH old_shifts AS (
  SELECT s.id
  FROM shifts s
  JOIN monthly_schedules ms ON ms.id = s.schedule_id
  JOIN departments d ON d.id = ms.department_id
  WHERE d.name = 'Farmácia'
    AND EXTRACT(year FROM ms.month) = 2026
    AND EXTRACT(month FROM ms.month) = 6
)
DELETE FROM shift_swaps
WHERE original_shift_id IN (SELECT id FROM old_shifts)
   OR offered_shift_id IN (SELECT id FROM old_shifts);

DELETE FROM shifts WHERE schedule_id IN (
  SELECT ms.id FROM monthly_schedules ms
  JOIN departments d ON d.id = ms.department_id
  WHERE d.name = 'Farmácia'
    AND EXTRACT(year FROM ms.month) = 2026 AND EXTRACT(month FROM ms.month) = 6
);

DELETE FROM monthly_schedules ms
USING departments d
WHERE ms.department_id = d.id
  AND d.name = 'Farmácia'
  AND EXTRACT(year FROM ms.month) = 2026 AND EXTRACT(month FROM ms.month) = 6;

-- PASSO 3a: cria profs novos (Andressa)
WITH src AS (
  SELECT pp.nome, pp.matricula, pp.categoria,
    (SELECT id FROM professionals p
     JOIN departments d ON d.id = p.department_id
     WHERE norm_name(p.full_name) = norm_name(pp.nome)
       AND d.name = 'Farmácia'
     ORDER BY p.created_at LIMIT 1) AS existing_id
  FROM _planilha_profs pp
)
INSERT INTO professionals (full_name, registration_number, category_id, department_id, company_id, active)
SELECT
  src.nome,
  NULLIF(src.matricula, ''),
  (SELECT id FROM professional_categories WHERE name = src.categoria LIMIT 1),
  (SELECT id FROM departments WHERE name = 'Farmácia' LIMIT 1),
  (SELECT id FROM companies WHERE name ILIKE 'FESF%' LIMIT 1),
  true
FROM src
WHERE src.existing_id IS NULL;

-- PASSO 3b: atualiza profs existentes em Farmacia (sobrescreve matricula, ajusta categoria, ativa)
UPDATE professionals p
SET
  active = true,
  registration_number = CASE
    WHEN NULLIF(pp.matricula, '') IS NOT NULL THEN pp.matricula
    ELSE p.registration_number
  END,
  category_id = (SELECT id FROM professional_categories WHERE name = pp.categoria LIMIT 1),
  updated_at = now()
FROM _planilha_profs pp,
     departments d
WHERE p.department_id = d.id
  AND d.name = 'Farmácia'
  AND norm_name(p.full_name) = norm_name(pp.nome);

-- PASSO 4a: consolida duplicata de Lais Cardoso (a sem matricula vai pra inativo)
UPDATE professionals p
SET active = false, updated_at = now()
FROM departments d
WHERE p.department_id = d.id
  AND d.name = 'Farmácia'
  AND norm_name(p.full_name) LIKE 'lais cardoso%'
  AND p.registration_number IS NULL;

-- PASSO 4b: desativa duplicatas legadas em CAF (sem matricula) cujos nomes batem com a planilha
UPDATE professionals p
SET active = false, updated_at = now()
FROM departments d
WHERE p.department_id = d.id
  AND d.name = 'CAF'
  AND p.registration_number IS NULL
  AND EXISTS (
    SELECT 1 FROM _planilha_profs pp WHERE norm_name(pp.nome) = norm_name(p.full_name)
  );

-- PASSO 5a: cria escala
INSERT INTO monthly_schedules (department_id, name, month, status)
SELECT d.id, 'Escala Farmácia - Junho de 2026', '2026-06-01'::date, 'Rascunho'
FROM departments d
WHERE d.name = 'Farmácia';

-- PASSO 5b: insere turnos
WITH shifts_data(nome, day, shift_type, start_t, end_t) AS (
  VALUES
  ('Andressa Silva de Souza', 2, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Andressa Silva de Souza', 4, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Andressa Silva de Souza', 6, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Andressa Silva de Souza', 8, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Andressa Silva de Souza', 10, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Andressa Silva de Souza', 12, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Andressa Silva de Souza', 14, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Andressa Silva de Souza', 16, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Andressa Silva de Souza', 18, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Andressa Silva de Souza', 22, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Andressa Silva de Souza', 24, 'Manhã e Tarde (8h às 17h) 8h', '08:00'::time, '17:00'::time),
  ('Andressa Silva de Souza', 26, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Andressa Silva de Souza', 28, 'Manhã e Tarde (8h às 17h) 8h', '08:00'::time, '17:00'::time),
  ('Andressa Silva de Souza', 30, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Pedro Paulo Silva de Assis Junior', 1, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Pedro Paulo Silva de Assis Junior', 4, 'Manhã e Tarde (8h às 17h) 8h', '08:00'::time, '17:00'::time),
  ('Pedro Paulo Silva de Assis Junior', 5, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Pedro Paulo Silva de Assis Junior', 9, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Pedro Paulo Silva de Assis Junior', 12, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Pedro Paulo Silva de Assis Junior', 13, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Pedro Paulo Silva de Assis Junior', 16, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Pedro Paulo Silva de Assis Junior', 17, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Pedro Paulo Silva de Assis Junior', 20, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Pedro Paulo Silva de Assis Junior', 21, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Pedro Paulo Silva de Assis Junior', 24, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Pedro Paulo Silva de Assis Junior', 25, 'Manhã e Tarde (8h às 17h) 8h', '08:00'::time, '17:00'::time),
  ('Pedro Paulo Silva de Assis Junior', 28, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Pedro Paulo Silva de Assis Junior', 29, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Roselia Delgado das Chagas', 1, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Roselia Delgado das Chagas', 3, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Roselia Delgado das Chagas', 5, 'Manhã e Tarde (8h às 17h) 8h', '08:00'::time, '17:00'::time),
  ('Roselia Delgado das Chagas', 7, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Roselia Delgado das Chagas', 11, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Roselia Delgado das Chagas', 14, 'Manhã e Tarde (8h às 17h) 8h', '08:00'::time, '17:00'::time),
  ('Roselia Delgado das Chagas', 15, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Roselia Delgado das Chagas', 17, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Roselia Delgado das Chagas', 19, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Roselia Delgado das Chagas', 23, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Roselia Delgado das Chagas', 25, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Roselia Delgado das Chagas', 27, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Roselia Delgado das Chagas', 29, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Roselia Delgado das Chagas', 30, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Jean Claúdio Lourenço Alves', 1, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Jean Claúdio Lourenço Alves', 3, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Jean Claúdio Lourenço Alves', 4, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Jean Claúdio Lourenço Alves', 6, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Jean Claúdio Lourenço Alves', 8, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Jean Claúdio Lourenço Alves', 11, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Jean Claúdio Lourenço Alves', 13, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Jean Claúdio Lourenço Alves', 16, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Jean Claúdio Lourenço Alves', 19, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Jean Claúdio Lourenço Alves', 20, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Jean Claúdio Lourenço Alves', 24, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Jean Claúdio Lourenço Alves', 29, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Cerineide da Silva Oliveira de Oliveira', 1, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Cerineide da Silva Oliveira de Oliveira', 2, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Cerineide da Silva Oliveira de Oliveira', 4, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Cerineide da Silva Oliveira de Oliveira', 8, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Cerineide da Silva Oliveira de Oliveira', 9, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Cerineide da Silva Oliveira de Oliveira', 14, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Cerineide da Silva Oliveira de Oliveira', 16, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Cerineide da Silva Oliveira de Oliveira', 20, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Cerineide da Silva Oliveira de Oliveira', 22, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Cerineide da Silva Oliveira de Oliveira', 25, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Cerineide da Silva Oliveira de Oliveira', 28, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Cerineide da Silva Oliveira de Oliveira', 30, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Flávia Madalena de Oliveira Cruz', 1, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Flávia Madalena de Oliveira Cruz', 3, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Flávia Madalena de Oliveira Cruz', 4, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Flávia Madalena de Oliveira Cruz', 7, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Flávia Madalena de Oliveira Cruz', 10, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Flávia Madalena de Oliveira Cruz', 12, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Flávia Madalena de Oliveira Cruz', 15, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Flávia Madalena de Oliveira Cruz', 18, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Flávia Madalena de Oliveira Cruz', 21, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Flávia Madalena de Oliveira Cruz', 24, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Flávia Madalena de Oliveira Cruz', 27, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Flávia Madalena de Oliveira Cruz', 29, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Jócelia Alcântara Pereira', 3, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Jócelia Alcântara Pereira', 5, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Jócelia Alcântara Pereira', 7, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Jócelia Alcântara Pereira', 9, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Jócelia Alcântara Pereira', 12, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Jócelia Alcântara Pereira', 15, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Jócelia Alcântara Pereira', 17, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Jócelia Alcântara Pereira', 19, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Jócelia Alcântara Pereira', 21, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Jócelia Alcântara Pereira', 26, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Jócelia Alcântara Pereira', 28, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Jócelia Alcântara Pereira', 30, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Marli de Assis Santos Bispo', 2, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Marli de Assis Santos Bispo', 5, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Marli de Assis Santos Bispo', 10, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Marli de Assis Santos Bispo', 11, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Marli de Assis Santos Bispo', 13, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Marli de Assis Santos Bispo', 16, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Marli de Assis Santos Bispo', 18, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Marli de Assis Santos Bispo', 21, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Marli de Assis Santos Bispo', 23, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Marli de Assis Santos Bispo', 25, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Marli de Assis Santos Bispo', 28, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Marli de Assis Santos Bispo', 30, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Renilton de Jesus Oliveira', 3, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Renilton de Jesus Oliveira', 5, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Renilton de Jesus Oliveira', 7, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Renilton de Jesus Oliveira', 9, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Renilton de Jesus Oliveira', 13, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Renilton de Jesus Oliveira', 15, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Renilton de Jesus Oliveira', 17, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Renilton de Jesus Oliveira', 22, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Renilton de Jesus Oliveira', 23, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Renilton de Jesus Oliveira', 26, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Renilton de Jesus Oliveira', 27, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Renilton de Jesus Oliveira', 29, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Uenderson de Jesus Santos', 4, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Uenderson de Jesus Santos', 6, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Uenderson de Jesus Santos', 9, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Uenderson de Jesus Santos', 11, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Uenderson de Jesus Santos', 12, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Uenderson de Jesus Santos', 14, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Uenderson de Jesus Santos', 17, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Uenderson de Jesus Santos', 19, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Uenderson de Jesus Santos', 23, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Uenderson de Jesus Santos', 26, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Uenderson de Jesus Santos', 27, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Uenderson de Jesus Santos', 30, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Vivian Keila Campos Abreu Tavares', 2, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Vivian Keila Campos Abreu Tavares', 6, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Vivian Keila Campos Abreu Tavares', 8, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Vivian Keila Campos Abreu Tavares', 10, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Vivian Keila Campos Abreu Tavares', 12, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Vivian Keila Campos Abreu Tavares', 14, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
  ('Vivian Keila Campos Abreu Tavares', 16, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Vivian Keila Campos Abreu Tavares', 18, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Vivian Keila Campos Abreu Tavares', 20, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Vivian Keila Campos Abreu Tavares', 22, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Vivian Keila Campos Abreu Tavares', 24, 'Serviço Diurno (7h às 19h) 12h', '07:00'::time, '19:00'::time),
  ('Vivian Keila Campos Abreu Tavares', 25, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time)
),
prof_resolved AS (
  SELECT sd.*,
    (SELECT p.id FROM professionals p
     JOIN departments d ON d.id = p.department_id
     WHERE norm_name(p.full_name) = norm_name(sd.nome)
       AND d.name = 'Farmácia'
       AND p.active = true
     ORDER BY p.created_at LIMIT 1) AS prof_id
  FROM shifts_data sd
)
INSERT INTO shifts (professional_id, schedule_id, department_id, shift_date, shift_type, start_time, end_time)
SELECT pr.prof_id, ms.id, d.id, make_date(2026, 6, pr.day), pr.shift_type, pr.start_t, pr.end_t
FROM prof_resolved pr
JOIN departments d ON d.name = 'Farmácia'
JOIN monthly_schedules ms ON ms.department_id = d.id AND ms.month = '2026-06-01'::date
WHERE pr.prof_id IS NOT NULL;

-- VERIFICACAO
SELECT d.name AS setor, COUNT(*) AS total_turnos
FROM shifts s
JOIN monthly_schedules ms ON ms.id = s.schedule_id
JOIN departments d ON d.id = ms.department_id
WHERE EXTRACT(year FROM ms.month) = 2026 AND EXTRACT(month FROM ms.month) = 6
  AND d.name = 'Farmácia'
GROUP BY d.name;

SELECT pp.nome, pp.matricula, 'NAO CASOU' AS aviso
FROM _planilha_profs pp
WHERE NOT EXISTS (
  SELECT 1 FROM professionals p
  JOIN departments d ON d.id = p.department_id
  WHERE norm_name(p.full_name) = norm_name(pp.nome)
    AND d.name = 'Farmácia'
    AND p.active = true
);
