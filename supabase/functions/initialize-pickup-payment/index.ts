import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { jobId, callbackUrl } = await req.json();
    if (!jobId || !callbackUrl) {
      return json({ error: 'jobId and callbackUrl are required' }, 400);
    }

    const { data: job } = await supabase
      .from('pickup_jobs')
      .select('id, quoted_fee, status, shipper_profile_id')
      .eq('id', jobId)
      .single();

    if (!job) return json({ error: 'Job not found' }, 404);
    if (job.status !== 'pending_payment') {
      return json({ error: `Job is not in pending_payment state (current: ${job.status})` }, 400);
    }

    // Verify caller is the shipper who owns this job
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('id', job.shipper_profile_id)
      .single();

    if (!profile) return json({ error: 'Forbidden' }, 403);

    const { data: { user: fullUser } } = await supabase.auth.admin.getUserById(user.id);
    const email = fullUser?.email ?? 'noreply@shareconload.com';

    const reference = `SCL-PKP-${jobId.slice(0, 8).toUpperCase()}-${Date.now()}`;
    const amountKobo = Math.round(job.quoted_fee * 100);

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        currency: 'ZAR',
        reference,
        callback_url: callbackUrl,
        metadata: { job_id: jobId, service: 'pickup' },
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackData.status || !paystackData.data?.authorization_url) {
      return json({ error: paystackData.message ?? 'Paystack initialization failed' }, 502);
    }

    await supabase
      .from('pickup_jobs')
      .update({ payment_ref: reference })
      .eq('id', jobId);

    await supabase.from('pickup_job_payments').upsert({
      job_id: jobId,
      paystack_ref: reference,
      amount: job.quoted_fee,
      status: 'pending',
    }, { onConflict: 'job_id' });

    await supabase.from('audit_logs').insert({
      action: 'pickup_job.payment_initialized',
      target_type: 'pickup_job',
      target_id: jobId,
      metadata: { reference, amount: job.quoted_fee },
    });

    return json({ authorization_url: paystackData.data.authorization_url, reference });
  } catch (err) {
    console.error('[initialize-pickup-payment]', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
