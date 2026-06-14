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

    const { jobId, callbackUrl } = await req.json();
    if (!jobId) return json({ error: 'jobId is required' }, 400);

    // Verify caller owns this job
    const authHeader = req.headers.get('authorization') ?? '';
    const { data: { user: caller } } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (!caller) return json({ error: 'Unauthorized' }, 401);

    const { data: job, error: jErr } = await supabase
      .from('measurement_jobs')
      .select('id, quoted_fee, status, shipper_profile_id')
      .eq('id', jobId)
      .single();

    if (jErr || !job) return json({ error: 'Job not found' }, 404);
    if (job.status !== 'pending_payment') return json({ error: 'Job is not awaiting payment' }, 400);

    // Verify caller is the shipper
    const { data: shipperProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', job.shipper_profile_id)
      .eq('user_id', caller.id)
      .single();

    if (!shipperProfile) return json({ error: 'Access denied' }, 403);

    const email = caller.email ?? '';
    const reference = `SCL-MSR-${jobId.slice(0, 8)}-${Date.now()}`.toUpperCase();

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(job.quoted_fee * 100),
        currency: 'ZAR',
        reference,
        callback_url: callbackUrl ?? `${Deno.env.get('SITE_URL') ?? ''}/measurement-service/${jobId}?verify=1`,
        metadata: { job_id: jobId, type: 'measurement_job' },
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackData.status) {
      return json({ error: paystackData.message ?? 'Paystack initialization failed' }, 502);
    }

    // Store reference + create payment record
    await supabase
      .from('measurement_jobs')
      .update({ payment_ref: reference })
      .eq('id', jobId);

    await supabase.from('measurement_job_payments').upsert({
      job_id: jobId,
      paystack_ref: reference,
      amount: job.quoted_fee,
      status: 'pending',
    }, { onConflict: 'job_id' });

    await supabase.from('audit_logs').insert({
      action: 'measurement_job.payment_initialized',
      target_type: 'measurement_job',
      target_id: jobId,
      metadata: { reference, amount: job.quoted_fee },
    });

    return json({ authorization_url: paystackData.data.authorization_url, reference });
  } catch (err) {
    console.error('[initialize-measurement-payment]', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
