create or replace function public.admin_get_users()
returns table (
  id          uuid,
  user_id     uuid,
  full_name   text,
  active_role text,
  is_admin    boolean,
  created_at  timestamptz,
  email       text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    p.id,
    p.user_id,
    p.full_name,
    p.active_role,
    p.is_admin,
    p.created_at,
    u.email
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where exists (
    select 1 from public.profiles admin_check
    where admin_check.user_id = auth.uid()
      and admin_check.is_admin = true
  )
  order by p.created_at desc;
$$;

grant execute on function public.admin_get_users() to authenticated;
