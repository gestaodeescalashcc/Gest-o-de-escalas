-- =============================================================================
-- Cadastra ELIANE REIS DOS SANTOS e insere seus 13 turnos de maio/2026
-- =============================================================================

-- 1) Cadastra a profissional (idempotente — só cria se não existir)
INSERT INTO professionals (
  full_name, category_id, department_id, company_id, active
)
SELECT
  'Eliane Reis dos Santos',
  (SELECT id FROM professional_categories WHERE name ILIKE 'Técnico%enferm%' LIMIT 1),
  (SELECT id FROM departments WHERE name = 'Técnicos de Enfermagem' LIMIT 1),
  (SELECT id FROM companies WHERE name ILIKE 'FESF%' LIMIT 1),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM professionals
  WHERE lower(translate(full_name,
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
      = 'eliane reis dos santos'
);

-- 2) Insere os 13 turnos dela
WITH shifts_data(day, shift_type, start_t, end_t) AS (
  VALUES
    (1,  'Serviço Diurno (7h às 19h) 12h',  '07:00'::time, '19:00'::time),
    (3,  'Serviço Diurno (7h às 19h) 12h',  '07:00'::time, '19:00'::time),
    (5,  'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
    (8,  'Serviço Diurno (7h às 19h) 12h',  '07:00'::time, '19:00'::time),
    (11, 'Manhã (7h às 13h) 6h',            '07:00'::time, '13:00'::time),
    (13, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
    (15, 'Serviço Diurno (7h às 19h) 12h',  '07:00'::time, '19:00'::time),
    (17, 'Serviço Diurno (7h às 19h) 12h',  '07:00'::time, '19:00'::time),
    (21, 'Serviço Diurno (7h às 19h) 12h',  '07:00'::time, '19:00'::time),
    (23, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
    (26, 'Serviço Diurno (7h às 19h) 12h',  '07:00'::time, '19:00'::time),
    (28, 'Serviço Noturno (19h às 7h) 12h', '19:00'::time, '07:00'::time),
    (30, 'Serviço Diurno (7h às 19h) 12h',  '07:00'::time, '19:00'::time)
)
INSERT INTO shifts (
  professional_id, schedule_id, department_id,
  shift_date, shift_type, start_time, end_time
)
SELECT
  p.id,
  ms.id,
  d.id,
  make_date(2026, 5, sd.day),
  sd.shift_type,
  sd.start_t,
  sd.end_t
FROM shifts_data sd
CROSS JOIN professionals p
JOIN departments d ON d.name = 'Técnicos de Enfermagem'
JOIN monthly_schedules ms ON ms.department_id = d.id AND ms.month = '2026-05-01'::date
WHERE lower(translate(p.full_name,
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
      = 'eliane reis dos santos'
  AND p.active = true
ON CONFLICT DO NOTHING;

-- 3) Verificação final
SELECT
  d.name AS setor,
  COUNT(*) AS total
FROM shifts s
JOIN monthly_schedules ms ON ms.id = s.schedule_id
JOIN departments d ON d.id = ms.department_id
WHERE EXTRACT(year FROM ms.month) = 2026 AND EXTRACT(month FROM ms.month) = 5
GROUP BY d.name
ORDER BY d.name;

SELECT COUNT(*) AS total_geral FROM shifts s
JOIN monthly_schedules ms ON ms.id = s.schedule_id
WHERE EXTRACT(year FROM ms.month) = 2026 AND EXTRACT(month FROM ms.month) = 5;
