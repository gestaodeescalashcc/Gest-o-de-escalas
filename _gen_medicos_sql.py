import json
import re

with open(r'C:/Users/adoni/OneDrive/Documentos/Gestão de escala/_medicos_maio.json', encoding='utf-8') as f:
    data = json.load(f)

PREP = {'de', 'da', 'das', 'do', 'dos', 'e'}
def title_case(s):
    return ' '.join(w.lower() if w.lower() in PREP else w.capitalize()
                    for w in s.lower().split())

def clean_name(name):
    # Remove "15/15" e similares do nome
    n = re.sub(r'\s+\d+/\d+\s*', ' ', name).strip()
    return title_case(n)

def esc(s):
    return str(s).replace("'", "''")

# === Categoria principal de cada médico ===
def main_category(cats):
    cats = set(cats)
    if 'Médico Plantonista' in cats:
        return 'Médico Plantonista'
    if 'Médico Diarista' in cats:
        return 'Médico Diarista'
    return 'Médico Interconsultor'

# === Empresas (lista limpa) ===
companies = sorted(set(c.strip() for c in data['companies'] if c))
# Normaliza algumas
companies_clean = []
for c in companies:
    # 'KLT SERVI�OS' → 'KLT Serviços'
    c2 = c.replace('SERVI�OS', 'Serviços').replace('SERVICOS', 'Serviços')
    companies_clean.append(c2)
companies_clean = sorted(set(companies_clean))

# Mapeamento original → normalizado
co_map = {c: c.replace('SERVI�OS', 'Serviços').replace('SERVICOS', 'Serviços') for c in companies}

# === Profissionais ===
profs = []
for p in data['professionals']:
    name = clean_name(p['name'])
    company = co_map.get(p['company']) if p['company'] else None
    cat = main_category(p['categories'])
    profs.append({'name': name, 'company': company, 'category': cat, 'original_name': p['name']})

# Map original_name -> cleaned name
name_map = {p['original_name'].upper(): p['name'] for p in profs}

def lookup_name(original):
    return name_map.get(original.upper(), title_case(clean_name(original)))

# === Mapeia shift_type por posição ===
CODE_TO_NAME = {
    'SD': 'Serviço Diurno (7h às 19h) 12h',
    'SN': 'Serviço Noturno (19h às 7h) 12h',
    'M':  'Manhã (7h às 13h) 6h',
    'T':  'Tarde (12h às 18h) 6h',
}
CODE_TO_TIME = {
    'SD': ('07:00', '19:00'),
    'SN': ('19:00', '07:00'),
    'M':  ('07:00', '13:00'),
    'T':  ('12:00', '18:00'),
}

def position_to_code(category, position_label):
    s = (position_label or '').upper()
    if category == 'Médico Plantonista':
        # "3. PLANT�O SN" → SN; "1. PLANTAO SD" → SD
        if 'SN' in s:
            return 'SN'
        return 'SD'
    # Diaristas: tudo SD
    return 'SD'

# === Coleta todos os shifts ===
all_shifts = []  # (name, date, code, start, end)
for s in data['shifts_diarismo']:
    code = position_to_code('Médico Diarista', s.get('position'))
    nm = lookup_name(s['name'])
    start, end = CODE_TO_TIME[code]
    all_shifts.append((nm, s['date'], CODE_TO_NAME[code], start, end))

for s in data['shifts_plantoes']:
    code = position_to_code('Médico Plantonista', s.get('position'))
    nm = lookup_name(s['name'])
    start, end = CODE_TO_TIME[code]
    all_shifts.append((nm, s['date'], CODE_TO_NAME[code], start, end))

for s in data['shifts_interconsultas']:
    code = s.get('shift_type') or 'M'
    if code not in CODE_TO_NAME:
        code = 'M'
    nm = lookup_name(s['name'])
    start, end = CODE_TO_TIME[code]
    all_shifts.append((nm, s['date'], CODE_TO_NAME[code], start, end))

print(f'Profissionais: {len(profs)}')
print(f'Empresas: {len(companies_clean)}')
print(f'Shifts: {len(all_shifts)}')

# === Monta o SQL ===
profs_values = ',\n  '.join([
    f"('{esc(p['name'])}', '{esc(p['company'] or 'FESF')}', '{esc(p['category'])}')"
    for p in profs
])
shifts_values = ',\n  '.join([
    f"('{esc(n)}', '{d}'::date, '{esc(t)}', '{s}'::time, '{e}'::time)"
    for n, d, t, s, e in all_shifts
])
companies_values = ',\n  '.join([f"('{esc(c)}')" for c in companies_clean])

sql = f"""-- =============================================================================
-- IMPORT MÉDICOS — MAIO/2026
-- {len(profs)} médicos · {len(all_shifts)} ocorrências de plantão
-- =============================================================================

-- 1) Empresas (idempotente)
INSERT INTO companies (name, active)
SELECT v.name, true
FROM (VALUES
  {companies_values}
) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM companies c WHERE c.name = v.name);

-- 2) Setor "Médicos" (idempotente)
INSERT INTO departments (name, active)
SELECT 'Médicos', true
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Médicos');

-- 3) Categorias dos médicos (idempotente)
INSERT INTO professional_categories (name, color, active)
SELECT v.name, v.color, true
FROM (VALUES
  ('Médico Plantonista',   '#0ea5e9'),
  ('Médico Diarista',      '#10b981'),
  ('Médico Interconsultor','#a855f7')
) AS v(name, color)
WHERE NOT EXISTS (SELECT 1 FROM professional_categories pc WHERE pc.name = v.name);

-- 4) Profissionais (idempotente — só cria se não existe)
WITH src(nome, empresa, categoria) AS (
  VALUES
  {profs_values}
)
INSERT INTO professionals (
  full_name, category_id, department_id, company_id, active
)
SELECT
  src.nome,
  (SELECT id FROM professional_categories WHERE name = src.categoria LIMIT 1),
  (SELECT id FROM departments WHERE name = 'Médicos' LIMIT 1),
  (SELECT id FROM companies WHERE name = src.empresa LIMIT 1),
  true
FROM src
WHERE NOT EXISTS (
  SELECT 1 FROM professionals p
  WHERE lower(translate(p.full_name,
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
      = lower(translate(src.nome,
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
);

-- 5) Escala Maio/2026 dos Médicos
INSERT INTO monthly_schedules (department_id, name, month, status)
SELECT
  (SELECT id FROM departments WHERE name = 'Médicos' LIMIT 1),
  'Escala Médicos - Maio de 2026',
  '2026-05-01'::date,
  'Rascunho'
WHERE NOT EXISTS (
  SELECT 1 FROM monthly_schedules ms
  JOIN departments d ON d.id = ms.department_id
  WHERE d.name = 'Médicos'
    AND EXTRACT(year FROM ms.month) = 2026
    AND EXTRACT(month FROM ms.month) = 5
);

-- 6) Insere os turnos
WITH shifts_data(nome, shift_date, shift_type, start_t, end_t) AS (
  VALUES
  {shifts_values}
),
resolved AS (
  SELECT
    sd.*,
    (SELECT p.id FROM professionals p
     WHERE lower(translate(p.full_name,
            'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
            'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
          = lower(translate(sd.nome,
            'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
            'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
       AND p.active = true
     ORDER BY p.created_at LIMIT 1) AS prof_id
  FROM shifts_data sd
)
INSERT INTO shifts (
  professional_id, schedule_id, department_id,
  shift_date, shift_type, start_time, end_time
)
SELECT
  r.prof_id,
  ms.id,
  d.id,
  r.shift_date,
  r.shift_type,
  r.start_t,
  r.end_t
FROM resolved r
JOIN departments d ON d.name = 'Médicos'
JOIN monthly_schedules ms
  ON ms.department_id = d.id AND ms.month = '2026-05-01'::date
WHERE r.prof_id IS NOT NULL;

-- 7) Verificação
SELECT COUNT(*) AS total_shifts FROM shifts s
JOIN monthly_schedules ms ON ms.id = s.schedule_id
JOIN departments d ON d.id = ms.department_id
WHERE d.name = 'Médicos'
  AND EXTRACT(year FROM ms.month) = 2026 AND EXTRACT(month FROM ms.month) = 5;

-- 8) Quem não casou
WITH shifts_data(nome, shift_date, shift_type, start_t, end_t) AS (
  VALUES
  {shifts_values}
)
SELECT DISTINCT nome FROM shifts_data sd
WHERE NOT EXISTS (
  SELECT 1 FROM professionals p
  WHERE lower(translate(p.full_name,
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
      = lower(translate(sd.nome,
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
);
"""

with open(r'C:/Users/adoni/OneDrive/Documentos/Gestão de escala/import_medicos_maio.sql', 'w', encoding='utf-8') as f:
    f.write(sql)

print(f'\nSQL gerado: import_medicos_maio.sql')
