# Aligned Payment Stages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate Stage 2 (50%) behind an operator departure notice on the container, and gate Stage 3 (30%) behind an operator "Arrived at Destination" milestone, so customers are never asked to pay before the triggering event occurs.

**Architecture:** Add `departure_notice_sent_at` to the `containers` table. The operator dashboard gets a "Send Departure Notice" action per container (container-level, not per booking) that sets this column and notifies all confirmed customers. The payment page fetches this column + booking milestones, and `isPayable()` enforces the gates. `PaymentStageCard` gets a `lockReason` prop so the UI tells customers exactly why a stage is locked rather than a generic message.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (PostgreSQL + client), Tailwind CSS, DaisyUI. All data fetching is client-side via the Supabase JS client.

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/20260514_24_container_departure_notice.sql` | Create — add `departure_notice_sent_at` column + INSERT policy for operators |
| `services/notificationService.ts` | Modify — add `container.departure_notice` event type, fix ZAR in `payment.due` |
| `app/operator/page.tsx` | Modify — add `departure_notice_sent_at` to Container type, fetch it, add "Send Departure Notice" button |
| `app/payments/[bookingId]/page.tsx` | Modify — fetch departure notice + milestones, update `isPayable()`, add `getLockReason()` |
| `components/PaymentStageCard.tsx` | Modify — add `lockReason?: string` prop, render meaningful locked message |

---

## Task 1: Migration — Add `departure_notice_sent_at` to containers

**Files:**
- Create: `supabase/migrations/20260514_24_container_departure_notice.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260514_24_container_departure_notice.sql
-- Tracks when the operator sends the 7-day departure notice to customers.
-- Null = notice not yet sent. Non-null = notice sent, Stage 2 payments unlock.

alter table public.containers
  add column if not exists departure_notice_sent_at timestamptz default null;

-- Allow operators to update their own containers (needed for setting this column).
drop policy if exists "operators_update_own_containers" on public.containers;
create policy "operators_update_own_containers" on public.containers
  for update using (operator_id = auth.uid())
  with check (operator_id = auth.uid());
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use `mcp__plugin_supabase_supabase__apply_migration` with:
- `project_id`: `fkhfbifgvebygafsewot`
- `name`: `20260514_24_container_departure_notice`
- `query`: contents of the file above

- [ ] **Step 3: Verify column exists**

Run via `execute_sql`:
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'containers'
  and column_name = 'departure_notice_sent_at';
```
Expected: one row returned.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260514_24_container_departure_notice.sql
git commit -m "feat: add departure_notice_sent_at to containers for Stage 2 payment gate"
```

---

## Task 2: Notification service — add departure notice event + fix ZAR

**Files:**
- Modify: `services/notificationService.ts`

- [ ] **Step 1: Add `container.departure_notice` to the event map**

In `services/notificationService.ts`, add this entry to `NotificationEventMap` (after the `payment.confirmed` entry):

```typescript
  'container.departure_notice': {
    bookingId:     string;
    recipientId:   string;
    route:         string;
    departureDate: string;
  };
```

- [ ] **Step 2: Add the message builder case**

In `buildMessage()`, add this case before the `default:` case:

```typescript
    case 'container.departure_notice': {
      const p = payload as NotificationEventMap['container.departure_notice'];
      return {
        title: 'Departure in 7 Days — Payment Due',
        body:  `Your container on ${p.route} departs on ${new Date(p.departureDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}. Please complete your 50% pre-departure payment to ensure your cargo is loaded.`,
      };
    }
```

- [ ] **Step 3: Fix ZAR in `payment.due` message**

Find this line in `buildMessage()` (inside the `payment.due` case):
```typescript
        body:  `Your ${stageLabel[p.stage] ?? p.stage} payment of $${p.amount.toFixed(2)} is due by ${new Date(p.dueDate).toLocaleDateString('en-GB')}.`,
```

Replace with:
```typescript
        body:  `Your ${stageLabel[p.stage] ?? p.stage} payment of R${p.amount.toFixed(2)} is due by ${new Date(p.dueDate).toLocaleDateString('en-GB')}.`,
```

- [ ] **Step 4: Fix ZAR in `payment.confirmed` message**

Find this line (inside the `payment.confirmed` case):
```typescript
        body:  `Your payment of $${p.amount.toFixed(2)} has been confirmed for booking ${p.bookingId.slice(0, 8).toUpperCase()}.`,
```

Replace with:
```typescript
        body:  `Your payment of R${p.amount.toFixed(2)} has been confirmed for booking ${p.bookingId.slice(0, 8).toUpperCase()}.`,
```

- [ ] **Step 5: Commit**

```bash
git add services/notificationService.ts
git commit -m "feat: add container.departure_notice notification event, fix ZAR in payment messages"
```

---

## Task 3: Operator dashboard — Send Departure Notice action

**Files:**
- Modify: `app/operator/page.tsx`

- [ ] **Step 1: Add `departure_notice_sent_at` to the `Container` type**

Find the `Container` type (line 12) and add the new field:

```typescript
type Container = {
  id: string;
  origin_city: string;
  origin_country: string;
  destination_city: string;
  destination_country: string;
  departure_date: string;
  arrival_date: string | null;
  total_capacity_cbm: number;
  available_capacity_cbm: number;
  price_per_cbm: number;
  status: string;
  created_at: string;
  departure_notice_sent_at: string | null;
};
```

- [ ] **Step 2: Add state for the departure notice action**

After the existing `useState` declarations (after `setPendingCount`), add:

```typescript
  const [sendingNotice,  setSendingNotice]  = useState<string | null>(null);
  const [noticeError,    setNoticeError]    = useState<string | null>(null);
  const [noticeSent,     setNoticeSent]     = useState<string | null>(null);
```

- [ ] **Step 3: Add the `sendDepartureNotice` function**

Add this function after the `useEffect` block (before the `filtered =` line):

```typescript
  async function sendDepartureNotice(container: Container) {
    setSendingNotice(container.id);
    setNoticeError(null);
    setNoticeSent(null);

    const { error: updateErr } = await supabase
      .from('containers')
      .update({ departure_notice_sent_at: new Date().toISOString() })
      .eq('id', container.id);

    if (updateErr) {
      setNoticeError(updateErr.message);
      setSendingNotice(null);
      return;
    }

    // Notify all confirmed/loaded customers on this container
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, customer_id')
      .eq('container_id', container.id)
      .in('status', ['confirmed', 'loaded']);

    for (const b of bookings ?? []) {
      await notify('container.departure_notice', {
        bookingId:     b.id,
        recipientId:   b.customer_id,
        route:         `${container.origin_city} → ${container.destination_city}`,
        departureDate: container.departure_date,
      });
    }

    setContainers((prev) =>
      prev.map((c) =>
        c.id === container.id ? { ...c, departure_notice_sent_at: new Date().toISOString() } : c,
      ),
    );
    setNoticeSent(container.id);
    setSendingNotice(null);
  }
```

- [ ] **Step 4: Add the `notify` import**

At the top of the file, add:
```typescript
import { notify } from '@/services/notificationService';
```

- [ ] **Step 5: Add departure notice column to the desktop table header**

Find the `<thead>` row with columns Route, Departure, Status, Capacity, Price / CBM. Add a new `<th>` after `Price / CBM`:

```tsx
                    <th className="font-semibold py-3 px-4">Notice</th>
```

- [ ] **Step 6: Add departure notice cell to each desktop table row**

After the `<td>` that shows `R{c.price_per_cbm}</td>` and before the `View →` td, add:

```tsx
                        <td className="py-4 px-4">
                          {c.departure_notice_sent_at ? (
                            <span className="text-xs font-semibold text-green-600 flex items-center gap-1">
                              ✓ Sent
                            </span>
                          ) : (
                            <button
                              onClick={() => sendDepartureNotice(c)}
                              disabled={sendingNotice === c.id || c.status === 'delivered' || c.status === 'closed'}
                              className="btn btn-xs rounded-lg text-white font-semibold hover:opacity-90 disabled:opacity-50"
                              style={{ backgroundColor: '#f97316' }}
                            >
                              {sendingNotice === c.id
                                ? <span className="loading loading-spinner loading-xs" />
                                : '7-Day Notice'}
                            </button>
                          )}
                        </td>
```

- [ ] **Step 7: Add departure notice button to mobile cards**

In the mobile cards section, after the capacity progress bar and before the `View Details →` link, add:

```tsx
                    {!c.departure_notice_sent_at ? (
                      <button
                        onClick={() => sendDepartureNotice(c)}
                        disabled={sendingNotice === c.id}
                        className="btn btn-sm rounded-xl text-white font-semibold hover:opacity-90 disabled:opacity-50 w-full"
                        style={{ backgroundColor: '#f97316' }}
                      >
                        {sendingNotice === c.id
                          ? <span className="loading loading-spinner loading-sm" />
                          : '📢 Send 7-Day Departure Notice'}
                      </button>
                    ) : (
                      <p className="text-xs text-green-600 font-semibold text-center">✓ Departure notice sent</p>
                    )}
```

- [ ] **Step 8: Show error if notice fails**

After the status filter tabs block (before the loading spinner), add:

```tsx
        {noticeError && (
          <div className="alert alert-error text-sm mb-4">{noticeError}</div>
        )}
        {noticeSent && (
          <div className="alert text-sm mb-4 font-semibold" style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
            ✓ Departure notice sent — customers have been notified.
          </div>
        )}
```

- [ ] **Step 9: Commit**

```bash
git add app/operator/page.tsx
git commit -m "feat: add Send Departure Notice action to operator container dashboard"
```

---

## Task 4: Payment page — gate isPayable on departure notice and arrival milestone

**Files:**
- Modify: `app/payments/[bookingId]/page.tsx`

- [ ] **Step 1: Update `BookingDetail` type to include `departure_notice_sent_at`**

Find the `BookingDetail` type and update the `containers` field:

```typescript
type BookingDetail = {
  id: string;
  total_price: number;
  status: string;
  containers: {
    origin_city: string;
    destination_city: string;
    departure_date: string;
    departure_notice_sent_at: string | null;
  } | null;
};
```

- [ ] **Step 2: Add `milestones` state**

After the existing `useState` declarations, add:

```typescript
  const [milestones, setMilestones] = useState<{ milestone: string }[]>([]);
```

- [ ] **Step 3: Update data fetching to include departure notice + milestones**

Find the `Promise.all` block in `load()` and replace it:

```typescript
      const [bookingRes, paymentsRes, milestonesRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, total_price, status, containers(origin_city, destination_city, departure_date, departure_notice_sent_at)')
          .eq('id', bookingId)
          .single(),
        supabase
          .from('payments')
          .select('id, stage, amount, status, due_date, paid_at')
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: true }),
        supabase
          .from('shipment_milestones')
          .select('milestone')
          .eq('booking_id', bookingId),
      ]);

      if (bookingRes.error || !bookingRes.data) {
        setError('Booking not found or access denied.');
      } else {
        setBooking(bookingRes.data as unknown as BookingDetail);
        setPayments((paymentsRes.data ?? []) as Payment[]);
        setMilestones((milestonesRes.data ?? []) as { milestone: string }[]);
      }
```

- [ ] **Step 4: Replace `isPayable()` with gated logic**

Find the `isPayable` function and replace it entirely:

```typescript
  function isPayable(payment: Payment): boolean {
    if (payment.status !== 'pending') return false;
    const idx = STAGE_ORDER.indexOf(payment.stage);

    if (idx === 0) return true;

    if (idx === 1) {
      const stage1Paid = payments.find((p) => p.stage === 'deposit_20')?.status === 'paid';
      const noticeSent = booking?.containers?.departure_notice_sent_at != null;
      return stage1Paid && noticeSent;
    }

    if (idx === 2) {
      const stage2Paid = payments.find((p) => p.stage === 'pre_departure_50')?.status === 'paid';
      const hasArrival = milestones.some((m) => m.milestone === 'destination_arrival');
      return stage2Paid && hasArrival;
    }

    return false;
  }
```

- [ ] **Step 5: Add `getLockReason()` function**

Add this function directly after `isPayable()`:

```typescript
  function getLockReason(payment: Payment): string | undefined {
    if (payment.status !== 'pending' || isPayable(payment)) return undefined;
    const idx = STAGE_ORDER.indexOf(payment.stage);

    if (idx === 1) {
      const stage1Paid = payments.find((p) => p.stage === 'deposit_20')?.status === 'paid';
      if (!stage1Paid) return 'Complete the 20% deposit first';
      return 'Awaiting operator 7-day departure notice';
    }

    if (idx === 2) {
      const stage2Paid = payments.find((p) => p.stage === 'pre_departure_50')?.status === 'paid';
      if (!stage2Paid) return 'Complete the 50% pre-departure payment first';
      return 'Awaiting cargo arrival confirmation from operator';
    }

    return undefined;
  }
```

- [ ] **Step 6: Pass `lockReason` to `PaymentStageCard`**

Find the `<PaymentStageCard ... />` call and add the prop:

```tsx
                <PaymentStageCard
                  key={payment.id}
                  payment={payment}
                  isPayable={isPayable(payment)}
                  lockReason={getLockReason(payment)}
                  onPay={handlePay}
                  paying={paying}
                />
```

- [ ] **Step 7: Commit**

```bash
git add app/payments/[bookingId]/page.tsx
git commit -m "feat: gate Stage 2/3 payments behind departure notice and arrival milestone"
```

---

## Task 5: PaymentStageCard — meaningful lock reason display

**Files:**
- Modify: `components/PaymentStageCard.tsx`

- [ ] **Step 1: Add `lockReason` to the `Props` type**

Find the `Props` type and add the field:

```typescript
type Props = {
  payment: Payment;
  isPayable: boolean;
  lockReason?: string;
  onPay: (paymentId: string) => void;
  paying: boolean;
};
```

- [ ] **Step 2: Destructure `lockReason` in the component**

Find:
```typescript
export default function PaymentStageCard({ payment, isPayable, onPay, paying }: Props) {
```

Replace with:
```typescript
export default function PaymentStageCard({ payment, isPayable, lockReason, onPay, paying }: Props) {
```

- [ ] **Step 3: Replace the generic locked message with `lockReason`**

Find this block at the bottom of the card:
```tsx
          {!isPayable && payment.status === 'pending' && (
            <span className="text-xs text-gray-400">Complete previous stage first</span>
          )}
```

Replace with:
```tsx
          {!isPayable && payment.status === 'pending' && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400 max-w-[180px] text-right leading-tight">
              🔒 {lockReason ?? 'Complete previous stage first'}
            </span>
          )}
```

- [ ] **Step 4: Commit**

```bash
git add components/PaymentStageCard.tsx
git commit -m "feat: show specific lock reason on PaymentStageCard instead of generic message"
```

---

## Self-Review

**Spec coverage:**
- ✅ Stage 2 gated on operator departure notice (Task 1 migration + Task 3 UI + Task 4 isPayable)
- ✅ Departure notice is container-level not per-booking (Task 3: single button per container, notifies all customers)
- ✅ Stage 3 gated on destination_arrival milestone (Task 4 isPayable — checks `destination_arrival` milestone)
- ✅ Customers notified when departure notice is sent (Task 3 `sendDepartureNotice`)
- ✅ Meaningful lock reason shown to customer (Task 5 PaymentStageCard)
- ✅ Operator booking confirmation already works (existing `/operator/bookings/page.tsx` Confirm Booking flow + `booking.status_updated` notification)

**Placeholder scan:** No TBDs, all code blocks complete.

**Type consistency:**
- `departure_notice_sent_at: string | null` used in Container (Task 3) and BookingDetail.containers (Task 4) ✅
- `milestone: string` in milestones state matches `select('milestone')` query ✅
- `lockReason?: string` added to Props (Task 5) and passed from payment page (Task 4 Step 6) ✅
- `'container.departure_notice'` event key consistent between notificationService (Task 2) and operator page (Task 3 Step 3) ✅
- `'destination_arrival'` milestone value matches `OPERATOR_MILESTONES` in operator/bookings/page.tsx ✅
