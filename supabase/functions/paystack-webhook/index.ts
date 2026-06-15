import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

const DEFAULT_TIERS: Tier[] = [
  { min: 0,     max: 5000,  rate: 0.12 },
  { min: 5001,  max: 20000, rate: 0.10 },
  { min: 20001, max: 50000, rate: 0.08 },
  { min: 50001, max: null,  rate: 0.06 },
];

function calcCommission(gross: number, config: CommissionConfig | null): number {
  if (config?.commission_type === 'fixed') {
    return Math.round(gross * (config.fixed_rate ?? 0.05) * 100) / 100;
  }
  const tiers = config?.tiers?.length ? config.tiers : DEFAULT_TIERS;
  const tier = tiers.find((t) => gross >= t.min && (t.max === null || gross <= t.max));
  return Math.round(gross * (tier?.rate ?? 0.06) * 100) / 100;
}

function effectiveRate(commission: number, gross: number): number {
  return Math.round((commission / gross) * 10000) / 10000;
}

serve(async (req: Request) => {
  try {
    const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const rawBody = await req.text();

    // ── Verify Paystack signature ──────────────────────────────────────────────
    const signature = req.headers.get('x-paystack-signature') ?? '';
    const valid     = await verifySignature(rawBody, PAYSTACK_SECRET, signature);
    if (!valid) {
      console.warn('[paystack-webhook] Invalid signature');
      return new Response('Unauthorized', { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const data  = event.data ?? {};

    await supabase.from('audit_logs').insert({
      action:      `webhook.${event.event}`,
      target_type: 'paystack_event',
      metadata:    { event: event.event, reference: data.reference },
    });

    switch (event.event) {

      case 'charge.success': {
        const meta      = data.metadata ?? {};
        const paymentId = meta.payment_id;
        const stage     = meta.stage;
        const bookingId = meta.booking_id;

        if (!paymentId) break;

        const [paymentRes, commRes] = await Promise.all([
          supabase
            .from('payments')
            .select('status, amount, booking_id')
            .eq('id', paymentId)
            .single(),
          supabase
            .from('platform_commission_config')
            .select('commission_type, fixed_rate, tiers')
            .single(),
        ]);

        const existingPayment = paymentRes.data;
        const alreadyPaid     = existingPayment?.status === 'paid';

        if (!alreadyPaid) {
          await supabase
            .from('payments')
            .update({
              status:             'paid',
              paid_at:            new Date().toISOString(),
              paystack_reference: data.reference,
            })
            .eq('id', paymentId);

          await supabase.from('audit_logs').insert({
            action:      'payment.paid_via_webhook',
            target_type: 'payment',
            target_id:   paymentId,
            metadata:    { stage, reference: data.reference, booking_id: bookingId },
          });
        }

        const bkId       = bookingId ?? existingPayment?.booking_id;
        const grossAmount = existingPayment?.amount;
        if (bkId && grossAmount != null) {
          await createPayoutRecord(supabase, {
            bookingId:  bkId,
            paymentId,
            stage,
            grossAmount,
            commConfig: commRes.data as CommissionConfig | null,
          });
        }
        break;
      }

      case 'transfer.success': {
        const transferCode = data.transfer_code;
        if (!transferCode) break;
        await supabase
          .from('payouts')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('paystack_transfer_code', transferCode);
        break;
      }

      case 'transfer.failed': {
        const transferCode  = data.transfer_code;
        const failureReason = data.reason ?? 'Transfer failed';
        if (!transferCode) break;
        await supabase
          .from('payouts')
          .update({ status: 'failed', failure_reason: failureReason })
          .eq('paystack_transfer_code', transferCode);
        break;
      }

      case 'refund.processed': {
        const reference = data.transaction_reference;
        if (!reference) break;
        await supabase
          .from('payments')
          .update({ status: 'refunded' })
          .eq('paystack_reference', reference);
        break;
      }

      default:
        console.info(`[paystack-webhook] Unhandled event: ${event.event}`);
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('[paystack-webhook]', err);
    return new Response('Internal error', { status: 500 });
  }
});

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
    .from('bookings').select('container_id').eq('id', bookingId).single();
  if (!booking) return;

  const { data: container } = await supabase
    .from('containers').select('operator_id').eq('id', booking.container_id).single();
  if (!container) return;

  const commissionAmount = calcCommission(grossAmount, commConfig);
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
    console.error('[paystack-webhook] payout creation failed:', error.message);
  }
}

async function verifySignature(body: string, secret: string, signature: string): Promise<boolean> {
  try {
    const encoder   = new TextEncoder();
    const keyData   = encoder.encode(secret);
    const msgData   = encoder.encode(body);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData,
      { name: 'HMAC', hash: 'SHA-512' },
      false, ['sign'],
    );
    const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const computed  = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return computed === signature;
  } catch {
    return false;
  }
}
