-- Pedido: "somente a coordenadora do RH faz cadastros e alterações de
-- funcionários". Cria role dedicado RH com CRUD completo em professionals e
-- acesso mínimo (leitura) no resto. Remove create/update/delete de
-- professionals de Coordenador e Diretoria Médica (Gestor mantém — pedido
-- explícito do dono). Administrador continua com acesso total (exceção
-- técnica).

INSERT INTO public.user_roles (name, description, permissions)
VALUES (
  'RH',
  'Cadastro e alterações de funcionários (RH) — acesso exclusivo à área de Profissionais',
  jsonb_build_object(
    'professionals', jsonb_build_object('read', true, 'create', true, 'update', true, 'delete', true),
    'schedules', jsonb_build_object('read', true, 'create', false, 'update', false, 'delete', false),
    'swaps', jsonb_build_object('read', false, 'create', false, 'update', false, 'delete', false, 'approve', false),
    'departments', jsonb_build_object('read', true, 'create', false, 'update', false, 'delete', false),
    'professional_categories', jsonb_build_object('read', true, 'create', false, 'update', false, 'delete', false),
    'companies', jsonb_build_object('read', true, 'create', false, 'update', false, 'delete', false),
    'reports', jsonb_build_object('read', true, 'export', true),
    'users', jsonb_build_object('read', false, 'create', false, 'update', false, 'delete', false),
    'absences', jsonb_build_object('read', true, 'create', false, 'update', false, 'delete', false)
  )
)
ON CONFLICT (name) DO NOTHING;

UPDATE public.user_roles
SET permissions = jsonb_set(
  jsonb_set(
    jsonb_set(permissions, '{professionals,create}', 'false'),
    '{professionals,update}', 'false'
  ),
  '{professionals,delete}', 'false'
)
WHERE name IN ('Coordenador', 'Diretoria Médica');
