create table if not exists error_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  fn_name text not null,
  error_message text not null,
  context jsonb,
  created_at timestamptz default now()
);

alter table error_logs enable row level security;

create policy "users see own errors" on error_logs
  for select using (auth.uid() = user_id);

create policy "users insert own errors" on error_logs
  for insert with check (auth.uid() = user_id);
