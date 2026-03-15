-- DB-003 — workout_plans + exercise_logs (AXISAI Treinos v2)

-- workout_plans: exercícios gerados pelo Coach IA por sessão
CREATE TABLE IF NOT EXISTS public.workout_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  workout_type text NOT NULL,
  phase text,
  week_number int,
  blocks jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_by text DEFAULT 'ai',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workout_plans'
      AND policyname = 'Users manage own workout_plans'
  ) THEN
    CREATE POLICY "Users manage own workout_plans"
      ON public.workout_plans FOR ALL
      USING (auth.uid()::text = user_id)
      WITH CHECK (auth.uid()::text = user_id);
  END IF;
END $$;

-- exercise_logs: cargas registradas pelo usuário por set
CREATE TABLE IF NOT EXISTS public.exercise_logs (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL,
  session_id uuid REFERENCES public.session_logs(id) ON DELETE CASCADE,
  workout_plan_id uuid REFERENCES public.workout_plans(id) ON DELETE SET NULL,
  exercise_name text NOT NULL,
  exercise_code text,
  block_type text,
  set_number int,
  target_reps int,
  actual_reps int,
  target_weight_kg float,
  actual_weight_kg float,
  bodyweight boolean DEFAULT false,
  target_rpe int,
  actual_rpe int,
  rest_seconds int DEFAULT 60,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.exercise_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exercise_logs'
      AND policyname = 'Users manage own exercise_logs'
  ) THEN
    CREATE POLICY "Users manage own exercise_logs"
      ON public.exercise_logs FOR ALL
      USING (auth.uid()::text = user_id)
      WITH CHECK (auth.uid()::text = user_id);
  END IF;
END $$;

-- Índices para performance da aba
CREATE INDEX IF NOT EXISTS idx_exercise_logs_user ON public.exercise_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_exercise ON public.exercise_logs(exercise_name);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_date ON public.exercise_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_session ON public.exercise_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_workout_plans_user ON public.workout_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_plans_date ON public.workout_plans(session_date DESC);
