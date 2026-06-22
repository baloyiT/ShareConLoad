import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Finalizes a Paystack transfer that was initiated while "OTP for transfers" is enabled.
// Calls POST /transfer/finalize_transfer with the transfer_code + OTP the operator received.
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';
    const { transferCode, otp } = await req.json();

    if (!transferCode) return json({ error: 'transferCode is required' }, 400);
    if (!otp)          return json({ error: 'otp is required' }, 400);

    const res = await fetch('https://api.paystack.co/transfer/finalize_transfer', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transfer_code: transferCode, otp: String(otp).trim() }),
    });

    const data = await res.json();
    if (!data.status) return json({ error: data.message ?? 'Finalize failed' }, 502);

    return json({ success: true, status: data.data?.status, transfer: data.data });
  } catch (err) {
    console.error('[finalize-transfer]', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
