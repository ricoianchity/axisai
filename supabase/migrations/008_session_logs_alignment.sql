-- DB-004 — Verificação de tipo e alinhamento de FK session_id

-- 1) Verificar tipo atual de session_logs.id
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'session_logs'
  AND column_name = 'id';

-- 2) Se session_logs.id for bigint, alinhar exercise_logs.session_id para bigint
--    (rode manualmente apenas se a query acima retornar bigint)
-- ALTER TABLE public.exercise_logs
--   ALTER COLUMN session_id TYPE bigint
--   USING session_id::text::bigint;
