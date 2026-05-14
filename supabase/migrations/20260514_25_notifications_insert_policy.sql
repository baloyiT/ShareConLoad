-- Allow any authenticated user to insert notifications for any recipient.
-- Notifications are always inserted by authenticated actors (operators, admins,
-- the system) on behalf of other users. SELECT and UPDATE remain recipient-scoped.

drop policy if exists "authenticated_insert_notifications" on public.notifications;
create policy "authenticated_insert_notifications" on public.notifications
  for insert with check (auth.role() = 'authenticated');
