-- unpublish_schedule (RPC) não tem nenhuma chamada no frontend (só aparece
-- em database.types.ts, que é gerado do schema — não é uso real). O fluxo
-- de "voltar a Planejada pra rascunho" hoje é feito por
-- reopen_schedule_planning, que preserva os campos original_* (só limpa
-- published_at). unpublish_schedule fazia algo mais destrutivo (zerava
-- original_professional_id/shift_type/etc. também) e não é chamado por
-- ninguém — remove pra não ficar um botão de pânico não-testado disponível
-- via RPC direto.

DROP FUNCTION IF EXISTS public.unpublish_schedule(uuid);
