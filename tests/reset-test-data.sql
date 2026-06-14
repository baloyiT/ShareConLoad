-- ============================================================
-- ShareConLoad — Reset Test Data
-- ============================================================
-- Deletes all user-generated data while preserving system config
-- (fx_rates, commission_config, waitlist_entries are kept).
--
-- Run this in the Supabase SQL Editor (service role / admin).
-- Deletion order respects FK constraints: deepest dependants first.
-- Tables with ON DELETE CASCADE from bookings/profiles are handled
-- automatically, but listed explicitly for clarity.
-- ============================================================

-- ── 1. Leaf tables hanging off disputes ─────────────────────
delete from public.dispute_evidence;
delete from public.insurance_claims;

-- ── 2. Leaf tables hanging off bookings ─────────────────────
delete from public.booking_messages;
delete from public.booking_ratings;
delete from public.shipment_item_photos;
delete from public.shipment_items;
delete from public.booking_status_history;
delete from public.payments;
delete from public.payouts;
delete from public.shipment_milestones;
delete from public.customs_events;
delete from public.cargo_release_authorizations;
delete from public.declarations;
delete from public.disputes;

-- ── 3. Support & audit (FK to profiles; booking_id nullable) ─
delete from public.support_tickets;
delete from public.audit_logs;
delete from public.notifications;
delete from public.compliance_flags;

-- ── 4. Bookings (FK to containers + profiles) ────────────────
delete from public.bookings;

-- ── 5. Containers (FK to profiles) ───────────────────────────
delete from public.containers;

-- ── 6. Agent sub-tables (CASCADE from agent_profiles) ────────
delete from public.agent_managed_shippers;
delete from public.agent_profiles;

-- ── 7. KYC & compliance documents ────────────────────────────
delete from public.customer_kyc;

-- ── 8. Operator profiles (CASCADE from profiles) ─────────────
delete from public.operator_profiles;

-- ── 9. Profiles (root of most user data) ─────────────────────
delete from public.profiles;

-- ── 10. Auth users — DELETE ONLY TEST ACCOUNTS ───────────────
-- This requires service role. Comment out if you want to keep auth users.
delete from auth.users
where email in (
  'customer.shareconload@gmail.com',
  'mercy.affulbaloyi@gmail.com',
  'justice_baloyi@yahoo.com',
  'admin.shareconload@test.com'
);

-- ============================================================
-- After running this script, recreate test users with:
--   node tests/create-test-users.mjs
-- ============================================================
