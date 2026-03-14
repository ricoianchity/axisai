-- Migration 010: Add supabase_id and status to workouts table
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS supabase_id UUID DEFAULT gen_random_uuid();
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'planned'
  CONSTRAINT workouts_status_check CHECK (status IN ('planned','in_progress','completed'));
CREATE INDEX IF NOT EXISTS idx_workouts_user_status ON workouts(user_id, status);
