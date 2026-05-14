import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLATFORM_COMMISSION = 0.05;

const PAYOUT_STAGE_MAP: Record<string, string> = {
  deposit_20:       'deposit_release',
  pre_departure_50: 'departure_release',
  final_release_30: 'final_release',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

    const { reference } = await req.json();
    if (!reference) return json({ error: 'reference is required' }, 400);

    // ── Verify with Paystack ───────────────────────────────────────────────────
    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } },
    );
    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data?.status !== 'success') {
      return json({
        success: false,
        message: paystackData.data?.gateway_response ?? 'Payment not successful',
      });
    }

    const meta      = paystackData.data.metadata ?? {};
    const paymentId = meta.payment_id;
    const bookingId = meta.booking_id;
    const stage     = meta.stage; // 'deposit_20' | 'pre_departure_50' | 'final_release_30'

    if (!paymentId) return json({ error: 'Payment metadata missing' }, 400);

    // ── Load payment record ────────────────────────────────────────────────────
    const { data: payment } = await supabase
      .from('payments')
      .select('status, amount, booking_id')
      .eq('id', paymentId)
      .single();

    if (payment?.status === 'paid') {
      return json({ success: true, message: 'Payment already recorded', alreadyPaid: true });
    }

    // Validate amount (Paystack returns kobo; payment.amount is ZAR)
    const expectedKobo = Math.round((payment?.amount ?? 0) * 100);
    const receivedKobo = paystackData.data.amount;
    if (Math.abs(receivedKobo - expectedKobo) > 1) {
      console.error(`[verify-payment] Amount mismatch: expected ${expectedKobo}, got ${receivedKobo}`);
      return json({ error: 'Payment amount mismatch' }, 400);
    }

    // ── Mark payment as paid ───────────────────────────────────────────────────
    await supabase
      .from('payments')
      .update({
        status:             'paid',
        paid_at:            new Date().toISOString(),
        paystack_reference: reference,
      })
      .eq('id', paymentId);

    // ── Create payout record ───────────────────────────────────────────────────
    // Route: booking → container → operator auth uid → profiles.id (= payouts.operator_id)
    const bkId = bookingId ?? payment?.booking_id;
    if (bkId && payment) {
      await createPayoutRecord(supabase, {
        bookingId:  bkId,
        paymentId,
        stage,
        grossAmount: payment.amount,
      });
    }

    // ── Audit log ──────────────────────────────────────────────────────────────
    await supabase.from('audit_logs').insert({
      action:      'payment.verified',
      target_type: 'payment',
      target_id:   paymentId,
      metadata:    { stage, reference, booking_id: bookingId, amount: payment?.amount },
    });

    return json({ success: true, stage, bookingId });
  } catch (err) {
    console.error('[verify-payment]', err);
    return json({ error: (err as Error).message }, 500);
  }
});

// ── Shared payout creation helper ─────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function createPayoutRecord(supabase: any, opts: {
  bookingId:   string;
  paymentId:   string;
  stage:       string;
  grossAmount: number;
}): Promise<void> {
  const { bookingId, paymentId, stage, grossAmount } = opts;

  const { data: booking } = await supabase
    .from('bookings')
    .select('container_id')
    .eq('id', bookingId)
    .single();
  if (!booking) return;

  const { data: container } = await supabase
    .from('containers')
    .select('operator_id')
    .eq('id', booking.container_id)
    .single();
  if (!container) return;

  // operator_id in containers = auth.uid(); match to profiles.user_id → profiles.id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', container.operator_id)
    .single();
  if (!profile) return;

  const commissionAmount = Math.round(grossAmount * PLATFORM_COMMISSION * 100) / 100;
  const netAmount        = Math.round((grossAmount - commissionAmount) * 100) / 100;
  // Stage 1 deposits are held for 48h to cover the refund window
  const eligibleAfter    = stage === 'deposit_20'
    ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    : null;

  const { error } = await supabase.from('payouts').upsert({
    booking_id:        bookingId,
    operator_id:       profile.id,
    payment_id:        paymentId,
    payout_stage:      PAYOUT_STAGE_MAP[stage] ?? 'deposit_release',
    stage,
    gross_amount:      grossAmount,
    commission_rate:   PLATFORM_COMMISSION,
    commission_amount: commissionAmount,
    platform_fee:      commissionAmount,
    net_amount:        netAmount,
    status:            'pending',
    eligible_after:    eligibleAfter,
  }, { onConflict: 'payment_id', ignoreDuplicates: true });

  if (error) {
    console.error('[verify-payment] payout creation failed:', error.message);
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
