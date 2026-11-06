-- Three objects answered to anonymous callers.
--
-- Both functions also carry a grant to PUBLIC, which anon and authenticated inherit, so revoking the
-- named roles alone would change nothing. PUBLIC goes too.
--
-- fire_departure_notices: only the pg_cron job calls it, as postgres, the owner. No client does.
-- increment_agent_jobs: app/measurement-agent/jobs/[id]/page.tsx calls it as the signed-in agent, on
--   this branch and at production commit 04f2c62, so authenticated stays.
-- operator_rating_summary: this branch does not read it. Production's home page does, as a visitor,
--   but only when open containers exist, and it ignores a failed read: a visitor sees a card without
--   stars. There are no containers today. Signed-in users keep it.

revoke execute on function public.fire_departure_notices() from public, anon, authenticated;
grant execute on function public.fire_departure_notices() to service_role;

revoke execute on function public.increment_agent_jobs(uuid) from public, anon;
grant execute on function public.increment_agent_jobs(uuid) to authenticated, service_role;
alter function public.increment_agent_jobs(uuid) set search_path = public;

revoke all on public.operator_rating_summary from anon;
