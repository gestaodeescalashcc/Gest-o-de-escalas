/*
  # Corrigir politica SELECT para dados faciais

  1. Problema
    - A politica atual nao esta funcionando corretamente durante JOINs
    - Os dados faciais nao estao sendo retornados na consulta

  2. Solucao
    - Simplificar a politica SELECT para permitir leitura por usuarios autenticados
    - Manter as outras politicas de seguranca intactas
*/

-- Remover politica antiga
DROP POLICY IF EXISTS "Authenticated users can view facial data" ON professional_facial_data;

-- Criar politica simplificada para SELECT
-- Usuarios autenticados podem ver dados faciais
CREATE POLICY "Authenticated users can view facial data"
  ON professional_facial_data
  FOR SELECT
  TO authenticated
  USING (true);