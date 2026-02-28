-- ═══════════════════════════════════════════════════════════════════
--  AxisAI — Role-Based Access Foundation
--  Run in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Add role column to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client'
  CHECK (role IN ('client', 'coach', 'admin'));

-- 2. Add coach_id to link clients to their coach
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 3. Coach-client relationship table
CREATE TABLE IF NOT EXISTS coach_clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  client_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coach_id, client_id)
);

ALTER TABLE coach_clients ENABLE ROW LEVEL SECURITY;

-- Coach sees their own clients
CREATE POLICY "coach_sees_clients" ON coach_clients
  FOR ALL USING (auth.uid() = coach_id);

-- Client sees their own coach relationship
CREATE POLICY "client_sees_own" ON coach_clients
  FOR SELECT USING (auth.uid() = client_id);

-- 4. Update RLS on profiles: coach can read their clients' profiles
CREATE POLICY "coach_reads_client_profiles" ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR
    EXISTS (
      SELECT 1 FROM coach_clients
      WHERE coach_id = auth.uid()
        AND client_id = id
        AND active = TRUE
    )
  );
