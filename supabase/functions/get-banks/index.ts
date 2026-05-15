import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Countries where Paystack supports automated bank payouts
const PAYSTACK_COUNTRIES: Record<string, { paystackCountry: string; currency: string; recipientType: string }> = {
  'South Africa': { paystackCountry: 'south africa', currency: 'ZAR', recipientType: 'basa'   },
  'Nigeria':      { paystackCountry: 'nigeria',      currency: 'NGN', recipientType: 'nuban'  },
  'Ghana':        { paystackCountry: 'ghana',        currency: 'GHS', recipientType: 'ghipss' },
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';
    const { country } = await req.json();

    if (!country) return json({ error: 'country is required' }, 400);

    const config = PAYSTACK_COUNTRIES[country];

    // Country not supported by Paystack — caller should show manual fields
    if (!config) return json({ manual: true, currency: null, recipientType: null });

    const url = `https://api.paystack.co/bank?country=${encodeURIComponent(config.paystackCountry)}&use_cursor=false&perPage=100`;
    const res  = await fetch(url, { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } });
    const data = await res.json();

    if (!data.status) {
      return json({ error: data.message ?? 'Could not fetch bank list.' }, 502);
    }

    const banks = (data.data as Array<{ name: string; code: string }>).map((b) => ({
      name: b.name,
      code: b.code,
    }));

    return json({ banks, currency: config.currency, recipientType: config.recipientType });
  } catch (err) {
    console.error('[get-banks]', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
