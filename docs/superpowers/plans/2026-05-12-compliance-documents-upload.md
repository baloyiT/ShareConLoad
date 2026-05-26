# Compliance Documents Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Coming Soon" placeholder on the operator compliance documents page with real per-document upload slots, backed by a `compliance_documents` DB table and an admin review UI.

**Architecture:** A new `compliance_documents` table holds one row per document type per operator (unique constraint), with a status of `under_review` → `approved` / `rejected`. Files go into a private `compliance-documents` Supabase Storage bucket at `{operator_profile_id}/{doc_type}.{ext}`. The operator UI reads/writes this table directly; the admin compliance page gains a "Documents" tab alongside the existing compliance flags tab.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, DaisyUI, Supabase (PostgreSQL + Storage), Supabase JS client

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/20260512_11_compliance_documents.sql` | Table DDL + storage bucket + RLS policies |
| Modify | `app/operator/compliance/documents/page.tsx` | Replace placeholder with per-doc upload cards |
| Modify | `app/admin/compliance/page.tsx` | Add Documents tab (list + approve/reject actions) |

---

## Task 1: Database Migration — `compliance_documents` Table + Storage

**Files:**
- Create: `supabase/migrations/20260512_11_compliance_documents.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260512_11_compliance_documents.sql

-- Table: one row per doc type per operator
create table if not exists public.compliance_documents (
  id                  uuid primary key default gen_random_uuid(),
  operator_profile_id uuid not null references public.operator_profiles(id) on delete cascade,
  doc_type            text not null check (doc_type in (
    'identity',
    'business_registration',
    'proof_of_address',
    'tax_clearance',
    'banking_confirmation'
  )),
  file_url            text not null,
  status              text not null default 'under_review'
    check (status in ('under_review', 'approved', 'rejected')),
  admin_notes         text,
  uploaded_at         timestamptz not null default now(),
  reviewed_at         timestamptz,
  unique (operator_profile_id, doc_type)
);

-- RLS
alter table public.compliance_documents enable row level security;

-- Operators: read/insert/update their own rows
create policy "Operators read own compliance docs"
  on public.compliance_documents for select
  to authenticated
  using (
    operator_profile_id in (
      select op.id from public.operator_profiles op
      join public.profiles p on p.id = op.profile_id
      where p.user_id = auth.uid()
    )
  );

create policy "Operators insert own compliance docs"
  on public.compliance_documents for insert
  to authenticated
  with check (
    operator_profile_id in (
      select op.id from public.operator_profiles op
      join public.profiles p on p.id = op.profile_id
      where p.user_id = auth.uid()
    )
  );

create policy "Operators update own compliance docs"
  on public.compliance_documents for update
  to authenticated
  using (
    operator_profile_id in (
      select op.id from public.operator_profiles op
      join public.profiles p on p.id = op.profile_id
      where p.user_id = auth.uid()
    )
  );

-- Admins: full access
create policy "Admins full access compliance docs"
  on public.compliance_documents for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role_type = 'admin'
    )
  );

-- Storage bucket: private, 10 MB limit, PDF/image only
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'compliance-documents',
  'compliance-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Storage RLS: operators upload to their own folder
create policy "Operators upload compliance docs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'compliance-documents'
    and (storage.foldername(name))[1] = (
      select op.id::text
      from public.operator_profiles op
      join public.profiles p on p.id = op.profile_id
      where p.user_id = auth.uid()
      limit 1
    )
  );

create policy "Operators update compliance docs"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'compliance-documents'
    and (storage.foldername(name))[1] = (
      select op.id::text
      from public.operator_profiles op
      join public.profiles p on p.id = op.profile_id
      where p.user_id = auth.uid()
      limit 1
    )
  );

create policy "Operators read own compliance docs storage"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'compliance-documents'
    and (storage.foldername(name))[1] = (
      select op.id::text
      from public.operator_profiles op
      join public.profiles p on p.id = op.profile_id
      where p.user_id = auth.uid()
      limit 1
    )
  );

create policy "Admins read all compliance docs storage"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'compliance-documents'
    and exists (
      select 1 from public.profiles
      where user_id = auth.uid() and role_type = 'admin'
    )
  );
```

- [ ] **Step 2: Apply the migration to your Supabase project**

Run in the Supabase SQL Editor (Dashboard → SQL Editor → New query), or via CLI:
```bash
supabase db push
```

Verify: open Table Editor → confirm `compliance_documents` table exists with the correct columns. Open Storage → confirm `compliance-documents` bucket exists.

- [ ] **Step 3: Commit the migration**

```bash
git add supabase/migrations/20260512_11_compliance_documents.sql
git commit -m "feat: add compliance_documents table and storage bucket"
```

---

## Task 2: Operator Documents Upload Page

**Files:**
- Modify: `app/operator/compliance/documents/page.tsx`

The page loads the operator's `compliance_documents` rows from the DB, maps them onto the 5 fixed document types, and renders an upload card per type. On file drop/click the file goes to Storage, then an upsert is done on the DB row (setting `status = 'under_review'`, `uploaded_at = now()`). Approved docs are locked (no re-upload button shown).

- [ ] **Step 1: Replace the file with the full implementation**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';

type DocStatus = 'under_review' | 'approved' | 'rejected';

type DocRecord = {
  id: string;
  doc_type: string;
  file_url: string;
  status: DocStatus;
  admin_notes: string | null;
  uploaded_at: string;
};

type DocSlot = {
  type: string;
  label: string;
  desc: string;
  record: DocRecord | null;
  uploading: boolean;
  error: string | null;
};

const DOC_DEFS: { type: string; label: string; desc: string }[] = [
  { type: 'identity',              label: 'Proof of Identity',         desc: 'Valid passport or national ID (director/owner)' },
  { type: 'business_registration', label: 'Business Registration',     desc: 'Certificate of incorporation or CIPC document' },
  { type: 'proof_of_address',      label: 'Proof of Address',          desc: 'Utility bill or bank statement (not older than 3 months)' },
  { type: 'tax_clearance',         label: 'Tax Clearance Certificate', desc: 'Issued by SARS — required for payout approval' },
  { type: 'banking_confirmation',  label: 'Banking Confirmation',      desc: 'Official bank letter confirming account details' },
];

const STATUS_BADGE: Record<DocStatus, { label: string; className: string }> = {
  under_review: { label: 'Under Review', className: 'bg-amber-100 text-amber-700' },
  approved:     { label: 'Approved',     className: 'bg-green-100 text-green-700' },
  rejected:     { label: 'Rejected',     className: 'bg-red-100 text-red-600'     },
};

export default function ComplianceDocumentsPage() {
  const router = useRouter();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [operatorProfileId, setOperatorProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<DocSlot[]>(
    DOC_DEFS.map((d) => ({ ...d, record: null, uploading: false, error: null }))
  );

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/login?next=/operator/compliance/documents'); return; }

      const { data: profile } = await supabase
        .from('profiles').select('id')
        .eq('user_id', user.id).eq('role_type', 'operator').single();
      if (!profile) { setLoading(false); return; }

      const { data: op } = await supabase
        .from('operator_profiles').select('id')
        .eq('profile_id', profile.id).single();
      if (!op) { setLoading(false); return; }

      setOperatorProfileId(op.id);

      const { data: docs } = await supabase
        .from('compliance_documents')
        .select('id, doc_type, file_url, status, admin_notes, uploaded_at')
        .eq('operator_profile_id', op.id);

      const recordMap: Record<string, DocRecord> = {};
      for (const d of (docs ?? []) as DocRecord[]) recordMap[d.doc_type] = d;

      setSlots(DOC_DEFS.map((d) => ({
        ...d,
        record: recordMap[d.type] ?? null,
        uploading: false,
        error: null,
      })));
      setLoading(false);
    }
    load();
  }, [router]);

  function setSlot(type: string, patch: Partial<DocSlot>) {
    setSlots((prev) => prev.map((s) => s.type === type ? { ...s, ...patch } : s));
  }

  async function handleFile(docType: string, file: File) {
    if (!operatorProfileId) return;

    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setSlot(docType, { error: 'Only PDF, JPG, PNG or WEBP accepted.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSlot(docType, { error: 'File must be under 10 MB.' });
      return;
    }

    setSlot(docType, { uploading: true, error: null });

    const ext  = file.name.split('.').pop();
    const path = `${operatorProfileId}/${docType}.${ext}`;

    const { error: storageErr } = await supabase.storage
      .from('compliance-documents')
      .upload(path, file, { upsert: true });

    if (storageErr) {
      setSlot(docType, { uploading: false, error: storageErr.message });
      return;
    }

    const { data: upserted, error: dbErr } = await supabase
      .from('compliance_documents')
      .upsert(
        {
          operator_profile_id: operatorProfileId,
          doc_type: docType,
          file_url: path,
          status: 'under_review',
          admin_notes: null,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: 'operator_profile_id,doc_type' }
      )
      .select('id, doc_type, file_url, status, admin_notes, uploaded_at')
      .single();

    if (dbErr || !upserted) {
      setSlot(docType, { uploading: false, error: dbErr?.message ?? 'Failed to save record.' });
      return;
    }

    setSlot(docType, { uploading: false, record: upserted as DocRecord });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-gray-800">Documents</h1>
        <p className="text-sm text-gray-400 mt-0.5">Required documents for KYC and payout eligibility.</p>
      </div>

      <div className="flex flex-col gap-4">
        {slots.map((slot) => {
          const badge = slot.record ? STATUS_BADGE[slot.record.status] : null;
          const isApproved = slot.record?.status === 'approved';

          return (
            <div key={slot.type} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <p className="text-sm font-semibold text-gray-700">{slot.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{slot.desc}</p>
                </div>
                {badge && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${badge.className}`}>
                    {badge.label}
                  </span>
                )}
                {!slot.record && !slot.uploading && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 bg-gray-100 text-gray-500">
                    Not uploaded
                  </span>
                )}
              </div>

              {/* Rejection notes */}
              {slot.record?.status === 'rejected' && slot.record.admin_notes && (
                <p className="text-xs text-red-500 mt-2 bg-red-50 rounded-lg px-3 py-2">
                  {slot.record.admin_notes}
                </p>
              )}

              {/* Error */}
              {slot.error && (
                <p className="text-xs text-red-500 mt-2">{slot.error}</p>
              )}

              {/* Upload area — hidden if approved */}
              {!isApproved && (
                <div className="mt-3">
                  <input
                    ref={(el) => { fileInputRefs.current[slot.type] = el; }}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(slot.type, file);
                      e.target.value = '';
                    }}
                  />
                  {slot.uploading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="loading loading-spinner loading-xs" style={{ color: '#f97316' }} />
                      Uploading…
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRefs.current[slot.type]?.click()}
                      className="btn btn-sm rounded-xl text-xs font-semibold"
                      style={slot.record
                        ? { backgroundColor: '#f3f4f6', color: '#374151' }
                        : { backgroundColor: '#0f2044', color: '#ffffff' }}
                    >
                      {slot.record ? 'Replace file' : 'Upload document'}
                    </button>
                  )}
                </div>
              )}

              {/* Approved lock message */}
              {isApproved && (
                <p className="text-xs text-green-600 mt-2">
                  Document verified — no changes required.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors relating to `app/operator/compliance/documents/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/operator/compliance/documents/page.tsx
git commit -m "feat: replace compliance documents placeholder with per-doc upload cards"
```

---

## Task 3: Admin Documents Review Tab

**Files:**
- Modify: `app/admin/compliance/page.tsx`

Add a "Documents" tab next to the existing "Flags" tab. The documents tab lists all submitted compliance documents with operator name, doc type, status badge, and Approve / Reject buttons. Reject opens an inline notes field.

- [ ] **Step 1: Add types and data-fetch to the existing admin compliance page**

At the top of `app/admin/compliance/page.tsx`, add these types after the existing `ComplianceFlag` type:

```tsx
type ComplianceDoc = {
  id: string;
  doc_type: string;
  file_url: string;
  status: 'under_review' | 'approved' | 'rejected';
  admin_notes: string | null;
  uploaded_at: string;
  reviewed_at: string | null;
  operator_profile: {
    id: string;
    profile: { full_name: string | null } | null;
  } | null;
};

const DOC_TYPE_LABELS: Record<string, string> = {
  identity:              'Proof of Identity',
  business_registration: 'Business Registration',
  proof_of_address:      'Proof of Address',
  tax_clearance:         'Tax Clearance Certificate',
  banking_confirmation:  'Banking Confirmation',
};
```

- [ ] **Step 2: Add state variables for the documents tab inside `AdminCompliancePage`**

Add these inside the component, after the existing state declarations:

```tsx
const [activeTab,       setActiveTab]       = useState<'flags' | 'documents'>('flags');
const [docs,            setDocs]            = useState<ComplianceDoc[]>([]);
const [docsLoading,     setDocsLoading]     = useState(true);
const [docsError,       setDocsError]       = useState<string | null>(null);
const [reviewingId,     setReviewingId]     = useState<string | null>(null);
const [rejectNotes,     setRejectNotes]     = useState('');
const [rejectTarget,    setRejectTarget]    = useState<string | null>(null);
const [actionBusy,      setActionBusy]      = useState<string | null>(null);
```

- [ ] **Step 3: Add `fetchDocs` function and call it in `useEffect`**

Add `fetchDocs` immediately after `fetchFlags`:

```tsx
async function fetchDocs() {
  const { data, error: err } = await supabase
    .from('compliance_documents')
    .select(`
      id, doc_type, file_url, status, admin_notes, uploaded_at, reviewed_at,
      operator_profile:operator_profiles!compliance_documents_operator_profile_id_fkey(
        id,
        profile:profiles!operator_profiles_profile_id_fkey(full_name)
      )
    `)
    .order('uploaded_at', { ascending: false });

  if (err) { setDocsError(err.message); }
  else { setDocs((data ?? []) as unknown as ComplianceDoc[]); }
  setDocsLoading(false);
}
```

Update the existing `useEffect` to call both:

```tsx
useEffect(() => { fetchFlags(); fetchDocs(); }, []);
```

- [ ] **Step 4: Add `approveDoc` and `rejectDoc` action functions**

Add these inside the component, after `toggleResolve`:

```tsx
async function approveDoc(id: string) {
  setActionBusy(id);
  const { error: err } = await supabase
    .from('compliance_documents')
    .update({ status: 'approved', admin_notes: null, reviewed_at: new Date().toISOString() })
    .eq('id', id);
  if (!err) setDocs((prev) => prev.map((d) => d.id === id ? { ...d, status: 'approved', admin_notes: null } : d));
  else setDocsError(err.message);
  setActionBusy(null);
  setReviewingId(null);
}

async function rejectDoc(id: string) {
  setActionBusy(id);
  const { error: err } = await supabase
    .from('compliance_documents')
    .update({ status: 'rejected', admin_notes: rejectNotes.trim() || null, reviewed_at: new Date().toISOString() })
    .eq('id', id);
  if (!err) setDocs((prev) => prev.map((d) => d.id === id ? { ...d, status: 'rejected', admin_notes: rejectNotes.trim() || null } : d));
  else setDocsError(err.message);
  setActionBusy(null);
  setRejectTarget(null);
  setRejectNotes('');
}
```

- [ ] **Step 5: Add tab switcher UI in the header section**

Inside the header `<div>` (the dark-blue gradient section), replace the closing tags so the tab buttons sit at the bottom of the header. Find the closing `</div>` of `max-w-6xl mx-auto flex ...` and add the tab switcher after the inner flex content:

```tsx
{/* Tab switcher — add inside the max-w-6xl div, after the existing flex row */}
<div className="flex gap-1 mt-4">
  {(['flags', 'documents'] as const).map((tab) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className="px-4 py-1.5 rounded-full text-sm font-semibold transition-colors"
      style={activeTab === tab
        ? { backgroundColor: '#f97316', color: '#ffffff' }
        : { backgroundColor: 'rgba(255,255,255,0.1)', color: '#d1d5db' }}
    >
      {tab === 'flags' ? 'Compliance Flags' : 'KYC Documents'}
    </button>
  ))}
</div>
```

- [ ] **Step 6: Replace the main content area with a tab-conditional render**

Wrap the existing flags list in `{activeTab === 'flags' && (...)}` and add the documents panel below it. The full content area (below the header, inside `max-w-6xl mx-auto px-4 sm:px-6 py-8`) becomes:

```tsx
<div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
  {/* ── Flags tab ── */}
  {activeTab === 'flags' && (
    <>
      {error && <div className="alert alert-error text-sm mb-4">{error}</div>}
      {loading ? (
        <div className="flex justify-center py-24">
          <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20">
          <p className="text-gray-400 text-sm">No {showResolved ? '' : 'unresolved '}compliance flags.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((flag) => (
            <div key={flag.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="h-1 w-full" style={{ backgroundColor: flag.resolved ? '#86efac' : (FLAG_COLOURS[flag.flag_type] ?? '#6b7280') }} />
              <div className="p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="badge badge-sm text-white font-semibold"
                      style={{ backgroundColor: flag.resolved ? '#22c55e' : (FLAG_COLOURS[flag.flag_type] ?? '#6b7280') }}>
                      {FLAG_TYPE_LABELS[flag.flag_type] ?? flag.flag_type}
                    </span>
                    <span className="badge badge-sm bg-gray-100 text-gray-600 border-0 capitalize">{flag.target_type}</span>
                    {flag.resolved && <span className="badge badge-sm bg-green-50 text-green-600 border-0">Resolved</span>}
                  </div>
                  <p className="text-xs font-mono text-gray-400 mb-2">Target: {flag.target_id.slice(0, 16)}…</p>
                  {flag.description && <p className="text-sm text-gray-700 mb-2">{flag.description}</p>}
                  <div className="flex gap-4 text-xs text-gray-400">
                    <span>Raised: {fmt(flag.created_at)}</span>
                    {flag.raised_by_profile?.full_name && <span>By: {flag.raised_by_profile.full_name}</span>}
                  </div>
                </div>
                <button onClick={() => toggleResolve(flag)} disabled={resolving === flag.id}
                  className="btn btn-sm rounded-xl font-semibold shrink-0"
                  style={flag.resolved
                    ? { backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }
                    : { backgroundColor: '#f0fdf4', color: '#22c55e', border: '1px solid #bbf7d0' }}>
                  {resolving === flag.id
                    ? <span className="loading loading-spinner loading-xs" />
                    : flag.resolved ? 'Reopen' : 'Mark Resolved'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )}

  {/* ── Documents tab ── */}
  {activeTab === 'documents' && (
    <>
      {docsError && <div className="alert alert-error text-sm mb-4">{docsError}</div>}
      {docsLoading ? (
        <div className="flex justify-center py-24">
          <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
        </div>
      ) : docs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20">
          <p className="text-gray-400 text-sm">No compliance documents submitted yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {docs.map((doc) => {
            const operatorName = doc.operator_profile?.profile?.full_name ?? 'Unknown operator';
            const statusColour = doc.status === 'approved' ? '#22c55e' : doc.status === 'rejected' ? '#ef4444' : '#f59e0b';
            const statusLabel  = doc.status === 'approved' ? 'Approved' : doc.status === 'rejected' ? 'Rejected' : 'Under Review';
            const isRejecting  = rejectTarget === doc.id;

            return (
              <div key={doc.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="h-1 w-full" style={{ backgroundColor: statusColour }} />
                <div className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="badge badge-sm text-white font-semibold" style={{ backgroundColor: statusColour }}>
                          {statusLabel}
                        </span>
                        <span className="badge badge-sm bg-gray-100 text-gray-600 border-0">
                          {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-700">{operatorName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Uploaded: {fmt(doc.uploaded_at)}
                        {doc.reviewed_at && ` · Reviewed: ${fmt(doc.reviewed_at)}`}
                      </p>
                      {doc.admin_notes && (
                        <p className="text-xs text-red-500 mt-1 bg-red-50 rounded-lg px-2.5 py-1.5">{doc.admin_notes}</p>
                      )}
                    </div>

                    {doc.status !== 'approved' && (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => approveDoc(doc.id)}
                          disabled={!!actionBusy}
                          className="btn btn-sm rounded-xl font-semibold"
                          style={{ backgroundColor: '#f0fdf4', color: '#22c55e', border: '1px solid #bbf7d0' }}
                        >
                          {actionBusy === doc.id ? <span className="loading loading-spinner loading-xs" /> : 'Approve'}
                        </button>
                        <button
                          onClick={() => { setRejectTarget(doc.id); setRejectNotes(''); }}
                          disabled={!!actionBusy}
                          className="btn btn-sm rounded-xl font-semibold"
                          style={{ backgroundColor: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Inline reject notes form */}
                  {isRejecting && (
                    <div className="mt-4 flex flex-col gap-2">
                      <textarea
                        value={rejectNotes}
                        onChange={(e) => setRejectNotes(e.target.value)}
                        placeholder="Reason for rejection (shown to operator)…"
                        className="textarea textarea-bordered text-sm w-full rounded-xl"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => rejectDoc(doc.id)}
                          disabled={!!actionBusy}
                          className="btn btn-sm rounded-xl font-semibold text-white"
                          style={{ backgroundColor: '#ef4444' }}
                        >
                          {actionBusy === doc.id ? <span className="loading loading-spinner loading-xs" /> : 'Confirm Reject'}
                        </button>
                        <button
                          onClick={() => setRejectTarget(null)}
                          className="btn btn-sm btn-ghost rounded-xl text-gray-500"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  )}
</div>
```

- [ ] **Step 7: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors relating to `app/admin/compliance/page.tsx`.

- [ ] **Step 8: Commit**

```bash
git add app/admin/compliance/page.tsx
git commit -m "feat: add KYC documents review tab to admin compliance page"
```

---

## Task 4: Manual Smoke Test

- [ ] **Step 1: Start the dev server**
```bash
npm run dev
```

- [ ] **Step 2: Test operator upload flow**
  1. Log in as an operator
  2. Navigate to `/operator/compliance/documents`
  3. Confirm 5 cards render, all showing "Not uploaded"
  4. Upload a PDF to "Proof of Identity" — confirm badge changes to "Under Review" without page reload
  5. Refresh — confirm "Under Review" badge persists (DB was written)
  6. Try uploading a file > 10 MB — confirm error message appears

- [ ] **Step 3: Test admin review flow**
  1. Log in as an admin
  2. Navigate to `/admin/compliance` → click "KYC Documents" tab
  3. Confirm the uploaded document appears with operator name and "Under Review" badge
  4. Click "Approve" — confirm badge turns green immediately
  5. Return to operator view — confirm the approved card shows "Approved" and no re-upload button

- [ ] **Step 4: Test rejection flow**
  1. Log in as admin, navigate to `/admin/compliance` → KYC Documents
  2. Find a "Under Review" doc, click "Reject"
  3. Enter rejection notes, click "Confirm Reject"
  4. Return to operator view — confirm red "Rejected" badge and rejection notes are visible
  5. Confirm "Replace file" button is shown so operator can re-upload
