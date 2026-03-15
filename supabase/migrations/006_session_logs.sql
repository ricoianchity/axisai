ALTER TABLE workouts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  duration_seconds INT,
  rpe INT CHECK (rpe BETWEEN 1 AND 10),
  ua NUMERIC(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own session_logs" ON session_logs
  FOR ALL USING (auth.uid() = user_id);
