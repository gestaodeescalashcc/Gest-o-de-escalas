-- =============================================================================
-- Move TODOS os profissionais de enfermagem (Enfermeiros + Técnicos)
-- da empresa "ALFA" para "FESF"
-- =============================================================================

-- 0) Confere que as duas empresas existem (ALFA origem, FESF destino)
SELECT id, name, active
FROM companies
WHERE name ILIKE 'ALFA%' OR name ILIKE 'FESF%'
ORDER BY name;

-- ⚠ Se "FESF" não existir, descomente abaixo para criar:
-- INSERT INTO companies (name, active) VALUES ('FESF', true)
-- ON CONFLICT (name) DO NOTHING;

-- 1) Preview: mostra quem vai ser afetado (rode antes do UPDATE)
SELECT
  p.full_name,
  pc.name AS categoria,
  c.name AS empresa_atual
FROM professionals p
JOIN professional_categories pc ON pc.id = p.category_id
LEFT JOIN companies c ON c.id = p.company_id
WHERE pc.name ILIKE '%enferm%'
  AND p.active = true
  AND (c.name ILIKE 'ALFA%' OR p.company_id IS NULL)
ORDER BY pc.name, p.full_name;

-- =============================================================================
-- 2) UPDATE: muda company_id para FESF apenas dos profissionais de enfermagem
--    que hoje estão em ALFA (ou sem empresa)
-- =============================================================================
UPDATE professionals p
SET company_id = (SELECT id FROM companies WHERE name ILIKE 'FESF%' LIMIT 1),
    updated_at = now()
FROM professional_categories pc
WHERE p.category_id = pc.id
  AND pc.name ILIKE '%enferm%'
  AND p.active = true
  AND (
    p.company_id = (SELECT id FROM companies WHERE name ILIKE 'ALFA%' LIMIT 1)
    OR p.company_id IS NULL
  );

-- 3) Verificação: lista todos os profissionais de enfermagem por empresa
SELECT
  c.name AS empresa,
  pc.name AS categoria,
  COUNT(*) AS qtd
FROM professionals p
JOIN professional_categories pc ON pc.id = p.category_id
LEFT JOIN companies c ON c.id = p.company_id
WHERE pc.name ILIKE '%enferm%'
  AND p.active = true
GROUP BY c.name, pc.name
ORDER BY c.name, pc.name;
