-- Security fix: "Users manage own operator profile" allows ALL, so an operator could enable
-- their own payouts, lift a hold, swap the bank details a payout goes to, approve themselves
-- through status, or delete their row and the agreement_acceptances that cascade from it.
--
-- No client flow writes these fields. /operator/bank goes through create-transfer-recipient and
-- the agreement through generate-agreement-pdf, both with the service role, which passes here.
-- The only client write of status is onboarding's insert of 'draft'.
--
-- Same rules as _79, plus the above. Must stay SECURITY INVOKER: current_user has to be the
-- caller's role. A cascade from profiles runs as the table owner, so it passes this guard;
-- guard_profile_operator_delete below covers that route.
create or replace function public.guard_operator_listing_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Operator profiles cannot be deleted. Contact support@shareconload.com.'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.verification_level <> 'registered'
      or new.participation_status <> 'pending'
      or new.participation_terms_accepted_at is not null
      or new.participation_terms_version is not null then
      raise exception 'Verification, participation and terms fields cannot be set directly'
        using errcode = '42501';
    end if;
    if new.status <> 'draft'
      or new.payout_enabled is true
      or new.payout_hold is true
      or new.payout_hold_reason is not null
      or new.paystack_recipient_code is not null
      or new.bank_code is not null
      or new.bank_account_number is not null
      or new.bank_account_name is not null
      or new.bank_name is not null
      or new.bank_country is not null
      or new.bank_swift_code is not null
      or new.payout_method is distinct from 'paystack'
      or new.phone_verified is true then
      raise exception 'Status, payout, bank and phone verification fields cannot be set directly'
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

  if new.status is distinct from old.status
    or new.payout_enabled is distinct from old.payout_enabled
    or new.payout_hold is distinct from old.payout_hold
    or new.payout_hold_reason is distinct from old.payout_hold_reason
    or new.paystack_recipient_code is distinct from old.paystack_recipient_code
    or new.bank_code is distinct from old.bank_code
    or new.bank_account_number is distinct from old.bank_account_number
    or new.bank_account_name is distinct from old.bank_account_name
    or new.bank_name is distinct from old.bank_name
    or new.bank_country is distinct from old.bank_country
    or new.bank_swift_code is distinct from old.bank_swift_code
    or new.payout_method is distinct from old.payout_method
    or new.phone_verified is distinct from old.phone_verified then
    raise exception 'Status, payout, bank and phone verification fields cannot be changed directly'
      using errcode = '42501';
  end if;

  if old.verification_level <> 'registered'
    and (new.legal_name is distinct from old.legal_name
      or new.entity_type is distinct from old.entity_type
      or new.registration_number is distinct from old.registration_number
      or new.id_number is distinct from old.id_number
      or new.id_type is distinct from old.id_type) then
    raise exception 'Your legal name, entity type and identity numbers cannot be changed after verification. Contact support@shareconload.com.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_operator_listing_fields on public.operator_profiles;
create trigger guard_operator_listing_fields
  before insert or update or delete on public.operator_profiles
  for each row execute function public.guard_operator_listing_fields();

-- "Users can access own profiles" allows ALL, and operator_profiles cascades from profiles.
-- Only rows with an operator record are blocked: createOperatorProfile deletes its own profiles
-- row when no operator record exists, to retry cleanly.
create or replace function public.guard_profile_operator_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
    and not public.is_admin()
    and exists (select 1 from public.operator_profiles op where op.profile_id = old.id) then
    raise exception 'Operator profiles cannot be deleted. Contact support@shareconload.com.'
      using errcode = '42501';
  end if;

  return old;
end;
$$;

drop trigger if exists guard_profile_operator_delete on public.profiles;
create trigger guard_profile_operator_delete
  before delete on public.profiles
  for each row execute function public.guard_profile_operator_delete();
