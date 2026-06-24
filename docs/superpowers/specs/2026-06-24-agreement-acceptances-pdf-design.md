# Signed Service Agreement → PDF → Compliance Document — Design Spec

**Date:** 2026-06-24
**Status:** Approved for planning
**Author:** Justice Baloyi (with Claude)

---

## 1. Overview

Today, operator acceptance of the Service Agreement is recorded only as two columns on
`operator_profiles` (`service_agreement_signed_at`, `service_agreement_version`). There is no
stored copy of what was agreed and no provenance (who/when/where).

This feature, **for operators only**, makes signing produce a durable, downloadable record:
1. An append-only `agreement_acceptances` row capturing the full text snapshot + provenance.
2. A generated **PDF** of the signed agreement, stored in the `compliance-documents` bucket.
3. A `compliance_documents` row (new `doc_type 'service_agreement'`, `status 'approved'`) so it
   surfaces and downloads through the existing compliance UIs.
4. Download from the **operator portal** and the **admin portal**.

Generation is **server-side in a Supabase Edge Function** (authoritative, tamper-resistant).

### Non-goals
- Measurement-agent agreements (they also sign one) — separate follow-up.
- Admin review of the generated PDF — it is system-produced and auto-`approved`.
- E-signature/cryptographic signing — out of scope; provenance is metadata + text snapshot.
- Re-generating PDFs for already-signed operators (none exist after the recent DB reset).

---

## 2. Data Model

### New table `agreement_acceptances` (append-only)
Migration: `supabase/migrations/20260624_NN_agreement_acceptances.sql` (idempotent).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK default `gen_random_uuid()` | |
| `operator_profile_id` | `uuid` NOT NULL → `operator_profiles(id)` on delete cascade | |
| `user_id` | `uuid` NOT NULL | auth.users id of signer |
| `agreement_type` | `text` NOT NULL default `'operator_service_agreement'` | future-proofs other agreement types |
| `version` | `text` NOT NULL | e.g. `'1.1'` |
| `accepted_at` | `timestamptz` NOT NULL default `now()` | server timestamp |
| `ip_address` | `text` | from request headers |
| `user_agent` | `text` | from request headers |
| `agreement_text` | `text` NOT NULL | full snapshot of the text shown to the operator |
| `pdf_path` | `text` | storage path in `compliance-documents` |
| `compliance_document_id` | `uuid` → `compliance_documents(id)` on delete set null | link to the doc row |
| `created_at` | `timestamptz` NOT NULL default `now()` | |

**RLS:**
- `select`: operator can read rows where the `operator_profile_id` belongs to their own profile; admins can read all (`is_admin()`).
- `insert`: none for `anon`/`authenticated` from the browser — rows are written **only** by the Edge Function (service role bypasses RLS). No client insert policy.

### `compliance_documents.doc_type` CHECK
Extend the existing CHECK list to add `'service_agreement'`:
```
doc_type in ('identity','business_registration','proof_of_warehouse_address','tax_clearance',
             'banking_confirmation','cargo_insurance','freight_forwarding_license','service_agreement')
```
Migration uses `drop constraint if exists` + re-add (idempotent). `status` domain is unchanged
(`under_review|approved|rejected`); the agreement row is inserted `approved`.

`operator_profiles` columns are unchanged (still set on signing).

---

## 3. Edge Function `generate-agreement-pdf`

New: `supabase/functions/generate-agreement-pdf/index.ts` (Deno). `verify_jwt` enabled.

**Request (POST):** `{ version: string, agreementText: string }` (the exact text the operator saw).
**Auth:** reads the caller's JWT → `user`. Captures `ip_address` (`x-forwarded-for`) and
`user_agent` from request headers, and a server `accepted_at`.

**Steps (service-role client):**
1. Resolve the operator: `profiles` (role_type `operator`, user_id) → `operator_profiles` (id, legal_name).
   Reject (404) if not found.
2. Idempotency guard: if `operator_profiles.service_agreement_signed_at` is already set, return the
   existing record (do not double-generate). *(Fresh signers only in practice.)*
3. Render the PDF with **pdf-lib** (`https://esm.sh/pdf-lib`): title, the agreement text (wrapped/
   paginated), and a signature block — operator legal name, version, `accepted_at`, IP.
4. Upload to `compliance-documents` bucket at
   `<operator_profile_id>/service_agreement_<version>_<epoch>.pdf` (`contentType application/pdf`).
5. **Upsert** the `compliance_documents` row (`on conflict (operator_profile_id, doc_type)`):
   `operator_profile_id`, `doc_type 'service_agreement'`, `file_url <path>`, `status 'approved'`,
   `uploaded_at now()`. Capture its `id`. (Upsert so a retry/re-sign replaces rather than duplicates.)
6. Insert `agreement_acceptances` row with the snapshot + provenance + `pdf_path` + `compliance_document_id`.
7. Update `operator_profiles`: `service_agreement_signed_at`, `service_agreement_version`,
   `status 'pending_verification'` (same transition as the current client code).
8. Return `{ success: true, compliance_document_id, pdf_path }`.

**Failure handling:** if any step after upload fails, return an error; the client shows it and the
operator can retry (the idempotency guard + `on conflict (operator_profile_id, doc_type)` upsert on
the compliance row prevent duplicates). Standard CORS + JSON helpers like the other functions.

**Deploy:** committed under `supabase/functions/generate-agreement-pdf/` and deployed; no new secrets
(uses `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).

---

## 4. Frontend — signing flow change

`app/operator/compliance/agreement/page.tsx`:
- `handleSign` no longer updates `operator_profiles` directly. Instead it builds the **agreement text
  string** from the same content rendered on the page (see §5) and calls
  `supabase.functions.invoke('generate-agreement-pdf', { body: { version: AGREEMENT_VERSION, agreementText } })`.
- On success: set `signedAt`, fire the existing `operator.compliance_submitted` notification, and show
  a **"Download signed agreement (PDF)"** button (resolves a signed URL via
  `supabase.storage.from('compliance-documents').createSignedUrl(pdf_path, 60)` then opens it).
- On error: surface the function's error message (read `error.context.json()` — same pattern fixed in
  the admin payouts page) instead of a generic failure.

---

## 5. Agreement text — single source

To keep the on-screen agreement, the snapshot, and the PDF identical, extract the clause text into a
shared constant `services/agreementContent.ts`:
```ts
export const OPERATOR_AGREEMENT_VERSION = '1.1';
export const OPERATOR_AGREEMENT_CLAUSES: { heading: string; body: string }[] = [ … ];
export function operatorAgreementPlainText(): string; // clauses joined for snapshot/PDF
```
The agreement page renders from `OPERATOR_AGREEMENT_CLAUSES` (replacing the inline JSX) and sends
`operatorAgreementPlainText()` as `agreementText`. The Edge Function receives that text verbatim and
uses it for both the snapshot and the PDF body (WYSIWYG; client-sent text is accepted per decision).

---

## 6. Downloads

- **Operator portal:**
  - Agreement page: "Download signed agreement (PDF)" button (signed URL), shown when signed.
  - Documents step (`app/operator/compliance/documents/page.tsx`): a read-only **"Service Agreement"**
    card listing the generated PDF with a Download link when an `service_agreement` compliance_documents
    row exists. It is NOT an upload slot.
- **Admin portal:** `app/admin/compliance/page.tsx` already lists an operator's `compliance_documents`
  and renders "View document →" via `createSignedUrl`. The `service_agreement` row appears there
  automatically; confirm it displays (it will, since it's a standard compliance_documents row).

---

## 7. Edge Cases

- **Retry after partial failure:** idempotency guard (step 2) + `on conflict (operator_profile_id,
  doc_type)` upsert keep a single agreement doc per operator.
- **Re-sign / new version:** out of scope now; the upsert would replace the compliance doc and a new
  `agreement_acceptances` row would be appended (history preserved).
- **Bucket RLS:** `compliance-documents` is private; downloads always go through short-lived signed URLs
  (existing pattern). The Edge Function uploads with the service role.

---

## 8. Testing

- **Migration:** apply; confirm `agreement_acceptances` exists with RLS; `service_agreement` accepted
  by the `doc_type` CHECK; a non-service-agreement bad value still rejected.
- **Edge Function:** invoke as an operator → returns success; verify a PDF exists in the bucket, a
  `compliance_documents` row (`doc_type service_agreement`, `status approved`), an
  `agreement_acceptances` row with text + ip + user_agent, and `operator_profiles` updated.
- **Operator UI:** sign → download button works (PDF opens); Documents step shows the read-only entry.
- **Admin UI:** the agreement PDF is viewable under the operator's compliance documents.
- **RLS:** an operator cannot read another operator's `agreement_acceptances`; admin can.
- Live E2E with a provisioned operator where practical.

---

## 9. Files Touched

- `supabase/migrations/20260624_NN_agreement_acceptances.sql` (new — table + RLS + doc_type CHECK)
- `supabase/functions/generate-agreement-pdf/index.ts` (new)
- `services/agreementContent.ts` (new — versioned clauses + plain-text helper)
- `app/operator/compliance/agreement/page.tsx` (call Edge Function; download button; render from shared clauses)
- `app/operator/compliance/documents/page.tsx` (read-only Service Agreement download entry)
- `app/admin/compliance/page.tsx` (verify the service_agreement row renders; minor label if needed)
