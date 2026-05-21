-- RPC pública que resolve um identificador de login (CPF, email completo,
-- ou CPF com máscara) para o email canônico em auth.users. Permite que o
-- front faça uma chamada simples antes do signIn, em vez de manter a regra
-- de conversão CPF→email duplicada no cliente.
CREATE OR REPLACE FUNCTION public.resolve_login_identifier(p_identifier text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_digits text;
  v_email  text;
BEGIN
  IF p_identifier IS NULL OR length(trim(p_identifier)) = 0 THEN
    RETURN p_identifier;
  END IF;

  -- Email completo → retorna ele mesmo
  IF p_identifier LIKE '%@%' THEN
    RETURN trim(p_identifier);
  END IF;

  -- 11 dígitos (CPF com ou sem máscara)
  v_digits := regexp_replace(p_identifier, '\D', '', 'g');
  IF length(v_digits) = 11 THEN
    SELECT u.email INTO v_email
    FROM auth.users u
    WHERE u.email = v_digits || '@medico.medscale.local'
    LIMIT 1;
    IF v_email IS NOT NULL THEN RETURN v_email; END IF;

    -- Fallback: procura por CPF na tabela professionals
    SELECT u.email INTO v_email
    FROM professionals p
    JOIN auth.users u ON u.id = p.user_id
    WHERE regexp_replace(p.cpf, '\D', '', 'g') = v_digits
    LIMIT 1;
    IF v_email IS NOT NULL THEN RETURN v_email; END IF;

    RETURN v_digits || '@medico.medscale.local';
  END IF;

  RETURN trim(p_identifier);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_login_identifier(text) TO anon, authenticated;
