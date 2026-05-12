-- supabase/migrations/20260512_12_documents_international.sql

-- Step 1: rename any existing proof_of_address rows before changing the constraint
update public.compliance_documents
  set doc_type = 'proof_of_warehouse_address'
  where doc_type = 'proof_of_address';

-- Step 2: drop the old check constraint (name matches the one created by the previous migration)
alter table public.compliance_documents
  drop constraint if exists compliance_documents_doc_type_check;

-- Step 3: add the new check constraint with all 7 doc types
alter table public.compliance_documents
  add constraint compliance_documents_doc_type_check
  check (doc_type in (
    'identity',
    'business_registration',
    'proof_of_warehouse_address',
    'tax_clearance',
    'banking_confirmation',
    'cargo_insurance',
    'freight_forwarding_license'
  ));
