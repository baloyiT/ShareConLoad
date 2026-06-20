import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { payoutId, override, overrideReason, adminProfileId } = await req.json();
    if (!payoutId) return json({ error: 'payoutId is required' }, 400);
    if (override && !overrideReason?.trim()) {
      return json({ error: 'Override reason is required' }, 400);
    }

    // ── Load payout + commission config in parallel ────────────────────────────
    const [payoutRes, commRes] = await Promise.all([
      supabase
        .from('payouts')
        .select('id, booking_id, operator_id, gross_amount, status, eligible_after')
        .eq('id', payoutId)
        .single(),
      supabase
        .from('platform_commission_config')
        .select('commission_type, fixed_rate, tiers')
        .single(),
    ]);

    const payout = payoutRes.data;
    if (payoutRes.error || !payout) return json({ error: 'Payout record not found' }, 404);
    if (payout.status !== 'pending') return json({ error: `Payout is already ${payout.status}` }, 400);

    // ── 48h refund window check (admin override skippable) ─────────────────────
    let msRemainingAtOverride = 0;
    if (payout.eligible_after && new Date(payout.eligible_after) > new Date()) {
      const msRemaining = new Date(payout.eligible_after).getTime() - Date.now();
      if (!override) {
        const hoursLeft = Math.ceil(msRemaining / (1000 * 60 * 60));
        return json({ error: `Still in refund window — eligible in ${hoursLeft}h` }, 400);
      }
      msRemainingAtOverride = msRemaining;
    }

    // ── Load operator profile ──────────────────────────────────────────────────
    // payout.operator_id is auth.users.id; operator_profiles.profile_id FK → profiles.id
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', payout.operator_id)
      .eq('role_type', 'operator')
      .single();

    if (!profileRow) return json({ error: 'Operator profile not found' }, 404);

    const { data: opProfile, error: opErr } = await supabase
      .from('operator_profiles')
      .select('paystack_recipient_code, payout_enabled, payout_hold, status')
      .eq('profile_id', profileRow.id)
      .single();

    if (opErr || !opProfile) return json({ error: 'Operator profile not found' }, 404);
    if (!['active', 'trusted'].includes(opProfile.status))
                                             return json({ error: 'Operator compliance is not approved' }, 400);
    if (!opProfile.payout_enabled)          return json({ error: 'Payouts are not enabled for this operator' }, 400);
    if (opProfile.payout_hold)              return json({ error: 'Operator payout is on hold' }, 400);
    if (!opProfile.paystack_recipient_code) return json({ error: 'Operator has no registered bank account' }, 400);

    // ── Check for active disputes ──────────────────────────────────────────────
    const { data: activeDispute } = await supabase
      .from('disputes')
      .select('id')
      .eq('booking_id', payout.booking_id)
      .not('status', 'in', '("resolved","closed")')
      .limit(1)
      .maybeSingle();

    if (activeDispute) return json({ error: 'Cannot pay out while an active dispute exists' }, 400);

    // ── Calculate commission using live config + booking USD total ─────────────
    const grossAmount      = payout.gross_amount;
    const commConfig       = commRes.data as CommissionConfig | null;
    const totalUsd         = await getBookingTotalUsd(supabase, payout.booking_id);
    const commRate         = getCommissionRate(totalUsd, commConfig);
    const commissionAmount = calcCommission(grossAmount, commRate);
    const netAmount        = Math.round((grossAmount - commissionAmount) * 100) / 100;
    const commissionRate   = grossAmount > 0
      ? Math.round((commissionAmount / grossAmount) * 10000) / 10000
      : 0;
    const amountKobo       = Math.round(netAmount * 100);
    const transferRef      = `SCL-PAYOUT-${payoutId.slice(0, 8)}-${Date.now()}`.toUpperCase();

    // ── Execute Paystack transfer ──────────────────────────────────────────────
    const paystackRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source:    'balance',
        amount:    amountKobo,
        reference: transferRef,
        recipient: opProfile.paystack_recipient_code,
        reason:    `ShareConLoad payout — booking ${payout.booking_id.slice(0, 8).toUpperCase()}`,
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackData.status) {
      return json({ error: paystackData.message ?? 'Transfer failed' }, 502);
    }

    const transferCode = paystackData.data.transfer_code;

    // ── Update payout record ───────────────────────────────────────────────────
    const { error: updateErr } = await supabase
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

    if (updateErr) {
      // Paystack transfer already went through — log prominently for manual reconciliation.
      console.error('[trigger-payout] DB update failed after successful transfer:', updateErr.message);
      await supabase.from('audit_logs').insert({
        action:      'payout.db_sync_failed',
        target_type: 'payout',
        target_id:   payoutId,
        metadata:    {
          transfer_code: transferCode,
          reference:     transferRef,
          net_amount:    netAmount,
          error:         updateErr.message,
        },
      });
      return json({
        success:  true,
        transferCode,
        netAmount,
        warning: 'Transfer succeeded but payout record could not be updated — check audit logs',
      });
    }

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
  } catch (err) {
    console.error('[trigger-payout]', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
