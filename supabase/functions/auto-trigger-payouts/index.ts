import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Tier = { min: number; max: number | null; rate: number };
type CommissionConfig = {
  commission_type: 'fixed' | 'tiered';
  fixed_rate: number | null;
  tiers: Tier[];
};

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

function calcCommission(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
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

type BatchResult =
  | { payout_id: string; result: 'triggered'; transfer_code: string; net_amount: number }
  | { payout_id: string; result: 'skipped';   reason: string }
  | { payout_id: string; result: 'failed';    error: string };

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

    // ── Load commission config once for the batch ──────────────────────────────
    const { data: commConfig } = await supabase
      .from('platform_commission_config')
      .select('commission_type, fixed_rate, tiers')
      .single();

    // ── Find all eligible pending payouts ──────────────────────────────────────
    const now = new Date().toISOString();
    const { data: pendingPayouts, error: fetchErr } = await supabase
      .from('payouts')
      .select('id, booking_id, operator_id, gross_amount')
      .eq('status', 'pending')
      .or(`eligible_after.is.null,eligible_after.lte.${now}`);

    if (fetchErr) throw new Error(`Failed to fetch payouts: ${fetchErr.message}`);

    if (!pendingPayouts?.length) {
      await supabase.from('audit_logs').insert({
        action:      'payout.auto_trigger_batch',
        target_type: 'batch',
        metadata:    { triggered: 0, skipped: 0, failed: 0, details: [] },
      });
      return json({ success: true, triggered: 0, skipped: 0, failed: 0, details: [] });
    }

    // ── Batch-load operator profiles (2-hop: profiles → operator_profiles) ─────
    const operatorIds = [...new Set(pendingPayouts.map((p: any) => p.operator_id as string))];
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('user_id, id, op:operator_profiles!profile_id(paystack_recipient_code, payout_enabled, payout_hold, status)')
      .in('user_id', operatorIds)
      .eq('role_type', 'operator');

    const opMap: Record<string, {
      profileId: string;
      paystack_recipient_code: string | null;
      payout_enabled: boolean;
      payout_hold: boolean;
      status: string;
    }> = {};
    for (const row of (profileRows ?? [])) {
      const op = Array.isArray(row.op) ? row.op[0] : row.op;
      if (op) opMap[row.user_id] = { profileId: row.id, ...op };
    }

    // ── Batch-load active disputes ─────────────────────────────────────────────
    const bookingIds = [...new Set(pendingPayouts.map((p: any) => p.booking_id as string))];
    const { data: disputeRows } = await supabase
      .from('disputes')
      .select('booking_id')
      .in('booking_id', bookingIds)
      .not('status', 'in', '("resolved","closed")');
    const activeDisputeBookingIds = new Set((disputeRows ?? []).map((d: any) => d.booking_id as string));

    // ── Process each payout ────────────────────────────────────────────────────
    const details: BatchResult[] = [];

    for (const payout of pendingPayouts as any[]) {
      const op = opMap[payout.operator_id];

      if (!op) {
        details.push({ payout_id: payout.id, result: 'skipped', reason: 'no_operator_profile' });
        continue;
      }
      if (!op.paystack_recipient_code) {
        details.push({ payout_id: payout.id, result: 'skipped', reason: 'no_bank_account' });
        continue;
      }
      if (!['active', 'trusted'].includes(op.status)) {
        details.push({ payout_id: payout.id, result: 'skipped', reason: 'compliance_not_approved' });
        continue;
      }
      if (!op.payout_enabled) {
        details.push({ payout_id: payout.id, result: 'skipped', reason: 'payout_disabled' });
        continue;
      }
      if (op.payout_hold) {
        details.push({ payout_id: payout.id, result: 'skipped', reason: 'payout_hold' });
        continue;
      }
      if (activeDisputeBookingIds.has(payout.booking_id)) {
        details.push({ payout_id: payout.id, result: 'skipped', reason: 'active_dispute' });
        continue;
      }

      // Calculate commission
      const grossAmount      = payout.gross_amount;
      const totalUsd         = await getBookingTotalUsd(supabase, payout.booking_id);
      const commRate         = getCommissionRate(totalUsd, commConfig as CommissionConfig | null);
      const commissionAmount = calcCommission(grossAmount, commRate);
      const netAmount        = Math.round((grossAmount - commissionAmount) * 100) / 100;
      const commissionRate   = grossAmount > 0
        ? Math.round((commissionAmount / grossAmount) * 10000) / 10000
        : 0;
      const amountKobo  = Math.round(netAmount * 100);
      const transferRef = `SCL-AUTO-${payout.id.slice(0, 8)}-${Date.now()}`.toUpperCase();

      // Call Paystack
      const paystackRes = await fetch('https://api.paystack.co/transfer', {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${PAYSTACK_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source:    'balance',
          amount:    amountKobo,
          reference: transferRef,
          recipient: op.paystack_recipient_code,
          reason:    `ShareConLoad auto-payout — booking ${payout.booking_id.slice(0, 8).toUpperCase()}`,
        }),
      });

      const paystackData = await paystackRes.json();
      if (!paystackData.status) {
        details.push({ payout_id: payout.id, result: 'failed', error: paystackData.message ?? 'Transfer failed' });
        continue;
      }

      const transferCode = paystackData.data.transfer_code;

      // Update payout record
      const { error: updateErr } = await supabase
        .from('payouts')
        .update({
          status:                 'processing',
          net_amount:             netAmount,
          commission_amount:      commissionAmount,
          commission_rate:        commissionRate,
          platform_fee:           commissionAmount,
          paystack_transfer_code: transferCode,
          metadata: {
            auto_triggered: true,
            triggered_at:   new Date().toISOString(),
          },
        })
        .eq('id', payout.id);

      if (updateErr) {
        console.error(`[auto-trigger-payouts] DB update failed after transfer for ${payout.id}:`, updateErr.message);
        details.push({
          payout_id: payout.id,
          result:    'failed',
          error:     `Transfer succeeded (${transferCode}) but DB update failed: ${updateErr.message}`,
        });
        continue;
      }

      details.push({ payout_id: payout.id, result: 'triggered', transfer_code: transferCode, net_amount: netAmount });
    }

    // ── Write batch audit log ──────────────────────────────────────────────────
    const triggered = details.filter((d) => d.result === 'triggered').length;
    const skipped   = details.filter((d) => d.result === 'skipped').length;
    const failed    = details.filter((d) => d.result === 'failed').length;

    await supabase.from('audit_logs').insert({
      action:      'payout.auto_trigger_batch',
      target_type: 'batch',
      metadata:    { triggered, skipped, failed, details },
    });

    return json({ success: true, triggered, skipped, failed, details });
  } catch (err) {
    console.error('[auto-trigger-payouts]', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
