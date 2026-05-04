-- Mostra como cada coordenador está configurado e a quais setores tem acesso
SELECT
  su.email,
  su.full_name,
  ur.name AS role,
  CASE
    WHEN su.allowed_departments IS NULL THEN 'TODOS (sem restrição)'
    WHEN array_length(su.allowed_departments, 1) IS NULL THEN 'NENHUM (array vazio)'
    ELSE (
      SELECT string_agg(d.name, ', ' ORDER BY d.name)
      FROM departments d
      WHERE d.id = ANY(su.allowed_departments)
    )
  END AS setores_permitidos
FROM system_users su
JOIN user_roles ur ON ur.id = su.role_id
WHERE ur.name IN ('Coordenador', 'Gestor')
ORDER BY ur.name, su.full_name;
