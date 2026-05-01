# Signup, Onboarding & Role Switching — Design Spec
**Date:** 2026-05-01
**Project:** ShareConLoad
**Approach:** Hybrid — Client UI + Server Action for mutations (Approach C)

---

## 1. Goal

Enable a complete user journey from signup through role selection to operator onboarding, supporting multi-role users on a single account.

---

## 2. Database Schema (already in Supabase)

### `profiles`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | gen_random_uuid() |
| user_id | UUID FK | → auth.users(id) ON DELETE CASCADE |
| role_type | TEXT | CHECK ('customer' \| 'operator') |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

One row per role per user. Trigger `handle_new_user` inserts `(user_id, role_type='customer')` on every new signup.

### `operator_profiles`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | gen_random_uuid() |
| profile_id | UUID FK UNIQUE | → profiles(id) ON DELETE CASCADE |
| legal_name | TEXT NOT NULL | |
| entity_type | TEXT | CHECK ('individual' \| 'company') |
| registration_number | TEXT | optional |
| vat_number | TEXT | optional |
| contact_person | TEXT | |
| phone_number | TEXT | |
| phone_verified | BOOLEAN | DEFAULT FALSE |
| country | TEXT | DEFAULT 'South Africa' |
| status | operator_status | DEFAULT 'draft' |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### RLS
- `profiles`: `FOR ALL USING (user_id = auth.uid())`
- `operator_profiles`: `FOR ALL USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))`

---

## 3. Architecture

### Approach: Hybrid (Client UI + Server Action for mutations)
- Client components (`'use client'`) for all UI pages — consistent with existing codebase
- Server action for the one privileged mutation (operator profile creation)
- Server route handler for the auth callback
- HTTP-only cookie for active role session context

### Supabase Client Rule
| Context | Client |
|---|---|
| Client components | `supabaseClient.ts` (unchanged) |
| Server actions, route handlers | `createServerActionClient()` from `supabaseServer.ts` |
| Middleware | `createMiddlewareClient()` from `supabaseServer.ts` (unchanged) |

---

## 4. Files Created / Modified

```
app/
  auth/
    callback/
      route.ts              ← NEW
    register/
      page.tsx              ← MODIFY (add emailRedirectTo)
  onboarding/
    page.tsx                ← NEW
    operator/
      page.tsx              ← NEW

actions/
  operatorActions.ts        ← NEW

services/
  supabaseServer.ts         ← EXTEND (add createServerActionClient)
  session.ts                ← NEW

middleware.ts               ← MODIFY
```

---

## 5. Session Context

**Cookie name:** `scl_active_profile`
**HTTP-only:** yes
**Shape:**
```ts
type ActiveSession = {
  profile_id: string       // profiles.id (generated UUID)
  role_type: 'customer' | 'operator'
}
```

**Written by:** `createOperatorProfile()` and `switchToOperator()` server actions on success.
**Read by:** server actions and future server components to scope queries to `profile_id`.

`services/session.ts` exports:
- `setActiveSession(data: ActiveSession): Promise<void>`
- `getActiveSession(): Promise<ActiveSession | null>`

---

## 6. Auth Callback Route (`app/auth/callback/route.ts`)

- Method: GET
- Reads `code` from query params
- Calls `supabase.auth.exchangeCodeForSession(code)`
- On success → `redirect('/onboarding')`
- On failure → `redirect('/auth/login?error=confirmation_failed')`

**Register page change:** Add `emailRedirectTo: \`${origin}/auth/callback\`` to `signUp()` options. The "check your email" screen is otherwise unchanged.

---

## 7. Server Actions (`actions/operatorActions.ts`)

### `createOperatorProfile(formData: FormData)`

```
1. Get user from server Supabase client
2. Query profiles WHERE user_id = uid AND role_type = 'operator'
3. If exists → redirect('/operator')
4. If not:
   a. INSERT profiles(user_id, role_type='operator') → profile.id
   b. INSERT operator_profiles(profile_id, ...form fields)
   c. setActiveSession({ profile_id, role_type: 'operator' })
   d. redirect('/operator')
5. On DB error → return { error: string }
```

Returns `{ error: string } | never` (redirect on success).

### `switchToOperator()`

```
1. Get user from server Supabase client
2. Query profiles WHERE user_id = uid AND role_type = 'operator'
3. If exists → setActiveSession → redirect('/operator')
4. If not   → redirect('/onboarding/operator')
```

---

## 8. UI Pages

### `/onboarding` (`app/onboarding/page.tsx`)
- Client component
- Two role cards side by side (stacked on mobile)
- **Operator card:** heading "I Have Container Space", description, button "Join as Space Provider" → `router.push('/onboarding/operator')`
- **Customer card:** heading "I Need Container Space", description, button "Continue" → `router.push('/')`
- Styled: dark navy gradient header, white card body, orange CTAs — matches existing pages

### `/onboarding/operator` (`app/onboarding/operator/page.tsx`)
- Client component
- `<form action={createOperatorProfile}>` (server action binding)
- Fields: `entity_type` (dropdown), `legal_name` (required), `registration_number`, `vat_number`, `country` (default: South Africa), `contact_person`, `phone_number`
- Displays `error` returned from server action inline
- Submit button shows loading spinner while pending
- Styled to match existing operator/create form

---

## 9. Middleware Changes

```ts
// Add to PROTECTED (requires auth):
'/onboarding'

// Add to AUTH_PAGES exceptions — /auth/callback must NOT redirect logged-in users:
// handled by removing /auth/callback from AUTH_PAGES check entirely
```

---

## 10. Routing Summary

| Route | Status | Notes |
|---|---|---|
| `/auth/callback` | NEW | Token exchange → `/onboarding` |
| `/onboarding` | NEW | Role selection, protected |
| `/onboarding/operator` | NEW | Operator form, protected |
| `/operator` | EXISTS | Unchanged |
| `/` | EXISTS | Customer landing after onboarding |

---

## 11. Out of Scope

- Updating `/operator/page.tsx` to use `profile_id` instead of `user.id` (pre-existing pattern, separate task)
- Payment, tracking, analytics
- Admin panel changes
