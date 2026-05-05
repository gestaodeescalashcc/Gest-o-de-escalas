-- =============================================================================
-- DEBUG: roda CADA query separadamente e me cola o resultado
-- =============================================================================

-- ============ QUERY 1: as 3 escalas existem? ============
SELECT ms.id, ms.name, ms.month, d.name AS departamento
FROM monthly_schedules ms
LEFT JOIN departments d ON d.id = ms.department_id
WHERE EXTRACT(year FROM ms.month) = 2026 AND EXTRACT(month FROM ms.month) = 5
ORDER BY d.name;

-- ============ QUERY 2: existem shifts em qualquer escala de maio/2026? ============
SELECT d.name AS setor, COUNT(s.id) AS qtd_shifts
FROM monthly_schedules ms
LEFT JOIN departments d ON d.id = ms.department_id
LEFT JOIN shifts s ON s.schedule_id = ms.id
WHERE EXTRACT(year FROM ms.month) = 2026 AND EXTRACT(month FROM ms.month) = 5
GROUP BY d.name
ORDER BY d.name;

-- ============ QUERY 3: setores existem com EXATAMENTE esses nomes? ============
SELECT id, name FROM departments
WHERE name IN ('Enfermeiros', 'Técnicos de Enfermagem', 'Técnicos de Enfermagem CME')
   OR name ILIKE '%enferm%' OR name ILIKE '%cme%';

-- ============ QUERY 4: testa um match conhecido (LUCINÉIA) ============
-- Se retornar 1 linha, o match exato funciona.
SELECT p.id, p.full_name, p.active
FROM professionals p
WHERE lower(translate(p.full_name,
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
      = lower(translate('LUCINÉIA DOS SANTOS ANDRADE',
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
  AND p.active = true;
