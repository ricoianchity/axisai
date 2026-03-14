-- Migration 011: Create exercise_logs table with RLS
CREATE TABLE IF NOT EXISTS exercise_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  session_log_id UUID REFERENCES session_logs(id) ON DELETE CASCADE,
  workout_id TEXT,
  exercise_name TEXT NOT NULL,
  block_name TEXT,
  set_number INT,
  reps INT,
  load_kg NUMERIC(6,2),
  rpe INT CHECK (rpe BETWEEN 1 AND 10),
  notes TEXT,
  logged_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own exercise_logs" ON exercise_logs
  FOR ALL USING (auth.uid()::text = user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_user_exercise ON exercise_logs(user_id, exercise_name, logged_at);
