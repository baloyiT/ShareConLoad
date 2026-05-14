# Compliance Page — Fix full_name References

**Date:** 2026-05-14
**Status:** Approved

## Problem

`app/admin/compliance/page.tsx` queries `profiles.full_name` in two places, but the `profiles` table has no `full_name` column (actual columns: `id`, `user_id`, `role_type`, `is_admin`, `created_at`). As a result:

- Compliance flag raiser name always renders blank
- KYC document operator name always renders "Unknown operator"

## Goal

Display a meaningful name for both the flag raiser and the document operator — `full_name` from `auth.users.raw_user_meta_data` when available, falling back to `auth.users.email` which is always set.

## Approach: Two Security Definer Functions

Same pattern as `admin_get_users()`. Both functions run as `postgres` (which can read `auth.users`) and gate results to admin callers via `WHERE EXISTS`. The frontend switches from nested Supabase joins to `.rpc()` calls.

---

## Migration

**File:** `supabase/migrations/20260514_14_admin_compliance_functions.sql`

### Function 1 — `admin_get_compliance_flags()`

```sql
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
  left join public.profiles p  on p.id      = f.raised_by
  left join auth.users        u on u.id     = p.user_id
  where exists (
    select 1 from public.profiles admin_check
    where admin_check.user_id = auth.uid()
      and (admin_check.is_admin = true or admin_check.role_type = 'admin')
  )
  order by f.created_at desc;
$$;

grant execute on function public.admin_get_compliance_flags() to authenticated;
```

Notes:
- `LEFT JOIN` on profiles/users so flags with no `raised_by` still appear
- Returns `resolved_at` so the existing toggle logic can keep using it

### Function 2 — `admin_get_compliance_docs()`

```sql
create or replace function public.admin_get_compliance_docs()
returns table (
  id               uuid,
  operator_profile_id uuid,
  doc_type         text,
  file_url         text,
  status           text,
  admin_notes      text,
  uploaded_at      timestamptz,
  reviewed_at      timestamptz,
  operator_name    text,
  operator_email   text
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
  left join public.operator_profiles op on op.id      = d.operator_profile_id
  left join public.profiles          p  on p.id       = op.profile_id
  left join auth.users               u  on u.id       = p.user_id
  where exists (
    select 1 from public.profiles admin_check
    where admin_check.user_id = auth.uid()
      and (admin_check.is_admin = true or admin_check.role_type = 'admin')
  )
  order by d.uploaded_at desc;
$$;

grant execute on function public.admin_get_compliance_docs() to authenticated;
```

---

## Frontend Changes

**File:** `app/admin/compliance/page.tsx`

### 1. Update `ComplianceFlag` type

```ts
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

### 2. Update `ComplianceDoc` type

```ts
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

### 3. Update `fetchFlags()`

```ts
async function fetchFlags() {
  const { data, error: err } = await supabase.rpc('admin_get_compliance_flags');
  if (err) { setError(err.message); }
  else { setFlags((data ?? []) as ComplianceFlag[]); }
  setLoading(false);
}
```

### 4. Update `fetchDocs()`

```ts
async function fetchDocs() {
  const { data, error: err } = await supabase.rpc('admin_get_compliance_docs');
  if (err) { setDocsError(err.message); }
  else { setDocs((data ?? []) as ComplianceDoc[]); }
  setDocsLoading(false);
}
```

### 5. Update flag raiser display

```tsx
// Before
{flag.raised_by_profile?.full_name && <span>By: {flag.raised_by_profile.full_name}</span>}

// After
{(flag.raised_by_name || flag.raised_by_email) && (
  <span>By: {flag.raised_by_name ?? flag.raised_by_email}</span>
)}
```

### 6. Update operator name display in docs

```tsx
// Before
const operatorName = doc.operator_profile?.profile?.full_name ?? 'Unknown operator';

// After
const operatorName = doc.operator_name ?? doc.operator_email ?? 'Unknown operator';
```

---

## What Does NOT Change

- Flag resolve/reopen toggle logic — unchanged
- Document approve/reject logic — unchanged
- `viewDoc()` signed URL logic — unchanged
- All styling, tab structure, error handling — unchanged

---

## Success Criteria

- Flag cards show raiser name (or email fallback) instead of blank
- KYC doc cards show operator name (or email fallback) instead of "Unknown operator"
- No TypeScript errors
- Non-admin users cannot call either RPC (WHERE EXISTS gates them)
