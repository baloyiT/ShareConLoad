import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TRANSPORTER_SHARE = 0.85;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

    const { jobId } = await req.json();
    if (!jobId) return json({ error: 'jobId is required' }, 400);

    const { data: job } = await supabase
      .from('pickup_jobs')
      .select('id, status, quoted_fee, transporter_profile_id')
      .eq('id', jobId)
      .single();

    if (!job) return json({ error: 'Job not found' }, 404);
    if (job.status !== 'delivered') {
      return json({ error: `Job must be delivered (current: ${job.status})` }, 400);
    }
    if (!job.transporter_profile_id) {
      return json({ error: 'No transporter assigned' }, 400);
    }

    // Enforce payout eligibility rules
    const { data: tp } = await supabase
      .from('transporter_profiles')
      .select('payout_enabled, payout_hold, paystack_recipient_code')
      .eq('id', job.transporter_profile_id)
      .single();

    if (!tp) return json({ error: 'Transporter profile not found' }, 404);
    if (!tp.payout_enabled) return json({ error: 'Payout not enabled for this transporter' }, 400);
    if (tp.payout_hold) return json({ error: 'Payout is on hold for this transporter' }, 400);
    if (!tp.paystack_recipient_code) {
      return json({ error: 'Transporter has no Paystack recipient code' }, 400);
    }

    const netAmount = job.quoted_fee * TRANSPORTER_SHARE;
    const amountKobo = Math.round(netAmount * 100);
    const transferRef = `SCL-TPAY-${jobId.slice(0, 8).toUpperCase()}-${Date.now()}`;

    const paystackRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: amountKobo,
        recipient: tp.paystack_recipient_code,
        reason: `ShareConLoad pickup job payout — ${jobId.slice(0, 8)}`,
        reference: transferRef,
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackData.status) {
      return json({ error: paystackData.message ?? 'Transfer failed' }, 502);
    }

    await supabase
      .from('pickup_jobs')
      .update({ payout_released_at: new Date().toISOString() })
      .eq('id', jobId);

    await supabase.from('audit_logs').insert({
      action: 'transporter.payout_triggered',
      target_type: 'pickup_job',
      target_id: jobId,
      metadata: { transfer_ref: transferRef, amount: netAmount, gross: job.quoted_fee },
    });

    return json({ success: true, transfer_ref: transferRef, amount: netAmount });
  } catch (err) {
    console.error('[trigger-transporter-payout]', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
