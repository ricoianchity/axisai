-- Migration 012: Create performance_by_exercise view
CREATE OR REPLACE VIEW performance_by_exercise AS
SELECT
  user_id,
  exercise_name,
  DATE(logged_at) AS session_date,
  MAX(load_kg) AS best_load,
  AVG(load_kg) AS avg_load,
  SUM(reps) AS total_reps,
  COUNT(*) AS total_sets,
  MAX(rpe) AS max_rpe
FROM exercise_logs
WHERE load_kg IS NOT NULL
GROUP BY user_id, exercise_name, DATE(logged_at)
ORDER BY session_date DESC;
