-- =============================================================================
-- TRILHA DE AUDITORIA UNIFICADA E IMUTÁVEL DAS ESCALAS
--
-- Registra, numa única linha do tempo, TUDO o que acontece numa escala:
--   • criação / edição / remoção de plantão (shifts)         -> trigger em shifts
--   • trocas e remanejamentos (mudança de profissional)      -> trigger em shifts
--   • soft-delete / restauração na Realizada                 -> trigger em shifts
--   • publicar / reabrir o planejamento                      -> trigger em monthly_schedules
--
-- Cada registro guarda QUEM (id + email + nome), QUANDO (data/hora) e O QUÊ
-- (ação + diff antes->depois de turno e profissional).
--
-- IMUTABILIDADE: só INSERT (feito pelos triggers, SECURITY DEFINER).
--   UPDATE e DELETE não têm policy => bloqueados para todos.
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- Rodar no SQL Editor do Supabase.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1) TABELA
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedule_audit_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id         uuid REFERENCES monthly_schedules(id) ON DELETE CASCADE,
  shift_id            uuid,
  professional_id     uuid,
  shift_date          date,
  action              text NOT NULL,
  old_shift_type      text,
  new_shift_type      text,
  old_professional_id uuid,
  new_professional_id uuid,
  note                text,                 -- contexto p/ eventos de escala (publicar/reabrir)
  actor_user_id       uuid,
  actor_email         text,
  actor_name          text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE schedule_audit_log IS
  'Trilha imutável de tudo que acontece nas escalas (plantões, trocas, soft-delete, publicar/reabrir). Apenas INSERT via trigger.';

-- Reforça o conjunto de ações aceitas (sem quebrar caso a tabela já exista).
ALTER TABLE schedule_audit_log DROP CONSTRAINT IF EXISTS schedule_audit_log_action_check;
ALTER TABLE schedule_audit_log
  ADD CONSTRAINT schedule_audit_log_action_check
  CHECK (action IN ('insert','update','delete','soft_delete','restore','publish','reopen'));

CREATE INDEX IF NOT EXISTS idx_sched_audit_schedule ON schedule_audit_log(schedule_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sched_audit_actor    ON schedule_audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_sched_audit_created  ON schedule_audit_log(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- 2) HELPER: resolve o ator atual (id/email/nome)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _audit_actor(OUT v_id uuid, OUT v_email text, OUT v_name text)
AS $$
BEGIN
  v_id := auth.uid();
  IF v_id IS NOT NULL THEN
    SELECT email, full_name INTO v_email, v_name FROM system_users WHERE id = v_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ─────────────────────────────────────────────────────────────────────────
-- 3) TRIGGER em SHIFTS: criação / edição / troca / soft-delete / restore / delete
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_log_shift_change() RETURNS trigger AS $$
DECLARE
  a_id uuid; a_email text; a_name text;
BEGIN
  SELECT v_id, v_email, v_name INTO a_id, a_email, a_name FROM _audit_actor();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO schedule_audit_log
      (schedule_id, shift_id, professional_id, shift_date, action,
       new_shift_type, new_professional_id, actor_user_id, actor_email, actor_name)
    VALUES
      (NEW.schedule_id, NEW.id, NEW.professional_id, NEW.shift_date, 'insert',
       NEW.shift_type, NEW.professional_id, a_id, a_email, a_name);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- soft-delete da Realizada
    IF NEW.deleted_in_realizada_at IS DISTINCT FROM OLD.deleted_in_realizada_at THEN
      INSERT INTO schedule_audit_log
        (schedule_id, shift_id, professional_id, shift_date, action,
         old_shift_type, new_shift_type, old_professional_id, new_professional_id,
         actor_user_id, actor_email, actor_name)
      VALUES
        (NEW.schedule_id, NEW.id, NEW.professional_id, NEW.shift_date,
         CASE WHEN NEW.deleted_in_realizada_at IS NOT NULL THEN 'soft_delete' ELSE 'restore' END,
         OLD.shift_type, NEW.shift_type, OLD.professional_id, NEW.professional_id,
         a_id, a_email, a_name);
    END IF;

    -- mudança real de turno / profissional / data (cobre trocas e remanejamentos)
    IF NEW.professional_id IS DISTINCT FROM OLD.professional_id
       OR NEW.shift_type   IS DISTINCT FROM OLD.shift_type
       OR NEW.shift_date   IS DISTINCT FROM OLD.shift_date THEN
      INSERT INTO schedule_audit_log
        (schedule_id, shift_id, professional_id, shift_date, action,
         old_shift_type, new_shift_type, old_professional_id, new_professional_id,
         actor_user_id, actor_email, actor_name)
      VALUES
        (NEW.schedule_id, NEW.id, NEW.professional_id, NEW.shift_date, 'update',
         OLD.shift_type, NEW.shift_type, OLD.professional_id, NEW.professional_id,
         a_id, a_email, a_name);
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO schedule_audit_log
      (schedule_id, shift_id, professional_id, shift_date, action,
       old_shift_type, old_professional_id, actor_user_id, actor_email, actor_name)
    VALUES
      (OLD.schedule_id, OLD.id, OLD.professional_id, OLD.shift_date, 'delete',
       OLD.shift_type, OLD.professional_id, a_id, a_email, a_name);
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_log_shift_change ON shifts;
CREATE TRIGGER trg_log_shift_change
  AFTER INSERT OR UPDATE OR DELETE ON shifts
  FOR EACH ROW EXECUTE FUNCTION fn_log_shift_change();

-- ─────────────────────────────────────────────────────────────────────────
-- 4) TRIGGER em MONTHLY_SCHEDULES: publicar / reabrir planejamento
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_log_schedule_publish() RETURNS trigger AS $$
DECLARE
  a_id uuid; a_email text; a_name text;
BEGIN
  IF NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    SELECT v_id, v_email, v_name INTO a_id, a_email, a_name FROM _audit_actor();
    INSERT INTO schedule_audit_log
      (schedule_id, action, note, actor_user_id, actor_email, actor_name)
    VALUES
      (NEW.id,
       CASE WHEN NEW.published_at IS NOT NULL THEN 'publish' ELSE 'reopen' END,
       CASE WHEN NEW.published_at IS NOT NULL
            THEN 'Planejamento publicado/congelado'
            ELSE 'Planejamento reaberto para edição' END,
       a_id, a_email, a_name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_log_schedule_publish ON monthly_schedules;
CREATE TRIGGER trg_log_schedule_publish
  AFTER UPDATE ON monthly_schedules
  FOR EACH ROW EXECUTE FUNCTION fn_log_schedule_publish();

-- ─────────────────────────────────────────────────────────────────────────
-- 5) RLS: leitura por visibilidade de setor; gravação só via trigger; imutável
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE schedule_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sched_audit_select" ON schedule_audit_log;
CREATE POLICY "sched_audit_select" ON schedule_audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM monthly_schedules ms
      JOIN system_users su ON su.id = auth.uid()
      WHERE ms.id = schedule_audit_log.schedule_id
        AND (su.allowed_departments IS NULL
             OR ms.department_id = ANY (su.allowed_departments))
    )
  );

-- Sem policy de INSERT/UPDATE/DELETE: o client não grava nem altera.
-- Os triggers são SECURITY DEFINER e ignoram RLS, então conseguem inserir.

-- ─────────────────────────────────────────────────────────────────────────
-- 6) VERIFICAÇÃO
-- ─────────────────────────────────────────────────────────────────────────
SELECT trigger_name, event_object_table, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_name IN ('trg_log_shift_change','trg_log_schedule_publish')
ORDER BY event_object_table, event_manipulation;
