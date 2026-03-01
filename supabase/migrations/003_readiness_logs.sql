-- ═══════════════════════════════════════════════════════════════════
--  AxisAI — Readiness Logs
--  Run in Supabase Dashboard → SQL Editor
--  Migration: 003_readiness_logs
-- ═══════════════════════════════════════════════════════════════════

-- 1. Tabela principal
CREATE TABLE IF NOT EXISTS readiness_logs (
  id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date            DATE          NOT NULL,
  sleep_quality   INTEGER       NOT NULL CHECK (sleep_quality   BETWEEN 1 AND 5),
  energy_level    INTEGER       NOT NULL CHECK (energy_level    BETWEEN 1 AND 5),
  muscle_soreness INTEGER       NOT NULL CHECK (muscle_soreness BETWEEN 1 AND 5),
  stress_level    INTEGER       NOT NULL CHECK (stress_level    BETWEEN 1 AND 5),
  readiness_score INTEGER       NOT NULL CHECK (readiness_score BETWEEN 0 AND 100),
  notes           TEXT,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (user_id, date)        -- um registro por usuário por dia; upsert usa esta constraint
);

-- 2. Row Level Security
ALTER TABLE readiness_logs ENABLE ROW LEVEL SECURITY;

-- Usuário lê/escreve apenas seus próprios registros
CREATE POLICY "user_own_readiness"
  ON readiness_logs
  FOR ALL
  USING (auth.uid() = user_id);

-- Coach lê os registros de seus clientes ativos
CREATE POLICY "coach_reads_client_readiness"
  ON readiness_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM coach_clients
      WHERE coach_id = auth.uid()
        AND client_id = readiness_logs.user_id
        AND active = TRUE
    )
  );

-- 3. Índice de performance para consultas por usuário + data
CREATE INDEX IF NOT EXISTS idx_readiness_logs_user_date
  ON readiness_logs (user_id, date DESC);
