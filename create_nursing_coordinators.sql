-- =============================================================================
-- Cria 2 coordenadoras de enfermagem (Aline e Denif) com o mesmo nível de
-- acesso da Ana Rafaela: mesmo role_id e mesmos allowed_departments.
--
-- PRÉ-REQUISITO:
-- 1. Convide essas 2 contas no Supabase Auth (Authentication → Users → Invite)
--    com os emails:
--      - alinedsantos@fesfsus.ba.gov.br
--      - denifsouza25@hotmail.com
--
-- 2. Depois de aceitarem o convite (ou criadas com senha temporária pelo
--    admin), elas terão um id em auth.users.
--
-- 3. Rode este SQL para vincular o perfil de Coordenador (mesmo da Rafaela).
-- =============================================================================

-- 0) Confere se os auth.users já existem
SELECT
  email,
  CASE WHEN id IS NULL THEN '⚠ NÃO ENCONTRADO — convide no Supabase Auth primeiro'
       ELSE 'ok'
  END AS status
FROM (
  SELECT 'alinedsantos@fesfsus.ba.gov.br' AS email
  UNION ALL SELECT 'denifsouza25@hotmail.com'
) e
LEFT JOIN auth.users u ON u.email = e.email;

-- 1) Pega o template (Rafaela) — confere se existe e qual é o role/setores
WITH rafaela AS (
  SELECT id, role_id, allowed_departments, full_name
  FROM system_users
  WHERE LOWER(full_name) LIKE '%rafaela%'
    AND active = true
  LIMIT 1
)
SELECT * FROM rafaela;

-- =============================================================================
-- 2) UPSERT — cria ou atualiza o system_users das duas coordenadoras
--    espelhando o role_id e allowed_departments da Rafaela.
-- =============================================================================
INSERT INTO system_users (id, email, full_name, role_id, allowed_departments, active)
SELECT
  u.id,
  u.email,
  CASE u.email
    WHEN 'alinedsantos@fesfsus.ba.gov.br' THEN 'Aline Santos'
    WHEN 'denifsouza25@hotmail.com'      THEN 'Denif Souza'
  END,
  rf.role_id,
  rf.allowed_departments,
  true
FROM auth.users u
CROSS JOIN (
  SELECT role_id, allowed_departments
  FROM system_users
  WHERE LOWER(full_name) LIKE '%rafaela%' AND active = true
  LIMIT 1
) rf
WHERE u.email IN ('alinedsantos@fesfsus.ba.gov.br', 'denifsouza25@hotmail.com')
ON CONFLICT (id) DO UPDATE
SET role_id             = EXCLUDED.role_id,
    allowed_departments = EXCLUDED.allowed_departments,
    active              = true;

-- 3) Verificação final — mostra as 3 coordenadoras lado a lado
SELECT
  su.email,
  su.full_name,
  ur.name AS perfil,
  CASE
    WHEN su.allowed_departments IS NULL THEN 'TODOS'
    ELSE (
      SELECT string_agg(d.name, ', ' ORDER BY d.name)
      FROM departments d
      WHERE d.id = ANY(su.allowed_departments)
    )
  END AS setores_permitidos,
  su.active
FROM system_users su
JOIN user_roles ur ON ur.id = su.role_id
WHERE LOWER(su.full_name) LIKE '%rafaela%'
   OR su.email IN ('alinedsantos@fesfsus.ba.gov.br', 'denifsouza25@hotmail.com')
ORDER BY su.full_name;
