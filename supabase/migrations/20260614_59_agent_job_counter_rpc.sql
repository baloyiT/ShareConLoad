-- supabase/migrations/20260614_59_agent_job_counter_rpc.sql
create or replace function increment_agent_jobs(agent_id uuid)
returns void
language sql
security definer
as $$
  update measurement_agent_profiles
  set total_jobs_completed = total_jobs_completed + 1
  where id = agent_id;
$$;
