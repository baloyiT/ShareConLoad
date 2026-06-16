-- Backfill: operators who signed the service agreement before the
-- agreement page started writing status alongside the signature
-- (fixed in commit 6fe2989, 2026-06-15 21:09 SAST) are stuck on
-- status = 'draft' despite having completed every compliance step.
-- Move any such row to pending_verification so it surfaces correctly
-- on the admin compliance queue instead of showing as "Incomplete".

update public.operator_profiles
set status = 'pending_verification'
where service_agreement_signed_at is not null
  and status = 'draft'
  and compliance_rejection_reason is null;
