-- PAR-Q gating fields for Coach IA access
alter table if exists public.profiles
  add column if not exists parq_cleared boolean default false,
  add column if not exists parq_completed_at timestamptz,
  add column if not exists parq_answers jsonb;

