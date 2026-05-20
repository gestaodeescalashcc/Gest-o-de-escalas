-- =========================================================================
-- HARDEN SHIFT SWAPS
--
-- Endurece a feature de trocas de plantão com atomicidade, validações e
-- histórico automático.
--
-- 1) RPC approve_shift_swap(swap_id): aprova troca de forma ATÔMICA
--    (transação única - aplica nos shifts e marca status)
-- 2) RPC reject_shift_swap(swap_id, reason): recusa atomicamente,
--    persistindo motivo em shift_swaps.notes
-- 3) RPC create_and_apply_swap(...): cria swap Aprovado e aplica nos
--    shifts em uma única transação (fluxo não-médico do CreateSwapModal)
-- 4) Trigger anti-conflito em shift_swaps: bloqueia INSERT/UPDATE quando
--    shifts envolvidos não pertencem aos profissionais declarados ou
--    quando já estão em outra troca Pendente.
-- 5) Trigger de histórico em shifts: popula shift_history sempre que
--    shifts.professional_id muda (auditoria de cessões/trocas).
-- =========================================================================

-- ---------- 1) approve_shift_swap RPC ----------
CREATE OR REPLACE FUNCTION public.approve_shift_swap(p_swap_id uuid)
RETURNS shift_swaps
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_swap shift_swaps;
  v_user uuid := auth.uid();
BEGIN
  SELECT * INTO v_swap FROM shift_swaps WHERE id = p_swap_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Troca não encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_swap.status <> 'Pendente' THEN
    RAISE EXCEPTION 'Apenas trocas Pendentes podem ser aprovadas (status atual: %)', v_swap.status USING ERRCODE = 'P0001';
  END IF;

  IF v_swap.offered_shift_id IS NOT NULL THEN
    UPDATE shifts SET professional_id = v_swap.target_professional_id     WHERE id = v_swap.original_shift_id;
    UPDATE shifts SET professional_id = v_swap.requesting_professional_id WHERE id = v_swap.offered_shift_id;
  ELSE
    UPDATE shifts SET professional_id = v_swap.target_professional_id WHERE id = v_swap.original_shift_id;
  END IF;

  UPDATE shift_swaps
  SET status = 'Aprovado',
      responded_at = now(),
      approved_by = v_user,
      approved_at = now(),
      updated_at = now()
  WHERE id = p_swap_id
  RETURNING * INTO v_swap;

  RETURN v_swap;
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_shift_swap(uuid) TO authenticated;

-- ---------- 2) reject_shift_swap RPC ----------
CREATE OR REPLACE FUNCTION public.reject_shift_swap(p_swap_id uuid, p_reason text)
RETURNS shift_swaps
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_swap shift_swaps;
  v_user uuid := auth.uid();
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Motivo da recusa é obrigatório' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_swap FROM shift_swaps WHERE id = p_swap_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Troca não encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_swap.status <> 'Pendente' THEN
    RAISE EXCEPTION 'Apenas trocas Pendentes podem ser recusadas (status atual: %)', v_swap.status USING ERRCODE = 'P0001';
  END IF;

  UPDATE shift_swaps
  SET status = 'Recusado',
      responded_at = now(),
      notes = p_reason,
      approved_by = v_user,
      updated_at = now()
  WHERE id = p_swap_id
  RETURNING * INTO v_swap;

  RETURN v_swap;
END;
$$;
GRANT EXECUTE ON FUNCTION public.reject_shift_swap(uuid, text) TO authenticated;

-- ---------- 3) create_and_apply_swap RPC ----------
CREATE OR REPLACE FUNCTION public.create_and_apply_swap(
  p_original_shift_id uuid,
  p_offered_shift_id uuid,
  p_requesting_professional_id uuid,
  p_target_professional_id uuid,
  p_reason text
)
RETURNS shift_swaps
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_swap shift_swaps;
  v_user uuid := auth.uid();
  v_now timestamptz := now();
BEGIN
  IF p_offered_shift_id IS NULL THEN
    RAISE EXCEPTION 'create_and_apply_swap requer offered_shift_id (use INSERT direto para cessão simples Pendente)' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO shift_swaps (
    original_shift_id, offered_shift_id,
    requesting_professional_id, target_professional_id,
    reason, status, responded_at, approved_by, approved_at
  ) VALUES (
    p_original_shift_id, p_offered_shift_id,
    p_requesting_professional_id, p_target_professional_id,
    COALESCE(NULLIF(trim(p_reason), ''), 'Troca recíproca aprovada'),
    'Aprovado', v_now, v_user, v_now
  ) RETURNING * INTO v_swap;

  UPDATE shifts SET professional_id = p_target_professional_id     WHERE id = p_original_shift_id;
  UPDATE shifts SET professional_id = p_requesting_professional_id WHERE id = p_offered_shift_id;

  RETURN v_swap;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_and_apply_swap(uuid, uuid, uuid, uuid, text) TO authenticated;

-- ---------- 4) Trigger anti-conflito em shift_swaps ----------
CREATE OR REPLACE FUNCTION public.validate_shift_swap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_orig_prof uuid;
  v_off_prof  uuid;
BEGIN
  -- Em UPDATE de status/notes apenas (sem mudar shifts/professionals), pula validação
  IF TG_OP = 'UPDATE' AND
     NEW.original_shift_id = OLD.original_shift_id AND
     NEW.offered_shift_id IS NOT DISTINCT FROM OLD.offered_shift_id AND
     NEW.requesting_professional_id = OLD.requesting_professional_id AND
     NEW.target_professional_id = OLD.target_professional_id THEN
    RETURN NEW;
  END IF;

  -- (1) shift original deve pertencer ao requesting
  SELECT professional_id INTO v_orig_prof FROM shifts WHERE id = NEW.original_shift_id;
  IF v_orig_prof IS NULL THEN
    RAISE EXCEPTION 'Plantão original não encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF v_orig_prof <> NEW.requesting_professional_id THEN
    RAISE EXCEPTION 'O plantão original não pertence ao solicitante' USING ERRCODE = 'P0001';
  END IF;

  -- (2) shift oferecido (se houver) deve pertencer ao target
  IF NEW.offered_shift_id IS NOT NULL THEN
    SELECT professional_id INTO v_off_prof FROM shifts WHERE id = NEW.offered_shift_id;
    IF v_off_prof IS NULL THEN
      RAISE EXCEPTION 'Plantão oferecido não encontrado' USING ERRCODE = 'P0002';
    END IF;
    IF v_off_prof <> NEW.target_professional_id THEN
      RAISE EXCEPTION 'O plantão oferecido não pertence ao destinatário' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- (3) original não pode estar em outra troca Pendente
  IF EXISTS (
    SELECT 1 FROM shift_swaps
    WHERE status = 'Pendente'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (original_shift_id = NEW.original_shift_id
           OR offered_shift_id = NEW.original_shift_id)
  ) THEN
    RAISE EXCEPTION 'O plantão original já está em outra troca pendente' USING ERRCODE = 'P0001';
  END IF;

  -- (4) oferecido (se houver) não pode estar em outra troca Pendente
  IF NEW.offered_shift_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM shift_swaps
    WHERE status = 'Pendente'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (original_shift_id = NEW.offered_shift_id
           OR offered_shift_id = NEW.offered_shift_id)
  ) THEN
    RAISE EXCEPTION 'O plantão oferecido já está em outra troca pendente' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_shift_swap ON public.shift_swaps;
CREATE TRIGGER trg_validate_shift_swap
  BEFORE INSERT OR UPDATE ON public.shift_swaps
  FOR EACH ROW EXECUTE FUNCTION public.validate_shift_swap();

-- ---------- 5) Trigger de histórico em shifts ----------
CREATE OR REPLACE FUNCTION public.log_shift_professional_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.professional_id IS DISTINCT FROM OLD.professional_id THEN
    INSERT INTO shift_history (shift_id, action_type, performed_by, details)
    VALUES (
      NEW.id,
      'professional_changed',
      auth.uid(),
      jsonb_build_object(
        'previous_professional_id', OLD.professional_id,
        'new_professional_id', NEW.professional_id,
        'shift_date', NEW.shift_date,
        'department_id', NEW.department_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_shift_professional_change ON public.shifts;
CREATE TRIGGER trg_log_shift_professional_change
  AFTER UPDATE OF professional_id ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.log_shift_professional_change();
