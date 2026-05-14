-- Replaces client-side profiles.full_name joins (column does not exist).
-- Sources name and email from auth.users via SECURITY DEFINER.
-- Requires: profiles.is_admin boolean and profiles.user_id uuid (both exist in DB).

-- ── Function 1: Compliance flags with raiser identity ──────────────────────────

create or replace function public.admin_get_compliance_flags()
returns table (
  id              uuid,
  target_type     text,
  target_id       uuid,
  flag_type       text,
  description     text,
  resolved        boolean,
  resolved_at     timestamptz,
  created_at      timestamptz,
  raised_by_name  text,
  raised_by_email text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    f.id,
    f.target_type,
    f.target_id,
    f.flag_type,
    f.description,
    f.resolved,
    f.resolved_at,
    f.created_at,
    u.raw_user_meta_data->>'full_name' as raised_by_name,
    u.email                            as raised_by_email
  from public.compliance_flags f
  left join public.profiles p on p.id  = f.raised_by
  left join auth.users       u on u.id = p.user_id
  where exists (
    select 1 from public.profiles admin_check
    where admin_check.user_id = auth.uid()
      and (admin_check.is_admin = true or admin_check.role_type = 'admin')
  )
  order by f.created_at desc;
$$;

revoke execute on function public.admin_get_compliance_flags() from public;
grant execute on function public.admin_get_compliance_flags() to authenticated;

-- ── Function 2: Compliance documents with operator identity ────────────────────

create or replace function public.admin_get_compliance_docs()
returns table (
  id                  uuid,
  operator_profile_id uuid,
  doc_type            text,
  file_url            text,
  status              text,
  admin_notes         text,
  uploaded_at         timestamptz,
  reviewed_at         timestamptz,
  operator_name       text,
  operator_email      text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    d.id,
    d.operator_profile_id,
    d.doc_type,
    d.file_url,
    d.status,
    d.admin_notes,
    d.uploaded_at,
    d.reviewed_at,
    u.raw_user_meta_data->>'full_name' as operator_name,
    u.email                            as operator_email
  from public.compliance_documents d
  left join public.operator_profiles op on op.id  = d.operator_profile_id
  left join public.profiles          p  on p.id   = op.profile_id
  left join auth.users               u  on u.id   = p.user_id
  where exists (
    select 1 from public.profiles admin_check
    where admin_check.user_id = auth.uid()
      and (admin_check.is_admin = true or admin_check.role_type = 'admin')
  )
  order by d.uploaded_at desc;
$$;

revoke execute on function public.admin_get_compliance_docs() from public;
grant execute on function public.admin_get_compliance_docs() to authenticated;
