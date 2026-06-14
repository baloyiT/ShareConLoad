-- 20260614_48_cascade_user_deletion.sql
--
-- Goal: deleting a row from auth.users automatically cleans up all
-- associated data across the platform.
--
-- Strategy:
--   CASCADE  — for data the user "owns" (messages they sent, etc.)
--   SET NULL — for audit/actor columns where the record must survive
--              (financial records, dispute history, audit logs, etc.)
--
-- auth.users → profiles → agent_profiles/operator_profiles/customer_kyc
-- is already CASCADE. This migration fixes everything else.

-- ── 1. bookings.customer_id ────────────────────────────────────────────
-- Was RESTRICT (actively blocked deletion). Change to SET NULL so booking
-- history is preserved for the operator even after the customer is removed.
alter table public.bookings
  alter column customer_id drop not null;

alter table public.bookings
  drop constraint if exists bookings_customer_id_fkey;

alter table public.bookings
  add constraint bookings_customer_id_fkey
  foreign key (customer_id)
  references auth.users(id)
  on delete set null;

-- ── 2. booking_messages.sender_id ─────────────────────────────────────
-- Messages belong to the sender — delete them when the user is deleted.
alter table public.booking_messages
  drop constraint if exists booking_messages_sender_id_fkey;

alter table public.booking_messages
  add constraint booking_messages_sender_id_fkey
  foreign key (sender_id)
  references auth.users(id)
  on delete cascade;

-- ── 3. booking_ratings (rater_id, ratee_id) ───────────────────────────
-- Keep rating data for historical record; null out the user reference.
alter table public.booking_ratings
  alter column rater_id drop not null,
  alter column ratee_id drop not null;

alter table public.booking_ratings
  drop constraint if exists booking_ratings_rater_id_fkey,
  drop constraint if exists booking_ratings_ratee_id_fkey;

alter table public.booking_ratings
  add constraint booking_ratings_rater_id_fkey
  foreign key (rater_id) references auth.users(id) on delete set null,
  add constraint booking_ratings_ratee_id_fkey
  foreign key (ratee_id) references auth.users(id) on delete set null;

-- ── 4. audit_logs.actor_id ────────────────────────────────────────────
alter table public.audit_logs
  drop constraint if exists audit_logs_actor_id_fkey;

alter table public.audit_logs
  add constraint audit_logs_actor_id_fkey
  foreign key (actor_id) references auth.users(id) on delete set null;

-- ── 5. booking_status_history.changed_by ─────────────────────────────
alter table public.booking_status_history
  drop constraint if exists booking_status_history_changed_by_fkey;

alter table public.booking_status_history
  add constraint booking_status_history_changed_by_fkey
  foreign key (changed_by) references auth.users(id) on delete set null;

-- ── 6. cargo_release_authorizations.approved_by ──────────────────────
alter table public.cargo_release_authorizations
  drop constraint if exists cargo_release_authorizations_approved_by_fkey;

alter table public.cargo_release_authorizations
  add constraint cargo_release_authorizations_approved_by_fkey
  foreign key (approved_by) references auth.users(id) on delete set null;

-- ── 7. compliance_flags.user_id ───────────────────────────────────────
alter table public.compliance_flags
  drop constraint if exists compliance_flags_user_id_fkey;

alter table public.compliance_flags
  add constraint compliance_flags_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

-- ── 8. disputes.raised_by ─────────────────────────────────────────────
alter table public.disputes
  drop constraint if exists disputes_raised_by_fkey;

alter table public.disputes
  add constraint disputes_raised_by_fkey
  foreign key (raised_by) references auth.users(id) on delete set null;

-- ── 9. dispute_evidence.uploaded_by ──────────────────────────────────
-- Make nullable so evidence is preserved even if uploader account is removed.
alter table public.dispute_evidence
  alter column uploaded_by drop not null;

alter table public.dispute_evidence
  drop constraint if exists dispute_evidence_uploaded_by_fkey;

alter table public.dispute_evidence
  add constraint dispute_evidence_uploaded_by_fkey
  foreign key (uploaded_by) references auth.users(id) on delete set null;

-- ── 10. payments.payer_id ─────────────────────────────────────────────
-- Financial record — must survive user deletion.
alter table public.payments
  drop constraint if exists payments_payer_id_fkey;

alter table public.payments
  add constraint payments_payer_id_fkey
  foreign key (payer_id) references auth.users(id) on delete set null;

-- ── 11. payouts.operator_id (auth.users) ─────────────────────────────
-- Note: payouts also has operator_id → profiles which is separate.
-- The auth.users FK is the one that would block deletion.
alter table public.payouts
  drop constraint if exists payouts_operator_id_fkey;

alter table public.payouts
  add constraint payouts_operator_id_fkey
  foreign key (operator_id) references auth.users(id) on delete set null;

-- ── 12. platform_commission_config.updated_by ────────────────────────
alter table public.platform_commission_config
  drop constraint if exists platform_commission_config_updated_by_fkey;

alter table public.platform_commission_config
  add constraint platform_commission_config_updated_by_fkey
  foreign key (updated_by) references auth.users(id) on delete set null;

-- ── 13. shipment_milestones.created_by ───────────────────────────────
alter table public.shipment_milestones
  drop constraint if exists shipment_milestones_created_by_fkey;

alter table public.shipment_milestones
  add constraint shipment_milestones_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;

-- ── 14. support_tickets (assigned_to, requester_id) ──────────────────
alter table public.support_tickets
  drop constraint if exists support_tickets_assigned_to_fkey,
  drop constraint if exists support_tickets_requester_id_fkey;

alter table public.support_tickets
  add constraint support_tickets_assigned_to_fkey
  foreign key (assigned_to) references auth.users(id) on delete set null,
  add constraint support_tickets_requester_id_fkey
  foreign key (requester_id) references auth.users(id) on delete set null;

-- ── 15. Profiles-referencing FKs (SET NULL on actor columns) ─────────
alter table public.cargo_release_authorizations
  drop constraint if exists cargo_release_authorizations_authorized_by_fkey;
alter table public.cargo_release_authorizations
  add constraint cargo_release_authorizations_authorized_by_fkey
  foreign key (authorized_by) references public.profiles(id) on delete set null;

alter table public.compliance_flags
  drop constraint if exists compliance_flags_raised_by_fkey,
  drop constraint if exists compliance_flags_resolved_by_fkey;
alter table public.compliance_flags
  add constraint compliance_flags_raised_by_fkey
  foreign key (raised_by) references public.profiles(id) on delete set null,
  add constraint compliance_flags_resolved_by_fkey
  foreign key (resolved_by) references public.profiles(id) on delete set null;

alter table public.customs_events
  drop constraint if exists customs_events_recorded_by_fkey;
alter table public.customs_events
  add constraint customs_events_recorded_by_fkey
  foreign key (recorded_by) references public.profiles(id) on delete set null;

alter table public.disputes
  drop constraint if exists disputes_submitted_by_fkey,
  drop constraint if exists disputes_resolved_by_fkey;
alter table public.disputes
  add constraint disputes_submitted_by_fkey
  foreign key (submitted_by) references public.profiles(id) on delete set null,
  add constraint disputes_resolved_by_fkey
  foreign key (resolved_by) references public.profiles(id) on delete set null;

alter table public.insurance_claims
  drop constraint if exists insurance_claims_submitted_by_fkey;
alter table public.insurance_claims
  add constraint insurance_claims_submitted_by_fkey
  foreign key (submitted_by) references public.profiles(id) on delete set null;

alter table public.shipment_milestones
  drop constraint if exists shipment_milestones_recorded_by_fkey;
alter table public.shipment_milestones
  add constraint shipment_milestones_recorded_by_fkey
  foreign key (recorded_by) references public.profiles(id) on delete set null;

alter table public.support_tickets
  drop constraint if exists support_tickets_submitted_by_fkey;
alter table public.support_tickets
  add constraint support_tickets_submitted_by_fkey
  foreign key (submitted_by) references public.profiles(id) on delete set null;
