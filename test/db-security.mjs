import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const userC = '33333333-3333-4333-8333-333333333333';

await db.exec(`
  CREATE ROLE anon;
  CREATE ROLE authenticated;
  CREATE ROLE service_role BYPASSRLS;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
    AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  CREATE TABLE public.profiles (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id),
    role text DEFAULT 'client',
    coach_id uuid,
    name text
  );
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  CREATE POLICY profiles_own ON public.profiles FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated, service_role;
  CREATE TABLE public.workouts (
    id bigint PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    titulo text
  );
  ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
  CREATE POLICY workouts_own ON public.workouts FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.workouts TO authenticated;
`);
await db.query('INSERT INTO auth.users(id) VALUES ($1), ($2)', [userA, userB]);
await db.exec(`
  CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql
    SECURITY DEFINER AS $$ BEGIN
      INSERT INTO public.profiles(user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
      RETURN NEW;
    END $$;
  CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC, anon, authenticated;
  GRANT INSERT ON auth.users TO service_role;
`);

const migration = readFileSync(new URL('../supabase/migrations/20260924154130_guard_profile_authority_and_chat_quota.sql', import.meta.url), 'utf8');
await db.exec(migration);
for (const role of ['anon', 'authenticated']) {
  const result = await db.query('SELECT has_function_privilege($1, $2, $3) AS allowed', [role, 'public.handle_new_user()', 'EXECUTE']);
  assert.equal(result.rows[0].allowed, false);
}
await db.exec('SET ROLE service_role');
await db.query('INSERT INTO auth.users(id) VALUES ($1)', [userC]);
await db.exec('RESET ROLE');
assert.equal((await db.query('SELECT role FROM public.profiles WHERE user_id = $1', [userC])).rows[0].role, 'client');

await db.exec('SET ROLE authenticated');
await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userA]);
await db.query('INSERT INTO public.profiles(user_id, name) VALUES ($1, $2)', [userA, 'A']);
await db.query('INSERT INTO public.workouts(id, user_id, titulo) VALUES (1, $1, $2)', [userA, 'Treino A']);
await assert.rejects(db.query('INSERT INTO public.profiles(user_id, role) VALUES ($1, $2)', [userB, 'admin']));
const changed = await db.query("UPDATE public.profiles SET role = 'admin', coach_id = $1, name = 'A2' WHERE user_id = $2 RETURNING role, coach_id, name", [userB, userA]);
assert.deepEqual(changed.rows, [{ role: 'client', coach_id: null, name: 'A2' }]);

for (let n = 0; n < 12; n++) {
  assert.equal((await db.query('SELECT public.reserve_ai_request() allowed')).rows[0].allowed, true);
}
assert.equal((await db.query('SELECT public.reserve_ai_request() allowed')).rows[0].allowed, false);
await assert.rejects(db.query('SELECT * FROM public.ai_daily_usage'));
await assert.rejects(db.query('UPDATE public.ai_daily_usage SET request_count = 0'));
await assert.rejects(db.query('INSERT INTO public.ai_daily_usage(user_id, usage_day, request_count) VALUES ($1, current_date, 1)', [userA]));

await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userB]);
await db.query('INSERT INTO public.profiles(user_id, name) VALUES ($1, $2)', [userB, 'B']);
assert.equal((await db.query('SELECT public.reserve_ai_request() allowed')).rows[0].allowed, true);
assert.equal((await db.query('SELECT * FROM public.profiles WHERE user_id = $1', [userA])).rows.length, 0);
assert.equal((await db.query("UPDATE public.profiles SET role = 'admin' WHERE user_id = $1 RETURNING user_id", [userA])).rows.length, 0);
assert.equal((await db.query('SELECT * FROM public.workouts WHERE user_id = $1', [userA])).rows.length, 0);
assert.equal((await db.query("UPDATE public.workouts SET titulo = 'forged' WHERE user_id = $1 RETURNING id", [userA])).rows.length, 0);
await assert.rejects(db.query('INSERT INTO public.workouts(id, user_id, titulo) VALUES (2, $1, $2)', [userA, 'forged']));

await db.exec('SET ROLE service_role');
const assigned = await db.query("UPDATE public.profiles SET role = 'coach', coach_id = $1 WHERE user_id = $2 RETURNING role, coach_id", [userB, userA]);
assert.deepEqual(assigned.rows, [{ role: 'coach', coach_id: userB }]);

await db.exec('SET ROLE authenticated');
await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userA]);
const ownerEdit = await db.query("UPDATE public.profiles SET role = 'client', coach_id = NULL, name = 'A3' WHERE user_id = $1 RETURNING role, coach_id, name", [userA]);
assert.deepEqual(ownerEdit.rows, [{ role: 'coach', coach_id: userB, name: 'A3' }]);

await db.exec('SET ROLE anon');
await assert.rejects(db.query('SELECT public.reserve_ai_request()'));
await db.exec('RESET ROLE');
await db.close();
console.log('Local PostgreSQL migration, profile guard, quota and two-user isolation: passed');
