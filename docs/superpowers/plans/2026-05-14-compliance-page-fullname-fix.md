# Compliance Page — Fix full_name References Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the compliance page so flag raiser names and operator names display correctly, by replacing broken `profiles.full_name` queries with two security-definer SQL functions that source name and email from `auth.users`.

**Architecture:** Two `SECURITY DEFINER` Postgres functions (`admin_get_compliance_flags`, `admin_get_compliance_docs`) join through `profiles → auth.users` to expose `email` and `raw_user_meta_data->>'full_name'`. The frontend replaces nested Supabase joins with `.rpc()` calls and flattens the type definitions. Display logic shows name when available, falls back to email.

**Tech Stack:** Supabase SQL (PostgreSQL), Next.js App Router, TypeScript, Tailwind CSS / DaisyUI

---

## Files

| Action | Path |
|---|---|
| Create | `supabase/migrations/20260514_14_admin_compliance_functions.sql` |
| Modify | `app/admin/compliance/page.tsx` — types, fetch functions, display |

---

### Task 1: Create the migration

**Files:**
- Create: `supabase/migrations/20260514_14_admin_compliance_functions.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260514_14_admin_compliance_functions.sql` with exactly this content:

```sql
-- Replaces client-side profiles.full_name joins (column does not exist).
-- Sources name and email from auth.users via SECURITY DEFINER.
-- Requires: profiles.is_admin boolean and profiles.user_id uuid (both exist in DB).

-- ── Function 1: Compliance flags with raiser identity ──────────────────────────

create or replace function public.admin_get_compliance_flags()
returns table (
  id              uuid,
  target_type     text,
  target_id       uuid,
  flag_type       text,
  description     text,
  resolved        boolean,
  resolved_at     timestamptz,
  created_at      timestamptz,
  raised_by_name  text,
  raised_by_email text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    f.id,
    f.target_type,
    f.target_id,
    f.flag_type,
    f.description,
    f.resolved,
    f.resolved_at,
    f.created_at,
    u.raw_user_meta_data->>'full_name' as raised_by_name,
    u.email                            as raised_by_email
  from public.compliance_flags f
  left join public.profiles p on p.id  = f.raised_by
  left join auth.users       u on u.id = p.user_id
  where exists (
    select 1 from public.profiles admin_check
    where admin_check.user_id = auth.uid()
      and (admin_check.is_admin = true or admin_check.role_type = 'admin')
  )
  order by f.created_at desc;
$$;

grant execute on function public.admin_get_compliance_flags() to authenticated;

-- ── Function 2: Compliance documents with operator identity ────────────────────

create or replace function public.admin_get_compliance_docs()
returns table (
  id                  uuid,
  operator_profile_id uuid,
  doc_type            text,
  file_url            text,
  status              text,
  admin_notes         text,
  uploaded_at         timestamptz,
  reviewed_at         timestamptz,
  operator_name       text,
  operator_email      text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    d.id,
    d.operator_profile_id,
    d.doc_type,
    d.file_url,
    d.status,
    d.admin_notes,
    d.uploaded_at,
    d.reviewed_at,
    u.raw_user_meta_data->>'full_name' as operator_name,
    u.email                            as operator_email
  from public.compliance_documents d
  left join public.operator_profiles op on op.id  = d.operator_profile_id
  left join public.profiles          p  on p.id   = op.profile_id
  left join auth.users               u  on u.id   = p.user_id
  where exists (
    select 1 from public.profiles admin_check
    where admin_check.user_id = auth.uid()
      and (admin_check.is_admin = true or admin_check.role_type = 'admin')
  )
  order by d.uploaded_at desc;
$$;

grant execute on function public.admin_get_compliance_docs() to authenticated;
```

- [ ] **Step 2: Apply the migration in Supabase**

Open the **Supabase Dashboard → SQL Editor** and paste + run the entire file contents. Expected output:

```
Success. No rows returned.
```

- [ ] **Step 3: Verify both functions exist**

In the SQL Editor, run:

```sql
select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('admin_get_compliance_flags', 'admin_get_compliance_docs')
order by routine_name;
```

Expected:

| routine_name                  | security_type |
|-------------------------------|---------------|
| admin_get_compliance_docs     | DEFINER       |
| admin_get_compliance_flags    | DEFINER       |

- [ ] **Step 4: Smoke-test both functions**

Run each in the SQL Editor (will return 0 rows since `auth.uid()` is NULL as postgres — that is correct):

```sql
select * from public.admin_get_compliance_flags();
select * from public.admin_get_compliance_docs();
```

Expected: 0 rows each, with columns as defined. A SQL error means the function body has a problem — re-check the migration.

- [ ] **Step 5: Commit the migration**

```bash
git add supabase/migrations/20260514_14_admin_compliance_functions.sql
git commit -m "feat: add admin compliance RPC functions with auth.users identity"
```

---

### Task 2: Update the frontend

**Files:**
- Modify: `app/admin/compliance/page.tsx`

- [ ] **Step 1: Replace the `ComplianceFlag` type**

In `app/admin/compliance/page.tsx`, replace the existing `ComplianceFlag` type (lines 8–17):

```ts
// Before
type ComplianceFlag = {
  id: string;
  target_type: string;
  target_id: string;
  flag_type: string;
  description: string | null;
  resolved: boolean;
  created_at: string;
  raised_by_profile: { full_name: string | null } | null;
};

// After
type ComplianceFlag = {
  id: string;
  target_type: string;
  target_id: string;
  flag_type: string;
  description: string | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  raised_by_name: string | null;
  raised_by_email: string | null;
};
```

- [ ] **Step 2: Replace the `ComplianceDoc` type**

Replace the existing `ComplianceDoc` type (lines 19–31):

```ts
// Before
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

// After
type ComplianceDoc = {
  id: string;
  operator_profile_id: string;
  doc_type: string;
  file_url: string;
  status: 'under_review' | 'approved' | 'rejected';
  admin_notes: string | null;
  uploaded_at: string;
  reviewed_at: string | null;
  operator_name: string | null;
  operator_email: string | null;
};
```

- [ ] **Step 3: Replace `fetchFlags()`**

Replace the existing `fetchFlags` function:

```ts
// Before
async function fetchFlags() {
  const { data, error: err } = await supabase
    .from('compliance_flags')
    .select(`
      id, target_type, target_id, flag_type, description, resolved, created_at,
      raised_by_profile:profiles!compliance_flags_raised_by_fkey(full_name)
    `)
    .order('created_at', { ascending: false });

  if (err) { setError(err.message); }
  else { setFlags((data ?? []) as unknown as ComplianceFlag[]); }
  setLoading(false);
}

// After
async function fetchFlags() {
  const { data, error: err } = await supabase.rpc('admin_get_compliance_flags');
  if (err) { setError(err.message); }
  else { setFlags((data ?? []) as ComplianceFlag[]); }
  setLoading(false);
}
```

- [ ] **Step 4: Replace `fetchDocs()`**

Replace the existing `fetchDocs` function:

```ts
// Before
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

// After
async function fetchDocs() {
  const { data, error: err } = await supabase.rpc('admin_get_compliance_docs');
  if (err) { setDocsError(err.message); }
  else { setDocs((data ?? []) as ComplianceDoc[]); }
  setDocsLoading(false);
}
```

- [ ] **Step 5: Fix the flag raiser display**

Find this line in the flags render section (inside `filtered.map`):

```tsx
{flag.raised_by_profile?.full_name && <span>By: {flag.raised_by_profile.full_name}</span>}
```

Replace with:

```tsx
{(flag.raised_by_name || flag.raised_by_email) && (
  <span>By: {flag.raised_by_name ?? flag.raised_by_email}</span>
)}
```

- [ ] **Step 6: Fix the operator name display**

Find this line in the docs render section (inside `docs.map`):

```ts
const operatorName = doc.operator_profile?.profile?.full_name ?? 'Unknown operator';
```

Replace with:

```ts
const operatorName = doc.operator_name ?? doc.operator_email ?? 'Unknown operator';
```

- [ ] **Step 7: Check TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors). If you see errors about `raised_by_profile` or `operator_profile`, the type replacements in Steps 1–2 didn't fully take — search the file for any remaining references to the old field names and remove them.

- [ ] **Step 8: Commit the frontend changes**

```bash
git add app/admin/compliance/page.tsx
git commit -m "fix: replace profiles.full_name with auth.users identity in compliance page"
```

---

### Task 3: Manual verification

No automated tests — admin pages require an authenticated admin session. Verify manually.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Navigate to the compliance page**

Go to `http://localhost:3000/admin/compliance` logged in as your admin user.

- [ ] **Step 3: Verify the Compliance Flags tab**

Click **Compliance Flags**. If no flags exist yet, the empty state ("No unresolved compliance flags.") is correct — the fix is working if there are no console errors.

If flags exist, each card should show `By: <name or email>` instead of showing nothing.

- [ ] **Step 4: Verify the KYC Documents tab**

Click **KYC Documents**. If documents exist, each card should show the operator's name or email instead of "Unknown operator".

- [ ] **Step 5: Check browser console**

Open DevTools → Console. There should be no errors related to `full_name`, `raised_by_profile`, or `operator_profile`.
