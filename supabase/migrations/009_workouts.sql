-- Migration 009 — tabela workouts (Coach IA sessions)
-- Schema simples compatível com o localStorage do AxisAI.
-- id = Date.now() gerado no cliente (bigint), garante deduplicação local ↔ remota.

CREATE TABLE IF NOT EXISTS public.workouts (
  id          bigint      PRIMARY KEY,           -- Date.now() do cliente
  user_id     text        NOT NULL,
  titulo      text,
  data        text,                               -- "13/03/2026" pt-BR
  conteudo    text,
  categoria   text        DEFAULT 'fullbody',
  tipo        text        DEFAULT 'sessao',
  fase_num    int,
  fase_nome   text,
  plano_titulo text,
  fonte       text        DEFAULT 'coach_ia',
  synced      boolean     DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'workouts'
      AND policyname = 'Users manage own workouts'
  ) THEN
    CREATE POLICY "Users manage own workouts"
      ON public.workouts FOR ALL
      USING (auth.uid()::text = user_id)
      WITH CHECK (auth.uid()::text = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workouts_user    ON public.workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_created ON public.workouts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workouts_fonte   ON public.workouts(fonte);
