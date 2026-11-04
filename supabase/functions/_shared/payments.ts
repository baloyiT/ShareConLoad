// Pure payment rules shared by the Edge Functions, tested in tests/front-door-security.spec.ts.

export type ChargeState = 'charged' | 'in_flight' | 'not_charged';

export type ChargeRetryDecision = 'new_charge' | 'confirming' | 'unavailable';

export type TransferKind = 'payout' | 'agpay' | 'tpay';

// Anything Paystack adds later counts as in flight, so an unknown status never allows a new charge.
export function chargeState(paystackStatus: string | undefined): ChargeState {
  if (paystackStatus === 'success') return 'charged';
  if (paystackStatus === 'abandoned' || paystackStatus === 'failed' || paystackStatus === 'reversed') {
    return 'not_charged';
  }
  return 'in_flight';
}

// Whether a customer may start a new charge, given Paystack's answer about their last reference.
// 400 and 404 mean Paystack has no such transaction. Any other error means we can't tell.
export function chargeRetryDecision(
  httpStatus: number,
  body: { status?: boolean; data?: { status?: string } },
): ChargeRetryDecision {
  if (httpStatus === 400 || httpStatus === 404) return 'new_charge';
  if (httpStatus >= 300 || !body.status) return 'unavailable';
  return chargeState(body.data?.status) === 'not_charged' ? 'new_charge' : 'confirming';
}

// The same payout always gets the same reference, so Paystack refuses a repeat. A new attempt
// number is the only way to a new reference: use it only once the last transfer really failed.
// Paystack wants lowercase, at most 50 characters.
export function transferReference(kind: TransferKind, id: string, attempt = 0): string {
  if (!Number.isInteger(attempt) || attempt < 0 || attempt > 999) {
    throw new RangeError('attempt must be a whole number from 0 to 999');
  }
  const base = `scl-${kind}-${id.replace(/-/g, '').toLowerCase()}`;
  return attempt === 0 ? base : `${base}-r${attempt}`;
}
