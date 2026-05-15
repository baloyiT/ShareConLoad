import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';
    const { accountNumber, bankCode } = await req.json();

    if (!accountNumber || !bankCode) {
      return json({ error: 'accountNumber and bankCode are required' }, 400);
    }

    const url = `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`;

    const res  = await fetch(url, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });
    const data = await res.json();

    if (!data.status) {
      return json({ error: data.message ?? 'Could not resolve account. Check the number and bank.' }, 422);
    }

    return json({
      accountName:   data.data.account_name,
      accountNumber: data.data.account_number,
    });
  } catch (err) {
    console.error('[resolve-bank-account]', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
