import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
    if (!RESEND_KEY) {
      console.warn('[send-email] RESEND_API_KEY not set — skipping email');
      return json({ success: false, skipped: true });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')              ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { recipientId, to: directTo, subject, html, text } = await req.json();
    if (!subject || !html || (!recipientId && !directTo)) {
      return json({ error: 'subject, html, and either recipientId or to are required' }, 400);
    }

    let to: string;
    if (directTo) {
      to = directTo;
    } else {
      // Resolve email address from user ID using service role
      const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(recipientId);
      if (userErr || !userData?.user?.email) {
        console.error('[send-email] Could not resolve email for', recipientId, userErr?.message);
        return json({ error: 'Could not resolve recipient email' }, 404);
      }
      to = userData.user.email;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    'ShareConLoad <support@shareconload.com>',
        to:      [to],
        subject,
        html,
        ...(text ? { text } : {}),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[send-email] Resend error:', JSON.stringify(data));
      return json({ error: data.message ?? 'Failed to send email' }, 502);
    }

    console.info('[send-email] Sent to', to, '| id:', data.id);
    return json({ success: true, id: data.id });

  } catch (err) {
    console.error('[send-email]', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
