import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireUser } from '../_shared/auth.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

    const { reference } = await req.json();
    if (!reference) return json({ error: 'reference is required' }, 400);

    const { data: job } = await supabase
      .from('measurement_jobs')
      .select('id, shipper_profile_id')
      .eq('payment_ref', reference)
      .single();

    if (!job) return json({ error: 'Job not found for this reference' }, 404);

    // Verify caller is the shipper
    const { data: shipperProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', job.shipper_profile_id)
      .eq('user_id', auth.user.id)
      .single();

    if (!shipperProfile) return json({ error: 'Access denied' }, 403);

    // Verify with Paystack
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });
    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data?.status !== 'success') {
      return json({ error: 'Payment not successful', paystackStatus: paystackData.data?.status }, 400);
    }

    const jobId = paystackData.data.metadata?.job_id;
    if (!jobId) return json({ error: 'Missing job_id in payment metadata' }, 400);
    if (jobId !== job.id) return json({ error: 'Access denied' }, 403);

    // Update payment record
    await supabase
      .from('measurement_job_payments')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('paystack_ref', reference);

    // Update job status → paid
    await supabase
      .from('measurement_jobs')
      .update({ status: 'paid' })
      .eq('id', jobId);

    // Notify admin (user_id null = broadcast to admins)
    await supabase.from('notifications').insert({
      user_id: null,
      type: 'measurement_job_paid',
      title: 'New measurement job ready for assignment',
      body: `Job ${jobId.slice(0, 8).toUpperCase()} has been paid. Assign an agent.`,
      metadata: { job_id: jobId },
    });

    await supabase.from('audit_logs').insert({
      action: 'measurement_job.payment_verified',
      target_type: 'measurement_job',
      target_id: jobId,
      metadata: { reference },
    });

    return json({ success: true, jobId });
  } catch (err) {
    console.error('[verify-measurement-payment]', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
