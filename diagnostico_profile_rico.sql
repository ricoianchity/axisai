-- ═══════════════════════════════════════════════════════════════
-- DIAGNÓSTICO: Perfil rico.ianchity@gmail.com no Supabase
-- Rodar no SQL Editor do Supabase Dashboard
-- ═══════════════════════════════════════════════════════════════

-- 1. Ver o user ID e dados de auth do usuário
SELECT
  id,
  email,
  created_at,
  last_sign_in_at,
  confirmed_at,
  raw_user_meta_data
FROM auth.users
WHERE email = 'rico.ianchity@gmail.com';

-- ─────────────────────────────────────────────────────────────
-- 2. Ver o perfil completo na tabela profiles
--    (substitua <USER_ID> pelo ID retornado na query acima)
SELECT *
FROM public.profiles
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'rico.ianchity@gmail.com'
);

-- ─────────────────────────────────────────────────────────────
-- 3. Checar campos críticos para a lógica de onboarding
--    Se todos retornarem NULL → esse é o bug: perfil existe mas campos vazios
SELECT
  id,
  name,
  age,
  level,
  goal,
  created_at,
  -- campos PAR-Q
  parq_cleared,
  parq_completed_at
FROM public.profiles
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'rico.ianchity@gmail.com'
);

-- ─────────────────────────────────────────────────────────────
-- 4. FIX: Se o perfil existir mas campos forem NULL, forçar created_at
--    para que enterApp() detecte o perfil corretamente.
--    RODAR APENAS SE A QUERY 3 MOSTRAR CAMPOS TODOS NULOS:
/*
UPDATE public.profiles
SET created_at = NOW()
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'rico.ianchity@gmail.com'
)
AND created_at IS NULL;
*/

-- ─────────────────────────────────────────────────────────────
-- 5. Se o perfil NÃO existir (query 2 retornou 0 linhas), criar manualmente:
/*
INSERT INTO public.profiles (id, name, created_at)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'rico.ianchity@gmail.com'),
  'Rico',
  NOW()
)
ON CONFLICT (id) DO NOTHING;
*/
