-- Clients could set their own approval on the three role profiles. agent_profiles has an ALL owner
-- policy with no guard, and the owner insert policies on measurement_agent_profiles and
-- transporter_profiles put no limit on any column. trigger-measurement-agent-payout and
-- trigger-transporter-payout trust these fields, so this protects money.
--
-- What the clients really send, the same on this branch and at production commit 04f2c62:
--   agent_profiles (actions/agentActions.ts, run as the signed-in user):
--     insert with status draft.
--     step 1 update with status draft, or approved when the row is already approved.
--     credentials, document and bank updates, with no status.
--     submit: status pending_review.
--     A rejected agent restarts at step 1, so rejected to draft must stay open.
--     No client writes rejection_reason.
--   measurement_agent_profiles, transporter_profiles: one insert of the name, contact, vehicle and
--     document fields. No owner update policy exists on either table, and no client updates them.
--
-- Written by no client: payout_enabled, payout_hold, paystack_recipient_code, average_rating,
-- total_jobs_completed, certification_test_passed and service_agreement_signed_at.
-- increment_agent_jobs is SECURITY DEFINER, so its update runs as postgres and passes.
-- Admin decisions run as the signed-in admin and pass on is_admin().
--
-- Service role, SECURITY DEFINER code and is_admin() pass, as in guard_operator_listing_fields.

create or replace function public.guard_agent_profile_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'draft' or new.rejection_reason is not null then
      raise exception 'Application status cannot be set directly'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- A client may keep the status, or move only to a state that an admin still has to review.
  if new.rejection_reason is distinct from old.rejection_reason
    or (new.status is distinct from old.status and new.status not in ('draft', 'pending_review')) then
    raise exception 'Application status cannot be changed directly'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_agent_profile_fields on public.agent_profiles;
create trigger guard_agent_profile_fields
  before insert or update on public.agent_profiles
  for each row execute function public.guard_agent_profile_fields();

create or replace function public.guard_measurement_agent_profile_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'pending'
      or new.rejection_reason is not null
      or new.certification_test_passed is true
      or new.service_agreement_signed_at is not null
      or new.average_rating is not null
      or new.total_jobs_completed is distinct from 0
      or new.paystack_recipient_code is not null
      or new.payout_enabled is true
      or new.payout_hold is true then
      raise exception 'Status, review and payout fields cannot be set directly'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status
    or new.rejection_reason is distinct from old.rejection_reason
    or new.certification_test_passed is distinct from old.certification_test_passed
    or new.service_agreement_signed_at is distinct from old.service_agreement_signed_at
    or new.average_rating is distinct from old.average_rating
    or new.total_jobs_completed is distinct from old.total_jobs_completed
    or new.paystack_recipient_code is distinct from old.paystack_recipient_code
    or new.payout_enabled is distinct from old.payout_enabled
    or new.payout_hold is distinct from old.payout_hold then
    raise exception 'Status, review and payout fields cannot be changed directly'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_measurement_agent_profile_fields on public.measurement_agent_profiles;
create trigger guard_measurement_agent_profile_fields
  before insert or update on public.measurement_agent_profiles
  for each row execute function public.guard_measurement_agent_profile_fields();

create or replace function public.guard_transporter_profile_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'pending'
      or new.rejection_reason is not null
      or new.average_rating is not null
      or new.total_jobs_completed is distinct from 0
      or new.paystack_recipient_code is not null
      or new.payout_enabled is true
      or new.payout_hold is true then
      raise exception 'Status, review and payout fields cannot be set directly'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status
    or new.rejection_reason is distinct from old.rejection_reason
    or new.average_rating is distinct from old.average_rating
    or new.total_jobs_completed is distinct from old.total_jobs_completed
    or new.paystack_recipient_code is distinct from old.paystack_recipient_code
    or new.payout_enabled is distinct from old.payout_enabled
    or new.payout_hold is distinct from old.payout_hold then
    raise exception 'Status, review and payout fields cannot be changed directly'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_transporter_profile_fields on public.transporter_profiles;
create trigger guard_transporter_profile_fields
  before insert or update on public.transporter_profiles
  for each row execute function public.guard_transporter_profile_fields();
