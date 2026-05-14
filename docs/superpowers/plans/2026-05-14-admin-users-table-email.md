# Admin Users Table — Email Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Email column to the Admin Dashboard Users table by exposing `auth.users.email` via a security-definer Postgres function.

**Architecture:** A new `public.admin_get_users()` SQL function with `SECURITY DEFINER` joins `profiles` with `auth.users` (inaccessible to the `authenticated` role directly). It gates results behind an admin check so non-admins get an empty result set. The frontend switches its query from `.from('profiles')` to `.rpc('admin_get_users')` and renders the new Email column.

**Tech Stack:** Supabase SQL (PostgreSQL), Next.js App Router, TypeScript, Tailwind CSS / DaisyUI

---

## Files

| Action | Path |
|---|---|
| Create | `supabase/migrations/20260514_13_admin_users_view.sql` |
| Modify | `app/admin/page.tsx` — `Profile` type, query, Users table render |

---

### Task 1: Create and apply the migration

**Files:**
- Create: `supabase/migrations/20260514_13_admin_users_view.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260514_13_admin_users_view.sql` with exactly this content:

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

Key points:
- `security definer` means the function runs as its creator (`postgres`), which has access to `auth.users`
- `set search_path = public, auth` makes the `auth.users` table resolvable inside the function body
- The `WHERE EXISTS` sub-query returns zero rows for non-admins — no separate RLS policy needed
- `grant execute to authenticated` allows logged-in users to call it (the WHERE clause gates actual data)

- [ ] **Step 2: Apply the migration in Supabase**

Open the **Supabase Dashboard → SQL Editor** and run the contents of the migration file. You should see:

```
Success. No rows returned.
```

- [ ] **Step 3: Verify the function exists**

In the SQL Editor, run:

```sql
select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'admin_get_users';
```

Expected result:

| routine_name    | security_type |
|-----------------|---------------|
| admin_get_users | DEFINER       |

- [ ] **Step 4: Smoke-test the function exists and compiles**

In the SQL Editor, confirm the function is callable (it will return 0 rows here because `auth.uid()` is NULL when running as `postgres` — that is expected and correct):

```sql
select * from public.admin_get_users();
```

Expected: `0 rows` with columns `id, user_id, full_name, active_role, is_admin, created_at, email`. If you see a SQL error instead, the function body has a syntax problem — re-check the migration file.

Real data will only appear when an admin user calls it from the app (where `auth.uid()` resolves to their UUID).

- [ ] **Step 5: Commit the migration**

```bash
git add supabase/migrations/20260514_13_admin_users_view.sql
git commit -m "feat: add admin_get_users security definer function"
```

---

### Task 2: Update the frontend

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Update the `Profile` type**

In `app/admin/page.tsx`, replace the existing `Profile` type (lines ~10–15):

```ts
// Before
type Profile = {
  id: string;
  full_name: string | null;
  active_role: string;
  created_at: string;
};

// After
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

- [ ] **Step 2: Update the data query**

In the `loadAll` function inside `useEffect`, replace the profiles query:

```ts
// Before
supabase.from('profiles').select('*').order('created_at', { ascending: false }),

// After
supabase.rpc('admin_get_users'),
```

The full `Promise.all` block should now read:

```ts
const [usersRes, containersRes, bookingsRes] = await Promise.all([
  supabase.rpc('admin_get_users'),
  supabase.from('containers').select('*').order('created_at', { ascending: false }),
  supabase
    .from('bookings')
    .select('id, customer_id, total_cbm, total_price, status, created_at, containers(origin_city, destination_city)')
    .order('created_at', { ascending: false }),
]);
```

Note: `.rpc()` returns `{ data, error }` just like `.from()`, so the error handling and `setUsers` call below are unchanged.

- [ ] **Step 3: Add the Email column header**

In the Users table `<thead>`, update the `<Th>` to include `'Email'`:

```tsx
// Before
<Th cols={['User ID', 'Name', 'Role', 'Joined']} />

// After
<Th cols={['User ID', 'Name', 'Email', 'Role', 'Joined']} />
```

- [ ] **Step 4: Add the Email cell to each row**

In the Users table `<tbody>`, add a `<Td>` for email between the Name cell and the Role cell:

```tsx
// Before
<Td>
  <div className="flex items-center gap-2">
    {/* avatar + name */}
  </div>
</Td>
<Td>
  <span className="badge badge-sm text-white font-semibold" ...>
    {u.active_role}
  </span>
</Td>

// After — insert this Td between Name and Role
<Td>
  <div className="flex items-center gap-2">
    {/* avatar + name — unchanged */}
  </div>
</Td>
<Td>
  <span className="text-sm text-gray-600">{u.email ?? '—'}</span>
</Td>
<Td>
  <span className="badge badge-sm text-white font-semibold" ...>
    {u.active_role}
  </span>
</Td>
```

Full updated row for reference — paste this as the complete `<tr>` body in the users map:

```tsx
{users.map((u) => (
  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
    <Td><span className="font-mono text-xs text-gray-400">{shortId(u.id)}</span></Td>
    <Td>
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#0f2044' }}
        >
          {(u.full_name ?? '?').charAt(0).toUpperCase()}
        </div>
        <span className="font-medium text-gray-800 text-sm">
          {u.full_name ?? <span className="text-gray-400 italic">No name</span>}
        </span>
      </div>
    </Td>
    <Td>
      <span className="text-sm text-gray-600">{u.email ?? '—'}</span>
    </Td>
    <Td>
      <span
        className="badge badge-sm text-white font-semibold"
        style={{ backgroundColor: u.active_role === 'operator' ? '#f97316' : '#0f2044' }}
      >
        {u.active_role}
      </span>
    </Td>
    <Td><span className="text-gray-500 text-sm">{fmt(u.created_at)}</span></Td>
  </tr>
))}
```

- [ ] **Step 5: Check TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors. If you see `Property 'email' does not exist on type 'Profile'`, the type update in Step 1 didn't save correctly — re-check.

- [ ] **Step 6: Commit the frontend changes**

```bash
git add app/admin/page.tsx
git commit -m "feat: add email column to admin users table"
```

---

### Task 3: Manual verification

No automated test is added here — the admin page requires an authenticated admin session which Playwright tests don't currently set up. Verify manually instead.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Log in as your admin user**

Navigate to `http://localhost:3000/auth/login` and log in with the account that has `is_admin = true` in the `profiles` table.

- [ ] **Step 3: Open the admin Users table**

Navigate to `http://localhost:3000/admin` → click the **Users** tab.

Expected:
- Table has five columns: User ID, Name, **Email**, Role, Joined
- Each row shows the user's email address (e.g. `justice.baloyi@gmail.com`)
- No console errors in the browser devtools

- [ ] **Step 4: Verify non-admin cannot access**

Log out, log back in as a non-admin user, and open the browser console. Attempt:

```js
const { createClient } = supabase; // or use the already-loaded client
```

Or simply navigate to `/admin` — the layout should redirect you to `/` before the RPC even fires.

- [ ] **Step 5: Final commit if any tweaks were made**

```bash
git add -p
git commit -m "fix: admin users table email column adjustments"
```
