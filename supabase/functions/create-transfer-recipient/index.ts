import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PAYSTACK_CONFIG: Record<string, { currency: string; recipientType: string }> = {
  'South Africa': { currency: 'ZAR', recipientType: 'basa'   },
  'Nigeria':      { currency: 'NGN', recipientType: 'nuban'  },
  'Ghana':        { currency: 'GHS', recipientType: 'ghipss' },
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? '';

    const { operatorProfileId, bankAccountName, bankAccountNumber, bankCode, bankCountry, swiftCode, bankName } = await req.json();

    if (!operatorProfileId || !bankAccountName || !bankCountry) {
      return json({ error: 'operatorProfileId, bankAccountName, and bankCountry are required' }, 400);
    }

    const paystackConfig = PAYSTACK_CONFIG[bankCountry];
    const isManual = !paystackConfig;

    let recipientCode: string | null = null;

    if (!isManual) {
      // ── Paystack-supported country: create transfer recipient ──────────────────
      if (!bankAccountNumber || !bankCode) {
        return json({ error: 'bankAccountNumber and bankCode are required for this country' }, 400);
      }

      const paystackRes = await fetch('https://api.paystack.co/transferrecipient', {
        method: 'POST',
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type:           paystackConfig.recipientType,
          name:           bankAccountName,
          account_number: bankAccountNumber,
          bank_code:      bankCode,
          currency:       paystackConfig.currency,
        }),
      });

      const paystackData = await paystackRes.json();
      if (!paystackData.status) {
        return json({ error: paystackData.message ?? 'Paystack recipient creation failed' }, 502);
      }

      recipientCode = paystackData.data.recipient_code;
    }

    // ── Save to operator_profiles ──────────────────────────────────────────────
    const { error: updateErr } = await supabase
      .from('operator_profiles')
      .update({
        bank_account_name:       bankAccountName,
        bank_account_number:     bankAccountNumber ?? null,
        bank_name:               bankName ?? null,
        bank_code:               bankCode ?? null,
        bank_country:            bankCountry,
        bank_swift_code:         swiftCode ?? null,
        payout_method:           isManual ? 'manual' : 'paystack',
        paystack_recipient_code: recipientCode,
      })
      .eq('id', operatorProfileId);

    if (updateErr) return json({ error: updateErr.message }, 500);

    // ── Audit log ──────────────────────────────────────────────────────────────
    await supabase.from('audit_logs').insert({
      action:      'operator.bank_account_registered',
      target_type: 'operator_profile',
      target_id:   operatorProfileId,
      metadata:    { bank_country: bankCountry, payout_method: isManual ? 'manual' : 'paystack', recipient_code: recipientCode },
    });

    return json({ success: true, recipientCode, manual: isManual });
  } catch (err) {
    console.error('[create-transfer-recipient]', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
