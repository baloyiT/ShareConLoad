-- Two founder decisions.
--
-- A. Draft terms cannot be accepted yet. accept_participation_terms() refuses the current row
--    until open_for_acceptance is true. 0.1-draft stays false: only the founder turns it on, after
--    approval. A re-run leaves the flag alone.
--
-- B. A private person's legal name is not published. The directory shows the trimmed trading_name
--    if set, otherwise legal_name for companies. An individual never falls back to legal_name:
--    an individual with a blank trading_name is not listed. operator_is_compliant() is not touched.

alter table public.participation_terms
  add column if not exists open_for_acceptance boolean not null default false;

alter table public.operator_profiles
  add column if not exists trading_name text;

-- Same as _79, plus the open_for_acceptance check.
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
  if v_terms.open_for_acceptance is not true then
    raise exception 'These terms are not open for acceptance yet';
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

-- Clause 6 now names the trading name. Text someone has accepted is never rewritten.
-- The body must match participationTermsPlainText() exactly. \n escapes keep it independent of
-- how this file is checked out.
update public.participation_terms t
set body = E'ShareConLoad Operator Participation Terms\nVersion 0.1-draft\n\n1. Free Founding Leads. Leads are free of charge for founding operators for 90 days.\n\n2. Outcome Reporting. In return for free founding leads, you agree to report the outcome of the leads you receive.\n\n3. Preferential Pricing Later. After the founding period, founding operators will receive preferential pricing. These terms do not set a price or a discount.\n\n4. No Guaranteed Volumes. ShareConLoad does not guarantee any number of leads, quotes, customers or volume of work.\n\n5. Your Services. You are an independent operator. You are responsible for the services you offer and deliver. ShareConLoad connects you with customers and does not deliver the freight.\n\n6. Your Public Listing. If you are listed, the directory shows your trading name publicly. A company with no trading name is shown under its registered name. The directory also shows your public description, public phone, public email, services and coverage.\n\n7. Data Handling. ShareConLoad uses the details and documents you provide to verify you and to connect you with customers. Your private contact details and your documents are not published. Questions about your data go to support@shareconload.com.'
where t.version = '0.1-draft'
  and not exists (
    select 1 from public.agreement_acceptances a
    where a.agreement_type = 'operator_participation_terms' and a.version = t.version
  );

-- Same as _84, plus trading_name: fixed once verified, like legal_name, except that a verified
-- operator with a blank trading_name may still set one. An individual has to, to be listed.
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

  if old.verification_level <> 'registered'
    and nullif(btrim(old.trading_name), '') is not null
    and new.trading_name is distinct from old.trading_name then
    raise exception 'Your trading name cannot be changed after verification. Contact support@shareconload.com.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Same as _76, plus the individual trading name rule.
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
      and (op.entity_type <> 'individual' or nullif(btrim(op.trading_name), '') is not null)
      and exists (select 1 from public.operator_services s where s.operator_profile_id = op.id)
      and exists (select 1 from public.operator_coverage c where c.operator_profile_id = op.id)
  );
$$;

revoke all on function public.operator_is_listed(uuid) from public;
grant execute on function public.operator_is_listed(uuid) to anon, authenticated;

-- Same as _77, except for display_name.
create or replace function public.get_directory_operator(op_id uuid)
returns table (
  id                 uuid,
  display_name       text,
  public_description text,
  verification_level text,
  services           text[],
  coverage           jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    op.id,
    coalesce(
      nullif(btrim(op.trading_name), ''),
      case when op.entity_type <> 'individual' then op.legal_name end
    ),
    op.public_description,
    op.verification_level,
    array(
      select sc.name
      from public.operator_services s
      join public.service_categories sc on sc.id = s.service_category_id
      where s.operator_profile_id = op.id and sc.is_active
      order by sc.sort_order, sc.name
    ),
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id,
        'operator_profile_id', c.operator_profile_id,
        'origin_country', c.origin_country,
        'origin_city', c.origin_city,
        'destination_country', c.destination_country,
        'destination_city', c.destination_city,
        'transport_mode', c.transport_mode
      ) order by c.origin_country, c.origin_city, c.destination_country, c.destination_city), '[]'::jsonb)
      from public.operator_coverage c
      where c.operator_profile_id = op.id
    )
  from public.operator_profiles op
  where op.id = op_id
    and public.operator_is_listed(op.id);
$$;

-- Same as _77, except that the 100-row cut sorts on the display name, so it never orders by a
-- legal name that is not shown.
create or replace function public.search_directory(
  p_service             text default null,
  p_mode                text default null,
  p_origin_country      text default null,
  p_origin_city         text default null,
  p_destination_country text default null,
  p_destination_city    text default null
)
returns table (
  id                 uuid,
  display_name       text,
  public_description text,
  verification_level text,
  services           text[],
  coverage           jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with f as (
    select
      nullif(lower(trim(p_service)), '')             as service,
      nullif(lower(trim(p_mode)), '')                as mode,
      nullif(lower(trim(p_origin_country)), '')      as origin_country,
      nullif(lower(trim(p_origin_city)), '')         as origin_city,
      nullif(lower(trim(p_destination_country)), '') as destination_country,
      nullif(lower(trim(p_destination_city)), '')    as destination_city
  ),
  matched as (
    select op.id
    from public.operator_profiles op
    cross join f
    where public.operator_is_listed(op.id)
      and (f.mode is null or f.mode = any(enum_range(null::public.transport_mode)::text[]))
      and (f.service is null or exists (
        select 1
        from public.operator_services s
        join public.service_categories sc on sc.id = s.service_category_id
        where s.operator_profile_id = op.id
          and sc.is_active
          and sc.slug = f.service
      ))
      and exists (
        select 1
        from public.operator_coverage c
        where c.operator_profile_id = op.id
          and (f.mode is null
            or c.transport_mode::text = f.mode
            or (c.transport_mode is null and exists (
              select 1
              from public.operator_services s
              join public.service_categories sc on sc.id = s.service_category_id
              where s.operator_profile_id = op.id
                and sc.is_active
                and (sc.transport_mode is null or sc.transport_mode::text = f.mode)
            )))
          and (f.origin_country is null or lower(c.origin_country) = f.origin_country)
          and (f.origin_city is null
            or lower(c.origin_city) = f.origin_city
            or (c.origin_city is null and f.origin_country is not null))
          and (f.destination_country is null or lower(c.destination_country) = f.destination_country)
          and (f.destination_city is null
            or lower(c.destination_city) = f.destination_city
            or (c.destination_city is null and f.destination_country is not null))
      )
    order by
      coalesce(
        nullif(btrim(op.trading_name), ''),
        case when op.entity_type <> 'individual' then op.legal_name end
      ),
      op.id
    limit 100
  )
  select d.*
  from matched m
  cross join lateral public.get_directory_operator(m.id) d
  order by d.display_name, d.id;
$$;

revoke all on function public.get_directory_operator(uuid) from public;
revoke all on function public.search_directory(text, text, text, text, text, text) from public;
grant execute on function public.get_directory_operator(uuid) to anon, authenticated;
grant execute on function public.search_directory(text, text, text, text, text, text) to anon, authenticated;
