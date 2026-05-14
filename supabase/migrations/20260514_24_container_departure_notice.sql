-- Tracks when the operator sends the 7-day departure notice to customers.
-- Null = notice not yet sent. Non-null = notice sent; Stage 2 payments unlock.

alter table public.containers
  add column if not exists departure_notice_sent_at timestamptz default null;

-- Allow operators to update their own containers (needed for setting this column).
drop policy if exists "operators_update_own_containers" on public.containers;
create policy "operators_update_own_containers" on public.containers
  for update using (operator_id = auth.uid())
  with check (operator_id = auth.uid());
