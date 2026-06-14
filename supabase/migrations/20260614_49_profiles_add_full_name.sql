-- Add full_name to profiles and keep it in sync with auth.users metadata

alter table public.profiles add column if not exists full_name text;

-- Backfill existing rows from auth.users metadata
update public.profiles p
set full_name = u.raw_user_meta_data->>'full_name'
from auth.users u
where u.id = p.user_id
  and p.full_name is null;

-- Trigger function: copy full_name from auth.users on profile insert
create or replace function public.sync_profile_full_name()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  new.full_name := coalesce(
    new.full_name,
    (select raw_user_meta_data->>'full_name' from auth.users where id = new.user_id)
  );
  return new;
end;
$$;

drop trigger if exists trg_sync_profile_full_name on public.profiles;
create trigger trg_sync_profile_full_name
  before insert on public.profiles
  for each row execute function public.sync_profile_full_name();
