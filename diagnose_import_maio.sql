-- =============================================================================
-- DIAGNÓSTICO: por que os shifts não foram inseridos no import_schedules_maio_2026
-- =============================================================================

-- 1) As 3 escalas foram realmente criadas?
SELECT ms.id, ms.name, ms.month, ms.department_id, d.name AS departamento
FROM monthly_schedules ms
LEFT JOIN departments d ON d.id = ms.department_id
WHERE ms.month = '2026-05-01'::date
ORDER BY d.name;

-- 2) Quantos shifts tem em cada escala de maio?
SELECT d.name AS setor, COUNT(s.id) AS qtd_shifts
FROM monthly_schedules ms
LEFT JOIN departments d ON d.id = ms.department_id
LEFT JOIN shifts s ON s.schedule_id = ms.id
WHERE ms.month = '2026-05-01'::date
GROUP BY d.name
ORDER BY d.name;

-- 3) Os nomes dos departamentos batem com o que está no SQL?
SELECT id, name FROM departments
WHERE name ILIKE '%enferm%' OR name ILIKE '%cme%'
ORDER BY name;

-- 4) Confere se a função norm_name existe
SELECT proname FROM pg_proc WHERE proname = 'norm_name';

-- 5) Teste manual: o nome do Excel casa com profissional?
--    Substitua 'LUCINÉIA DOS SANTOS ANDRADE' por outros nomes pra testar
SELECT
  p.id, p.full_name, p.active,
  pc.name AS categoria
FROM professionals p
LEFT JOIN professional_categories pc ON pc.id = p.category_id
WHERE lower(translate(p.full_name,
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
      = lower(translate('LUCINÉIA DOS SANTOS ANDRADE',
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'));
