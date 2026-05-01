# Signup, Onboarding & Role Switching — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete post-signup onboarding flow with multi-role support (customer / operator) and HTTP-only cookie session context.

**Architecture:** Hybrid — all UI pages are client components (consistent with existing codebase), the operator profile creation mutation uses a Next.js server action, and an `/auth/callback` route handler exchanges the Supabase email confirmation token for a session before redirecting to `/onboarding`.

**Tech Stack:** Next.js 16 App Router, Supabase (@supabase/ssr + @supabase/supabase-js), TypeScript, Tailwind CSS, DaisyUI, Playwright (tests)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `services/supabaseServer.ts` | Extend | Add `createServerActionClient()` for use in server actions |
| `services/session.ts` | Create | `ActiveSession` type + `setActiveSession` / `getActiveSession` cookie helpers |
| `app/auth/callback/route.ts` | Create | Exchange Supabase confirmation code for session → redirect to `/onboarding` |
| `app/auth/register/page.tsx` | Modify | Add `emailRedirectTo` pointing to `/auth/callback` |
| `middleware.ts` | Modify | Add `/onboarding` to PROTECTED routes |
| `actions/operatorActions.ts` | Create | `createOperatorProfile` + `switchToOperator` server actions |
| `app/onboarding/page.tsx` | Create | Role selection UI (two cards) |
| `app/onboarding/operator/page.tsx` | Create | Operator detail form, calls `createOperatorProfile` |
| `tests/shareconload.spec.ts` | Extend | Playwright tests for onboarding routing + callback |

---

## Task 1: Extend `services/supabaseServer.ts` with `createServerActionClient`

**Files:**
- Modify: `services/supabaseServer.ts`

- [ ] **Step 1: Verify current state — TypeScript does not know `createServerActionClient`**

```bash
npx tsc --noEmit 2>&1 | head -5
```
Expected: No errors yet (function doesn't exist to cause errors — this step confirms baseline compiles).

- [ ] **Step 2: Add `createServerActionClient` to `services/supabaseServer.ts`**

Replace the entire file with:

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

// ── Middleware client ─────────────────────────────────────────────────────────
// Used exclusively in middleware.ts

export function createMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  return { supabase, response };
}

// ── Server action / route handler client ─────────────────────────────────────
// Used in server actions (actions/) and route handlers (app/**/route.ts)

export async function createServerActionClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

- [ ] **Step 3: Verify TypeScript is clean**

```bash
npx tsc --noEmit
```
Expected: No output (exit code 0).

- [ ] **Step 4: Commit**

```bash
git add services/supabaseServer.ts
git commit -m "feat: add createServerActionClient to supabaseServer"
```

---

## Task 2: Create `services/session.ts`

**Files:**
- Create: `services/session.ts`

- [ ] **Step 1: Create `services/session.ts`**

```typescript
import { cookies } from 'next/headers';

export type ActiveSession = {
  profile_id: string;
  role_type: 'customer' | 'operator';
};

export async function setActiveSession(data: ActiveSession): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('scl_active_profile', JSON.stringify(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function getActiveSession(): Promise<ActiveSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get('scl_active_profile')?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveSession;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Verify TypeScript is clean**

```bash
npx tsc --noEmit
```
Expected: No output (exit code 0).

- [ ] **Step 3: Commit**

```bash
git add services/session.ts
git commit -m "feat: add session cookie helpers"
```

---

## Task 3: Create `app/auth/callback/route.ts`

**Files:**
- Create: `app/auth/callback/route.ts`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p app/auth/callback
```

- [ ] **Step 2: Write `app/auth/callback/route.ts`**

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/onboarding`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=confirmation_failed`);
}
```

- [ ] **Step 3: Verify TypeScript is clean**

```bash
npx tsc --noEmit
```
Expected: No output (exit code 0).

- [ ] **Step 4: Commit**

```bash
git add app/auth/callback/route.ts
git commit -m "feat: add auth callback route for email confirmation"
```

---

## Task 4: Update `app/auth/register/page.tsx` — add `emailRedirectTo`

**Files:**
- Modify: `app/auth/register/page.tsx` (line ~64, inside `handleSubmit`)

- [ ] **Step 1: Find the `signUp` call**

Open `app/auth/register/page.tsx`. Locate the `supabase.auth.signUp` call (currently around line 64). It looks like:

```typescript
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { full_name: fullName.trim(), active_role: 'customer' },
  },
});
```

- [ ] **Step 2: Add `emailRedirectTo` to the options**

Replace the `signUp` call with:

```typescript
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: { full_name: fullName.trim(), active_role: 'customer' },
    emailRedirectTo: `${window.location.origin}/auth/callback`,
  },
});
```

- [ ] **Step 3: Verify TypeScript is clean**

```bash
npx tsc --noEmit
```
Expected: No output (exit code 0).

- [ ] **Step 4: Commit**

```bash
git add app/auth/register/page.tsx
git commit -m "feat: redirect email confirmation to /auth/callback"
```

---

## Task 5: Update `middleware.ts` — protect `/onboarding`

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Add `/onboarding` to the `PROTECTED` array**

Open `middleware.ts`. The `PROTECTED` array currently reads:

```typescript
const PROTECTED = [
  '/booking',
  '/operator',
];
```

Change it to:

```typescript
const PROTECTED = [
  '/booking',
  '/operator',
  '/onboarding',
];
```

No other changes needed. `/auth/callback` is already safe — it does not match `/auth/login` or `/auth/register` in the `AUTH_PAGES` check, so authenticated users are never bounced away from it.

- [ ] **Step 2: Verify TypeScript is clean**

```bash
npx tsc --noEmit
```
Expected: No output (exit code 0).

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: protect /onboarding routes in middleware"
```

---

## Task 6: Create `actions/operatorActions.ts`

**Files:**
- Create: `actions/operatorActions.ts`

- [ ] **Step 1: Create the `actions` directory and file**

```bash
mkdir -p actions
```

- [ ] **Step 2: Write `actions/operatorActions.ts`**

```typescript
'use server';

import { redirect } from 'next/navigation';
import { createServerActionClient } from '@/services/supabaseServer';
import { setActiveSession } from '@/services/session';

// ── createOperatorProfile ─────────────────────────────────────────────────────
// Called from the operator onboarding form via useActionState.
// Signature matches React 19 useActionState: (prevState, formData) => State.
// On success it calls redirect() (throws NEXT_REDIRECT — never returns).
// On failure it returns { error } so the form can display an inline message.

export async function createOperatorProfile(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const supabase = await createServerActionClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'You must be logged in.' };

  // Idempotency — if operator profile already exists, just activate it
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'operator')
    .maybeSingle();

  if (existing) {
    await setActiveSession({ profile_id: existing.id, role_type: 'operator' });
    redirect('/operator');
  }

  // Step 1 — create the operator role row in profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .insert({ user_id: user.id, role_type: 'operator' })
    .select('id')
    .single();

  if (profileError || !profile) {
    return { error: 'Failed to create operator profile. Please try again.' };
  }

  // Step 2 — create the operator detail row
  const { error: opError } = await supabase.from('operator_profiles').insert({
    profile_id:          profile.id,
    entity_type:         formData.get('entity_type')         as string,
    legal_name:          formData.get('legal_name')          as string,
    registration_number: (formData.get('registration_number') as string) || null,
    vat_number:          (formData.get('vat_number')          as string) || null,
    country:             (formData.get('country')             as string) || 'South Africa',
    contact_person:      (formData.get('contact_person')      as string) || null,
    phone_number:        (formData.get('phone_number')        as string) || null,
  });

  if (opError) {
    // Roll back the profiles row so the user can retry cleanly
    await supabase.from('profiles').delete().eq('id', profile.id);
    return { error: 'Failed to save operator details. Please try again.' };
  }

  await setActiveSession({ profile_id: profile.id, role_type: 'operator' });
  redirect('/operator');
}

// ── switchToOperator ──────────────────────────────────────────────────────────
// Reusable action for any UI that wants to switch the active role to operator.
// Always redirects — no return value needed.

export async function switchToOperator(): Promise<void> {
  const supabase = await createServerActionClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'operator')
    .maybeSingle();

  if (profile) {
    await setActiveSession({ profile_id: profile.id, role_type: 'operator' });
    redirect('/operator');
  } else {
    redirect('/onboarding/operator');
  }
}
```

- [ ] **Step 3: Verify TypeScript is clean**

```bash
npx tsc --noEmit
```
Expected: No output (exit code 0).

- [ ] **Step 4: Commit**

```bash
git add actions/operatorActions.ts
git commit -m "feat: add createOperatorProfile and switchToOperator server actions"
```

---

## Task 7: Create `app/onboarding/page.tsx`

**Files:**
- Create: `app/onboarding/page.tsx`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p app/onboarding
```

- [ ] **Step 2: Write `app/onboarding/page.tsx`**

```typescript
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}
    >
      {/* Nav */}
      <nav className="flex items-center px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo_v4.png" alt="ShareConLoad" width={36} height={36} className="rounded-md" />
          <span className="text-xl font-bold text-white">ShareConLoad</span>
        </Link>
      </nav>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white text-center mb-2">
          How would you like to use ShareConLoad?
        </h1>
        <p className="text-gray-400 text-sm mb-10 text-center">
          You can switch roles any time after setup.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">

          {/* Operator card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: '#fff7ed' }}
            >
              🚢
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-800">I Have Container Space</h2>
              <p className="text-gray-500 text-sm mt-1">
                List available container space and earn from unused capacity
              </p>
            </div>
            <button
              onClick={() => router.push('/onboarding/operator')}
              className="btn w-full text-white font-bold rounded-xl mt-auto hover:opacity-90"
              style={{ backgroundColor: '#0f2044' }}
            >
              Join as Space Provider
            </button>
          </div>

          {/* Customer card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: '#fff7ed' }}
            >
              📦
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-800">I Need Container Space</h2>
              <p className="text-gray-500 text-sm mt-1">
                Book container space for your cargo quickly and securely
              </p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="btn w-full text-white font-bold rounded-xl mt-auto hover:opacity-90"
              style={{ backgroundColor: '#f97316' }}
            >
              Continue
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript is clean**

```bash
npx tsc --noEmit
```
Expected: No output (exit code 0).

- [ ] **Step 4: Commit**

```bash
git add app/onboarding/page.tsx
git commit -m "feat: add onboarding role selection page"
```

---

## Task 8: Create `app/onboarding/operator/page.tsx`

**Files:**
- Create: `app/onboarding/operator/page.tsx`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p app/onboarding/operator
```

- [ ] **Step 2: Write `app/onboarding/operator/page.tsx`**

```typescript
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useActionState } from 'react';
import { createOperatorProfile } from '@/actions/operatorActions';

export default function OperatorOnboardingPage() {
  const [state, formAction, isPending] = useActionState(createOperatorProfile, null);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}
    >
      {/* Nav */}
      <nav className="flex items-center px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo_v4.png" alt="ShareConLoad" width={36} height={36} className="rounded-md" />
          <span className="text-xl font-bold text-white">ShareConLoad</span>
        </Link>
      </nav>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg">
          <h1 className="text-2xl font-extrabold text-gray-800 mb-1">
            Set up your operator profile
          </h1>
          <p className="text-gray-400 text-sm mb-6">
            This information helps customers trust your listings.
          </p>

          {/* Inline error from server action */}
          {state?.error && (
            <div className="alert alert-error text-sm mb-5">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
              </svg>
              {state.error}
            </div>
          )}

          <form action={formAction} className="flex flex-col gap-4">

            {/* Entity type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Entity Type
              </label>
              <select name="entity_type" required className="select select-bordered w-full">
                <option value="individual">Individual</option>
                <option value="company">Company</option>
              </select>
            </div>

            {/* Legal name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Legal Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="legal_name"
                required
                placeholder="Your full legal name or company name"
                className="input input-bordered w-full"
              />
            </div>

            {/* Registration number */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Registration Number{' '}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                name="registration_number"
                placeholder="Company registration number"
                className="input input-bordered w-full"
              />
            </div>

            {/* VAT number */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                VAT Number{' '}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                name="vat_number"
                placeholder="VAT number"
                className="input input-bordered w-full"
              />
            </div>

            {/* Country */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Country</label>
              <input
                type="text"
                name="country"
                defaultValue="South Africa"
                className="input input-bordered w-full"
              />
            </div>

            {/* Contact person */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                name="contact_person"
                placeholder="Full name of primary contact"
                className="input input-bordered w-full"
              />
            </div>

            {/* Phone number */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone_number"
                placeholder="+27 XX XXX XXXX"
                className="input input-bordered w-full"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="btn w-full text-white font-bold rounded-xl mt-2 hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#f97316' }}
            >
              {isPending
                ? <span className="loading loading-spinner loading-sm" />
                : 'Complete Setup'}
            </button>

          </form>

          <p className="text-center text-sm text-gray-400 mt-4">
            <Link href="/onboarding" className="hover:underline">
              ← Back to role selection
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript is clean**

```bash
npx tsc --noEmit
```
Expected: No output (exit code 0).

- [ ] **Step 4: Commit**

```bash
git add app/onboarding/operator/page.tsx
git commit -m "feat: add operator onboarding form page"
```

---

## Task 9: Playwright tests + build verification

**Files:**
- Modify: `tests/shareconload.spec.ts` (append new describe block)

- [ ] **Step 1: Append onboarding tests to `tests/shareconload.spec.ts`**

Add the following at the end of the file (after the existing `Protected routes` describe block):

```typescript
// ── Onboarding & auth callback ────────────────────────────────────────────────

test.describe('Onboarding routing', () => {
  test('unauthenticated /onboarding redirects to login', async ({ page }) => {
    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fonboarding/);
  });

  test('unauthenticated /onboarding/operator redirects to login', async ({ page }) => {
    await page.goto('/onboarding/operator');
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fonboarding%2Foperator/);
  });

  test('/auth/callback with no code redirects to login with error', async ({ page }) => {
    await page.goto('/auth/callback');
    await expect(page).toHaveURL(/\/auth\/login\?error=confirmation_failed/);
  });
});
```

- [ ] **Step 2: Run the new tests (dev server must be running)**

In a separate terminal, start the dev server:
```bash
npm run dev
```

Then run only the new tests:
```bash
npx playwright test --grep "Onboarding routing" --project=chromium
```

Expected output:
```
  ✓ unauthenticated /onboarding redirects to login
  ✓ unauthenticated /onboarding/operator redirects to login
  ✓ /auth/callback with no code redirects to login with error

  3 passed
```

- [ ] **Step 3: Run full test suite to check for regressions**

```bash
npx playwright test --project=chromium
```

Expected: All previously passing tests still pass. The 3 new tests pass.

- [ ] **Step 4: Run production build to verify no build errors**

```bash
npm run build
```

Expected: Build completes successfully with no TypeScript or compilation errors.

- [ ] **Step 5: Commit**

```bash
git add tests/shareconload.spec.ts
git commit -m "test: add Playwright tests for onboarding routing and auth callback"
```

---

## Done

After Task 9 passes, the following flows are fully implemented:

| Flow | Behaviour |
|---|---|
| New user signs up | Gets "check your email" screen |
| User clicks confirmation link | `/auth/callback` exchanges code, redirects to `/onboarding` |
| User picks Customer on `/onboarding` | Redirected to `/` |
| User picks Operator on `/onboarding` | Redirected to `/onboarding/operator` |
| User submits operator form | Server action inserts `profiles` + `operator_profiles`, sets cookie, redirects to `/operator` |
| User re-submits operator form (idempotent) | Existing profile found, cookie set, redirect to `/operator` — no duplicate insert |
| Any page calls `switchToOperator()` | Checks for operator profile → `/operator` or `/onboarding/operator` |
| Unauthenticated access to `/onboarding*` | Middleware redirects to `/auth/login?next=...` |
