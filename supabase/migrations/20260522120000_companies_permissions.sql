-- Habilita CRUD de empresas para Diretoria Médica (que precisa cadastrar
-- empresas terceirizadas onde médicos prestam serviço) e create/update
-- para Coordenador/Gestor (sem delete, que continua só pro Admin).
UPDATE user_roles
SET permissions = jsonb_set(
      COALESCE(permissions, '{}'::jsonb),
      '{companies}',
      '{"read":true,"create":true,"update":true,"delete":true}'::jsonb
    ),
    updated_at = now()
WHERE name = 'Diretoria Médica';

UPDATE user_roles
SET permissions = jsonb_set(
      permissions, '{companies}',
      '{"read":true,"create":true,"update":true,"delete":false}'::jsonb
    ),
    updated_at = now()
WHERE name IN ('Coordenador','Gestor');
