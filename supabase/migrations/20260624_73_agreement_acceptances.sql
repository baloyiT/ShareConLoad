-- Append-only record of accepted operator service agreements (provenance + text snapshot).
create table if not exists public.agreement_acceptances (
  id                     uuid primary key default gen_random_uuid(),
  operator_profile_id    uuid not null references public.operator_profiles(id) on delete cascade,
  user_id                uuid not null,
  agreement_type         text not null default 'operator_service_agreement',
  version                text not null,
  accepted_at            timestamptz not null default now(),
  ip_address             text,
  user_agent             text,
  agreement_text         text not null,
  pdf_path               text,
  compliance_document_id uuid references public.compliance_documents(id) on delete set null,
  created_at             timestamptz not null default now()
);

create index if not exists idx_agreement_acceptances_operator
  on public.agreement_acceptances(operator_profile_id);

alter table public.agreement_acceptances enable row level security;

-- Operators read their own; admins read all. Writes happen only via the Edge Function
-- (service role bypasses RLS) — no insert/update/delete policy is granted to clients.
do $$ begin
  create policy "read own or admin agreement acceptances"
    on public.agreement_acceptances for select
    using (
      operator_profile_id in (
        select op.id from public.operator_profiles op
        join public.profiles p on p.id = op.profile_id
        where p.user_id = auth.uid()
      )
      or public.is_admin()
    );
exception when duplicate_object then null; end $$;

-- Allow 'service_agreement' as a compliance document type.
alter table public.compliance_documents drop constraint if exists compliance_documents_doc_type_check;
alter table public.compliance_documents add constraint compliance_documents_doc_type_check
  check (doc_type = any (array[
    'identity','business_registration','proof_of_warehouse_address','tax_clearance',
    'banking_confirmation','cargo_insurance','freight_forwarding_license','service_agreement'
  ]));
