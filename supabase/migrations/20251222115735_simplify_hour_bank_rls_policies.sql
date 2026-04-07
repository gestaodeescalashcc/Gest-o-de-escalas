/*
  # Simplificar politicas RLS do Banco de Horas

  As politicas anteriores eram muito restritivas e causavam lentidao.
  Simplificando para permitir leitura por usuarios autenticados.
*/

-- Remover politicas antigas
DROP POLICY IF EXISTS "hb_entries_select" ON hour_bank_entries;
DROP POLICY IF EXISTS "hb_compensations_select" ON hour_bank_compensations;

-- Criar politicas simplificadas
CREATE POLICY "hour_bank_entries_select_auth"
  ON hour_bank_entries FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "hour_bank_compensations_select_auth"
  ON hour_bank_compensations FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);