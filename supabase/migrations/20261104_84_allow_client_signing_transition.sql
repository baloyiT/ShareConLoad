-- Production fix: the live frontend (commit 04f2c62) signs the service agreement with a direct
-- client update that also sets status = 'pending_verification'. _80 and _83 refuse that update.
--
-- A client may make exactly one status change: draft to pending_verification, in the same update
-- that sets a new service_agreement_signed_at. Every other client status change stays blocked.
-- pending_verification only queues the operator for admin review, so it grants nothing.
--
-- Can be tightened once the new frontend is live: it signs through generate-agreement-pdf with
-- the service role, so this exception can then be removed.
--
-- Otherwise the same rules as _83.
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
    if new.verification_level is distinct from 'registered'
      or new.participation_status is distinct from 'pending'
      or new.participation_terms_accepted_at is not null
      or new.participation_terms_version is not null then
      raise exception 'Verification, participation and terms fields cannot be set directly'
        using errcode = '42501';
    end if;
    if new.status is distinct from 'draft'
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
      or new.bank_confirmation_letter_url is not null
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
    and not (
      old.status = 'draft'
      and new.status = 'pending_verification'
      and new.service_agreement_signed_at is not null
      and new.service_agreement_signed_at is distinct from old.service_agreement_signed_at
    ) then
    raise exception 'Status, payout, bank and phone verification fields cannot be changed directly'
      using errcode = '42501';
  end if;

  if new.payout_enabled is distinct from old.payout_enabled
    or new.payout_hold is distinct from old.payout_hold
    or new.payout_hold_reason is distinct from old.payout_hold_reason
    or new.paystack_recipient_code is distinct from old.paystack_recipient_code
    or new.bank_code is distinct from old.bank_code
    or new.bank_account_number is distinct from old.bank_account_number
    or new.bank_account_name is distinct from old.bank_account_name
    or new.bank_name is distinct from old.bank_name
    or new.bank_country is distinct from old.bank_country
    or new.bank_swift_code is distinct from old.bank_swift_code
    or new.bank_confirmation_letter_url is distinct from old.bank_confirmation_letter_url
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
