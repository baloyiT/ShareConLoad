-- supabase/migrations/20260519_38_booking_messages.sql

-- 1. Messages table
create table if not exists public.booking_messages (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  sender_id   uuid not null references auth.users(id),
  content     text not null check (char_length(content) between 1 and 2000),
  created_at  timestamptz not null default now()
);

alter table public.booking_messages enable row level security;

-- 2. Content filter — raises exception if message contains contact details
create or replace function check_message_content()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if new.content ~* '[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}' then
    raise exception 'Contact details are not allowed in messages.';
  end if;
  if new.content ~* '(https?://|www\.)\S+' then
    raise exception 'Contact details are not allowed in messages.';
  end if;
  if new.content ~* '(\+27|0)[6-8][0-9][\s\-]?\d{3}[\s\-]?\d{4}' then
    raise exception 'Contact details are not allowed in messages.';
  end if;
  if new.content ~* '\+\d{1,3}[\s\-]?\d{6,14}' then
    raise exception 'Contact details are not allowed in messages.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_message_content on public.booking_messages;
create trigger enforce_message_content
  before insert on public.booking_messages
  for each row execute function check_message_content();

-- 3. RLS policies
-- Note: operator_id lives on containers, not bookings — join via container_id
drop policy if exists "messages_select" on public.booking_messages;
create policy "messages_select" on public.booking_messages
  for select using (
    is_admin()
    or exists (
      select 1 from public.bookings bk
      join public.containers c on c.id = bk.container_id
      where bk.id = booking_id
        and (bk.customer_id = auth.uid() or c.operator_id = auth.uid())
    )
  );

drop policy if exists "messages_insert" on public.booking_messages;
create policy "messages_insert" on public.booking_messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.bookings bk
      join public.containers c on c.id = bk.container_id
      where bk.id = booking_id
        and (bk.customer_id = auth.uid() or c.operator_id = auth.uid())
    )
  );
