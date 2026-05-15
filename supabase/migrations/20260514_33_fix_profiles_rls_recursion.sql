-- Fix infinite recursion in profiles RLS policy.
--
-- Root cause: admins_all_profiles used an EXISTS subquery on profiles from within
-- a profiles policy — PostgreSQL detected this as infinite recursion and aborted,
-- returning null to the client. This made every admin check silently fail.
--
-- Fix: a SECURITY DEFINER function bypasses RLS when checking admin status,
-- so the profiles policy is no longer self-referential.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
      AND (is_admin = true OR role_type = 'admin')
  );
$$;

-- Fix the recursive policy (the root cause)
DROP POLICY IF EXISTS "admins_all_profiles" ON public.profiles;
CREATE POLICY "admins_all_profiles"
  ON public.profiles
  FOR SELECT
  USING (public.is_admin());

-- Update all other admin policies to use the helper function directly
-- (avoids multi-level subquery evaluation through profiles each time)

DROP POLICY IF EXISTS "admins_all_bookings" ON public.bookings;
CREATE POLICY "admins_all_bookings"
  ON public.bookings FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_all_containers" ON public.containers;
CREATE POLICY "admins_all_containers"
  ON public.containers FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_all_operator_profiles" ON public.operator_profiles;
CREATE POLICY "admins_all_operator_profiles"
  ON public.operator_profiles FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_all_payments" ON public.payments;
CREATE POLICY "admins_all_payments"
  ON public.payments FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_all_payouts" ON public.payouts;
CREATE POLICY "admins_all_payouts"
  ON public.payouts FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_all_disputes" ON public.disputes;
CREATE POLICY "admins_all_disputes"
  ON public.disputes FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_all_dispute_evidence" ON public.dispute_evidence;
CREATE POLICY "admins_all_dispute_evidence"
  ON public.dispute_evidence FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_all_claims" ON public.insurance_claims;
CREATE POLICY "admins_all_claims"
  ON public.insurance_claims FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_all_milestones" ON public.shipment_milestones;
CREATE POLICY "admins_all_milestones"
  ON public.shipment_milestones FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_all_customs_events" ON public.customs_events;
CREATE POLICY "admins_all_customs_events"
  ON public.customs_events FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_all_compliance_flags" ON public.compliance_flags;
CREATE POLICY "admins_all_compliance_flags"
  ON public.compliance_flags FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_all_release" ON public.cargo_release_authorizations;
CREATE POLICY "admins_all_release"
  ON public.cargo_release_authorizations FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admins_view_audit_logs" ON public.audit_logs;
CREATE POLICY "admins_view_audit_logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "admins_all_tickets" ON public.support_tickets;
CREATE POLICY "admins_all_tickets"
  ON public.support_tickets FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "commission_config_admin_all" ON public.platform_commission_config;
CREATE POLICY "commission_config_admin_all"
  ON public.platform_commission_config FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins full access compliance docs" ON public.compliance_documents;
CREATE POLICY "Admins full access compliance docs"
  ON public.compliance_documents FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
