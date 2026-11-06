-- Nobody could file a support ticket: requester_id and category were NOT NULL with no
-- default, and the page sends neither on 04f2c62 or this branch, so every insert failed
-- with 23502. Defaults fix both refs with no page change.

-- NOT NULL also contradicted the column's on delete set null, as with disputes.raised_by.
alter table public.support_tickets
  alter column requester_id drop not null,
  alter column requester_id set default auth.uid();

alter table public.support_tickets
  alter column category set default 'general';

-- A customer files as themselves, in the first status, on their own booking if any.
-- Defaults are applied before this check, so the pages still pass.
drop policy if exists "customers_insert_tickets" on public.support_tickets;
create policy "customers_insert_tickets" on public.support_tickets
  for insert with check (
    submitted_by in (select id from public.profiles where user_id = (select auth.uid()))
    and requester_id = (select auth.uid())
    and status = 'open'
    and (
      booking_id is null
      or booking_id in (select id from public.bookings where customer_id = (select auth.uid()))
    )
  );
