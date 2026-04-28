-- =============================================================================
-- DAR PERMISSÃO DE DELETE EM SCHEDULES PARA COORDENADORES E GESTORES
--
-- Motivo: Coordenadores precisam poder limpar/remover turnos da escala que
-- estão montando. Sem essa permissão, o DELETE em shifts é bloqueado pelo
-- RLS e o botão "Limpar Todos os Dias" não funciona (silenciosamente).
--
-- Isso só afeta escalas que ainda estão em Rascunho — escalas Publicadas
-- já são protegidas no frontend (não mostra botão de edição para não-admin).
-- =============================================================================

-- Coordenador
UPDATE user_roles
SET permissions = jsonb_set(
  permissions,
  '{schedules,delete}',
  'true'::jsonb,
  true
)
WHERE name = 'Coordenador';

-- Gestor
UPDATE user_roles
SET permissions = jsonb_set(
  permissions,
  '{schedules,delete}',
  'true'::jsonb,
  true
)
WHERE name = 'Gestor';

-- Verificação
SELECT
  name,
  (permissions -> 'schedules') AS schedules_perms
FROM user_roles
WHERE name IN ('Administrador', 'Gestor', 'Coordenador', 'Visualizador')
ORDER BY name;
