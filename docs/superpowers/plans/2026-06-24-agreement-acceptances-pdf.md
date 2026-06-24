# Signed Service Agreement → PDF → Compliance Document — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an operator signs the Service Agreement, generate a PDF server-side, store it as a compliance document, record provenance in a new `agreement_acceptances` table, and make it downloadable from the operator and admin portals.

**Architecture:** Signing moves from a direct client `update` to a Supabase Edge Function that records the acceptance, renders the PDF (pdf-lib), uploads it to the private `compliance-documents` bucket, upserts a `service_agreement` compliance_documents row, and sets the operator-profile fields. The agreement clause text is extracted to a shared module so screen, snapshot, and PDF match. Downloads use the existing short-lived signed-URL pattern.

**Tech Stack:** Next.js (App Router, client components), TypeScript, Supabase (Postgres + RLS + Storage + Edge Functions/Deno), pdf-lib.

## Global Constraints

- Schema changes are idempotent SQL migrations in `supabase/migrations/`, named `YYYYMMDD_NN_short_description.sql`; commit immediately.
- All Paystack/secret-bearing and now agreement-PDF generation runs in Edge Functions; secret keys never in `NEXT_PUBLIC_*`. No `any`. Tailwind/DaisyUI; brand colors `#0b103a`/`#ff6a00`.
- Scope: **operators only**. The generated agreement doc is `status='approved'` (system-produced, not admin-reviewed) and is **not** an upload slot in the Documents step.
- Client sends the exact displayed agreement text to the function (WYSIWYG snapshot); the function stamps server-side `accepted_at`, `ip_address`, `user_agent`.
- Private `compliance-documents` bucket; downloads always via `createSignedUrl(path, ttl)`.
- Verification harness: `npx tsc --noEmit` (no client unit runner) + SQL checks for the migration; Edge Function verified by invocation. Each code task ends with a passing typecheck.

---

### Task 1: Migration — `agreement_acceptances` + `doc_type` CHECK

**Files:**
- Create: `supabase/migrations/20260624_73_agreement_acceptances.sql`

**Interfaces:**
- Produces: table `agreement_acceptances`; `compliance_documents.doc_type` now accepts `'service_agreement'`.

- [ ] **Step 1: Write the migration**

```sql
-- Append-only record of accepted operator service agreements (provenance + text snapshot).
create table if not exists public.agreement_acceptances (
  id                     uuid primary key default gen_random_uuid(),
  operator_profile_id    uuid not null references public.operator_profiles(id) on delete cascade,
  user_id                uuid not null,
  agreement_type         text not null default 'operator_service_agreement',
  version                text not null,
  accepted_at            timestamptz not null default now(),
  ip_address             text,
  user_agent             text,
  agreement_text         text not null,
  pdf_path               text,
  compliance_document_id uuid references public.compliance_documents(id) on delete set null,
  created_at             timestamptz not null default now()
);

create index if not exists idx_agreement_acceptances_operator
  on public.agreement_acceptances(operator_profile_id);

alter table public.agreement_acceptances enable row level security;

-- Operators read their own; admins read all. Writes happen only via the Edge Function
-- (service role bypasses RLS) — no insert/update/delete policy is granted to clients.
do $$ begin
  create policy "read own or admin agreement acceptances"
    on public.agreement_acceptances for select
    using (
      operator_profile_id in (
        select op.id from public.operator_profiles op
        join public.profiles p on p.id = op.profile_id
        where p.user_id = auth.uid()
      )
      or public.is_admin()
    );
exception when duplicate_object then null; end $$;

-- Allow 'service_agreement' as a compliance document type.
alter table public.compliance_documents drop constraint if exists compliance_documents_doc_type_check;
alter table public.compliance_documents add constraint compliance_documents_doc_type_check
  check (doc_type = any (array[
    'identity','business_registration','proof_of_warehouse_address','tax_clearance',
    'banking_confirmation','cargo_insurance','freight_forwarding_license','service_agreement'
  ]));
```

- [ ] **Step 2: Apply** via Supabase MCP `apply_migration` (project `fkhfbifgvebygafsewot`, name `agreement_acceptances`).

- [ ] **Step 3: Verify**

```sql
select to_regclass('public.agreement_acceptances') as tbl;
select count(*) as rls from pg_policies where tablename='agreement_acceptances';
-- doc_type check now allows service_agreement:
select pg_get_constraintdef(oid) from pg_constraint where conname='compliance_documents_doc_type_check';
```
Expected: `tbl` not null; `rls` = 1; the constraint definition includes `'service_agreement'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260624_73_agreement_acceptances.sql
git commit -m "feat: agreement_acceptances table + service_agreement doc_type"
```

---

### Task 2: Shared agreement content module

**Files:**
- Create: `services/agreementContent.ts`

**Interfaces:**
- Produces:
  - `OPERATOR_AGREEMENT_VERSION: string`
  - `OPERATOR_AGREEMENT_CLAUSES: { n: number; heading: string; body: string }[]`
  - `operatorAgreementPlainText(): string`

- [ ] **Step 1: Create the module** (clauses copied verbatim from the current agreement page)

```ts
// services/agreementContent.ts
// Single source of truth for the operator Service Agreement text. Rendered on the
// agreement page, sent to the generate-agreement-pdf Edge Function, and stored as the
// acceptance snapshot — keep all three identical.

export const OPERATOR_AGREEMENT_VERSION = '1.1';
export const OPERATOR_AGREEMENT_TITLE = 'ShareConLoad Operator Service Agreement';

export const OPERATOR_AGREEMENT_CLAUSES: { n: number; heading: string; body: string }[] = [
  { n: 1, heading: 'Platform Access', body: 'ShareConLoad grants you a non-exclusive, non-transferable licence to list container space on the platform and accept bookings from customers.' },
  { n: 2, heading: 'Fees & Commission', body: 'ShareConLoad charges a tiered platform commission on each gross payout, based on the total booking value (normalised to USD): 12% on bookings up to USD 500; 10% from USD 501 to 2,000; 8% from USD 2,001 to 5,000; and 6% above USD 5,000. The commission is deducted from the gross payout and the net amount is transferred to your registered bank account via Paystack. ShareConLoad may update these rates from time to time; the rates in effect at the time of each booking apply.' },
  { n: 3, heading: 'Payout Conditions', body: "Payouts are released subject to: (a) the corresponding customer payment being confirmed as 'paid'; (b) no active dispute on the booking; (c) payout account being verified and in good standing; and (d) expiry of the applicable refund window." },
  { n: 4, heading: 'Operator Obligations', body: 'You must: (a) list only container space you have lawful authority to offer; (b) maintain accurate capacity and departure information; (c) honour confirmed bookings; (d) comply with all applicable customs, import, and export regulations.' },
  { n: 5, heading: 'Prohibited Goods', body: 'You must not facilitate the shipment of prohibited, restricted, or hazardous goods as defined by applicable law and international shipping conventions.' },
  { n: 6, heading: 'Dispute Resolution', body: 'In the event of a dispute raised by a customer, ShareConLoad reserves the right to place a payout hold pending investigation. You agree to co-operate fully with any such review.' },
  { n: 7, heading: 'Termination', body: 'ShareConLoad may suspend or terminate your account for breach of this agreement, fraudulent activity, or repeated customer complaints, with or without notice.' },
  { n: 8, heading: 'Limitation of Liability', body: "ShareConLoad's liability to you in connection with any booking shall not exceed the net payout amount for that booking." },
  { n: 9, heading: 'Governing Law', body: 'This agreement is governed by the laws of the Republic of South Africa.' },
];

export function operatorAgreementPlainText(): string {
  const header = `${OPERATOR_AGREEMENT_TITLE}\nVersion ${OPERATOR_AGREEMENT_VERSION}\n\n`;
  const body = OPERATOR_AGREEMENT_CLAUSES
    .map((c) => `${c.n}. ${c.heading}. ${c.body}`)
    .join('\n\n');
  return header + body;
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 3: Commit**

```bash
git add services/agreementContent.ts
git commit -m "feat: shared operator service agreement content module"
```

---

### Task 3: Edge Function `generate-agreement-pdf`

**Files:**
- Create: `supabase/functions/generate-agreement-pdf/index.ts`

**Interfaces:**
- Consumes: tables from Task 1.
- Produces: HTTP endpoint accepting `{ version: string, agreementText: string }`, returning `{ success: true, compliance_document_id, pdf_path }` or `{ error }`.

- [ ] **Step 1: Write the function**

```ts
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
```

- [ ] **Step 2: Deploy** via Supabase MCP `deploy_edge_function` (project `fkhfbifgvebygafsewot`, name `generate-agreement-pdf`, `verify_jwt: true`, file `index.ts` with the code above).

- [ ] **Step 3: Commit the source**

```bash
git add supabase/functions/generate-agreement-pdf/index.ts
git commit -m "feat: generate-agreement-pdf Edge Function (PDF + acceptance record)"
```

---

### Task 4: Agreement page — render from shared clauses, sign via Edge Function, download

**Files:**
- Modify: `app/operator/compliance/agreement/page.tsx`

**Interfaces:**
- Consumes: `OPERATOR_AGREEMENT_VERSION`, `OPERATOR_AGREEMENT_CLAUSES`, `OPERATOR_AGREEMENT_TITLE`, `operatorAgreementPlainText` (Task 2); the `generate-agreement-pdf` function (Task 3).

- [ ] **Step 1: Import shared content + drop the local version const**

Add `import { OPERATOR_AGREEMENT_VERSION, OPERATOR_AGREEMENT_TITLE, OPERATOR_AGREEMENT_CLAUSES, operatorAgreementPlainText } from '@/services/agreementContent';`. Replace the file's `const AGREEMENT_VERSION = '1.0';`/`'1.1'` with `const AGREEMENT_VERSION = OPERATOR_AGREEMENT_VERSION;` (keeps the rest of the file referencing `AGREEMENT_VERSION` unchanged).

- [ ] **Step 2: Render the clause list from the shared array**

Replace the hardcoded `<h2>…</h2>` + nine `<p>…</p>` clause block (the agreement-text card body) with:

```tsx
        <h2 className="text-base font-bold text-gray-800 mb-3">{OPERATOR_AGREEMENT_TITLE}</h2>
        {OPERATOR_AGREEMENT_CLAUSES.map((c) => (
          <p key={c.n}><strong>{c.n}. {c.heading}.</strong> {c.body}</p>
        ))}
        <p className="text-xs text-gray-400 mt-4">Last updated: 2026-06-24 · Version {AGREEMENT_VERSION}</p>
```

- [ ] **Step 3: Sign via the Edge Function (replace the direct update in `handleSign`)**

Replace the `supabase.from('operator_profiles').update({...})` block in `handleSign` with:

```ts
    const { data, error: fnErr } = await supabase.functions.invoke('generate-agreement-pdf', {
      body: { version: AGREEMENT_VERSION, agreementText: operatorAgreementPlainText() },
    });
    if (fnErr || !data?.success) {
      let msg = data?.error ?? fnErr?.message ?? 'Could not record agreement.';
      const ctx = (fnErr as { context?: { json?: () => Promise<unknown> } } | null)?.context;
      if (!data?.error && ctx?.json) { try { const b = await ctx.json() as { error?: string }; if (b?.error) msg = b.error; } catch { /* */ } }
      setError(msg);
      setSigning(false);
      return;
    }
    setSignedAt(now);
    setPdfPath(data.pdf_path ?? null);
    if (userId) {
      await notify('operator.compliance_submitted', { recipientId: userId, legalName });
    }
    setSigning(false);
```
Add `const [pdfPath, setPdfPath] = useState<string | null>(null);` to the component state. (Remove the now-unused `now`/`updateErr` plumbing if the linter flags it; keep `const now = new Date().toISOString();` since `setSignedAt(now)` uses it.)

- [ ] **Step 4: Add the download button in the signed state**

In the `signedAt ?` branch (next to "View Compliance Status"), add a button that resolves a signed URL and opens it:

```tsx
            <button
              type="button"
              onClick={async () => {
                let path = pdfPath;
                if (!path) {
                  const { data: doc } = await supabase.from('compliance_documents')
                    .select('file_url')
                    .eq('doc_type', 'service_agreement')
                    .order('uploaded_at', { ascending: false }).limit(1).maybeSingle();
                  path = doc?.file_url ?? null;
                }
                if (!path) return;
                const { data } = await supabase.storage.from('compliance-documents').createSignedUrl(path, 60);
                if (data?.signedUrl) window.open(data.signedUrl, '_blank');
              }}
              className="btn flex-1 font-bold rounded-xl text-white hover:opacity-90"
              style={{ backgroundColor: '#ff6a00' }}
            >
              Download signed agreement (PDF)
            </button>
```

- [ ] **Step 5: On load, capture the existing PDF path** so the download button works after a refresh

In the load effect where `op` is fetched, also select `id` and then look up the agreement doc:

```ts
      const { data: agDoc } = await supabase.from('compliance_documents')
        .select('file_url').eq('operator_profile_id', op_id /* the operator_profiles.id */)
        .eq('doc_type', 'service_agreement').maybeSingle();
      if (agDoc?.file_url) setPdfPath(agDoc.file_url);
```
(Use the operator_profiles `id` already available in the load effect; the page fetches the operator profile to read `service_agreement_signed_at`/`legal_name` — add `id` to that select and reuse it.)

- [ ] **Step 6: Typecheck** — `npx tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 7: Commit**

```bash
git add "app/operator/compliance/agreement/page.tsx"
git commit -m "feat: operator agreement signs via Edge Function and offers PDF download"
```

---

### Task 5: Operator Documents step — read-only Service Agreement download entry

**Files:**
- Modify: `app/operator/compliance/documents/page.tsx`

**Interfaces:**
- Consumes: `compliance_documents` rows with `doc_type='service_agreement'`.

- [ ] **Step 1: Fetch the agreement doc + add a signed-URL opener**

The load effect already selects the operator's `compliance_documents` (`id, doc_type, file_url, status, …`). Add state `const [agreementUrlPath, setAgreementUrlPath] = useState<string | null>(null);` and, after building `recordMap`, set it from the service_agreement row:

```ts
      setAgreementUrlPath(recordMap['service_agreement']?.file_url ?? null);
```
Add an opener:
```ts
  async function openAgreement() {
    if (!agreementUrlPath) return;
    const { data } = await supabase.storage.from('compliance-documents').createSignedUrl(agreementUrlPath, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }
```

- [ ] **Step 2: Render a read-only Service Agreement card** (only when present), after the doc slots list:

```tsx
        {agreementUrlPath && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">Service Agreement</p>
              <p className="text-xs text-gray-400 mt-0.5">Your signed agreement, generated on acceptance.</p>
            </div>
            <button onClick={openAgreement}
              className="btn btn-sm rounded-xl text-xs font-semibold text-white" style={{ backgroundColor: '#0b103a' }}>
              Download PDF
            </button>
          </div>
        )}
```

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add "app/operator/compliance/documents/page.tsx"
git commit -m "feat: operator documents step shows downloadable service agreement"
```

---

### Task 6: Admin compliance — label the service-agreement document

**Files:**
- Modify: `app/admin/compliance/page.tsx`

**Interfaces:**
- Consumes: the `service_agreement` compliance_documents row (rendered by the existing list + `viewDoc` signed-URL opener).

- [ ] **Step 1: Add a friendly label**

The admin compliance page lists an operator's `compliance_documents` and already opens each via `viewDoc(file_url)` (signed URL). Find the doc-type→label lookup (e.g. `DOC_TYPE_LABELS` / a label map or inline switch) and add `service_agreement: 'Service Agreement'` so the auto-generated row shows a readable name. If the page renders `doc_type` raw with no map, add a small map covering at least `service_agreement`. Do not change the existing `viewDoc`/list logic — the row already renders and downloads.

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 3: Manual verification (dev)** — as admin, open an operator who has signed; confirm the "Service Agreement" document appears with a working "View document →" link. SQL spot-check:

```sql
select doc_type, status, file_url from compliance_documents where doc_type='service_agreement';
select operator_profile_id, version, ip_address is not null as has_ip, length(agreement_text) from agreement_acceptances;
```

- [ ] **Step 4: Commit**

```bash
git add "app/admin/compliance/page.tsx"
git commit -m "feat: admin compliance labels the service agreement document"
```

---

## Self-Review

**Spec coverage:**
- §2 `agreement_acceptances` + `doc_type` CHECK → Task 1 ✓ (RLS: operator-own + admin; no client write policy).
- §3 Edge Function (record, render PDF, upload, upsert compliance row, acceptance row, profile transition, idempotency) → Task 3 ✓.
- §4 Signing-flow change (invoke function, send text, error surfacing, download button) → Task 4 ✓.
- §5 Shared agreement text → Task 2 ✓; page renders from it → Task 4 Step 2 ✓.
- §6 Downloads: operator agreement page (Task 4) + Documents entry (Task 5); admin auto-renders + label (Task 6) ✓.
- §7 Edge cases: idempotency guard + upsert (Task 3) ✓.

**Placeholder scan:** All code steps contain concrete code. The migration `_NN` is the naming convention; resolved to `73` in Task 1's filename. No TBD/TODO.

**Type consistency:** `operatorAgreementPlainText()`, `OPERATOR_AGREEMENT_VERSION`, `OPERATOR_AGREEMENT_CLAUSES`, `OPERATOR_AGREEMENT_TITLE` (Task 2) are consumed verbatim in Task 4. Function request shape `{ version, agreementText }` and response `{ success, compliance_document_id, pdf_path }` (Task 3) match the client call + `data.pdf_path`/`data.error` reads (Task 4). `doc_type 'service_agreement'` consistent across Tasks 1, 3, 5, 6. Storage bucket `compliance-documents` and `createSignedUrl(path, 60)` consistent in Tasks 3–5.
