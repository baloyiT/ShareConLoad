import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

    const { paymentId, adminProfileId } = await req.json();
    if (!paymentId) return json({ error: 'paymentId is required' }, 400);

    // ── Load payment record ────────────────────────────────────────────────────
    const { data: payment, error: pErr } = await supabase
      .from('payments')
      .select('id, status, amount, paystack_reference, booking_id, stage')
      .eq('id', paymentId)
      .single();

    if (pErr || !payment)           return json({ error: 'Payment not found' }, 404);
    if (payment.status !== 'paid')  return json({ error: 'Only paid payments can be refunded' }, 400);
    if (!payment.paystack_reference) return json({ error: 'No Paystack reference on this payment' }, 400);

    // ── Call Paystack refund API ───────────────────────────────────────────────
    const paystackRes = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: payment.paystack_reference,
        amount:      Math.round(payment.amount * 100), // full refund in kobo/cents
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackData.status) {
      return json({ error: paystackData.message ?? 'Refund failed' }, 502);
    }

    // ── Mark payment as refunded ───────────────────────────────────────────────
    await supabase
      .from('payments')
      .update({ status: 'refunded', refunded_at: new Date().toISOString() })
      .eq('id', paymentId);

    // ── Audit log ──────────────────────────────────────────────────────────────
    await supabase.from('audit_logs').insert({
      action:      'payment.refunded',
      target_type: 'payment',
      target_id:   paymentId,
      actor_id:    adminProfileId ?? null,
      metadata:    {
        stage:     payment.stage,
        amount:    payment.amount,
        reference: payment.paystack_reference,
        booking_id: payment.booking_id,
      },
    });

    return json({ success: true });
  } catch (err) {
    console.error('[process-refund]', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
