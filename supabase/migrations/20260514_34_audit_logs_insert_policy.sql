-- Allow admins to insert audit log entries.
-- audit_logs previously had only a SELECT policy, so logAudit() calls from
-- admin pages were blocked by RLS on every insert.

DROP POLICY IF EXISTS "admins_insert_audit_logs" ON public.audit_logs;
CREATE POLICY "admins_insert_audit_logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (public.is_admin());
