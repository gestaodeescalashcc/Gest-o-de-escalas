-- =============================================================================
-- COREN dos 2 casos especiais que não casaram pelo fuzzy
-- =============================================================================

-- Taina Barbara de Jesus Trigueiros (As / Sa) — COREN 1419110
UPDATE professionals
SET coren = '1419110'
WHERE active = true
  AND lower(translate(full_name,
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
      ILIKE 'taina barbara de jesus trigueiros%'
  AND (coren IS NULL OR coren = '');

-- Viviane de Jesus Ferreira Souza — COREN 868984
UPDATE professionals
SET coren = '868984'
WHERE active = true
  AND lower(translate(full_name,
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))
      ILIKE 'viviane de jesus ferreira%'
  AND (coren IS NULL OR coren = '');

-- Verificação
SELECT full_name, coren
FROM professionals
WHERE full_name ILIKE 'taina barbara%'
   OR full_name ILIKE 'viviane de jesus ferreira%'
ORDER BY full_name;

-- Total final de COREN cadastrados na enfermagem
SELECT
  COUNT(*) FILTER (WHERE coren IS NOT NULL AND coren <> '') AS com_coren,
  COUNT(*) FILTER (WHERE coren IS NULL OR coren = '')        AS sem_coren,
  COUNT(*)                                                    AS total
FROM professionals p
JOIN professional_categories c ON c.id = p.category_id
WHERE p.active = true
  AND c.name ILIKE '%enferm%';
