-- Review fixes to _76: a verified operator keeps the identity that was verified, and
-- participation terms text comes from the database rather than from the client.

-- Same rules as _76, plus legal_name and entity_type are fixed once verified.
-- The message is shown as is by the operator compliance profile form.
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
    return new;
  end if;

  if new.verification_level is distinct from old.verification_level
    or new.participation_status is distinct from old.participation_status
    or new.participation_terms_accepted_at is distinct from old.participation_terms_accepted_at
    or new.participation_terms_version is distinct from old.participation_terms_version then
    raise exception 'Verification, participation and terms fields cannot be changed directly'
      using errcode = '42501';
  end if;

  if old.verification_level <> 'registered'
    and (new.legal_name is distinct from old.legal_name
      or new.entity_type is distinct from old.entity_type) then
    raise exception 'Your legal name and entity type cannot be changed after verification. Contact support@shareconload.com.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create table if not exists public.participation_terms (
  version    text primary key,
  title      text not null,
  body       text not null,
  is_current boolean not null default false,
  created_at timestamptz default now()
);

create unique index if not exists participation_terms_one_current_idx
  on public.participation_terms (is_current) where is_current;

alter table public.participation_terms enable row level security;

drop policy if exists "Anyone reads participation terms" on public.participation_terms;
create policy "Anyone reads participation terms" on public.participation_terms
  for select using (true);

drop policy if exists "Admins manage participation terms" on public.participation_terms;
create policy "Admins manage participation terms" on public.participation_terms
  for all using (public.is_admin()) with check (public.is_admin());

-- Holds even if the same acceptance is sent twice at once.
create unique index if not exists agreement_acceptances_participation_once_idx
  on public.agreement_acceptances (operator_profile_id, version)
  where agreement_type = 'operator_participation_terms';

drop function if exists public.accept_participation_terms(text, text);

create or replace function public.accept_participation_terms(p_version text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operator_ids uuid[];
  v_terms public.participation_terms%rowtype;
begin
  select array_agg(op.id) into v_operator_ids
  from public.operator_profiles op
  join public.profiles p on p.id = op.profile_id
  where p.user_id = auth.uid()
    and p.role_type = 'operator';

  if v_operator_ids is null then
    raise exception 'No operator profile for this user';
  end if;
  if cardinality(v_operator_ids) > 1 then
    raise exception 'More than one operator profile for this user';
  end if;

  select * into v_terms from public.participation_terms where is_current;

  if not found then
    raise exception 'No current terms to accept';
  end if;
  if p_version is distinct from v_terms.version then
    raise exception 'This version is not the current terms';
  end if;

  begin
    insert into public.agreement_acceptances
      (operator_profile_id, user_id, agreement_type, version, agreement_text)
    values
      (v_operator_ids[1], auth.uid(), 'operator_participation_terms', v_terms.version, v_terms.body);
  exception when unique_violation then
    raise exception 'These terms are already accepted by this operator';
  end;

  update public.operator_profiles
  set participation_terms_accepted_at = now(),
      participation_terms_version = v_terms.version
  where id = v_operator_ids[1];
end;
$$;

revoke all on function public.accept_participation_terms(text) from public, anon;
grant execute on function public.accept_participation_terms(text) to authenticated;
