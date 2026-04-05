-- 014_exercise_library_equipment.sql

-- 1. Enums
CREATE TYPE equipment_type AS ENUM (
  'barbell',
  'dumbbell',
  'kettlebell',
  'cable',
  'machine',
  'trx',
  'sled',
  'cardio',
  'bodyweight',
  'medicine_ball',
  'band'
);

CREATE TYPE prescription_context_type AS ENUM (
  'primary',
  'filler',
  'auxiliary'
);

-- 2. Novas colunas na exercise_library
ALTER TABLE exercise_library
  ADD COLUMN IF NOT EXISTS equipment_arr    equipment_type[],
  ADD COLUMN IF NOT EXISTS prescription_context prescription_context_type DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS phase_relevance  text[] DEFAULT ARRAY['accumulation','hypertrophy','intensification','realization','off_season'];

-- 3. Popular equipment_arr nos 100 exercícios existentes
-- Regras aplicadas em ordem, com AND equipment_arr IS NULL para evitar sobrescrita

UPDATE exercise_library SET equipment_arr = ARRAY['barbell']::equipment_type[]
WHERE (name ILIKE '%Barbell%' OR name ILIKE '%Barra %');

UPDATE exercise_library SET equipment_arr = ARRAY['kettlebell']::equipment_type[]
WHERE (name ILIKE '%KB %' OR name ILIKE '%2KB%' OR name ILIKE '%Kettlebell%')
  AND equipment_arr IS NULL;

UPDATE exercise_library SET equipment_arr = ARRAY['dumbbell']::equipment_type[]
WHERE (name ILIKE '%DB %' OR name ILIKE '%Haltere%' OR name ILIKE '%Dumbbell%')
  AND equipment_arr IS NULL;

UPDATE exercise_library SET equipment_arr = ARRAY['medicine_ball']::equipment_type[]
WHERE (name ILIKE '%SB %' OR name ILIKE '%Sandbag%')
  AND equipment_arr IS NULL;

UPDATE exercise_library SET equipment_arr = ARRAY['trx']::equipment_type[]
WHERE (name ILIKE '%Ring%' OR name ILIKE '%TRX%' OR name ILIKE '%WV %')
  AND equipment_arr IS NULL;

UPDATE exercise_library SET equipment_arr = ARRAY['sled']::equipment_type[]
WHERE (name ILIKE '%Sled%' OR name ILIKE '%Trenó%')
  AND equipment_arr IS NULL;

UPDATE exercise_library SET equipment_arr = ARRAY['bodyweight']::equipment_type[]
WHERE equipment_arr IS NULL;

-- 4. prescription_context e phase_relevance para todos os existentes
UPDATE exercise_library
SET prescription_context = 'primary',
    phase_relevance = ARRAY['accumulation','hypertrophy','intensification','realization','off_season']
WHERE prescription_context IS NULL;

-- 5. Novos exercícios — Bíceps / Tríceps
INSERT INTO exercise_library (name, movement_pattern, equipment_arr, prescription_context, phase_relevance, difficulty, category, progression_level) VALUES
('Barbell Curl - Rosca Direta com Barra',             'isolation_elbow_flexion',    ARRAY['barbell']::equipment_type[],           'auxiliary', ARRAY['accumulation','hypertrophy','off_season'], 'iniciante',     'strength', 0),
('Dumbbell Curl - Rosca Alternada com Halteres',      'isolation_elbow_flexion',    ARRAY['dumbbell']::equipment_type[],          'auxiliary', ARRAY['accumulation','hypertrophy','off_season'], 'iniciante',     'strength', 0),
('Hammer Curl - Rosca Martelo',                       'isolation_elbow_flexion',    ARRAY['dumbbell']::equipment_type[],          'auxiliary', ARRAY['accumulation','hypertrophy','off_season'], 'iniciante',     'strength', 1),
('Cable Curl - Rosca no Cabo',                        'isolation_elbow_flexion',    ARRAY['cable']::equipment_type[],             'auxiliary', ARRAY['accumulation','hypertrophy','off_season'], 'iniciante',     'strength', 1),
('Machine Curl - Rosca na Máquina',                   'isolation_elbow_flexion',    ARRAY['machine']::equipment_type[],           'auxiliary', ARRAY['accumulation','hypertrophy','off_season'], 'iniciante',     'strength', 0),
('Incline Dumbbell Curl - Rosca Inclinada',           'isolation_elbow_flexion',    ARRAY['dumbbell']::equipment_type[],          'auxiliary', ARRAY['accumulation','hypertrophy','off_season'], 'intermediario', 'strength', 2),
('Triceps Pushdown - Pushdown no Cabo',                'isolation_elbow_extension',  ARRAY['cable']::equipment_type[],             'auxiliary', ARRAY['accumulation','hypertrophy','off_season'], 'iniciante',     'strength', 0),
('Overhead Triceps Extension - Extensão sobre a Cabeça','isolation_elbow_extension', ARRAY['dumbbell','cable']::equipment_type[], 'auxiliary', ARRAY['accumulation','hypertrophy','off_season'], 'iniciante',     'strength', 1),
('Skull Crusher - Tríceps Testa com Barra',           'isolation_elbow_extension',  ARRAY['barbell']::equipment_type[],           'auxiliary', ARRAY['accumulation','hypertrophy','off_season'], 'intermediario', 'strength', 2),
('Triceps Kickback - Coice de Tríceps',               'isolation_elbow_extension',  ARRAY['dumbbell']::equipment_type[],          'auxiliary', ARRAY['accumulation','hypertrophy','off_season'], 'iniciante',     'strength', 0),
('Machine Triceps Extension - Extensão na Máquina',   'isolation_elbow_extension',  ARRAY['machine']::equipment_type[],           'auxiliary', ARRAY['accumulation','hypertrophy','off_season'], 'iniciante',     'strength', 0),
('Close Grip Bench Press - Supino Fechado',           'isolation_elbow_extension',  ARRAY['barbell']::equipment_type[],           'auxiliary', ARRAY['accumulation','hypertrophy','off_season'], 'intermediario', 'strength', 2);

-- 6. Novos exercícios — Ombro isolado
INSERT INTO exercise_library (name, movement_pattern, equipment_arr, prescription_context, phase_relevance, difficulty, category, progression_level) VALUES
('Lateral Raise - Elevação Lateral com Halteres',          'isolation_shoulder_abduction',            ARRAY['dumbbell']::equipment_type[], 'auxiliary', ARRAY['accumulation','hypertrophy','off_season'],                                        'iniciante', 'strength', 0),
('Cable Lateral Raise - Elevação Lateral no Cabo',          'isolation_shoulder_abduction',            ARRAY['cable']::equipment_type[],   'auxiliary', ARRAY['accumulation','hypertrophy','off_season'],                                        'iniciante', 'strength', 1),
('Machine Lateral Raise - Elevação Lateral na Máquina',     'isolation_shoulder_abduction',            ARRAY['machine']::equipment_type[], 'auxiliary', ARRAY['accumulation','hypertrophy','off_season'],                                        'iniciante', 'strength', 0),
('Front Raise - Elevação Frontal com Halteres',             'isolation_shoulder_flexion',              ARRAY['dumbbell']::equipment_type[], 'auxiliary', ARRAY['accumulation','hypertrophy','off_season'],                                        'iniciante', 'strength', 0),
('Face Pull - Puxada para o Rosto no Cabo',                 'isolation_shoulder_external_rotation',    ARRAY['cable']::equipment_type[],   'filler',    ARRAY['accumulation','hypertrophy','intensification','realization','off_season'],         'iniciante', 'strength', 1),
('Band Pull Apart - Separação de Band',                     'isolation_shoulder_external_rotation',    ARRAY['band']::equipment_type[],    'filler',    ARRAY['accumulation','hypertrophy','intensification','realization','off_season'],         'iniciante', 'strength', 0),
('Reverse Fly - Crucifixo Inverso com Halteres',            'isolation_shoulder_horizontal_abduction', ARRAY['dumbbell']::equipment_type[], 'auxiliary', ARRAY['accumulation','hypertrophy','off_season'],                                        'iniciante', 'strength', 1),
('Cable Reverse Fly - Crucifixo Inverso no Cabo',           'isolation_shoulder_horizontal_abduction', ARRAY['cable']::equipment_type[],   'auxiliary', ARRAY['accumulation','hypertrophy','off_season'],                                        'iniciante', 'strength', 1);

-- 7. Novos exercícios — Adutores / Abdutores
INSERT INTO exercise_library (name, movement_pattern, equipment_arr, prescription_context, phase_relevance, difficulty, category, progression_level) VALUES
('Machine Hip Adduction - Adução de Quadril na Máquina', 'adduction_hip', ARRAY['machine']::equipment_type[],             'filler', ARRAY['accumulation','hypertrophy','off_season'],                                'iniciante',     'strength', 0),
('Cable Hip Adduction - Adução de Quadril no Cabo',      'adduction_hip', ARRAY['cable']::equipment_type[],               'filler', ARRAY['accumulation','hypertrophy','off_season'],                                'iniciante',     'strength', 1),
('Cossack Squat - Agachamento Cossaco',                  'adduction_hip', ARRAY['bodyweight','dumbbell']::equipment_type[],'filler', ARRAY['accumulation','hypertrophy','intensification','off_season'],             'intermediario', 'strength', 2),
('Machine Hip Abduction - Abdução de Quadril na Máquina','abduction_hip', ARRAY['machine']::equipment_type[],             'filler', ARRAY['accumulation','hypertrophy','off_season'],                                'iniciante',     'strength', 0),
('Cable Hip Abduction - Abdução de Quadril no Cabo',     'abduction_hip', ARRAY['cable']::equipment_type[],               'filler', ARRAY['accumulation','hypertrophy','off_season'],                                'iniciante',     'strength', 1),
('Band Hip Abduction - Abdução com Band',                'abduction_hip', ARRAY['band']::equipment_type[],                'filler', ARRAY['accumulation','hypertrophy','intensification','realization','off_season'], 'iniciante',     'strength', 0),
('Side Lying Hip Abduction - Abdução Deitado de Lado',   'abduction_hip', ARRAY['bodyweight','band']::equipment_type[],   'filler', ARRAY['accumulation','hypertrophy','intensification','realization','off_season'], 'iniciante',     'strength', -1),
('Clamshell - Concha com Band',                          'abduction_hip', ARRAY['band']::equipment_type[],                'filler', ARRAY['accumulation','hypertrophy','intensification','realization','off_season'], 'iniciante',     'strength', -1);

-- 8. Novos exercícios — Panturrilha
INSERT INTO exercise_library (name, movement_pattern, equipment_arr, prescription_context, phase_relevance, difficulty, category, progression_level) VALUES
('Standing Calf Raise - Gêmeos em Pé (peso corporal)',  'isolation_ankle_plantar_flexion', ARRAY['bodyweight']::equipment_type[],          'auxiliary', ARRAY['accumulation','hypertrophy','off_season'],             'iniciante',     'strength', -1),
('Weighted Standing Calf Raise - Gêmeos em Pé com Carga','isolation_ankle_plantar_flexion',ARRAY['dumbbell','barbell']::equipment_type[], 'auxiliary', ARRAY['accumulation','hypertrophy','off_season'],             'iniciante',     'strength', 1),
('Seated Calf Raise - Gêmeos Sentado na Máquina',       'isolation_ankle_plantar_flexion', ARRAY['machine']::equipment_type[],             'auxiliary', ARRAY['accumulation','hypertrophy','off_season'],             'iniciante',     'strength', 0),
('Machine Standing Calf Raise - Gêmeos em Pé na Máquina','isolation_ankle_plantar_flexion',ARRAY['machine']::equipment_type[],            'auxiliary', ARRAY['accumulation','hypertrophy','off_season'],             'iniciante',     'strength', 1),
('Single Leg Calf Raise - Gêmeos Unilateral',           'isolation_ankle_plantar_flexion', ARRAY['bodyweight']::equipment_type[],          'auxiliary', ARRAY['accumulation','hypertrophy','intensification','off_season'], 'intermediario', 'strength', 2);

-- 9. Novos exercícios — Máquinas compostas (filler)
INSERT INTO exercise_library (name, movement_pattern, equipment_arr, prescription_context, phase_relevance, difficulty, category, progression_level) VALUES
('Leg Press 45° - Leg Press',                          'knee_dominant_bilateral',  ARRAY['machine']::equipment_type[],        'filler', ARRAY['accumulation','hypertrophy','off_season'],             'iniciante',     'strength', 1),
('Hack Squat - Hack Squat na Máquina',                 'knee_dominant_bilateral',  ARRAY['machine']::equipment_type[],        'filler', ARRAY['accumulation','hypertrophy','off_season'],             'intermediario', 'strength', 2),
('Leg Extension - Cadeira Extensora',                  'isolation_knee_extension', ARRAY['machine']::equipment_type[],        'filler', ARRAY['accumulation','hypertrophy','off_season'],             'iniciante',     'strength', 0),
('Leg Curl - Cadeira Flexora',                         'isolation_knee_flexion',   ARRAY['machine']::equipment_type[],        'filler', ARRAY['accumulation','hypertrophy','off_season'],             'iniciante',     'strength', 0),
('Cable Pull Through - Pull Through no Cabo',          'hip_dominant_bilateral',   ARRAY['cable']::equipment_type[],          'filler', ARRAY['accumulation','hypertrophy','off_season'],             'iniciante',     'strength', 0),
('Machine Chest Press - Supino na Máquina',            'push_horizontal',          ARRAY['machine']::equipment_type[],        'filler', ARRAY['accumulation','hypertrophy','off_season'],             'iniciante',     'strength', 1),
('Pec Deck - Crucifixo na Máquina',                   'push_horizontal',          ARRAY['machine']::equipment_type[],        'filler', ARRAY['accumulation','hypertrophy','off_season'],             'iniciante',     'strength', 0),
('Cable Fly - Crucifixo no Cabo',                      'push_horizontal',          ARRAY['cable']::equipment_type[],          'filler', ARRAY['accumulation','hypertrophy','off_season'],             'iniciante',     'strength', 1),
('Seated Cable Row - Remada Sentada no Cabo',          'pull_horizontal',          ARRAY['cable']::equipment_type[],          'filler', ARRAY['accumulation','hypertrophy','off_season'],             'iniciante',     'strength', 1),
('Machine Row - Remada na Máquina',                    'pull_horizontal',          ARRAY['machine']::equipment_type[],        'filler', ARRAY['accumulation','hypertrophy','off_season'],             'iniciante',     'strength', 1),
('Lat Pulldown - Puxada na Polia Alta',                'pull_vertical',            ARRAY['machine','cable']::equipment_type[],'filler', ARRAY['accumulation','hypertrophy','off_season'],             'iniciante',     'strength', 0),
('Cable Pullover - Pullover no Cabo',                  'pull_vertical',            ARRAY['cable']::equipment_type[],          'filler', ARRAY['accumulation','hypertrophy','off_season'],             'iniciante',     'strength', 1),
('Machine Shoulder Press - Desenvolvimento na Máquina','push_vertical',            ARRAY['machine']::equipment_type[],        'filler', ARRAY['accumulation','hypertrophy','off_season'],             'iniciante',     'strength', 1);

-- 10. Verificação final embutida
SELECT
  (SELECT COUNT(*) FROM exercise_library)                                    AS total_exercicios,
  (SELECT COUNT(*) FROM exercise_library WHERE equipment_arr IS NULL)        AS sem_equipment,
  (SELECT COUNT(*) FROM exercise_library WHERE prescription_context = 'primary')   AS primary_count,
  (SELECT COUNT(*) FROM exercise_library WHERE prescription_context = 'filler')    AS filler_count,
  (SELECT COUNT(*) FROM exercise_library WHERE prescription_context = 'auxiliary') AS auxiliary_count;
-- Esperado: total ~163, sem_equipment = 0
