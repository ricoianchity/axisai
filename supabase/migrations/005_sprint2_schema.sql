-- Sprint 2: comorbidades, medicações, display_name em profiles + fotos FMS
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS comorbidities JSONB DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS medications JSONB DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Fotos do FMS em fms_assessments
ALTER TABLE fms_assessments ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '{}';
