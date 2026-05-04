-- =============================================================================
-- DIAGNÓSTICO: identificar profissionais com nome "Wellington"
-- =============================================================================

-- 1. Listar TODOS os profissionais com "Wellington" no nome
SELECT
  p.id,
  p.full_name,
  p.active,
  p.cpf,
  p.registration_number,
  c.name AS categoria,
  d.name AS setor
FROM professionals p
LEFT JOIN professional_categories c ON c.id = p.category_id
LEFT JOIN departments d ON d.id = p.department_id
WHERE unaccent(lower(p.full_name)) LIKE '%wellington%'
ORDER BY p.full_name;

-- 2. Quantos turnos cada Wellington tem em junho/2026?
SELECT
  p.id,
  p.full_name,
  d.name AS setor,
  COUNT(s.id) AS turnos_junho_2026
FROM professionals p
LEFT JOIN departments d ON d.id = p.department_id
LEFT JOIN shifts s ON s.professional_id = p.id
  AND s.shift_date >= '2026-06-01'
  AND s.shift_date <= '2026-06-30'
WHERE unaccent(lower(p.full_name)) LIKE '%wellington%'
GROUP BY p.id, p.full_name, d.name
ORDER BY p.full_name;
