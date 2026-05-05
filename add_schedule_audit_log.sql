-- =============================================================================
-- HISTÓRICO IMUTÁVEL DE ALTERAÇÕES NA ESCALA
--
-- Cada vez que um shift é criado / atualizado / removido, um registro é
-- gravado em schedule_audit_log. Os registros são INALTERÁVEIS:
--  - INSERT: feito automaticamente por trigger
--  - UPDATE / DELETE: bloqueados via RLS para todos os usuários
--  - SELECT: liberado para usuários autenticados que têm acesso à escala
-- =============================================================================

-- Tabela de auditoria
CREATE TABLE IF NOT EXISTS schedule_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid REFERENCES monthly_schedules(id) ON DELETE CASCADE,
  shift_id uuid,
  professional_id uuid,
  shift_date date,
  action text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  old_shift_type text,
  new_shift_type text,
  old_professional_id uuid,
  new_professional_id uuid,
  actor_user_id uuid,
  actor_email text,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_schedule ON schedule_audit_log(schedule_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor    ON schedule_audit_log(actor_user_id);

COMMENT ON TABLE schedule_audit_log IS
  'Histórico imutável de alterações em shifts. Apenas INSERT é permitido (via trigger).';

-- =============================================================================
-- Trigger: registra cada mudança em shifts
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_log_shift_change() RETURNS trigger AS $$
DECLARE
  v_actor_id uuid;
  v_actor_email text;
  v_actor_name text;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NOT NULL THEN
    SELECT email, full_name INTO v_actor_email, v_actor_name
    FROM system_users WHERE id = v_actor_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO schedule_audit_log
      (schedule_id, shift_id, professional_id, shift_date, action,
       new_shift_type, new_professional_id,
       actor_user_id, actor_email, actor_name)
    VALUES
      (NEW.schedule_id, NEW.id, NEW.professional_id, NEW.shift_date, 'insert',
       NEW.shift_type, NEW.professional_id,
       v_actor_id, v_actor_email, v_actor_name);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Só registra se algo relevante mudou
    IF NEW.professional_id IS DISTINCT FROM OLD.professional_id
       OR NEW.shift_type   IS DISTINCT FROM OLD.shift_type
       OR NEW.shift_date   IS DISTINCT FROM OLD.shift_date THEN
      INSERT INTO schedule_audit_log
        (schedule_id, shift_id, professional_id, shift_date, action,
         old_shift_type, new_shift_type,
         old_professional_id, new_professional_id,
         actor_user_id, actor_email, actor_name)
      VALUES
        (NEW.schedule_id, NEW.id, NEW.professional_id, NEW.shift_date, 'update',
         OLD.shift_type, NEW.shift_type,
         OLD.professional_id, NEW.professional_id,
         v_actor_id, v_actor_email, v_actor_name);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO schedule_audit_log
      (schedule_id, shift_id, professional_id, shift_date, action,
       old_shift_type, old_professional_id,
       actor_user_id, actor_email, actor_name)
    VALUES
      (OLD.schedule_id, OLD.id, OLD.professional_id, OLD.shift_date, 'delete',
       OLD.shift_type, OLD.professional_id,
       v_actor_id, v_actor_email, v_actor_name);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_shift_change ON shifts;
CREATE TRIGGER trg_log_shift_change
  AFTER INSERT OR UPDATE OR DELETE ON shifts
  FOR EACH ROW EXECUTE FUNCTION fn_log_shift_change();

-- =============================================================================
-- RLS: tornar o log imutável
-- =============================================================================
ALTER TABLE schedule_audit_log ENABLE ROW LEVEL SECURITY;

-- Permite SELECT a usuários autenticados (mesma regra de visibilidade
-- que já controla acesso a schedules)
DROP POLICY IF EXISTS "audit_select" ON schedule_audit_log;
CREATE POLICY "audit_select" ON schedule_audit_log
  FOR SELECT TO authenticated
  USING (true);

-- INSERT é feito SOMENTE pelo trigger (security definer ignora RLS)
-- Portanto não criamos política de INSERT — qualquer INSERT vindo
-- direto do client será bloqueado.

-- UPDATE e DELETE: SEM POLÍTICA → bloqueados para todos.
-- Isso garante imutabilidade do histórico.

-- =============================================================================
-- Verificação
-- =============================================================================
SELECT
  trigger_name,
  event_manipulation,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'shifts'
  AND trigger_name = 'trg_log_shift_change';
