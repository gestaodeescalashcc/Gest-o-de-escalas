-- =============================================================================
-- DIAGNÓSTICO E LIMPEZA DE PROFISSIONAIS DUPLICADOS
--
-- Encontra profissionais com nome praticamente igual (ignorando acentos/caso/pontos)
-- e mostra dados pra você decidir quais consolidar.
-- =============================================================================

-- 1. Listar grupos de duplicatas (mesmo nome normalizado)
WITH normalized AS (
  SELECT
    id,
    full_name,
    cpf,
    registration_number,
    department_id,
    category_id,
    company_id,
    active,
    created_at,
    -- chave de normalização: minúsculo, sem acentos, sem pontuação, espaços únicos
    regexp_replace(
      lower(unaccent(full_name)),
      '[^a-z0-9 ]+', '', 'g'
    ) AS norm_name
  FROM professionals
)
SELECT
  norm_name,
  COUNT(*) as duplicatas,
  array_agg(
    json_build_object(
      'id', id,
      'name', full_name,
      'cpf', cpf,
      'matricula', registration_number,
      'active', active,
      'created_at', created_at
    ) ORDER BY active DESC, created_at
  ) AS detalhes
FROM normalized
GROUP BY norm_name
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC, norm_name;
