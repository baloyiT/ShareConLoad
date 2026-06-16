# Payout Countdown + Admin Override — Design

## Problem

`admin/payouts` currently shows a static, hour-rounded block reason ("In 48h refund window, eligible in 6h") for any payout whose `eligible_after` timestamp hasn't passed yet. There are two issues:

1. It's not intuitive — the admin has to mentally track when a row will become actionable, and the page doesn't update on its own.
2. There's no way for admin to act sooner if business judgment says it's safe to pay an operator before the 48h refund window naturally expires (e.g. customer has already confirmed receipt with no dispute risk).

## Scope

In scope:
- Live countdown display on `app/admin/payouts/page.tsx` for payouts blocked only by the refund window.
- Admin-only manual override to force-trigger a payout before `eligible_after` passes, gated behind a required justification reason.
- Audit trail for every override (who, why, how much time was skipped).

Out of scope (unchanged):
- The other three payout gates — `payout_enabled`, `payout_hold`, `paystack_recipient_code` missing — remain hard blocks. No override for these; they are structural eligibility rules, not time-based judgment calls.
- Active-dispute blocking (already enforced server-side in `trigger-payout`, not surfaced as a separate block reason in the admin table today — this spec does not change that).
- Operator-facing UI (`app/operator/payouts/page.tsx`) — no changes. Operators do not see a countdown or have override capability.

## Design

### 1. Live countdown (`app/admin/payouts/page.tsx`)

Replace the existing static `eligibilityReason()` hour-rounded string with a ticking countdown:

- Add a `now` state, updated every 30 seconds via `setInterval`.
- Replace `Math.ceil((eligibleAfter - Date.now()) / 3600000)` hour math with a `formatCountdown(ms)` helper that renders `Xd Xh Ym` (omitting leading zero units, e.g. `14h 22m` once under a day, `45m` once under an hour).
- `eligibilityReason()` becomes time-aware using the `now` state instead of `new Date()` at render time, so when the countdown hits zero the row flips from blocked → "Trigger →" enabled automatically, no refresh needed.
- The function returns a structured reason instead of a single string, so the page can tell *which* gate is blocking (needed for step 2):
  ```ts
  type BlockReason =
    | { type: 'no_profile' | 'no_bank' | 'payout_disabled' | 'on_hold'; message: string }
    | { type: 'refund_window'; message: string; msRemaining: number };
  ```

### 2. Override entry point

A "Force trigger" link appears next to the disabled "Trigger →" button **only** when `blockReason.type === 'refund_window'` (i.e. every other gate already passes). For any other block reason, only the existing disabled button + reason text shows — no override path.

Clicking "Force trigger" opens a new component, `components/PayoutOverrideModal.tsx`:

**Props:**
```ts
type PayoutOverrideModalProps = {
  payoutId: string;
  msRemaining: number;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  submitting: boolean;
  error: string | null;
};
```

**Behavior:**
- Shows the time being skipped, e.g. "This will bypass 14h 22m of refund-window protection."
- A required `<textarea>` for the justification reason (minimum 10 non-whitespace characters; Confirm button disabled until met).
- Cancel closes the modal with no action. Confirm calls `onConfirm(reason)`.
- Displays `error` inline if the parent reports a failure (e.g. function call failed).

### 3. Edge function (`supabase/functions/trigger-payout/index.ts`)

New optional request fields: `override?: boolean`, `overrideReason?: string`, `adminProfileId?: string` (mirrors the existing `adminProfileId` pattern already used in `process-refund/index.ts`).

Changes to the handler:
- If `override` is true and `overrideReason` is missing or blank → `400 { error: 'Override reason is required' }`.
- The existing `eligible_after` check (`if (payout.eligible_after && new Date(payout.eligible_after) > new Date())`) is skipped when `override === true`. Capture `msRemaining` (the time being skipped) before skipping, for the audit log.
- All other checks remain unconditional: operator status, `payout_enabled`, `payout_hold`, `paystack_recipient_code`, active dispute. Override never bypasses these.
- On successful transfer, merge into the payout's existing `metadata` jsonb column (already present on the table, currently unused — no migration needed):
  ```json
  {
    "overridden": true,
    "override_reason": "<text>",
    "overridden_by": "<adminProfileId>",
    "overridden_at": "<ISO timestamp>"
  }
  ```
- Add an `audit_logs` insert (in addition to the existing `payout.triggered` entry): `action: 'payout.eligibility_overridden'`, `target_type: 'payout'`, `target_id: payoutId`, `actor_id: adminProfileId ?? null`, `metadata: { reason, ms_remaining: msRemaining, eligible_after }`.

### 4. Admin UI follow-up display

The admin payouts query adds `metadata` to its `select`. Rows where `metadata.overridden === true` show a small badge ("⚡ Overridden") next to the status badge, with the reason available on hover (`title` attribute) — keeps a visible record that this row skipped the standard protection window directly in the table, not just in audit logs.

## Data / Schema

No migration required. `payouts.metadata` (jsonb, nullable) already exists and is currently unused by any code path.

## Files touched

- Modify: `app/admin/payouts/page.tsx` — countdown, structured block reason, override entry point, override badge, wiring to modal.
- Create: `components/PayoutOverrideModal.tsx` — reason capture + confirmation UI.
- Modify: `supabase/functions/trigger-payout/index.ts` — override handling, metadata merge, audit log entry. Redeploy after merge (preserve current `verify_jwt` setting).

## Testing

- Manual: confirm countdown ticks down and the row auto-unblocks at zero without a page refresh.
- Manual: confirm "Force trigger" is absent when blocked by `no_bank` / `payout_disabled` / `on_hold` (no override path for structural gates).
- Manual: confirm override with no reason text is rejected client-side (button disabled) and server-side (400 if called directly without a reason).
- Manual: confirm a successful override creates the `payout.eligibility_overridden` audit_logs row and the `metadata.overridden` badge appears on next page load.
- Manual: confirm a normal (non-override) trigger after the window naturally expires still works exactly as before (regression check).
