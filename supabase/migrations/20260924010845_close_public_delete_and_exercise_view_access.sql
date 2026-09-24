-- Limit the privileged deletion RPC to the service role.
REVOKE ALL PRIVILEGES ON FUNCTION public.delete_user_data(uuid)
  FROM PUBLIC, anon, authenticated;

-- Keep exercise aggregates unavailable to anonymous callers and apply
-- exercise_logs RLS for authenticated callers of the view.
REVOKE ALL PRIVILEGES ON TABLE public.performance_by_exercise
  FROM PUBLIC, anon;
ALTER VIEW public.performance_by_exercise SET (security_invoker = true);
