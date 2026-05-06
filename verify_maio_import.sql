-- =============================================================================
-- VERIFICAÇÃO: import de Maio/2026 está fiel às planilhas?
-- =============================================================================

-- 1) Totais por setor e por sigla (use pra comparar com o esperado)
--    Esperado:
--      Enfermeiros: 131 P + 43 MT + 6 SN + 1 SD = 181
--      CME:         24 SD + 2 M               = 26
--      Técnicos:    325 SD + 283 SN + 52 M + 26 P + 3 T = 689
--      TOTAL = 896
SELECT
  d.name AS setor,
  CASE
    WHEN s.shift_type ILIKE 'Plantão 24h%'   THEN 'P'
    WHEN s.shift_type ILIKE 'Manhã e Tarde%' THEN 'MT'
    WHEN s.shift_type ILIKE 'Serviço Diurno%' THEN 'SD'
    WHEN s.shift_type ILIKE 'Serviço Noturno%' THEN 'SN'
    WHEN s.shift_type ILIKE 'Manhã (7h%' OR s.shift_type ILIKE 'Manhã (8h%' THEN 'M'
    WHEN s.shift_type ILIKE 'Tarde%' THEN 'T'
    ELSE s.shift_type
  END AS sigla,
  COUNT(*) AS qtd
FROM shifts s
JOIN monthly_schedules ms ON ms.id = s.schedule_id
JOIN departments d ON d.id = ms.department_id
WHERE EXTRACT(year FROM ms.month) = 2026
  AND EXTRACT(month FROM ms.month) = 5
GROUP BY d.name, sigla
ORDER BY d.name, sigla;

-- 2) Por profissional: quem tem 0 turnos (deveria ter mas o nome não casou)
WITH profs_in_db AS (
  SELECT DISTINCT s.professional_id
  FROM shifts s
  JOIN monthly_schedules ms ON ms.id = s.schedule_id
  WHERE EXTRACT(year FROM ms.month) = 2026 AND EXTRACT(month FROM ms.month) = 5
)
SELECT
  p.full_name,
  pc.name AS categoria,
  d.name AS setor
FROM professionals p
JOIN professional_categories pc ON pc.id = p.category_id
JOIN departments d ON d.id = p.department_id
WHERE p.active = true
  AND pc.name ILIKE '%enferm%'
  AND d.name IN ('Enfermeiros', 'Técnicos de Enfermagem', 'Técnicos de Enfermagem CME')
  AND p.id NOT IN (SELECT professional_id FROM profs_in_db)
ORDER BY d.name, p.full_name;

-- 3) Total geral
SELECT COUNT(*) AS total_turnos_em_maio_2026
FROM shifts s
JOIN monthly_schedules ms ON ms.id = s.schedule_id
WHERE EXTRACT(year FROM ms.month) = 2026 AND EXTRACT(month FROM ms.month) = 5;
