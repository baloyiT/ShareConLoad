-- Critical fix: "Users can access own profiles" allows ALL on a user's own rows, and user_id
-- is not unique, so any signed-in user could make themselves admin by updating is_admin or
-- role_type, or by inserting another row. is_admin() and every admin policy trust these fields.
--
-- Must stay SECURITY INVOKER: current_user has to be the caller's role. handle_new_user and
-- the service role do not run as authenticated or anon, so they pass.
-- is_admin() only reads profiles, so this cannot recurse. In a before trigger it cannot see
-- the row being written, so a row cannot vouch for itself.
create or replace function public.guard_profile_admin_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if new.is_admin or new.role_type = 'admin' then
    raise exception 'Admin access cannot be set from a client'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and (old.is_admin or old.role_type = 'admin') then
    raise exception 'Admin access cannot be changed from a client'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_admin_fields on public.profiles;
create trigger guard_profile_admin_fields
  before insert or update on public.profiles
  for each row execute function public.guard_profile_admin_fields();
