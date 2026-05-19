# Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-booking message threads between customers and operators, with client-side and server-side enforcement blocking contact details (phone numbers, emails, URLs).

**Architecture:** A `booking_messages` table scoped to `booking_id`. A PostgreSQL `BEFORE INSERT` trigger is the authoritative content filter gate. A client-side `containsContactInfo()` utility provides the immediate "warn and block" UX before a round trip. A `MessageThread` component handles the chat UI and is embedded on the customer booking track page, operator bookings page, and admin bookings page (read-only).

**Tech Stack:** Next.js 16, TypeScript, Supabase (PostgreSQL), Tailwind CSS, DaisyUI

---

## File Map

| Action | File |
|---|---|
| Create | `supabase/migrations/20260519_38_booking_messages.sql` |
| Modify | `services/notificationService.ts` — add `message.new` event |
| Create | `services/messageFilter.ts` |
| Create | `components/MessageThread.tsx` |
| Modify | `app/booking/track/[id]/page.tsx` — add Messages section |
| Modify | `app/operator/bookings/page.tsx` — add Messages modal per booking |
| Modify | `app/admin/bookings/page.tsx` — add read-only message view per booking |

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260519_38_booking_messages.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260519_38_booking_messages.sql` with this exact content:

```sql
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
```

- [ ] **Step 2: Apply migration in Supabase**

Supabase dashboard → SQL Editor → paste the file contents → Run.

Verify:
- `booking_messages` table appears in Table Editor
- `check_message_content` function appears under Database → Functions
- `enforce_message_content` trigger appears on the `booking_messages` table

- [ ] **Step 3: Test the content filter via SQL**

In the Supabase SQL Editor, test that the trigger blocks contact info. Pick a real `booking_id` and `sender_id` from your data for these tests:

```sql
-- Should fail with "Contact details are not allowed in messages."
insert into public.booking_messages (booking_id, sender_id, content)
values ('<booking_id>', '<sender_id>', 'Call me at john@example.com');

-- Should fail
insert into public.booking_messages (booking_id, sender_id, content)
values ('<booking_id>', '<sender_id>', 'Visit www.mysite.com for details');

-- Should succeed
insert into public.booking_messages (booking_id, sender_id, content)
values ('<booking_id>', '<sender_id>', 'Your cargo has been confirmed for loading.');
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260519_38_booking_messages.sql
git commit -m "feat: add booking_messages table with contact-info filter trigger and RLS"
```

---

### Task 2: Add message.new notification event

**Files:**
- Modify: `services/notificationService.ts`

- [ ] **Step 1: Add event type to NotificationEventMap**

In `services/notificationService.ts`, add `'message.new'` to the `NotificationEventMap` type. Add it after the last existing event entry (before the closing `}`):

```ts
'message.new': {
  bookingId:   string;
  recipientId: string;
  bookingRef:  string;
};
```

- [ ] **Step 2: Add message builder case**

In the `buildMessage` function, add a case before the `default:` line:

```ts
case 'message.new': {
  const p = payload as NotificationEventMap['message.new'];
  return {
    title: 'New Message',
    body:  `You have a new message on booking ${p.bookingRef}.`,
  };
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add services/notificationService.ts
git commit -m "feat: add message.new notification event"
```

---

### Task 3: Client-side message filter utility

**Files:**
- Create: `services/messageFilter.ts`

- [ ] **Step 1: Create the utility**

Create `services/messageFilter.ts`:

```ts
const CONTACT_PATTERNS: RegExp[] = [
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/,
  /(https?:\/\/|www\.)\S+/,
  /(\+27|0)[6-8][0-9][\s\-]?\d{3}[\s\-]?\d{4}/,
  /\+\d{1,3}[\s\-]?\d{6,14}/,
];

export function containsContactInfo(text: string): boolean {
  return CONTACT_PATTERNS.some(pattern => pattern.test(text));
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add services/messageFilter.ts
git commit -m "feat: add client-side message content filter utility"
```

---

### Task 4: MessageThread component

**Files:**
- Create: `components/MessageThread.tsx`

- [ ] **Step 1: Create the component**

Create `components/MessageThread.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/services/supabaseClient';
import { containsContactInfo } from '@/services/messageFilter';
import { notify } from '@/services/notificationService';

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type Props = {
  bookingId: string;
  bookingRef: string;
  currentUserId: string;
  recipientId: string;
  readOnly?: boolean;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function MessageThread({
  bookingId,
  bookingRef,
  currentUserId,
  recipientId,
  readOnly = false,
}: Props) {
  const [messages, setMessages]     = useState<Message[]>([]);
  const [draft, setDraft]           = useState('');
  const [sending, setSending]       = useState(false);
  const [filterWarn, setFilterWarn] = useState(false);
  const [sendError, setSendError]   = useState<string | null>(null);
  const bottomRef                   = useRef<HTMLDivElement>(null);

  useEffect(() => { loadMessages(); }, [bookingId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadMessages() {
    const { data, error } = await supabase
      .from('booking_messages')
      .select('id, sender_id, content, created_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });

    if (error) { console.error('[MessageThread] load failed:', error.message); return; }
    setMessages(data ?? []);
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    setFilterWarn(containsContactInfo(value));
    setSendError(null);
  }

  async function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || filterWarn) return;

    setSending(true);
    setSendError(null);

    const { error } = await supabase.from('booking_messages').insert({
      booking_id: bookingId,
      sender_id:  currentUserId,
      content:    trimmed,
    });

    if (error) {
      setSendError(
        error.message.includes('Contact details')
          ? 'Contact details (phone numbers, emails, or links) are not allowed in messages.'
          : 'Failed to send. Please try again.'
      );
      setSending(false);
      return;
    }

    await notify('message.new', {
      bookingId,
      recipientId,
      bookingRef,
    });

    setDraft('');
    setSending(false);
    await loadMessages();
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '360px', border: '1px solid #e5e7eb',
      borderRadius: '8px', overflow: 'hidden',
    }}>
      {/* Message list */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px',
        background: '#f9fafb', display: 'flex',
        flexDirection: 'column', gap: '8px',
      }}>
        {messages.length === 0 && (
          <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', marginTop: '40px' }}>
            No messages yet.
          </p>
        )}
        {messages.map(msg => {
          const isMine = msg.sender_id === currentUserId;
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
              <div style={{
                background: isMine ? '#3b82f6' : 'white',
                color: isMine ? 'white' : '#111827',
                border: isMine ? 'none' : '1px solid #e5e7eb',
                borderRadius: isMine ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                padding: '8px 12px',
                maxWidth: '70%',
              }}>
                <p style={{ fontSize: '11px', opacity: 0.7, marginBottom: '3px', margin: 0 }}>
                  {fmt(msg.created_at)}
                </p>
                <p style={{ fontSize: '13px', margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {!readOnly && (
        <div style={{ borderTop: '1px solid #e5e7eb', padding: '10px', background: 'white' }}>
          {filterWarn && (
            <p style={{ fontSize: '12px', color: '#dc2626', marginBottom: '6px', margin: '0 0 6px' }}>
              Contact details (phone numbers, emails, or links) are not allowed in messages.
            </p>
          )}
          {sendError && (
            <p style={{ fontSize: '12px', color: '#dc2626', margin: '0 0 6px' }}>{sendError}</p>
          )}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <textarea
              className="textarea textarea-bordered"
              style={{ flex: 1, fontSize: '13px', minHeight: '40px', maxHeight: '100px', resize: 'vertical' }}
              placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
              value={draft}
              maxLength={2000}
              onChange={e => handleDraftChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
            />
            <button
              className="btn btn-sm"
              style={{ background: '#3b82f6', color: 'white', border: 'none' }}
              disabled={sending || !draft.trim() || filterWarn}
              onClick={handleSend}
            >
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/MessageThread.tsx
git commit -m "feat: add MessageThread component with send, receive, and contact-info filtering"
```

---

### Task 5: Customer booking track page — messages section

**Files:**
- Modify: `app/booking/track/[id]/page.tsx`

- [ ] **Step 1: Add `operator_id` to the BookingContainer type**

In `app/booking/track/[id]/page.tsx`, update `BookingContainer`:

```tsx
type BookingContainer = {
  origin_city: string;
  origin_country: string;
  destination_city: string;
  destination_country: string;
  departure_date: string;
  price_per_cbm: number;
  operator_id: string;    // ← add this
};
```

- [ ] **Step 2: Add `operator_id` to the Supabase select**

Find the `.from('bookings').select(...)` call and add `operator_id` to the containers fields:

```tsx
const { data, error } = await supabase
  .from('bookings')
  .select(`
    id, container_id, customer_id, total_cbm, total_price, status, created_at,
    containers (
      origin_city, origin_country, destination_city, destination_country,
      departure_date, price_per_cbm, operator_id
    )
  `)
  .eq('id', id)
  .single();
```

- [ ] **Step 3: Add currentUserId state**

```tsx
const [currentUserId, setCurrentUserId] = useState<string | null>(null);
```

In the data-loading useEffect, add:

```tsx
const { data: { user } } = await supabase.auth.getUser();
if (user) setCurrentUserId(user.id);
```

- [ ] **Step 4: Add import**

```tsx
import MessageThread from '@/components/MessageThread';
```

- [ ] **Step 5: Render Messages section**

In the page JSX, add below the milestones timeline (or at the end of the main content area):

```tsx
{booking && currentUserId && booking.containers?.operator_id && (
  <div style={{ marginTop: '32px' }}>
    <h3 style={{ fontWeight: 700, fontSize: '16px', marginBottom: '12px', color: '#111827' }}>
      Messages
    </h3>
    <MessageThread
      bookingId={booking.id}
      bookingRef={booking.id.slice(0, 8).toUpperCase()}
      currentUserId={currentUserId}
      recipientId={booking.containers.operator_id}
    />
  </div>
)}
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Manual verification**

Run `npm run dev`. Sign in as a customer. Navigate to a booking track page (`/booking/track/<id>`). Scroll to the bottom — you should see a "Messages" heading and the chat thread. Type `test@example.com` — warning appears, Send is disabled. Type a normal message and press Enter — it appears in the thread.

- [ ] **Step 8: Commit**

```bash
git add "app/booking/track/[id]/page.tsx"
git commit -m "feat: add messages section to customer booking track page"
```

---

### Task 6: Operator bookings page — messages modal

**Files:**
- Modify: `app/operator/bookings/page.tsx`

- [ ] **Step 1: Add state for open message thread**

```tsx
const [messageBooking, setMessageBooking]   = useState<OperatorBooking | null>(null);
const [currentUserId, setCurrentUserId]     = useState<string | null>(null);
```

- [ ] **Step 2: Load currentUserId**

In the data-loading useEffect, alongside the existing auth check, capture the user ID:

```tsx
const { data: { user } } = await supabase.auth.getUser();
if (user) setCurrentUserId(user.id);
```

- [ ] **Step 3: Add import**

```tsx
import MessageThread from '@/components/MessageThread';
```

- [ ] **Step 4: Add "Messages" button to each booking row/card**

Find the action buttons on each booking (near the milestone and status update buttons). Add:

```tsx
<button
  className="btn btn-xs btn-outline"
  onClick={() => setMessageBooking(booking)}
>
  💬 Messages
</button>
```

- [ ] **Step 5: Render the messages modal**

At the bottom of the component JSX:

```tsx
{messageBooking && currentUserId && (
  <div className="modal modal-open">
    <div className="modal-box max-w-lg">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 className="font-bold text-base">
          Messages — {messageBooking.id.slice(0, 8).toUpperCase()}
        </h3>
        <button className="btn btn-ghost btn-xs" onClick={() => setMessageBooking(null)}>✕</button>
      </div>
      <MessageThread
        bookingId={messageBooking.id}
        bookingRef={messageBooking.id.slice(0, 8).toUpperCase()}
        currentUserId={currentUserId}
        recipientId={messageBooking.customer_id}
      />
    </div>
    <label className="modal-backdrop" onClick={() => setMessageBooking(null)} />
  </div>
)}
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Manual verification**

Run `npm run dev`. Sign in as an operator. On the operator bookings page, click "💬 Messages" on any booking. Modal opens with the thread. Send a message — it appears. Type a phone number pattern like `+27831234567` — warning appears and Send is disabled.

- [ ] **Step 8: Commit**

```bash
git add app/operator/bookings/page.tsx
git commit -m "feat: add per-booking messages modal to operator bookings page"
```

---

### Task 7: Admin bookings page — read-only message view

**Files:**
- Modify: `app/admin/bookings/page.tsx`

- [ ] **Step 1: Add state for selected booking**

```tsx
const [messageBookingId, setMessageBookingId] = useState<string | null>(null);
```

- [ ] **Step 2: Add import**

```tsx
import MessageThread from '@/components/MessageThread';
```

- [ ] **Step 3: Add "View Messages" button per booking**

Find the action area for each booking row/card and add:

```tsx
<button
  className="btn btn-xs btn-ghost"
  onClick={() => setMessageBookingId(booking.id)}
>
  💬 Messages
</button>
```

- [ ] **Step 4: Render read-only message modal**

At the bottom of the component JSX:

```tsx
{messageBookingId && (
  <div className="modal modal-open">
    <div className="modal-box max-w-lg">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 className="font-bold text-base">
          Messages — {messageBookingId.slice(0, 8).toUpperCase()}
        </h3>
        <button className="btn btn-ghost btn-xs" onClick={() => setMessageBookingId(null)}>✕</button>
      </div>
      <MessageThread
        bookingId={messageBookingId}
        bookingRef={messageBookingId.slice(0, 8).toUpperCase()}
        currentUserId=""
        recipientId=""
        readOnly
      />
    </div>
    <label className="modal-backdrop" onClick={() => setMessageBookingId(null)} />
  </div>
)}
```

Note: `currentUserId=""` means no messages are styled as "mine" — all messages appear on the left. This is correct for a read-only admin view where the admin is observing both sides.

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Manual verification**

Run `npm run dev`. Sign in as admin. Go to `/admin/bookings`. Click "💬 Messages" on a booking that has messages. The modal opens showing all messages in read-only mode (no input field).

- [ ] **Step 7: Commit**

```bash
git add app/admin/bookings/page.tsx
git commit -m "feat: add read-only message thread view to admin bookings page"
```
