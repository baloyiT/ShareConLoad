-- Makes the dispute tables match what the dispute pages send, on the live frontend
-- (04f2c62) and on this branch. Everything here is additive or relaxes a constraint.

-- 1. uploaded_by is a profile id, as the page, the insert policy and the sibling columns
--    (disputes.submitted_by, insurance_claims.submitted_by) all treat it. _48 pointed it
--    at auth.users, so every customer insert failed with 23503. The evidence still
--    survives its uploader, which is what _48 wanted.
alter table public.dispute_evidence
  drop constraint if exists dispute_evidence_uploaded_by_fkey;

alter table public.dispute_evidence
  add constraint dispute_evidence_uploaded_by_fkey
  foreign key (uploaded_by) references public.profiles(id) on delete set null;

-- 2. The page reads and writes these two columns, which the live table never received.
alter table public.dispute_evidence
  add column if not exists description text,
  add column if not exists created_at timestamptz not null default now();

-- 3. raised_by was NOT NULL with no default and neither page sends it, so no customer
--    could open a dispute. NOT NULL also contradicted the on delete set null from _48.
alter table public.disputes
  alter column raised_by drop not null,
  alter column raised_by set default auth.uid();

-- 4. The page offers these types and the enum refused them with 22P02.
alter type public.dispute_type add value if not exists 'short_delivery';
alter type public.dispute_type add value if not exists 'overcharge';
alter type public.dispute_type add value if not exists 'delay';
alter type public.dispute_type add value if not exists 'other';
