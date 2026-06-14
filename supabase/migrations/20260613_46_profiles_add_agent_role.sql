-- supabase/migrations/20260613_46_profiles_add_agent_role.sql
-- Add 'agent' to the profiles.role_type check constraint

alter table public.profiles
  drop constraint if exists profiles_role_type_check;

alter table public.profiles
  add constraint profiles_role_type_check
  check (role_type in ('customer', 'operator', 'admin', 'agent'));
