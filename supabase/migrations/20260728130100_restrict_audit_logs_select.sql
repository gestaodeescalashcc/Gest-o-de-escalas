-- audit_logs_select_all liberava SELECT (qual: true) pra QUALQUER usuário
-- autenticado ver o audit log inteiro do sistema, de todos os setores.
-- Confirmado: nenhum lugar do frontend/edge functions lê a tabela genérica
-- `audit_logs` diretamente (o painel de histórico da escala lê
-- `schedule_audit_log`, uma tabela específica e diferente). A policy "Admins
-- can view audit logs" já cobre o único consumo legítimo. Restringe a
-- admin-only.

DROP POLICY IF EXISTS audit_logs_select_all ON public.audit_logs;
