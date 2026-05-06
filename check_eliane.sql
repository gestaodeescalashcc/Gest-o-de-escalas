-- 1) Eliane existe na tabela professionals?
SELECT id, full_name, active,
       (SELECT name FROM professional_categories WHERE id = professionals.category_id) AS categoria,
       (SELECT name FROM departments WHERE id = professionals.department_id) AS setor,
       (SELECT name FROM companies WHERE id = professionals.company_id) AS empresa
FROM professionals
WHERE full_name ILIKE '%eliane%reis%';

-- 2) Quantos shifts ela tem em maio/2026?
SELECT COUNT(*) AS shifts_da_eliane
FROM shifts s
JOIN professionals p ON p.id = s.professional_id
JOIN monthly_schedules ms ON ms.id = s.schedule_id
WHERE p.full_name ILIKE '%eliane%reis%'
  AND EXTRACT(year FROM ms.month) = 2026
  AND EXTRACT(month FROM ms.month) = 5;

-- 3) Confere se o setor "Técnicos de Enfermagem" existe (com este nome exato)
SELECT id, name FROM departments WHERE name ILIKE '%técnicos%enferm%' OR name ILIKE '%tecnicos%enferm%';

-- 4) Confere se a categoria "Técnico de Enfermagem" existe
SELECT id, name FROM professional_categories WHERE name ILIKE '%técnico%enferm%' OR name ILIKE '%tecnico%enferm%';
