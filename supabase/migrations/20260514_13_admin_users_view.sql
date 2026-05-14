-- Exposes auth.users email and metadata to admin users.
-- Requires: profiles.is_admin boolean (not versioned in migrations — must exist in DB).
-- Admin check uses both is_admin (frontend convention) and role_type (DB/RLS convention).
-- profiles actual columns: id, user_id, role_type, is_admin, created_at (no full_name/active_role).
-- full_name is sourced from auth.users.raw_user_meta_data.
create or replace function public.admin_get_users()
returns table (
  id          uuid,
  user_id     uuid,
  role_type   text,
  is_admin    boolean,
  created_at  timestamptz,
  email       text,
  full_name   text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    p.id,
    p.user_id,
    p.role_type,
    p.is_admin,
    p.created_at,
    u.email,
    u.raw_user_meta_data->>'full_name' as full_name
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where exists (
    select 1 from public.profiles admin_check
    where admin_check.user_id = auth.uid()
      and (admin_check.is_admin = true or admin_check.role_type = 'admin')
  )
  order by p.created_at desc;
$$;

grant execute on function public.admin_get_users() to authenticated;
