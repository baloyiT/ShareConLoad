-- Front door: lighter verification and participation for the public directory (Module A).
-- Separate from the Stage 3 compliance gate: operator_is_compliant() and the
-- existing operator_profiles.status column are not touched.

alter table public.operator_profiles
  add column if not exists verification_level text not null default 'registered'
    check (verification_level in ('registered', 'identity_verified', 'business_verified')),
  add column if not exists participation_status text not null default 'pending'
    check (participation_status in ('pending', 'active', 'suspended', 'deactivated')),
  add column if not exists public_description text,
  add column if not exists public_phone text,
  add column if not exists public_email text,
  add column if not exists participation_terms_accepted_at timestamptz,
  add column if not exists participation_terms_version text;

-- "Users manage own operator profile" allows ALL, so the protected fields are guarded here.
-- Must stay SECURITY INVOKER: current_user has to be the caller's role. SECURITY DEFINER
-- functions such as accept_participation_terms run as their owner, so they pass.
-- Covers insert as well as update, because the same policy lets a user create their own row.
create or replace function public.guard_operator_listing_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.verification_level <> 'registered'
      or new.participation_status <> 'pending'
      or new.participation_terms_accepted_at is not null
      or new.participation_terms_version is not null then
      raise exception 'Verification, participation and terms fields cannot be set directly'
        using errcode = '42501';
    end if;
  elsif new.verification_level is distinct from old.verification_level
    or new.participation_status is distinct from old.participation_status
    or new.participation_terms_accepted_at is distinct from old.participation_terms_accepted_at
    or new.participation_terms_version is distinct from old.participation_terms_version then
    raise exception 'Verification, participation and terms fields cannot be changed directly'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_operator_listing_fields on public.operator_profiles;
create trigger guard_operator_listing_fields
  before insert or update on public.operator_profiles
  for each row execute function public.guard_operator_listing_fields();

-- SECURITY DEFINER so the answer is the same for every caller: operator_services and
-- operator_coverage have no public read. It returns only a boolean.
create or replace function public.operator_is_listed(op_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.operator_profiles op
    where op.id = op_id
      and op.verification_level in ('identity_verified', 'business_verified')
      and op.participation_status = 'active'
      and op.participation_terms_accepted_at is not null
      and exists (select 1 from public.operator_services s where s.operator_profile_id = op.id)
      and exists (select 1 from public.operator_coverage c where c.operator_profile_id = op.id)
  );
$$;

revoke all on function public.operator_is_listed(uuid) from public;
grant execute on function public.operator_is_listed(uuid) to anon, authenticated;

-- Participation terms are not the service agreement: service_agreement_signed_at stays as it is.
create or replace function public.accept_participation_terms(p_version text, p_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operator_id uuid;
begin
  if coalesce(trim(p_version), '') = '' or coalesce(trim(p_text), '') = '' then
    raise exception 'Terms version and text are required';
  end if;

  select op.id into v_operator_id
  from public.operator_profiles op
  join public.profiles p on p.id = op.profile_id
  where p.user_id = auth.uid()
  limit 1;

  if v_operator_id is null then
    raise exception 'No operator profile for this user';
  end if;

  update public.operator_profiles
  set participation_terms_accepted_at = now(),
      participation_terms_version = p_version
  where id = v_operator_id;

  insert into public.agreement_acceptances
    (operator_profile_id, user_id, agreement_type, version, agreement_text)
  values
    (v_operator_id, auth.uid(), 'operator_participation_terms', p_version, p_text);
end;
$$;

revoke all on function public.accept_participation_terms(text, text) from public, anon;
grant execute on function public.accept_participation_terms(text, text) to authenticated;

-- One-off backfill. Participation stays pending for everyone, and the old service
-- agreement does not count as accepting the terms. Only 'individual' is an individual.
update public.operator_profiles op
set verification_level = 'business_verified'
where op.verification_level = 'registered'
  and op.entity_type is distinct from 'individual'
  and exists (
    select 1 from public.compliance_documents cd
    where cd.operator_profile_id = op.id and cd.doc_type = 'identity' and cd.status = 'approved')
  and exists (
    select 1 from public.compliance_documents cd
    where cd.operator_profile_id = op.id and cd.doc_type = 'business_registration' and cd.status = 'approved');

update public.operator_profiles op
set verification_level = 'identity_verified'
where op.verification_level = 'registered'
  and op.entity_type = 'individual'
  and exists (
    select 1 from public.compliance_documents cd
    where cd.operator_profile_id = op.id and cd.doc_type = 'identity' and cd.status = 'approved');
