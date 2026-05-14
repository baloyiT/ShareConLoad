-- Add missing FK from operator_profiles.profile_id → profiles.id
-- Required for PostgREST to resolve the relationship in embedded selects
alter table public.operator_profiles
  add constraint operator_profiles_profile_id_fkey
  foreign key (profile_id) references public.profiles(id)
  on delete cascade;
