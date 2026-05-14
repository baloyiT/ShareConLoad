import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLATFORM_COMMISSION = 0.05;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

    const { payoutId } = await req.json();
    if (!payoutId) return json({ error: 'payoutId is required' }, 400);

    // ── Load payout record ─────────────────────────────────────────────────────
    const { data: payout, error: pErr } = await supabase
      .from('payouts')
      .select('id, booking_id, operator_id, gross_amount, status, eligible_after')
      .eq('id', payoutId)
      .single();

    if (pErr || !payout) return json({ error: 'Payout record not found' }, 404);
    if (payout.status !== 'pending') return json({ error: `Payout is already ${payout.status}` }, 400);

    // ── 48h refund window check ────────────────────────────────────────────────
    if (payout.eligible_after && new Date(payout.eligible_after) > new Date()) {
      const hoursLeft = Math.ceil(
        (new Date(payout.eligible_after).getTime() - Date.now()) / (1000 * 60 * 60)
      );
      return json({ error: `Still in refund window — eligible in ${hoursLeft}h` }, 400);
    }

    // ── Load operator profile ──────────────────────────────────────────────────
    // payouts.operator_id = profiles.id; operator_profiles links via profile_id
    const { data: opProfile, error: opErr } = await supabase
      .from('operator_profiles')
      .select('paystack_recipient_code, payout_enabled, payout_hold')
      .eq('profile_id', payout.operator_id)
      .single();

    if (opErr || !opProfile) return json({ error: 'Operator profile not found' }, 404);

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

    // ── Calculate net amount ───────────────────────────────────────────────────
    const grossAmount     = payout.gross_amount;
    const commissionAmount = Math.round(grossAmount * PLATFORM_COMMISSION * 100) / 100;
    const netAmount       = Math.round((grossAmount - commissionAmount) * 100) / 100;
    const amountKobo      = Math.round(netAmount * 100);
    const transferRef     = `SCL-PAYOUT-${payoutId.slice(0, 8)}-${Date.now()}`.toUpperCase();

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
    await supabase
      .from('payouts')
      .update({
        status:                 'processing',
        net_amount:             netAmount,
        commission_amount:      commissionAmount,
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
