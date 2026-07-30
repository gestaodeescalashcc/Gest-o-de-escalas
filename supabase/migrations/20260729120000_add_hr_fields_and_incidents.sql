-- Pedido dos usuários: campos novos de RH no cadastro de profissional +
-- histórico de eventos/acidentes por colaborador. Todas as colunas são
-- nullable (não quebra dado existente); status continua usando os campos
-- já existentes (active/on_leave/leave_reason/leave_started_at), só ganha
-- leave_end_date pra completar "Licença Médica com data-fim".

ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS cbo text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_agency text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS admission_process_number text,
  ADD COLUMN IF NOT EXISTS termination_process_number text,
  ADD COLUMN IF NOT EXISTS termination_date date,
  ADD COLUMN IF NOT EXISTS labor_restriction text,
  ADD COLUMN IF NOT EXISTS leave_end_date date;

CREATE TABLE IF NOT EXISTS public.professional_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  event_date date NOT NULL,
  event_type text NOT NULL,
  description text,
  created_by uuid REFERENCES public.system_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_professional_incidents_professional
  ON public.professional_incidents (professional_id, event_date);

ALTER TABLE public.professional_incidents ENABLE ROW LEVEL SECURITY;

-- Espelha o acesso de professionals: leitura segue permissão de leitura de
-- professionals; escrita só quem tem professionals.update (RH/Gestor/Admin).
CREATE POLICY professional_incidents_select ON public.professional_incidents
  FOR SELECT TO authenticated
  USING (user_has_permission('professionals', 'read'));

CREATE POLICY professional_incidents_insert ON public.professional_incidents
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission('professionals', 'update'));

CREATE POLICY professional_incidents_update ON public.professional_incidents
  FOR UPDATE TO authenticated
  USING (user_has_permission('professionals', 'update'))
  WITH CHECK (user_has_permission('professionals', 'update'));

CREATE POLICY professional_incidents_delete ON public.professional_incidents
  FOR DELETE TO authenticated
  USING (user_has_permission('professionals', 'delete'));
