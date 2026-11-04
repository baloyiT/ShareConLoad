-- Review fixes to _80. Same rules, plus:
-- - insert checks on status and verification_level use "is distinct from", so a null cannot pass
-- - bank_confirmation_letter_url is guarded like the other bank fields. Nothing writes it today:
--   the column has no client or Edge Function writer. An admin may read it as proof of a bank
--   account, so a client must not be able to set it. Bank letters go in compliance_documents.
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
