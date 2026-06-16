# Payout Countdown + Admin Override Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Testing note:** This codebase has no unit test framework for React components or Supabase Edge Functions (confirmed: no `*.test.ts`/`*.test.tsx` files anywhere under `app/`, `components/`, or `supabase/functions/`; `package.json` only has `@playwright/test` for e2e, unused by any existing admin page or edge function). Per the approved spec's Testing section, verification steps in this plan are manual (dev server + browser, curl, SQL) rather than fabricated unit tests — this matches how every other admin page and edge function in this repo was built and verified.

**Goal:** Replace the static, hour-rounded payout block-reason text on `/admin/payouts` with a live-ticking countdown, and let admin force-trigger a payout still inside its 48h refund window by typing a required justification reason — fully audited, with the other (non-time) payout gates still hard-blocked.

**Architecture:** A new `BlockReason` union type replaces the old string-returning `eligibilityReason()` so the page can tell *which* gate is blocking a payout. A `now` state ticking every 30s drives a live countdown. A new `PayoutOverrideModal` component captures the override reason. The `trigger-payout` Edge Function gains an `override`/`overrideReason`/`adminProfileId` request path that skips only the `eligible_after` check, writes the override into the payout's existing (currently-unused) `metadata` jsonb column, and logs a dedicated `audit_logs` entry.

**Tech Stack:** Next.js App Router (client component), TypeScript, Tailwind/DaisyUI, Supabase Edge Function (Deno).

---

### Task 1: Add override support to `trigger-payout` Edge Function

**Files:**
- Modify: `supabase/functions/trigger-payout/index.ts`

- [ ] **Step 1: Add override fields to the request body and validate the reason**

In `supabase/functions/trigger-payout/index.ts`, find:

```ts
    const { payoutId } = await req.json();
    if (!payoutId) return json({ error: 'payoutId is required' }, 400);
```

Replace with:

```ts
    const { payoutId, override, overrideReason, adminProfileId } = await req.json();
    if (!payoutId) return json({ error: 'payoutId is required' }, 400);
    if (override && !overrideReason?.trim()) {
      return json({ error: 'Override reason is required' }, 400);
    }
```

- [ ] **Step 2: Skip the refund-window check only when overriding, and capture the time being skipped**

Find:

```ts
    // ── 48h refund window check ────────────────────────────────────────────────
    if (payout.eligible_after && new Date(payout.eligible_after) > new Date()) {
      const hoursLeft = Math.ceil(
        (new Date(payout.eligible_after).getTime() - Date.now()) / (1000 * 60 * 60)
      );
      return json({ error: `Still in refund window — eligible in ${hoursLeft}h` }, 400);
    }
```

Replace with:

```ts
    // ── 48h refund window check (skippable via admin override) ─────────────────
    let msRemainingAtOverride = 0;
    if (payout.eligible_after && new Date(payout.eligible_after) > new Date()) {
      const msRemaining = new Date(payout.eligible_after).getTime() - Date.now();
      if (!override) {
        const hoursLeft = Math.ceil(msRemaining / (1000 * 60 * 60));
        return json({ error: `Still in refund window — eligible in ${hoursLeft}h` }, 400);
      }
      msRemainingAtOverride = msRemaining;
    }
```

Note: every other check below this (operator status, `payout_enabled`, `payout_hold`, `paystack_recipient_code`, active dispute) is untouched — override only ever lifts the time gate.

- [ ] **Step 3: Record the override on the payout row and write a dedicated audit log entry**

Find:

```ts
    // ── Update payout record ───────────────────────────────────────────────────
    await supabase
      .from('payouts')
      .update({
        status:                 'processing',
        net_amount:             netAmount,
        commission_amount:      commissionAmount,
        commission_rate:        commissionRate,
        platform_fee:           commissionAmount,
        paystack_transfer_code: transferCode,
      })
      .eq('id', payoutId);

    // ── Audit log ──────────────────────────────────────────────────────────────
    await supabase.from('audit_logs').insert({
      action:      'payout.triggered',
      target_type: 'payout',
      target_id:   payoutId,
      metadata:    {
        gross_amount:  grossAmount,
        commission:    commissionAmount,
        net_amount:    netAmount,
        transfer_code: transferCode,
        reference:     transferRef,
      },
    });

    return json({ success: true, transferCode, netAmount });
```

Replace with:

```ts
    // ── Update payout record ───────────────────────────────────────────────────
    await supabase
      .from('payouts')
      .update({
        status:                 'processing',
        net_amount:             netAmount,
        commission_amount:      commissionAmount,
        commission_rate:        commissionRate,
        platform_fee:           commissionAmount,
        paystack_transfer_code: transferCode,
        ...(override ? {
          metadata: {
            overridden:      true,
            override_reason: overrideReason.trim(),
            overridden_by:   adminProfileId ?? null,
            overridden_at:   new Date().toISOString(),
          },
        } : {}),
      })
      .eq('id', payoutId);

    // ── Audit log ──────────────────────────────────────────────────────────────
    await supabase.from('audit_logs').insert({
      action:      'payout.triggered',
      target_type: 'payout',
      target_id:   payoutId,
      metadata:    {
        gross_amount:  grossAmount,
        commission:    commissionAmount,
        net_amount:    netAmount,
        transfer_code: transferCode,
        reference:     transferRef,
      },
    });

    if (override) {
      await supabase.from('audit_logs').insert({
        action:      'payout.eligibility_overridden',
        target_type: 'payout',
        target_id:   payoutId,
        actor_id:    adminProfileId ?? null,
        metadata:    {
          reason:         overrideReason.trim(),
          ms_remaining:   msRemainingAtOverride,
          eligible_after: payout.eligible_after,
        },
      });
    }

    return json({ success: true, transferCode, netAmount });
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/trigger-payout/index.ts
git commit -m "feat: support admin override of payout refund-window check"
```

(Deployment happens in Task 5, after the frontend is wired up, so it ships as one unit.)

---

### Task 2: Create the override confirmation modal

**Files:**
- Create: `components/PayoutOverrideModal.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { useState } from 'react';

type Props = {
  msRemaining: number;
  onCancel:    () => void;
  onConfirm:   (reason: string) => void;
  submitting:  boolean;
  error:       string | null;
};

const MIN_REASON_LENGTH = 10;

export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0m';
  const totalMinutes = Math.ceil(ms / 60000);
  const days    = Math.floor(totalMinutes / 1440);
  const hours   = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (days === 0 && minutes > 0) parts.push(`${minutes}m`);
  return parts.join(' ') || '0m';
}

export default function PayoutOverrideModal({ msRemaining, onCancel, onConfirm, submitting, error }: Props) {
  const [reason, setReason] = useState('');
  const trimmedLength = reason.trim().length;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-sm">
        <h3 className="font-bold text-base mb-2">Force trigger payout</h3>
        <p className="text-sm text-gray-500 mb-4">
          This will bypass {formatCountdown(msRemaining)} of refund-window protection.
          The customer may still be eligible to request a refund during that time.
        </p>

        <textarea
          className="textarea textarea-bordered w-full text-sm"
          placeholder="Why is it safe to trigger this payout early? (min 10 characters)"
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={submitting}
        />

        {error && <p className="text-error text-sm mt-2">{error}</p>}

        <div className="modal-action">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm border-0 text-white"
            style={{ backgroundColor: '#ef4444' }}
            disabled={submitting || trimmedLength < MIN_REASON_LENGTH}
            onClick={() => onConfirm(reason.trim())}
          >
            {submitting ? 'Triggering…' : 'Force trigger'}
          </button>
        </div>
      </div>
      <label className="modal-backdrop" aria-label="Close modal" onClick={submitting ? undefined : onCancel} />
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors referencing `PayoutOverrideModal.tsx` (errors in unrelated files, if any pre-existed, are not in scope).

- [ ] **Step 3: Commit**

```bash
git add components/PayoutOverrideModal.tsx
git commit -m "feat: add PayoutOverrideModal component"
```

---

### Task 3: Structured block reason + live countdown on the admin payouts page

**Files:**
- Modify: `app/admin/payouts/page.tsx`

- [ ] **Step 1: Add the `metadata` field to the `Payout` type**

Find:

```ts
type Payout = {
  id:                      string;
  booking_id:              string;
  operator_id:             string;
  gross_amount:            number;
  net_amount:              number | null;
  commission_amount:       number | null;
  status:                  string;
  eligible_after:          string | null;
  paystack_transfer_code:  string | null;
  failure_reason:          string | null;
  completed_at:            string | null;
  created_at:              string;
  operator_profile:        OperatorProfile | null;
  booking:                 { containers: { origin_city: string; destination_city: string } | null } | null;
};
```

Replace with:

```ts
type Payout = {
  id:                      string;
  booking_id:              string;
  operator_id:             string;
  gross_amount:            number;
  net_amount:              number | null;
  commission_amount:       number | null;
  status:                  string;
  eligible_after:          string | null;
  paystack_transfer_code:  string | null;
  failure_reason:          string | null;
  completed_at:            string | null;
  created_at:              string;
  metadata:                { overridden?: boolean; override_reason?: string } | null;
  operator_profile:        OperatorProfile | null;
  booking:                 { containers: { origin_city: string; destination_city: string } | null } | null;
};
```

- [ ] **Step 2: Replace the string-returning `eligibilityReason` with a structured `getBlockReason`**

Find:

```ts
function eligibilityReason(op: OperatorProfile | null, eligibleAfter: string | null): string | null {
  if (!op) return 'No operator profile';
  if (!op.paystack_recipient_code) return 'No bank account registered';
  if (!op.payout_enabled) return 'Payouts disabled by admin';
  if (op.payout_hold) return 'Operator on payout hold';
  if (eligibleAfter && new Date(eligibleAfter) > new Date()) {
    const hoursLeft = Math.ceil((new Date(eligibleAfter).getTime() - Date.now()) / (1000 * 60 * 60));
    return `In 48h refund window, eligible in ${hoursLeft}h`;
  }
  return null;
}
```

Replace with:

```ts
type BlockReason =
  | { type: 'no_profile' | 'no_bank' | 'payout_disabled' | 'on_hold'; message: string }
  | { type: 'refund_window'; message: string; msRemaining: number };

function getBlockReason(op: OperatorProfile | null, eligibleAfter: string | null, now: number): BlockReason | null {
  if (!op) return { type: 'no_profile', message: 'No operator profile' };
  if (!op.paystack_recipient_code) return { type: 'no_bank', message: 'No bank account registered' };
  if (!op.payout_enabled) return { type: 'payout_disabled', message: 'Payouts disabled by admin' };
  if (op.payout_hold) return { type: 'on_hold', message: 'Operator on payout hold' };
  if (eligibleAfter) {
    const msRemaining = new Date(eligibleAfter).getTime() - now;
    if (msRemaining > 0) {
      return { type: 'refund_window', message: `Eligible in ${formatCountdown(msRemaining)}`, msRemaining };
    }
  }
  return null;
}
```

- [ ] **Step 3: Import `formatCountdown` from the new modal component**

Find:

```ts
import { supabase } from '@/services/supabaseClient';
import PageHero from '@/components/PageHero';
```

Replace with:

```ts
import { supabase } from '@/services/supabaseClient';
import PageHero from '@/components/PageHero';
import PayoutOverrideModal, { formatCountdown } from '@/components/PayoutOverrideModal';
```

- [ ] **Step 4: Add a `now` state that ticks every 30 seconds**

Find:

```ts
  const [triggering,   setTriggering]   = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<Record<string, string>>({});
```

Replace with:

```ts
  const [triggering,   setTriggering]   = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<Record<string, string>>({});
  const [now,           setNow]          = useState(Date.now());
```

Then find:

```ts
  useEffect(() => {
    async function fetchPayouts() {
```

Replace with:

```ts
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    async function fetchPayouts() {
```

- [ ] **Step 5: Add `metadata` to the payouts select query**

Find:

```ts
        .select(`
          id, booking_id, operator_id,
          gross_amount, net_amount, commission_amount,
          status, eligible_after, paystack_transfer_code, failure_reason,
          completed_at, created_at,
          booking:bookings(containers(origin_city, destination_city))
        `)
```

Replace with:

```ts
        .select(`
          id, booking_id, operator_id,
          gross_amount, net_amount, commission_amount,
          status, eligible_after, paystack_transfer_code, failure_reason,
          completed_at, created_at, metadata,
          booking:bookings(containers(origin_city, destination_city))
        `)
```

- [ ] **Step 6: Use `getBlockReason` instead of `eligibilityReason` when rendering rows**

Find:

```ts
                    const blockReason = p.status === 'pending' ? eligibilityReason(p.operator_profile, p.eligible_after) : null;
```

Replace with:

```ts
                    const blockReason = p.status === 'pending' ? getBlockReason(p.operator_profile, p.eligible_after, now) : null;
```

- [ ] **Step 7: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: errors about `blockReason` being used as a string further down the file (next task fixes those render sites) — no errors about `getBlockReason`, `formatCountdown`, or the `metadata` field itself.

- [ ] **Step 8: Commit**

```bash
git add app/admin/payouts/page.tsx
git commit -m "feat: structured block reason + live countdown on admin payouts page"
```

---

### Task 4: Wire the override button, modal, and overridden badge into the admin payouts page

**Files:**
- Modify: `app/admin/payouts/page.tsx`

- [ ] **Step 1: Add override + admin-profile state**

Find:

```ts
  const [triggering,   setTriggering]   = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<Record<string, string>>({});
  const [now,           setNow]          = useState(Date.now());
```

Replace with:

```ts
  const [triggering,   setTriggering]   = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<Record<string, string>>({});
  const [now,           setNow]          = useState(Date.now());
  const [adminProfileId,     setAdminProfileId]     = useState<string | null>(null);
  const [overrideTarget,     setOverrideTarget]     = useState<{ payoutId: string; msRemaining: number } | null>(null);
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [overrideError,      setOverrideError]      = useState<string | null>(null);
```

- [ ] **Step 2: Fetch the admin's profile id alongside the countdown tick effect**

Find:

```ts
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(tick);
  }, []);
```

Replace with:

```ts
  useEffect(() => {
    async function fetchAdminProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profile) setAdminProfileId(profile.id);
    }
    fetchAdminProfile();

    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(tick);
  }, []);
```

- [ ] **Step 3: Add the override-confirm handler next to `handleTrigger`**

Find:

```ts
  const filtered = statusFilter === 'all' ? payouts : payouts.filter((p) => p.status === statusFilter);
```

Replace with:

```ts
  async function handleOverrideConfirm(reason: string) {
    if (!overrideTarget) return;
    setOverrideSubmitting(true);
    setOverrideError(null);

    const { data, error: fnErr } = await supabase.functions.invoke('trigger-payout', {
      body: {
        payoutId:       overrideTarget.payoutId,
        override:       true,
        overrideReason: reason,
        adminProfileId,
      },
    });

    if (fnErr || !data?.success) {
      setOverrideError(data?.error ?? fnErr?.message ?? 'Override trigger failed.');
      setOverrideSubmitting(false);
      return;
    }

    setPayouts((prev) =>
      prev.map((p) =>
        p.id === overrideTarget.payoutId
          ? {
              ...p,
              status: 'processing',
              paystack_transfer_code: data.transferCode ?? p.paystack_transfer_code,
              net_amount: data.netAmount ?? p.net_amount,
              metadata: { ...p.metadata, overridden: true, override_reason: reason },
            }
          : p
      )
    );
    setOverrideSubmitting(false);
    setOverrideTarget(null);
  }

  const filtered = statusFilter === 'all' ? payouts : payouts.filter((p) => p.status === statusFilter);
```

- [ ] **Step 4: Fix the block-reason render sites and add the "Force trigger" link**

Find:

```tsx
                        <td className="py-3.5 px-4">
                          <span className="badge badge-sm text-white font-semibold capitalize"
                            style={{ backgroundColor: STATUS_COLOURS[p.status] ?? '#6b7280' }}>
                            {p.status}
                          </span>
                          {p.failure_reason && (
                            <p className="text-xs text-red-400 mt-1 max-w-[140px] truncate">{p.failure_reason}</p>
                          )}
                        </td>
```

Replace with:

```tsx
                        <td className="py-3.5 px-4">
                          <span className="badge badge-sm text-white font-semibold capitalize"
                            style={{ backgroundColor: STATUS_COLOURS[p.status] ?? '#6b7280' }}>
                            {p.status}
                          </span>
                          {p.metadata?.overridden && (
                            <span
                              className="badge badge-sm font-semibold ml-1"
                              style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}
                              title={p.metadata.override_reason ?? undefined}
                            >
                              ⚡ Overridden
                            </span>
                          )}
                          {p.failure_reason && (
                            <p className="text-xs text-red-400 mt-1 max-w-[140px] truncate">{p.failure_reason}</p>
                          )}
                        </td>
```

Then find:

```tsx
                          {p.status === 'pending' && (
                            <div>
                              <button
                                onClick={() => handleTrigger(p.id)}
                                disabled={!!blockReason || isTriggering}
                                title={blockReason ?? undefined}
                                className="btn btn-sm text-white font-bold rounded-lg hover:opacity-90 disabled:opacity-40 whitespace-nowrap"
                                style={{ backgroundColor: '#0b103a' }}
                              >
                                {isTriggering
                                  ? <span className="loading loading-spinner loading-xs" />
                                  : 'Trigger →'}
                              </button>
                              {blockReason && (
                                <p className="text-xs text-amber-600 mt-1 max-w-[120px]">{blockReason}</p>
                              )}
                              {triggerError[p.id] && (
                                <p className="text-xs text-red-500 mt-1 max-w-[120px]">{triggerError[p.id]}</p>
                              )}
                            </div>
                          )}
```

Replace with:

```tsx
                          {p.status === 'pending' && (
                            <div>
                              <button
                                onClick={() => handleTrigger(p.id)}
                                disabled={!!blockReason || isTriggering}
                                title={blockReason?.message ?? undefined}
                                className="btn btn-sm text-white font-bold rounded-lg hover:opacity-90 disabled:opacity-40 whitespace-nowrap"
                                style={{ backgroundColor: '#0b103a' }}
                              >
                                {isTriggering
                                  ? <span className="loading loading-spinner loading-xs" />
                                  : 'Trigger →'}
                              </button>
                              {blockReason && (
                                <p className="text-xs text-amber-600 mt-1 max-w-[120px]">{blockReason.message}</p>
                              )}
                              {blockReason?.type === 'refund_window' && (
                                <button
                                  onClick={() => setOverrideTarget({ payoutId: p.id, msRemaining: blockReason.msRemaining })}
                                  className="text-xs font-semibold mt-1 underline"
                                  style={{ color: '#ef4444' }}
                                >
                                  Force trigger
                                </button>
                              )}
                              {triggerError[p.id] && (
                                <p className="text-xs text-red-500 mt-1 max-w-[120px]">{triggerError[p.id]}</p>
                              )}
                            </div>
                          )}
```

- [ ] **Step 5: Render the modal at the end of the page**

Find the closing of the component (the final two lines):

```tsx
      </div>
    </div>
  );
}
```

Replace with:

```tsx
      </div>

      {overrideTarget && (
        <PayoutOverrideModal
          msRemaining={overrideTarget.msRemaining}
          submitting={overrideSubmitting}
          error={overrideError}
          onCancel={() => { setOverrideTarget(null); setOverrideError(null); }}
          onConfirm={handleOverrideConfirm}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Manual verification in the browser**

Run: `npm run dev`, then sign in as an admin and open `/admin/payouts`.

Expected:
- A payout still inside its refund window shows "Eligible in Xh Ym" (or similar) and a red "Force trigger" link under the disabled "Trigger →" button.
- A payout blocked for any other reason (no bank account / payouts disabled / on hold) shows the reason but **no** "Force trigger" link.
- Clicking "Force trigger" opens the modal; "Force trigger" inside the modal stays disabled until at least 10 non-whitespace characters are typed.
- Cancelling closes the modal with no network call.

- [ ] **Step 8: Commit**

```bash
git add app/admin/payouts/page.tsx
git commit -m "feat: wire admin override flow into payouts page"
```

---

### Task 5: Deploy the updated Edge Function and verify end-to-end

**Files:**
- Deploy (no new file): `supabase/functions/trigger-payout/index.ts`

- [ ] **Step 1: Confirm current deployment settings before redeploying**

Use the Supabase MCP tool `get_edge_function` with `function_slug: "trigger-payout"`, `project_id: "fkhfbifgvebygafsewot"`.
Expected: current version is 14, `verify_jwt: false` — confirm this `verify_jwt` value is preserved on redeploy.

- [ ] **Step 2: Confirm with the user before deploying**

This step touches production. Ask the user for explicit go-ahead before calling `deploy_edge_function`, per this project's established deployment pattern (every prior Edge Function deploy this session was confirmed first).

- [ ] **Step 3: Deploy**

Use the Supabase MCP tool `deploy_edge_function` with `project_id: "fkhfbifgvebygafsewot"`, `name: "trigger-payout"`, `entrypoint_path: "index.ts"`, `verify_jwt: false`, and the full updated file content from Task 1.

Expected: response `status: "ACTIVE"`, `version` incremented from 14 to 15.

- [ ] **Step 4: Smoke-test the new validation without touching real data**

Run:

```bash
curl -s -X POST "https://fkhfbifgvebygafsewot.supabase.co/functions/v1/trigger-payout" \
  -H "Content-Type: application/json" \
  -d '{"payoutId":"00000000-0000-0000-0000-000000000000","override":true}'
```

Expected: `{"error":"Override reason is required"}` — confirms the new guard runs before any database lookup, so this is safe to run against production with a fake id.

- [ ] **Step 5: End-to-end check against the existing backfilled payout row**

The payout row from booking `8b67a422-02e0-4dae-83dc-dc9f59669538` (id `a5397084-d870-4276-9e48-85eaeb0e5d90`) has `eligible_after` in the future and `status = 'pending'` — it's a real candidate for exercising the override path in the admin UI without needing a new test booking. In the browser at `/admin/payouts`, use "Force trigger" on that row with a test reason, then verify:

```sql
select status, paystack_transfer_code, metadata from public.payouts where id = 'a5397084-d870-4276-9e48-85eaeb0e5d90';
```

Expected: `status` is `processing` or `completed`, and `metadata` contains `"overridden": true` with the typed reason.

Note: only do this if the user wants to actually exercise a real Paystack transfer for this operator now — otherwise treat steps 1–4 as sufficient verification and leave this real payout untouched for its natural trigger later.
