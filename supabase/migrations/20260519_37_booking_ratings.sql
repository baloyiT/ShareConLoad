-- supabase/migrations/20260519_37_booking_ratings.sql

-- 1. Add delivered_at to bookings — set automatically when status changes to 'delivered'
alter table public.bookings add column if not exists delivered_at timestamptz;

create or replace function set_booking_delivered_at()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  if new.status = 'delivered' and (old.status is null or old.status <> 'delivered') then
    new.delivered_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_booking_delivered_at on public.bookings;
create trigger trg_booking_delivered_at
  before update on public.bookings
  for each row execute function set_booking_delivered_at();

-- 2. Ratings table
create table if not exists public.booking_ratings (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references public.bookings(id) on delete cascade,
  rater_id     uuid not null references auth.users(id),
  ratee_id     uuid not null references auth.users(id),
  stars        int  not null check (stars between 1 and 5),
  comment      text check (comment is null or char_length(comment) <= 1000),
  submitted_at timestamptz not null default now(),
  revealed_at  timestamptz,
  unique (booking_id, rater_id)
);

alter table public.booking_ratings enable row level security;

-- 3. Reveal trigger — set revealed_at on both rows when both parties have rated
create or replace function maybe_reveal_ratings()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.booking_ratings
  where booking_id = new.booking_id;

  if v_count >= 2 then
    update public.booking_ratings
    set revealed_at = now()
    where booking_id = new.booking_id
      and revealed_at is null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reveal_ratings on public.booking_ratings;
create trigger trg_reveal_ratings
  after insert on public.booking_ratings
  for each row execute function maybe_reveal_ratings();

-- 4. View: public operator rating summary (revealed ratings only)
--    14-day window applied on read: rating is visible if revealed_at IS NOT NULL
--    OR booking.delivered_at < now() - 14 days
create or replace view public.operator_rating_summary as
select
  r.ratee_id                      as user_id,
  round(avg(r.stars)::numeric, 1) as average_stars,
  count(*)::int                   as review_count
from public.booking_ratings r
join public.bookings b on b.id = r.booking_id
where r.revealed_at is not null
   or b.delivered_at < now() - interval '14 days'
group by r.ratee_id;

-- 5. RLS policies
-- Note: operator_id lives on containers, not bookings — join via container_id
drop policy if exists "rating_insert" on public.booking_ratings;
create policy "rating_insert" on public.booking_ratings
  for insert with check (
    auth.uid() = rater_id
    and exists (
      select 1 from public.bookings bk
      join public.containers c on c.id = bk.container_id
      where bk.id = booking_id
        and bk.status = 'delivered'
        and (bk.customer_id = auth.uid() or c.operator_id = auth.uid())
    )
  );

drop policy if exists "rating_select" on public.booking_ratings;
create policy "rating_select" on public.booking_ratings
  for select using (
    rater_id = auth.uid()
    or is_admin()
    or (
      revealed_at is not null
      or exists (
        select 1 from public.bookings b2
        where b2.id = booking_id
          and b2.delivered_at < now() - interval '14 days'
      )
    )
  );
