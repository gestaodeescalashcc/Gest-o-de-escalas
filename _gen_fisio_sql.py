import json

with open(r'C:/Users/adoni/OneDrive/Documentos/Gestão de escala/_fisio_jun_2026.json', encoding='utf-8') as f:
    data = json.load(f)

PREP = {'de', 'da', 'das', 'do', 'dos', 'e'}
def title_case(s):
    return ' '.join(w.lower() if w.lower() in PREP else w.capitalize()
                    for w in s.lower().split())

CODE_TO_NAME = {
    'P':  'Plantao 24h (7h as 7h) 24h',
    'SD': 'Servico Diurno (7h as 19h) 12h',
    'SN': 'Servico Noturno (19h as 7h) 12h',
    'M':  'Manha (7h as 13h) 6h',
    'M2': 'Manha (8h as 12h) 4h',
    'T':  'Tarde (12h as 18h) 6h',
    'MT': 'Manha e Tarde (8h as 17h) 8h',
}
# atualiza com nomes corretos com acento
CODE_TO_NAME = {
    'P':  'Plantão 24h (7h às 7h) 24h',
    'SD': 'Serviço Diurno (7h às 19h) 12h',
    'SN': 'Serviço Noturno (19h às 7h) 12h',
    'M':  'Manhã (7h às 13h) 6h',
    'M2': 'Manhã (8h às 12h) 4h',
    'T':  'Tarde (12h às 18h) 6h',
    'MT': 'Manhã e Tarde (8h às 17h) 8h',
}
CODE_TO_TIME = {
    'P': ('07:00', '07:00'), 'SD': ('07:00', '19:00'), 'SN': ('19:00', '07:00'),
    'M': ('07:00', '13:00'), 'M2': ('08:00', '12:00'), 'T': ('12:00', '18:00'),
    'MT': ('08:00', '17:00'),
}
def esc(s):
    return str(s).replace("'", "''")

profs_values = []
shifts_values = []
for p in data:
    nome_pretty = title_case(p['nome'])
    mat = p['matricula'] or ''
    profs_values.append(f"('{esc(nome_pretty)}', '{esc(mat)}')")
    for day, code in p['shifts'].items():
        full_type = CODE_TO_NAME.get(code, code)
        start, end = CODE_TO_TIME.get(code, ('00:00', '00:00'))
        shifts_values.append(
            f"('{esc(nome_pretty)}', {day}, '{esc(full_type)}', '{start}'::time, '{end}'::time)"
        )

profs_v = ',\n  '.join(profs_values)
shifts_v = ',\n  '.join(shifts_values)
total_shifts = len(shifts_values)

sql = f"""-- =============================================================================
-- IMPORT FISIOTERAPIA — JUNHO/2026 (escala da planilha "Abr 2026")
-- 20 profissionais · {total_shifts} turnos
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
  {profs_v};

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
  {shifts_v}
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
"""

with open(r'C:/Users/adoni/OneDrive/Documentos/Gestão de escala/import_fisio_junho_2026.sql', 'w', encoding='utf-8') as f:
    f.write(sql)
print(f'OK: {total_shifts} shifts')
