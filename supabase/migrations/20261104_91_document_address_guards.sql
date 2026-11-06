-- A client could point its document row at someone else's file. An admin then opens that address
-- with admin rights, so an operator or customer could read another user's documents through the
-- review screen. Same as _88, plus the address checks.
--
-- What the clients really send, on this branch and at production commit 04f2c62:
--   compliance_documents.file_url: the storage path <operator_profile_id>/<doc_type>.<ext>.
--     The signed agreement is written by generate-agreement-pdf with the service role, which passes.
--   customer_kyc URLs: the full public-style address from getPublicUrl:
--     https://<host>/storage/v1/object/public/customer-kyc/<user id>/<key>_<time>.<ext>
--     The admin page cuts the path out of it after /object/public/customer-kyc/ and decodes it once,
--     so an encoded climb is refused as well as a plain one. The host is left open: only the path
--     is ever used. proof_of_address_url may be null.
-- Only a new or changed address is checked. All 5 compliance rows and both KYC rows comply today.

create or replace function public.guard_compliance_document_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if (tg_op = 'INSERT' or new.file_url is distinct from old.file_url)
    and (new.file_url !~ ('^' || new.operator_profile_id::text || '/[^/]+$')
      or position('..' in new.file_url) > 0) then
    raise exception 'Documents must sit in your own folder'
      using errcode = '42501';
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

create or replace function public.guard_customer_kyc_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_own_file text;
  v_climb constant text := '\.\.|%2f|%5c|%2e%2e';
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  v_own_file := '^https://[^/]+/storage/v1/object/public/customer-kyc/' || auth.uid()::text || '/[^/]+$';

  if (new.id_document_url is not null
      and (tg_op = 'INSERT' or new.id_document_url is distinct from old.id_document_url)
      and (new.id_document_url !~ v_own_file or new.id_document_url ~* v_climb))
    or (new.proof_of_address_url is not null
      and (tg_op = 'INSERT' or new.proof_of_address_url is distinct from old.proof_of_address_url)
      and (new.proof_of_address_url !~ v_own_file or new.proof_of_address_url ~* v_climb)) then
    raise exception 'Documents must sit in your own folder'
      using errcode = '42501';
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
