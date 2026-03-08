-- ═══════════════════════════════════════════════════════════════════
--  AxisAI — Sprint 1 Schema: Profiles + New Tables
--  Run in Supabase Dashboard → SQL Editor
--  Safe: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Extend profiles table with missing columns ──────────────────
-- The existing profiles table uses id = auth user UUID

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sex TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS frequency TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS session_time TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gym TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS equipment JSONB DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profissao TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS horas_trabalho INT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS perfil_postural TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS horas_sentado INT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS estresse_ocup TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS turno_trabalho TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS parq TEXT DEFAULT 'no';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS injuries TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fms JSONB DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS toe_touch BOOLEAN;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS risk_flags JSONB DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fms_date TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lgpd_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lgpd_date TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coach_id UUID;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Enable RLS on profiles if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS policy for profiles (user sees own row, id = auth.uid())
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_own_id'
  ) THEN
    CREATE POLICY "profiles_own_id" ON profiles FOR ALL USING (auth.uid()::text = id::text);
  END IF;
END $$;

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 2. chat_messages table (used by existing code) ─────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'chat_messages_own'
  ) THEN
    CREATE POLICY "chat_messages_own" ON chat_messages FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 3. readiness_logs table (used by existing code) ────────────────
CREATE TABLE IF NOT EXISTS readiness_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  sleep_hours FLOAT,
  sleep_quality INT,
  stress_level INT,
  muscle_soreness INT,
  urine_color INT,
  readiness INT,
  readiness_score INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE readiness_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'readiness_logs' AND policyname = 'readiness_logs_own'
  ) THEN
    CREATE POLICY "readiness_logs_own" ON readiness_logs FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 4. checkins table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'checkins' AND policyname = 'checkins_own'
  ) THEN
    CREATE POLICY "checkins_own" ON checkins FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 5. training_phases table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS training_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phase_num INT,
  phase_name TEXT,
  plan_title TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE training_phases ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'training_phases' AND policyname = 'training_phases_own'
  ) THEN
    CREATE POLICY "training_phases_own" ON training_phases FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 6. fms_assessments table (new) ────────────────────────────────
CREATE TABLE IF NOT EXISTS fms_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  scores JSONB NOT NULL DEFAULT '{}',
  toe_touch BOOLEAN,
  total_score INT,
  risk_flags JSONB DEFAULT '[]',
  analysis JSONB DEFAULT '{}',
  photos JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fms_assessments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'fms_assessments' AND policyname = 'fms_assessments_own'
  ) THEN
    CREATE POLICY "fms_assessments_own" ON fms_assessments FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── 7. training_sessions table (new) ──────────────────────────────
CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_title TEXT,
  duration_minutes INT,
  loads JSONB DEFAULT '{}',
  total_ua FLOAT,
  readiness_score INT,
  notes TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'training_sessions' AND policyname = 'training_sessions_own'
  ) THEN
    CREATE POLICY "training_sessions_own" ON training_sessions FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;
