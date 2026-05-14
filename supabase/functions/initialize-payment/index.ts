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

    const { paymentId, bookingId, callbackUrl } = await req.json();
    if (!paymentId || !bookingId) {
      return json({ error: 'paymentId and bookingId are required' }, 400);
    }

    // ── Load payment record ────────────────────────────────────────────────────
    const { data: payment, error: pErr } = await supabase
      .from('payments')
      .select('id, stage, amount, status, booking_id')
      .eq('id', paymentId)
      .eq('booking_id', bookingId)
      .single();

    if (pErr || !payment) return json({ error: 'Payment record not found' }, 404);
    if (payment.status === 'paid') return json({ error: 'Payment already completed' }, 400);

    // ── Load booking + customer email ──────────────────────────────────────────
    // bookings.customer_id stores auth.uid() directly (no FK to profiles)
    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .select('customer_id')
      .eq('id', bookingId)
      .single();

    if (bErr || !booking) return json({ error: 'Booking not found' }, 404);

    // Verify the caller owns this booking (customer_id = auth.uid())
    const authHeader = req.headers.get('authorization') ?? '';
    const { data: { user: caller } } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (!caller || caller.id !== booking.customer_id) {
      return json({ error: 'Access denied' }, 403);
    }

    const userId = booking.customer_id;

    const { data: authData, error: aErr } = await supabase.auth.admin.getUserById(userId);
    if (aErr || !authData?.user) return json({ error: 'Could not load customer email' }, 404);

    const email = authData.user.email ?? '';

    // ── Generate unique reference ──────────────────────────────────────────────
    const reference = `SCL-${bookingId.slice(0, 8)}-${payment.stage}-${Date.now()}`.toUpperCase();

    // ── Initialize Paystack transaction ────────────────────────────────────────
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount:       Math.round(payment.amount * 100), // ZAR cents
        currency:     'ZAR',
        reference,
        callback_url: callbackUrl ?? `${Deno.env.get('SITE_URL') ?? ''}/payments/callback`,
        metadata: {
          booking_id: bookingId,
          payment_id: paymentId,
          stage:      payment.stage,
        },
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackData.status) {
      return json({ error: paystackData.message ?? 'Paystack initialization failed' }, 502);
    }

    // ── Store reference on payment record ──────────────────────────────────────
    await supabase
      .from('payments')
      .update({ paystack_reference: reference })
      .eq('id', paymentId);

    // ── Audit log ──────────────────────────────────────────────────────────────
    await supabase.from('audit_logs').insert({
      action:      'payment.initialized',
      target_type: 'payment',
      target_id:   paymentId,
      metadata:    { stage: payment.stage, reference, amount: payment.amount },
    });

    return json({ authorization_url: paystackData.data.authorization_url, reference });
  } catch (err) {
    console.error('[initialize-payment]', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
