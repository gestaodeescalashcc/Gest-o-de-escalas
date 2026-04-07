/*
  # Adicionar Empresas e Atualizar Profissionais

  1. Nova Tabela `companies`
    - `id` (uuid, primary key)
    - `name` (text) - Nome da empresa
    - `cnpj` (text, unique) - CNPJ da empresa
    - `active` (boolean) - Se a empresa está ativa
    - `created_at` (timestamptz)

  2. Alterações na Tabela `professionals`
    - Adiciona `company_id` (uuid, foreign key) - Empresa vinculada
    - Torna `contracted_hours_per_month` NOT NULL com padrão
    - Remove valor NULL da coluna de horas

  3. Segurança
    - RLS habilitado na tabela companies
    - Políticas para usuários autenticados

  4. Notas Importantes
    - Campo `company_id` obrigatório para novos profissionais
    - Campo `contracted_hours_per_month` obrigatório
    - Profissionais existentes receberão empresa padrão "Sem Empresa"
*/

-- Cria tabela de empresas
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text UNIQUE,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Habilita RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Políticas para companies
CREATE POLICY "Users can view companies"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete companies"
  ON companies FOR DELETE
  TO authenticated
  USING (true);

-- Insere empresa padrão para profissionais sem vínculo
INSERT INTO companies (id, name, cnpj, active)
VALUES ('00000000-0000-0000-0000-000000000000', 'Sem Empresa', NULL, true)
ON CONFLICT (id) DO NOTHING;

-- Adiciona coluna company_id à tabela professionals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'professionals' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE professionals ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Atualiza profissionais existentes sem empresa para empresa padrão
UPDATE professionals 
SET company_id = '00000000-0000-0000-0000-000000000000' 
WHERE company_id IS NULL;

-- Torna contracted_hours_per_month obrigatório
DO $$
BEGIN
  -- Define 180h para profissionais que ainda não têm valor
  UPDATE professionals 
  SET contracted_hours_per_month = 180 
  WHERE contracted_hours_per_month IS NULL;

  -- Torna a coluna NOT NULL
  ALTER TABLE professionals 
  ALTER COLUMN contracted_hours_per_month SET NOT NULL;

  -- Define valor padrão
  ALTER TABLE professionals 
  ALTER COLUMN contracted_hours_per_month SET DEFAULT 180;
END $$;

-- Comentários nas colunas
COMMENT ON COLUMN professionals.company_id IS 'Empresa à qual o profissional está vinculado';
COMMENT ON TABLE companies IS 'Empresas/Organizações que empregam os profissionais';
