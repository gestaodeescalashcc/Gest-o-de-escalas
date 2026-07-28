-- BUG REAL encontrado testando o fluxo de troca (shift_swaps tinha 0 linhas
-- em produção — esse caminho nunca tinha sido exercitado com dado real):
--
-- Quando os dois plantões de uma troca recíproca têm o MESMO
-- department_id/shift_date/start_time/end_time/schedule_id (o caso mais
-- comum: dois profissionais trocando o mesmo tipo de plantão no mesmo dia),
-- mover o plantão A pro dono do plantão B viola o índice único parcial
-- `shifts_unique_with_schedule` — porque no instante do UPDATE, o plantão B
-- AINDA pertence ao profissional B, então a linha resultante do plantão A
-- (mesmo dept/data/horário/escala, professional_id = B) colide com a linha
-- do próprio plantão B. Isso é pré-existente em `approve_shift_swap` e
-- `create_and_apply_swap` (não foi introduzido pela migração anterior) — só
-- nunca tinha sido pego porque não havia troca real em produção.
--
-- Fix: no trigger de propagação, libera as duas linhas pra NULL primeiro
-- (múltiplos NULL nunca colidem num índice único) e só then escreve os
-- valores finais trocados. E os dois RPCs deixam de fazer o UPDATE em
-- shifts por conta própria — a propagação passa a ser 100% responsabilidade
-- do trigger (fonte única, sem lógica duplicada/divergente entre os 2 RPCs).

CREATE OR REPLACE FUNCTION public.propagate_shift_swap_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.offered_shift_id IS NOT NULL THEN
    -- Troca recíproca: libera as duas linhas antes de trocar, pra não colidir
    -- com o índice único parcial (professional_id, department_id, shift_date,
    -- start_time, end_time, schedule_id) quando os 2 plantões são idênticos
    -- em tudo menos o dono.
    UPDATE shifts
    SET professional_id = NULL, updated_at = NOW()
    WHERE id IN (NEW.original_shift_id, NEW.offered_shift_id);

    UPDATE shifts
    SET professional_id = NEW.target_professional_id, updated_at = NOW()
    WHERE id = NEW.original_shift_id;

    UPDATE shifts
    SET professional_id = NEW.requesting_professional_id, updated_at = NOW()
    WHERE id = NEW.offered_shift_id;
  ELSE
    -- Cessão simples: mesma proteção, só que num único plantão (idempotente
    -- via IS DISTINCT FROM — não faz nada se já estiver no valor certo).
    UPDATE shifts
    SET professional_id = NULL, updated_at = NOW()
    WHERE id = NEW.original_shift_id
      AND professional_id IS DISTINCT FROM NEW.target_professional_id;

    UPDATE shifts
    SET professional_id = NEW.target_professional_id, updated_at = NOW()
    WHERE id = NEW.original_shift_id
      AND professional_id IS DISTINCT FROM NEW.target_professional_id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_shift_swap(p_swap_id uuid)
 RETURNS shift_swaps
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- A propagação pros shifts é feita pelo trigger
  -- trg_propagate_shift_swap_approval_update, disparado por este UPDATE
  -- (fonte única da lógica de troca, evita duplicar o bug em 2 lugares).
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
$function$;

CREATE OR REPLACE FUNCTION public.create_and_apply_swap(p_original_shift_id uuid, p_offered_shift_id uuid, p_requesting_professional_id uuid, p_target_professional_id uuid, p_reason text)
 RETURNS shift_swaps
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_swap shift_swaps;
  v_user uuid := auth.uid();
  v_now timestamptz := now();
BEGIN
  IF p_offered_shift_id IS NULL THEN
    RAISE EXCEPTION 'create_and_apply_swap requer offered_shift_id (use insert direto se for cessão simples Pendente)' USING ERRCODE = 'P0001';
  END IF;

  -- Insere já Aprovado (trigger valida ownership/conflitos via
  -- trg_validate_shift_swap e propaga pros shifts via
  -- trg_propagate_shift_swap_approval_insert).
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

  RETURN v_swap;
END;
$function$;
