-- Align all admin RLS policies to use (is_admin = true OR role_type = 'admin').
-- Previously many policies only checked role_type = 'admin', excluding admins
-- whose profile has is_admin = true but role_type not yet set to 'admin'.

-- audit_logs
drop policy if exists "admins_view_audit_logs" on public.audit_logs;
create policy "admins_view_audit_logs" on public.audit_logs
  for select using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid()
        and (is_admin = true or role_type = 'admin')
    )
  );

-- cargo_release_authorizations
drop policy if exists "admins_all_release" on public.cargo_release_authorizations;
create policy "admins_all_release" on public.cargo_release_authorizations
  for all using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid()
        and (is_admin = true or role_type = 'admin')
    )
  );

-- compliance_flags
drop policy if exists "admins_all_compliance_flags" on public.compliance_flags;
create policy "admins_all_compliance_flags" on public.compliance_flags
  for all using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid()
        and (is_admin = true or role_type = 'admin')
    )
  );

-- customs_events
drop policy if exists "admins_all_customs_events" on public.customs_events;
create policy "admins_all_customs_events" on public.customs_events
  for all using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid()
        and (is_admin = true or role_type = 'admin')
    )
  );

-- dispute_evidence (admin-only policy)
drop policy if exists "admins_all_dispute_evidence" on public.dispute_evidence;
create policy "admins_all_dispute_evidence" on public.dispute_evidence
  for all using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid()
        and (is_admin = true or role_type = 'admin')
    )
  );

-- dispute_evidence (combined customer + admin view policy)
drop policy if exists "dispute_parties_view_evidence" on public.dispute_evidence;
create policy "dispute_parties_view_evidence" on public.dispute_evidence
  for select using (
    dispute_id in (
      select id from public.disputes
      where submitted_by = (
        select id from public.profiles where user_id = auth.uid()
      )
    )
    or exists (
      select 1 from public.profiles
      where user_id = auth.uid()
        and (is_admin = true or role_type = 'admin')
    )
  );

-- disputes
drop policy if exists "admins_all_disputes" on public.disputes;
create policy "admins_all_disputes" on public.disputes
  for all using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid()
        and (is_admin = true or role_type = 'admin')
    )
  );

-- insurance_claims
drop policy if exists "admins_all_claims" on public.insurance_claims;
create policy "admins_all_claims" on public.insurance_claims
  for all using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid()
        and (is_admin = true or role_type = 'admin')
    )
  );

-- payments
drop policy if exists "admins_all_payments" on public.payments;
create policy "admins_all_payments" on public.payments
  for all using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid()
        and (is_admin = true or role_type = 'admin')
    )
  );

-- payouts
drop policy if exists "admins_all_payouts" on public.payouts;
create policy "admins_all_payouts" on public.payouts
  for all using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid()
        and (is_admin = true or role_type = 'admin')
    )
  );

-- shipment_milestones
drop policy if exists "admins_all_milestones" on public.shipment_milestones;
create policy "admins_all_milestones" on public.shipment_milestones
  for all using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid()
        and (is_admin = true or role_type = 'admin')
    )
  );

-- support_tickets
drop policy if exists "admins_all_tickets" on public.support_tickets;
create policy "admins_all_tickets" on public.support_tickets
  for all using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid()
        and (is_admin = true or role_type = 'admin')
    )
  );
