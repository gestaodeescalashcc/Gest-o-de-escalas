-- =============================================================================
-- Define a ordem dos fisioterapeutas conforme a planilha (3 blocos)
-- =============================================================================

CREATE OR REPLACE FUNCTION norm_name(s text) RETURNS text AS $func$
  SELECT lower(translate(s,
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'));
$func$ LANGUAGE SQL IMMUTABLE;

-- Lista a ordem oficial: nome + posição + tem separador depois
WITH ordem(pos, nome, tem_separador) AS (
  VALUES
    -- Bloco 1
    (1,  'Aieza dos Santos Cardoso',                    false),
    (2,  'Luana Costa Santos Carvalho',                 false),
    (3,  'Rosineide Loreto de Jesus',                   false),
    (4,  'Edna Francisca da Conceição Correia Neta',    false),
    (5,  'Raiane Santos Lima',                          false),
    (6,  'Rosangela dos Santos Nascimento',             true),   -- ← separador depois
    -- Bloco 2
    (7,  'Leila Maria Cintra da Cunha Sampaio',         false),
    (8,  'Deivid Silva de Araujo Esquivel',             false),
    (9,  'Manuela Silva Costa',                         false),
    (10, 'Luciano Hayne Mettig',                        false),
    (11, 'Luciana Almeida dos Santos',                  false),
    (12, 'Liane Rego Caribe Ramos',                     false),
    (13, 'Camila Souza Guimaraes',                      true),   -- ← separador depois
    -- Bloco 3
    (14, 'Isabela Lomba Paranhos',                      false),
    (15, 'Juliana Lima Alexandre Monteiro',             false),
    (16, 'Michele Coelho Serra Gama',                   false),
    (17, 'Tais Conceição Damasceno',                    false),
    (18, 'Wagner Ferreira Figueredo',                   false),
    (19, 'Érica Vinhas Macedo Magalhães',               false),
    (20, 'Gabriela Quirino Belo',                       false)
)
UPDATE professionals p
SET display_order = o.pos,
    block_separator_after = o.tem_separador,
    updated_at = now()
FROM ordem o
WHERE norm_name(p.full_name) = norm_name(o.nome)
  AND p.active = true;

-- Verificação
SELECT
  p.display_order,
  p.full_name,
  p.block_separator_after AS sep_depois
FROM professionals p
JOIN departments d ON d.id = p.department_id
WHERE d.name = 'Fisioterapia' AND p.active = true
ORDER BY p.display_order NULLS LAST, p.full_name;
