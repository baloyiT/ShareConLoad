import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AGENT_SHARE = 0.80;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

    const { jobId } = await req.json();
    if (!jobId) return json({ error: 'jobId is required' }, 400);

    // Load job
    const { data: job, error: jErr } = await supabase
      .from('measurement_jobs')
      .select('id, status, quoted_fee, measurement_agent_profile_id')
      .eq('id', jobId)
      .single();

    if (jErr || !job) return json({ error: 'Job not found' }, 404);
    if (job.status !== 'completed') return json({ error: 'Job is not completed' }, 400);
    if (!job.measurement_agent_profile_id) return json({ error: 'No agent assigned' }, 400);

    // Load agent profile
    const { data: agentProfile, error: aErr } = await supabase
      .from('measurement_agent_profiles')
      .select('paystack_recipient_code, payout_enabled, payout_hold')
      .eq('id', job.measurement_agent_profile_id)
      .single();

    if (aErr || !agentProfile) return json({ error: 'Agent profile not found' }, 404);
    if (!agentProfile.payout_enabled) return json({ error: 'Payouts not enabled for this agent' }, 400);
    if (agentProfile.payout_hold) return json({ error: 'Agent payout is on hold' }, 400);
    if (!agentProfile.paystack_recipient_code) return json({ error: 'Agent has no registered bank account' }, 400);

    const grossAmount = job.quoted_fee;
    const netAmount = Math.round(grossAmount * AGENT_SHARE * 100) / 100;
    const amountKobo = Math.round(netAmount * 100);
    const transferRef = `SCL-AGPAY-${jobId.slice(0, 8)}-${Date.now()}`.toUpperCase();

    const paystackRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: amountKobo,
        reference: transferRef,
        recipient: agentProfile.paystack_recipient_code,
        reason: `ShareConLoad measurement job payout — ${jobId.slice(0, 8).toUpperCase()}`,
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackData.status) {
      return json({ error: paystackData.message ?? 'Transfer failed' }, 502);
    }

    await supabase.from('audit_logs').insert({
      action: 'measurement_agent.payout_triggered',
      target_type: 'measurement_job',
      target_id: jobId,
      metadata: {
        gross_amount: grossAmount,
        net_amount: netAmount,
        transfer_ref: transferRef,
        transfer_code: paystackData.data.transfer_code,
      },
    });

    return json({ success: true, netAmount, transferCode: paystackData.data.transfer_code });
  } catch (err) {
    console.error('[trigger-measurement-agent-payout]', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
