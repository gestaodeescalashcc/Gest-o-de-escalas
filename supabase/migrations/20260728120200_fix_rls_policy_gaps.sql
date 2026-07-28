-- Auditoria de RLS encontrou 3 furos concretos onde uma policy PERMISSIVE
-- redundante anula (via OR) a restrição pretendida por outra policy, ou onde
-- um INSERT fica aberto sem necessidade real:
--
-- 1) meal_category_config: policies "meal_config_permissive_*" (só exige
--    estar autenticado) convivem com "meal_config_restrictive_*" (exige
--    user_has_permission). Postgres combina policies PERMISSIVE por OR, então
--    a permissiva sozinha já libera tudo pra qualquer autenticado.
-- 2) audit_logs: "only_trigger_can_insert_audit_logs" libera INSERT pra
--    role `public` (nem precisa estar logado). Desnecessário: quem escreve de
--    fato é audit_trigger_fn, um trigger SECURITY DEFINER em outras tabelas,
--    que já contorna RLS por conta própria. Confirmado: zero INSERT direto em
--    audit_logs no frontend.
-- 3) punch_audit_log: mesma situação ("System can insert punch audit", role
--    `public`, with_check true) — mas aqui HÁ inserts diretos do frontend
--    (PunchAdjustmentsView.tsx), sempre com user_id = auth.uid(). Troca por
--    uma policy que exige autenticação e dono correto.
-- 4) punch_receipts: "System can insert receipts" (authenticated, with_check
--    true, sem validar nada) não é usada pelo app — quem grava é a edge
--    function register-punch, que usa SUPABASE_SERVICE_ROLE_KEY (bypassa RLS
--    de qualquer forma). Remove a policy: fecha a superfície sem quebrar nada.

DROP POLICY IF EXISTS meal_config_permissive_select ON public.meal_category_config;
DROP POLICY IF EXISTS meal_config_permissive_insert ON public.meal_category_config;
DROP POLICY IF EXISTS meal_config_permissive_update ON public.meal_category_config;
DROP POLICY IF EXISTS meal_config_permissive_delete ON public.meal_category_config;

DROP POLICY IF EXISTS only_trigger_can_insert_audit_logs ON public.audit_logs;

DROP POLICY IF EXISTS "System can insert punch audit" ON public.punch_audit_log;
CREATE POLICY "Authenticated users can insert own punch audit"
  ON public.punch_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "System can insert receipts" ON public.punch_receipts;
