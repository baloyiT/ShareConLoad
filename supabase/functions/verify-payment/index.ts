import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYOUT_STAGE_MAP: Record<string, string> = {
  deposit_20:       'deposit_release',
  pre_departure_50: 'departure_release',
  final_release_30: 'final_release',
};

// ── Commission helpers ─────────────────────────────────────────────────────────

type Tier = { min: number; max: number | null; rate: number };
type CommissionConfig = {
  commission_type: 'fixed' | 'tiered';
  fixed_rate: number | null;
  tiers: Tier[];
};

// Thresholds are in USD — tier is looked up on booking total_price converted to USD.
const DEFAULT_TIERS: Tier[] = [
  { min: 0,    max: 500,  rate: 0.12 },
  { min: 501,  max: 2000, rate: 0.10 },
  { min: 2001, max: 5000, rate: 0.08 },
  { min: 5001, max: null, rate: 0.06 },
];

function getCommissionRate(totalUsd: number, config: CommissionConfig | null): number {
  if (config?.commission_type === 'fixed') return config.fixed_rate ?? 0.05;
  const tiers = config?.tiers?.length ? config.tiers : DEFAULT_TIERS;
  const tier = tiers.find((t) => totalUsd >= t.min && (t.max === null || totalUsd <= t.max));
  return tier?.rate ?? 0.06;
}

function calcCommission(stageAmount: number, rate: number): number {
  return Math.round(stageAmount * rate * 100) / 100;
}

function effectiveRate(commission: number, gross: number): number {
  return Math.round((commission / gross) * 10000) / 10000;
}

// deno-lint-ignore no-explicit-any
async function getBookingTotalUsd(supabase: any, bookingId: string): Promise<number> {
  const { data: booking } = await supabase
    .from('bookings')
    .select('total_price, containers(currency_code)')
    .eq('id', bookingId)
    .single();
  if (!booking) return 0;
  const currencyCode: string = booking.containers?.currency_code ?? 'USD';
  if (currencyCode === 'USD') return booking.total_price;
  const { data: fx } = await supabase
    .from('fx_rates')
    .select('rate_to_usd')
    .eq('currency_code', currencyCode)
    .single();
  return Math.round(booking.total_price * (fx?.rate_to_usd ?? 1) * 100) / 100;
}

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

    // ── Fetch commission config ────────────────────────────────────────────────
    const { data: commConfig } = await supabase
      .from('platform_commission_config')
      .select('commission_type, fixed_rate, tiers')
      .single();

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
    const stage     = meta.stage;

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
    const bkId = bookingId ?? payment?.booking_id;
    if (bkId && payment) {
      await createPayoutRecord(supabase, {
        bookingId:   bkId,
        paymentId,
        stage,
        grossAmount: payment.amount,
        commConfig:  commConfig as CommissionConfig | null,
      });
    }

    // ── Audit log ──────────────────────────────────────────────────────────────
    await supabase.from('audit_logs').insert({
      action:      'payment.verified',
      target_type: 'payment',
      target_id:   paymentId,
      metadata:    { stage, reference, booking_id: bookingId, amount: payment?.amount },
    });

    // ── Payment notifications ──────────────────────────────────────────────────
    const confirmedBookingId = bookingId ?? payment?.booking_id;
    if (confirmedBookingId && payment) {
      await firePaymentNotifications(supabase, {
        bookingId: confirmedBookingId,
        stage,
        amount: payment.amount,
      });
    }

    return json({ success: true, stage, bookingId });
  } catch (err) {
    console.error('[verify-payment]', err);
    return json({ error: (err as Error).message }, 500);
  }
});

const STAGE_LABELS: Record<string, string> = {
  deposit_20:       'Deposit (20%)',
  pre_departure_50: 'Pre-Departure (50%)',
  final_release_30: 'Final Release (30%)',
};

const STAGE_ORDER = ['deposit_20', 'pre_departure_50', 'final_release_30'];

// deno-lint-ignore no-explicit-any
async function firePaymentNotifications(supabase: any, opts: {
  bookingId: string;
  stage:     string;
  amount:    number;
}): Promise<void> {
  const { bookingId, stage, amount } = opts;

  const SUPABASE_URL        = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_ROLE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const SEND_EMAIL_ENDPOINT = `${SUPABASE_URL}/functions/v1/send-email`;

  // Fetch booking customer + container route
  const { data: booking } = await supabase
    .from('bookings')
    .select('customer_id, containers(origin_city, destination_city)')
    .eq('id', bookingId)
    .single();

  const customerId = booking?.customer_id;
  if (!customerId) return;

  const container  = booking?.containers as { origin_city: string; destination_city: string } | null;
  const route      = container ? `${container.origin_city} → ${container.destination_city}` : 'your shipment';
  const stageLabel = STAGE_LABELS[stage] ?? stage;
  const amountStr  = `R${amount.toFixed(2)}`;

  // ── payment.confirmed ──────────────────────────────────────────────────────
  const confirmedTitle = 'Payment Confirmed';
  const confirmedBody  = `Your ${stageLabel} payment of ${amountStr} for ${route} has been received and confirmed. Thank you.`;

  await supabase.from('notifications').insert({
    recipient_id: customerId,
    event:        'payment.confirmed',
    title:        confirmedTitle,
    body:         confirmedBody,
    metadata:     { bookingId, stage, amount },
  });

  await fetch(SEND_EMAIL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${SERVICE_ROLE_KEY}`,
      apikey:          SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      recipientId: customerId,
      subject:     confirmedTitle,
      title:       confirmedTitle,
      body:        confirmedBody,
    }),
  }).catch((e: Error) => console.error('[verify-payment] send-email (confirmed):', e.message));

  // ── payment.due — next pending stage ──────────────────────────────────────
  const currentIdx = STAGE_ORDER.indexOf(stage);
  if (currentIdx < 0 || currentIdx >= STAGE_ORDER.length - 1) return;

  const nextStage = STAGE_ORDER[currentIdx + 1];
  const { data: nextPayment } = await supabase
    .from('payments')
    .select('id, amount, stage')
    .eq('booking_id', bookingId)
    .eq('stage', nextStage)
    .eq('status', 'pending')
    .single();

  if (!nextPayment) return;

  const nextLabel  = STAGE_LABELS[nextStage] ?? nextStage;
  const nextAmount = `R${Number(nextPayment.amount).toFixed(2)}`;
  const dueTitle   = 'Payment Due';
  const dueBody    = `Your next payment stage — ${nextLabel} of ${nextAmount} — is now due for ${route}. Please make your payment to avoid delays.`;

  await supabase.from('notifications').insert({
    recipient_id: customerId,
    event:        'payment.due',
    title:        dueTitle,
    body:         dueBody,
    metadata:     { bookingId, stage: nextStage, amount: nextPayment.amount },
  });

  await fetch(SEND_EMAIL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${SERVICE_ROLE_KEY}`,
      apikey:          SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      recipientId: customerId,
      subject:     dueTitle,
      title:       dueTitle,
      body:        dueBody,
    }),
  }).catch((e: Error) => console.error('[verify-payment] send-email (due):', e.message));
}

// deno-lint-ignore no-explicit-any
async function createPayoutRecord(supabase: any, opts: {
  bookingId:   string;
  paymentId:   string;
  stage:       string;
  grossAmount: number;
  commConfig:  CommissionConfig | null;
}): Promise<void> {
  const { bookingId, paymentId, stage, grossAmount, commConfig } = opts;

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

  const totalUsd         = await getBookingTotalUsd(supabase, bookingId);
  const commRate         = getCommissionRate(totalUsd, commConfig);
  const commissionAmount = calcCommission(grossAmount, commRate);
  const netAmount        = Math.round((grossAmount - commissionAmount) * 100) / 100;
  const rate             = effectiveRate(commissionAmount, grossAmount);
  const eligibleAfter    = stage === 'deposit_20'
    ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    : null;

  const { error } = await supabase.from('payouts').upsert({
    booking_id:        bookingId,
    operator_id:       container.operator_id,
    payment_id:        paymentId,
    payout_stage:      PAYOUT_STAGE_MAP[stage] ?? 'deposit_release',
    stage,
    gross_amount:      grossAmount,
    commission_rate:   rate,
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
