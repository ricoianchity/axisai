-- Apply after 20260924010845_close_public_delete_and_exercise_view_access.
-- That earlier migration is already applied in production and must not be replayed.

-- Profile owners may edit their own data, but only privileged server operations may
-- assign a role or coach. A trigger protects both direct Data API writes and upserts.
CREATE OR REPLACE FUNCTION public.guard_profile_authority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('postgres', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS DISTINCT FROM 'client' OR NEW.coach_id IS NOT NULL THEN
      RAISE EXCEPTION 'Only an administrator may assign role or coach_id'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    -- Upserts that omit these columns can still send their defaults on conflict.
    -- Preserve the existing assignments while allowing other profile edits.
    NEW.role := OLD.role;
    NEW.coach_id := OLD.coach_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_profile_authority() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_profile_authority ON public.profiles;
CREATE TRIGGER guard_profile_authority
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_authority();

-- The API reserves one request before contacting the model. A single database
-- statement enforces a UTC daily limit across concurrent Vercel instances.
CREATE TABLE IF NOT EXISTS public.ai_daily_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_day date NOT NULL,
  request_count integer NOT NULL CHECK (request_count BETWEEN 1 AND 12),
  PRIMARY KEY (user_id, usage_day)
);

ALTER TABLE public.ai_daily_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_daily_usage FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_ai_request()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  reserved boolean;
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.ai_daily_usage (user_id, usage_day, request_count)
  VALUES (caller_id, (current_timestamp AT TIME ZONE 'UTC')::date, 1)
  ON CONFLICT (user_id, usage_day) DO UPDATE
    SET request_count = public.ai_daily_usage.request_count + 1
    WHERE public.ai_daily_usage.request_count < 12
  RETURNING true INTO reserved;

  RETURN COALESCE(reserved, false);
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_request() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_ai_request() TO authenticated;
