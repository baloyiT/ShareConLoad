-- supabase/migrations/20260511_10_operator_compliance_fields.sql
-- Adds fields required by the operator compliance portal.

alter table public.operator_profiles
  add column if not exists address            text,
  add column if not exists service_agreement_signed_at timestamptz,
  add column if not exists service_agreement_version   text;
