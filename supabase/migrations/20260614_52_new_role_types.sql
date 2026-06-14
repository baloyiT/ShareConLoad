-- supabase/migrations/20260614_52_new_role_types.sql
-- Add measurement_agent and transporter as valid role values for profiles.role_type.
-- Note: profiles.role_type is stored as TEXT and enforced via CHECK constraint,
-- so we document the new valid values here.

-- These values are now valid for profiles.role_type:
-- 'customer', 'operator', 'agent', 'admin', 'measurement_agent', 'transporter'

-- Update the CHECK constraint on profiles.role_type to include the new values
alter table public.profiles
drop constraint if exists profiles_role_type_check;

alter table public.profiles
add constraint profiles_role_type_check check (
  role_type in ('customer', 'operator', 'agent', 'admin', 'measurement_agent', 'transporter')
);
