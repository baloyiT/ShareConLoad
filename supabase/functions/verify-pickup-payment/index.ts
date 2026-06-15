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

    const { reference } = await req.json();
    if (!reference) return json({ error: 'reference is required' }, 400);

    // Verify payment with Paystack server-side
    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}` },
      },
    );
    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data?.status !== 'success') {
      return json({ error: 'Payment not successful' }, 400);
    }

    const { data: job } = await supabase
      .from('pickup_jobs')
      .select('id, transporter_profile_id')
      .eq('payment_ref', reference)
      .single();

    if (!job) return json({ error: 'Job not found for this reference' }, 404);

    // Mark payment as paid
    await supabase
      .from('pickup_job_payments')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('job_id', job.id);

    // Advance job to assigned
    await supabase
      .from('pickup_jobs')
      .update({ status: 'assigned' })
      .eq('id', job.id);

    // Notify transporter if one is already assigned
    if (job.transporter_profile_id) {
      const { data: tp } = await supabase
        .from('transporter_profiles')
        .select('profile_id')
        .eq('id', job.transporter_profile_id)
        .single();

      if (tp) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('id', tp.profile_id)
          .single();

        if (profile) {
          await supabase.from('notifications').insert({
            user_id: profile.user_id,
            type: 'pickup_job_assigned',
            title: 'New pickup job assigned',
            body: 'A pickup job has been assigned to you. Check your jobs.',
            metadata: { job_id: job.id },
          });
        }
      }
    }

    // Admin-visible notification
    await supabase.from('notifications').insert({
      user_id: null,
      type: 'pickup_payment_received',
      title: 'Pickup payment received',
      body: `Payment confirmed for pickup job. Reference: ${reference}`,
      metadata: { job_id: job.id, reference },
    });

    await supabase.from('audit_logs').insert({
      action: 'pickup_job.payment_verified',
      target_type: 'pickup_job',
      target_id: job.id,
      metadata: { reference },
    });

    return json({ success: true });
  } catch (err) {
    console.error('[verify-pickup-payment]', err);
    return json({ error: 'Internal server error' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
