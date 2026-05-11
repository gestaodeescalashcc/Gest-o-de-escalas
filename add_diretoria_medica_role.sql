-- =============================================================================
-- Cria a role "Diretoria Médica" com permissão pra aprovar trocas
-- =============================================================================

INSERT INTO user_roles (name, permissions)
SELECT 'Diretoria Médica', '{
  "swaps":         {"read": true, "create": true, "update": true, "delete": true, "approve": true},
  "schedules":     {"read": true, "create": false, "update": false, "delete": false},
  "professionals": {"read": true, "create": false, "update": false, "delete": false},
  "absences":      {"read": true, "create": false, "update": false, "delete": false},
  "departments":   {"read": true, "create": false, "update": false, "delete": false},
  "reports":       {"read": true, "export": true}
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE name = 'Diretoria Médica');

SELECT name, permissions FROM user_roles WHERE name = 'Diretoria Médica';
