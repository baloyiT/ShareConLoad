-- Remove cargo_insurance from the mandatory compliance check.
-- It is an optional document; only the 5 core doc types are required.

create or replace function public.operator_is_compliant(op_id uuid)
returns boolean
language sql
security invoker
set search_path = public
as $$
  select
    op.legal_name                      is not null
    and op.phone_number                is not null
    and op.paystack_recipient_code     is not null
    and op.service_agreement_signed_at is not null
    and (
      select count(*)
      from public.compliance_documents cd
      where cd.operator_profile_id = op.id
        and cd.doc_type in (
          'identity',
          'business_registration',
          'proof_of_warehouse_address',
          'tax_clearance',
          'banking_confirmation'
        )
        and cd.status = 'approved'
    ) = 5
  from public.operator_profiles op
  where op.id = op_id;
$$;

grant execute on function public.operator_is_compliant(uuid) to authenticated;
