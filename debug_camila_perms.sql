-- 1) Verifica system_users da Camila e sua role
SELECT
  su.email,
  su.full_name,
  ur.name AS role,
  ur.permissions,
  su.allowed_departments,
  array_length(su.allowed_departments, 1) AS qtd_setores,
  (SELECT array_agg(d.name)
   FROM departments d
   WHERE d.id = ANY(su.allowed_departments)) AS setores_nomes,
  su.active
FROM system_users su
LEFT JOIN user_roles ur ON ur.id = su.role_id
WHERE su.email = 'camilanossa@fesfsus.ba.gov.br';

-- 2) Verifica também o que tem em raw_app_meta_data (algumas regras
--    podem estar lá e fazer isAdmin() retornar true)
SELECT
  u.email,
  u.raw_app_meta_data,
  u.raw_user_meta_data
FROM auth.users u
WHERE u.email = 'camilanossa@fesfsus.ba.gov.br';

-- 3) Verifica permissões da role Coordenador no banco
SELECT name, permissions FROM user_roles WHERE name = 'Coordenador';
