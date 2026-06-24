import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// Wrap text to a max width (in chars) for simple PDF layout.
function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    if (para === '') { out.push(''); continue; }
    let line = '';
    for (const word of para.split(' ')) {
      if ((line + word).length > max) { out.push(line.trimEnd()); line = ''; }
      line += word + ' ';
    }
    out.push(line.trimEnd());
  }
  return out;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const { version, agreementText } = await req.json();
    if (!version || !agreementText) return json({ error: 'version and agreementText are required' }, 400);

    // User-scoped client to identify the caller; service client for writes.
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Not authenticated' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: profile } = await admin.from('profiles')
      .select('id').eq('user_id', user.id).eq('role_type', 'operator').maybeSingle();
    if (!profile) return json({ error: 'Operator profile not found' }, 404);

    const { data: op } = await admin.from('operator_profiles')
      .select('id, legal_name, service_agreement_signed_at')
      .eq('profile_id', profile.id).maybeSingle();
    if (!op) return json({ error: 'Operator details not found' }, 404);

    // Idempotency — if already signed, return the existing agreement document.
    if (op.service_agreement_signed_at) {
      const { data: existing } = await admin.from('compliance_documents')
        .select('id, file_url').eq('operator_profile_id', op.id).eq('doc_type', 'service_agreement').maybeSingle();
      if (existing) return json({ success: true, compliance_document_id: existing.id, pdf_path: existing.file_url });
    }

    const acceptedAt = new Date();
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;
    const userAgent = req.headers.get('user-agent') ?? null;

    // ── Render PDF ──────────────────────────────────────────────────────────
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const PAGE_W = 595, PAGE_H = 842, MARGIN = 50, SIZE = 10, LH = 14;
    let page = pdf.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    const drawLine = (txt: string, useBold = false) => {
      if (y < MARGIN + LH) { page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN; }
      page.drawText(txt, { x: MARGIN, y, size: SIZE, font: useBold ? fontBold : font, color: rgb(0.1, 0.1, 0.1) });
      y -= LH;
    };

    for (const line of wrap(agreementText, 95)) drawLine(line);
    y -= LH;
    drawLine('ACCEPTANCE', true);
    drawLine(`Operator: ${op.legal_name ?? ''}`);
    drawLine(`Agreement version: ${version}`);
    drawLine(`Accepted at: ${acceptedAt.toISOString()}`);
    drawLine(`IP address: ${ip ?? 'unknown'}`);

    const pdfBytes = await pdf.save();

    // ── Upload ──────────────────────────────────────────────────────────────
    const pdfPath = `${op.id}/service_agreement_${version}_${acceptedAt.getTime()}.pdf`;
    const { error: upErr } = await admin.storage.from('compliance-documents')
      .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true });
    if (upErr) return json({ error: `Upload failed: ${upErr.message}` }, 502);

    // ── Upsert compliance_documents row ──────────────────────────────────────
    const { data: doc, error: docErr } = await admin.from('compliance_documents')
      .upsert({
        operator_profile_id: op.id,
        doc_type: 'service_agreement',
        file_url: pdfPath,
        status: 'approved',
        uploaded_at: acceptedAt.toISOString(),
      }, { onConflict: 'operator_profile_id,doc_type' })
      .select('id').single();
    if (docErr || !doc) return json({ error: docErr?.message ?? 'Failed to record document' }, 500);

    // ── Acceptance provenance ────────────────────────────────────────────────
    await admin.from('agreement_acceptances').insert({
      operator_profile_id: op.id,
      user_id: user.id,
      agreement_type: 'operator_service_agreement',
      version,
      accepted_at: acceptedAt.toISOString(),
      ip_address: ip,
      user_agent: userAgent,
      agreement_text: agreementText,
      pdf_path: pdfPath,
      compliance_document_id: doc.id,
    });

    // ── Operator profile transition (same as the old client flow) ────────────
    await admin.from('operator_profiles').update({
      service_agreement_signed_at: acceptedAt.toISOString(),
      service_agreement_version: version,
      status: 'pending_verification',
    }).eq('id', op.id);

    return json({ success: true, compliance_document_id: doc.id, pdf_path: pdfPath });
  } catch (err) {
    console.error('[generate-agreement-pdf]', err);
    return json({ error: (err as Error).message }, 500);
  }
});
