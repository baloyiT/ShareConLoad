-- Clients could approve their own documents: the owner policies on compliance_documents and
-- customer_kyc limit by owner only, and the verified badge and operator_is_compliant() trust status.
--
-- Non-admin clients may only write the initial status. A client update must therefore leave the row
-- in review, so a reviewed row can never change and stay approved or verified.
--
-- What the clients really send, on this branch and at production commit 04f2c62:
--   compliance_documents: one upsert with status under_review, admin_notes null and uploaded_at.
--     That is why admin_notes may be cleared, and only cleared: re-uploading after a rejection does it.
--     file_url cannot prove a new file, because the path is the same on a re-upload.
--   customer_kyc: both server actions run as the user and send status pending_review. Neither sends
--     rejection_reason or reviewed_at, so those are fixed for a client.
-- Neither table has a client delete policy.
--
-- Service role, SECURITY DEFINER code and is_admin() pass, as in guard_operator_listing_fields.

create or replace function public.guard_compliance_document_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'under_review'
      or new.admin_notes is not null
      or new.reviewed_at is not null then
      raise exception 'Document review fields cannot be set directly'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status is distinct from 'under_review'
    or new.reviewed_at is distinct from old.reviewed_at
    or (new.admin_notes is not null and new.admin_notes is distinct from old.admin_notes) then
    raise exception 'Document review fields cannot be changed directly'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_compliance_document_fields on public.compliance_documents;
create trigger guard_compliance_document_fields
  before insert or update on public.compliance_documents
  for each row execute function public.guard_compliance_document_fields();

create or replace function public.guard_customer_kyc_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'pending_review'
      or new.rejection_reason is not null
      or new.reviewed_at is not null then
      raise exception 'KYC review fields cannot be set directly'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.status is distinct from 'pending_review'
    or new.reviewed_at is distinct from old.reviewed_at
    or new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'KYC review fields cannot be changed directly'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_customer_kyc_fields on public.customer_kyc;
create trigger guard_customer_kyc_fields
  before insert or update on public.customer_kyc
  for each row execute function public.guard_customer_kyc_fields();

-- Same as _86, plus compliance_rejection_reason, which only an admin writes.
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
      or new.phone_verified is true
      or new.compliance_rejection_reason is not null then
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
    or new.phone_verified is distinct from old.phone_verified
    or new.compliance_rejection_reason is distinct from old.compliance_rejection_reason then
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

  if old.verification_level <> 'registered'
    and nullif(btrim(old.trading_name), '') is not null
    and new.trading_name is distinct from old.trading_name then
    raise exception 'Your trading name cannot be changed after verification. Contact support@shareconload.com.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
