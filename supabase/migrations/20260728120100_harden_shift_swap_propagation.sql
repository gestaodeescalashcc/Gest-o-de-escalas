-- Auditoria encontrou: a propagação Troca→Realizada (mover shifts.professional_id
-- quando uma troca é aprovada) só existia dentro das RPCs approve_shift_swap/
-- create_and_apply_swap. Um UPDATE direto em shift_swaps.status (SQL editor,
-- script, ou qualquer código futuro que esqueça de chamar a RPC) marcava a
-- troca como aprovada SEM mover ninguém de plantão. Também havia um caminho no
-- frontend (troca direta pela grade) que fazia 2 updates sequenciais não-
-- atômicos em shifts + 1 insert separado em shift_swaps — se o 2º update
-- falhasse, ficava um "meio-swap" sem registro.
--
-- Fix: mover a propagação para um trigger em shift_swaps, disparado sempre
-- que uma linha nasce ou passa a ter status = 'Aprovado'. Isso a torna
-- garantida no nível de banco, independente de qual código chamou o insert/
-- update (RPC, script manual, ou o insert simples usado na "cessão simples").
-- Idempotente (IS DISTINCT FROM), então não quebra nada mesmo rodando "por
-- cima" do que as RPCs já fazem.

ALTER TABLE public.shift_swaps
  ADD CONSTRAINT shift_swaps_status_check
  CHECK (status IN ('Pendente', 'Aprovado', 'Recusado', 'Cancelado'));

CREATE OR REPLACE FUNCTION public.propagate_shift_swap_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE shifts
  SET professional_id = NEW.target_professional_id,
      updated_at = NOW()
  WHERE id = NEW.original_shift_id
    AND professional_id IS DISTINCT FROM NEW.target_professional_id;

  IF NEW.offered_shift_id IS NOT NULL THEN
    UPDATE shifts
    SET professional_id = NEW.requesting_professional_id,
        updated_at = NOW()
    WHERE id = NEW.offered_shift_id
      AND professional_id IS DISTINCT FROM NEW.requesting_professional_id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_propagate_shift_swap_approval_insert
  AFTER INSERT ON public.shift_swaps
  FOR EACH ROW
  WHEN (NEW.status = 'Aprovado')
  EXECUTE FUNCTION public.propagate_shift_swap_approval();

CREATE TRIGGER trg_propagate_shift_swap_approval_update
  AFTER UPDATE OF status ON public.shift_swaps
  FOR EACH ROW
  WHEN (NEW.status = 'Aprovado' AND OLD.status IS DISTINCT FROM 'Aprovado')
  EXECUTE FUNCTION public.propagate_shift_swap_approval();
