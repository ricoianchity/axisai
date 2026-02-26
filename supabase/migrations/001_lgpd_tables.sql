-- ═══════════════════════════════════════════════════════════════════
--  AxisAI — LGPD Compliance Tables
--  Run in Supabase Dashboard → SQL Editor (in order)
-- ═══════════════════════════════════════════════════════════════════

-- 1. Consents table
CREATE TABLE IF NOT EXISTS user_consents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_version VARCHAR(10) NOT NULL DEFAULT '1.0',
  essential BOOLEAN NOT NULL DEFAULT true,
  fms_data BOOLEAN NOT NULL DEFAULT false,
  training_history BOOLEAN NOT NULL DEFAULT false,
  analytics BOOLEAN NOT NULL DEFAULT false,
  marketing BOOLEAN NOT NULL DEFAULT false,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. LGPD requests table (Art. 18)
CREATE TABLE IF NOT EXISTS lgpd_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(20) CHECK (type IN ('access','correction','portability','deletion','revoke_consent','complaint')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','rejected')),
  details TEXT,
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 3. Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE lgpd_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_consents" ON user_consents FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user_own_requests" ON lgpd_requests FOR ALL USING (auth.uid() = user_id);

-- 5. Full deletion function
CREATE OR REPLACE FUNCTION delete_user_data(target_user_id UUID)
RETURNS void AS $$
BEGIN
  DELETE FROM user_consents WHERE user_id = target_user_id;
  DELETE FROM lgpd_requests WHERE user_id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
