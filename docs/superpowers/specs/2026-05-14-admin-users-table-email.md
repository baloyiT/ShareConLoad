# Admin Users Table — Email Column

**Date:** 2026-05-14
**Status:** Approved

## Problem

The Admin Dashboard Users table loads correctly but is missing the user's email address. Email lives in `auth.users`, not in `profiles`, so it cannot be fetched directly from the client with the existing query.

## Goal

Display each user's email in the All Users table on the Admin Dashboard, alongside their name and role — with no architecture changes and no duplicate data storage.

## Approach: Security Definer Function

Create a `public.admin_get_users()` Postgres function with `SECURITY DEFINER` that joins `profiles` with `auth.users`. The function runs with the `postgres` role's permissions (which can read `auth.users`), but only returns rows when the calling user is an admin. The client calls it via `supabase.rpc('admin_get_users')`.

A plain view is not used here because views execute with the **caller's** permissions — the `authenticated` role has no access to `auth.users`, so the join would fail.

## Migration

File: `supabase/migrations/20260514_13_admin_users_view.sql`

```sql
create or replace function public.admin_get_users()
returns table (
  id          uuid,
  user_id     uuid,
  full_name   text,
  active_role text,
  is_admin    boolean,
  created_at  timestamptz,
  email       text
)
language sql
security definer
set search_path = public, auth
as $$
  select
    p.id,
    p.user_id,
    p.full_name,
    p.active_role,
    p.is_admin,
    p.created_at,
    u.email
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where exists (
    select 1 from public.profiles admin_check
    where admin_check.user_id = auth.uid()
      and admin_check.is_admin = true
  )
  order by p.created_at desc;
$$;

grant execute on function public.admin_get_users() to authenticated;
```

The `WHERE EXISTS` clause acts as the access gate — non-admins get an empty result set.

## Frontend Changes

**File:** `app/admin/page.tsx`

### 1. Update `Profile` type

Add `email` field:

```ts
type Profile = {
  id: string;
  user_id: string;
  full_name: string | null;
  active_role: string;
  is_admin: boolean | null;
  email: string | null;
  created_at: string;
};
```

### 2. Update query

```ts
supabase.rpc('admin_get_users')
```

No `.order()` needed — ordering is handled inside the function.

### 3. Add Email column to table

Insert an **Email** column between Name and Role in the Users tab:

| User ID | Name | Email | Role | Joined |
|---|---|---|---|---|

Render as `<span className="text-sm text-gray-600">{u.email ?? '—'}</span>`.

## What Does NOT Change

- Stats computation (totalUsers, customers, operators) — unchanged
- Tab structure, rendering logic, sub-components — unchanged
- All other admin tabs (Containers, Bookings, Overview) — unchanged
- No new dependencies

## Success Criteria

- Email column appears in the Users table for all users
- Non-admin users cannot query `admin_users_view` (RLS blocks them)
- No console errors
