# Ratings & Messaging Design

**Date:** 2026-05-19
**Status:** Approved

---

## Overview

Two features that enable trust and communication between customers/shippers and operators on the ShareConLoad platform:

1. **Mutual ratings** — blind, post-delivery, 1–5 star ratings with optional comments. Publicly visible.
2. **Per-booking messaging** — in-app chat thread scoped to a booking, with server-enforced content filtering that blocks contact details.

Both features build on existing infrastructure: the `notifications` table, `is_admin()` RLS function, and booking status lifecycle.

---

## Feature 1: Ratings

### Rules

- A rating becomes available only after a booking reaches `delivered` status.
- Both parties (customer and operator) can each submit one rating per booking.
- **Blind mutual reveal:** a rating is hidden until both parties have submitted, or 14 days after `delivered_at` — whichever comes first.
- Once revealed, ratings are permanent and cannot be edited or deleted.
- Revealed ratings are publicly visible: operator averages appear on container listings and detail pages; customer averages are visible to operators on their bookings list.

### Schema

```sql
-- supabase/migrations/20260519_37_booking_ratings.sql

-- Add delivered_at to bookings (set by trigger when status → delivered)
alter table public.bookings add column if not exists delivered_at timestamptz;

create or replace function set_booking_delivered_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'delivered' and old.status <> 'delivered' then
    new.delivered_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_booking_delivered_at on public.bookings;
create trigger trg_booking_delivered_at
  before update on public.bookings
  for each row execute function set_booking_delivered_at();

create table if not exists public.booking_ratings (
  id             uuid primary key default gen_random_uuid(),
  booking_id     uuid not null references public.bookings(id) on delete cascade,
  rater_id       uuid not null references auth.users(id),
  ratee_id       uuid not null references auth.users(id),
  stars          int  not null check (stars between 1 and 5),
  comment        text check (char_length(comment) <= 1000),
  submitted_at   timestamptz not null default now(),
  revealed_at    timestamptz,
  unique (booking_id, rater_id)
);
```

**Reveal trigger:** after each insert, an `AFTER INSERT` trigger calls `maybe_reveal_ratings(booking_id)`. The function checks whether two ratings now exist for the booking; if so, it sets `revealed_at = now()` on both rows.

**14-day deadline (on read):** a rating is treated as revealed if:
```sql
revealed_at IS NOT NULL
OR booking.delivered_at < now() - interval '14 days'
```
`delivered_at` is set by a `BEFORE UPDATE` trigger on `bookings` when status transitions to `delivered`. No cron job required — queries join against this condition.

**Operator rating summary view:**
```sql
create or replace view operator_rating_summary as
select
  r.ratee_id as user_id,
  round(avg(r.stars)::numeric, 1) as average_stars,
  count(*) as review_count
from public.booking_ratings r
join public.bookings b on b.id = r.booking_id
where r.revealed_at is not null
   or b.delivered_at < now() - interval '14 days'
group by r.ratee_id;
```

### RLS Policies

```sql
-- INSERT: customer or operator on the booking, booking must be delivered
-- Note: operator_id lives on containers, not bookings — join via container_id
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

-- SELECT: rater always sees their own submission; ratee sees only after reveal;
--         public sees revealed ratings; admin sees all
create policy "rating_select" on public.booking_ratings
  for select using (
    rater_id = auth.uid()
    or is_admin()
    or (
      revealed_at is not null
      or exists (
        select 1 from public.bookings b
        where b.id = booking_id
          and b.delivered_at < now() - interval '14 days'
      )
    )
  );
```

### UI Changes

**`app/bookings/page.tsx` (customer)**
- After a booking reaches `delivered`, show `<RatingBanner>` inline on the booking card — an amber strip with "How was your shipment with [Operator]?" and a "Rate now" button.
- Banner disappears once the customer has submitted their rating.

**`app/operator/bookings/page.tsx` (operator)**
- Same `<RatingBanner>` — "Rate this customer" prompt on delivered bookings.

**`app/page.tsx` and `app/container/[id]/page.tsx`**
- `<StarDisplay>` shows operator average stars and review count, sourced from `operator_rating_summary` view.

### New Components

| Component | Purpose |
|---|---|
| `components/RatingBanner.tsx` | Amber inline prompt on a delivered booking card |
| `components/RatingModal.tsx` | Star picker (1–5), optional comment field, submit button |
| `components/StarDisplay.tsx` | Read-only star display with average + count |

---

## Feature 2: Per-Booking Messaging

### Rules

- Every booking has one message thread. Messages are scoped to `booking_id`.
- Either party (customer or operator on the booking) can send and read messages at any time after booking is created.
- **Contact details are blocked:** phone numbers, email addresses, and URLs may not appear in message content. The client warns immediately; the server enforces as the authoritative gate.
- Admins can read all message threads (for dispute resolution and moderation).
- New messages trigger a notification for the recipient via the existing `notifications` table.

### Schema

```sql
-- supabase/migrations/20260519_38_booking_messages.sql

create table if not exists public.booking_messages (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  sender_id   uuid not null references auth.users(id),
  content     text not null check (char_length(content) between 1 and 2000),
  created_at  timestamptz not null default now()
);
```

**Content filtering function + trigger:**
```sql
create or replace function check_message_content()
returns trigger language plpgsql as $$
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

create trigger enforce_message_content
  before insert on public.booking_messages
  for each row execute function check_message_content();
```

**Client-side utility (`services/messageFilter.ts`):**
```ts
const CONTACT_PATTERNS = [
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,
  /(https?:\/\/|www\.)\S+/,
  /(\+27|0)[6-8][0-9][\s\-]?\d{3}[\s\-]?\d{4}/,
  /\+\d{1,3}[\s\-]?\d{6,14}/,
];

export function containsContactInfo(text: string): boolean {
  return CONTACT_PATTERNS.some(p => p.test(text));
}
```

If `containsContactInfo` returns true, the send button is disabled and the user sees:
> *"Contact details (phone numbers, emails, or links) are not allowed in messages."*

### RLS Policies

```sql
-- SELECT: parties on the booking + admin
-- Note: operator_id lives on containers, not bookings — join via container_id
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

-- INSERT: sender must be a party on the booking
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
```

### UI Changes

**`app/bookings/[id]/page.tsx`** (new booking detail page, or extend existing booking track page)
- Add a "Messages" tab alongside tracking/milestones.
- Renders `<MessageThread bookingId={id} />`.

**`app/operator/bookings/page.tsx`**
- Each booking row gets a "Messages" link/button that opens the thread.

**`app/admin/bookings/page.tsx`**
- Read-only `<MessageThread>` visible per booking for admin review.

### New Components

| Component | Purpose |
|---|---|
| `components/MessageThread.tsx` | Full chat thread: scrollable history + input + client-side filter |

### Notifications

On each successful message insert, write to `notifications`:
```ts
await notificationService.create({
  user_id: recipientId,
  type: 'new_message',
  title: 'New message',
  body: `You have a new message on booking ${bookingRef}`,
  link: `/bookings/${bookingId}`,
});
```

---

## Migration Files

| File | Purpose |
|---|---|
| `supabase/migrations/20260519_37_booking_ratings.sql` | Ratings table, reveal trigger, summary view, RLS |
| `supabase/migrations/20260519_38_booking_messages.sql` | Messages table, content filter trigger, RLS |

---

## Out of Scope

- Real-time message delivery (WebSocket / Supabase Realtime) — polling on focus is sufficient for MVP
- Message read receipts
- Message deletion or editing
- Rating appeals or admin overrides
- Multi-media attachments in messages
