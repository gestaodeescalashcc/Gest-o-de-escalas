-- Estas funções já existem em produção (criadas direto no banco, sem migração
-- versionada). Este arquivo só documenta/versiona o que já está rodando —
-- CREATE OR REPLACE com o corpo exato encontrado em produção, zero mudança de
-- comportamento. A partir daqui, qualquer alteração futura passa por migração.

CREATE OR REPLACE FUNCTION public.publish_schedule(p_schedule_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_published_at timestamptz := NOW();
  v_role_name text;
  v_allowed_depts uuid[];
  v_schedule_dept uuid;
  v_already boolean;
  v_count int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  -- Permissão: Coordenador (do setor) ou Administrador
  SELECT ur.name, su.allowed_departments
    INTO v_role_name, v_allowed_depts
  FROM system_users su
  JOIN user_roles ur ON ur.id = su.role_id
  WHERE su.id = v_uid AND su.active = true;

  IF v_role_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário sem perfil válido');
  END IF;

  SELECT ms.department_id, ms.published_at IS NOT NULL
    INTO v_schedule_dept, v_already
  FROM monthly_schedules ms
  WHERE ms.id = p_schedule_id;

  IF v_schedule_dept IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Escala não encontrada');
  END IF;

  IF v_already THEN
    RETURN jsonb_build_object('success', false, 'error', 'Escala já está publicada');
  END IF;

  -- Coordenador precisa ter o setor permitido; Administrador pode tudo
  IF v_role_name <> 'Administrador' THEN
    IF v_role_name <> 'Coordenador' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas Coordenador ou Administrador podem publicar');
    END IF;
    IF v_allowed_depts IS NOT NULL AND NOT (v_schedule_dept = ANY(v_allowed_depts)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Você não tem acesso a este setor');
    END IF;
  END IF;

  -- Snapshot de todos os shifts da escala
  UPDATE shifts
  SET original_shift_type = shift_type,
      original_start_time = start_time,
      original_end_time = end_time,
      original_company_id = company_id,
      original_professional_id = professional_id,
      published_at = v_published_at,
      updated_at = NOW()
  WHERE schedule_id = p_schedule_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Marca escala como publicada
  UPDATE monthly_schedules
  SET published_at = v_published_at,
      published_by = v_uid
  WHERE id = p_schedule_id;

  RETURN jsonb_build_object(
    'success', true,
    'published_at', v_published_at,
    'shifts_snapshotted', v_count
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_schedule_planning(p_schedule_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := NOW();
  v_role_name text;
  v_allowed_depts uuid[];
  v_schedule_dept uuid;
  v_already timestamptz;
  v_count int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT ur.name, su.allowed_departments INTO v_role_name, v_allowed_depts
  FROM system_users su JOIN user_roles ur ON ur.id = su.role_id
  WHERE su.id = v_uid AND su.active = true;

  IF v_role_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário sem perfil válido');
  END IF;

  SELECT department_id, published_at INTO v_schedule_dept, v_already
  FROM monthly_schedules WHERE id = p_schedule_id;

  IF v_schedule_dept IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Escala não encontrada');
  END IF;

  IF v_already IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Planejamento já está finalizado');
  END IF;

  IF v_role_name <> 'Administrador' THEN
    IF v_role_name <> 'Coordenador' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Apenas Coordenador ou Administrador podem finalizar');
    END IF;
    IF v_allowed_depts IS NOT NULL AND NOT (v_schedule_dept = ANY(v_allowed_depts)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Você não tem acesso a este setor');
    END IF;
  END IF;

  -- Snapshot dos plantões existentes (caso algum ainda não tenha original_*)
  UPDATE shifts
  SET original_shift_type = COALESCE(original_shift_type, shift_type),
      original_start_time = COALESCE(original_start_time, start_time),
      original_end_time = COALESCE(original_end_time, end_time),
      original_company_id = COALESCE(original_company_id, company_id),
      original_professional_id = COALESCE(original_professional_id, professional_id),
      published_at = COALESCE(published_at, v_now),
      updated_at = NOW()
  WHERE schedule_id = p_schedule_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE monthly_schedules
  SET published_at = v_now,
      published_by = v_uid
  WHERE id = p_schedule_id;

  RETURN jsonb_build_object('success', true, 'finalized_at', v_now, 'shifts', v_count);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reopen_schedule_planning(p_schedule_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role_name text;
BEGIN
  SELECT ur.name INTO v_role_name
  FROM system_users su JOIN user_roles ur ON ur.id = su.role_id
  WHERE su.id = auth.uid() AND su.active = true;

  IF v_role_name <> 'Administrador' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas Administrador');
  END IF;

  UPDATE monthly_schedules SET published_at = NULL, published_by = NULL
  WHERE id = p_schedule_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.unpublish_schedule(p_schedule_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role_name text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT ur.name INTO v_role_name
  FROM system_users su JOIN user_roles ur ON ur.id = su.role_id
  WHERE su.id = v_uid AND su.active = true;

  IF v_role_name <> 'Administrador' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas Administrador pode despublicar');
  END IF;

  UPDATE shifts
  SET original_shift_type = NULL,
      original_start_time = NULL,
      original_end_time = NULL,
      original_company_id = NULL,
      original_professional_id = NULL,
      published_at = NULL,
      updated_at = NOW()
  WHERE schedule_id = p_schedule_id;

  UPDATE monthly_schedules
  SET published_at = NULL, published_by = NULL
  WHERE id = p_schedule_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.shifts_auto_original_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_schedule_published timestamptz;
  v_schedule_created timestamptz;
BEGIN
  IF NEW.schedule_id IS NOT NULL THEN
    SELECT published_at, created_at INTO v_schedule_published, v_schedule_created
    FROM monthly_schedules WHERE id = NEW.schedule_id;
  END IF;

  -- Auto-finaliza se a escala foi criada há mais de 24h e ainda está em rascunho.
  -- Isso garante que mesmo coordenadoras que nunca clicam "Finalizar" terão a
  -- Planejada congelada automaticamente depois do período de montagem.
  IF v_schedule_published IS NULL
     AND v_schedule_created IS NOT NULL
     AND v_schedule_created < NOW() - INTERVAL '24 hours' THEN
    UPDATE monthly_schedules
       SET published_at = NOW()
     WHERE id = NEW.schedule_id;
    v_schedule_published := NOW();
  END IF;

  -- Escala ainda em rascunho (< 24h): popula original_* = current.
  -- Escala finalizada: deixa original_* NULL (só aparece na Realizada).
  IF v_schedule_published IS NULL THEN
    IF NEW.original_shift_type IS NULL THEN
      NEW.original_shift_type := NEW.shift_type;
    END IF;
    IF NEW.original_start_time IS NULL THEN
      NEW.original_start_time := NEW.start_time;
    END IF;
    IF NEW.original_end_time IS NULL THEN
      NEW.original_end_time := NEW.end_time;
    END IF;
    IF NEW.original_company_id IS NULL THEN
      NEW.original_company_id := NEW.company_id;
    END IF;
    IF NEW.original_professional_id IS NULL THEN
      NEW.original_professional_id := NEW.professional_id;
    END IF;
    IF NEW.published_at IS NULL THEN
      NEW.published_at := COALESCE(NEW.created_at, NOW());
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
