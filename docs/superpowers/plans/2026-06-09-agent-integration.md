# Agent Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class Agent role to ShareConLoad — agents can onboard, manage a list of their shippers, and place bookings on shippers' behalf, with full portal visibility into their facilitated bookings.

**Architecture:** Agent is a new `role_type = 'agent'` value in the existing `profiles` table (text column, no enum change needed). Each agent has an `agent_profiles` detail row and a list of `agent_managed_shippers`. Bookings placed by agents carry `agent_profile_id` and `managed_shipper_id` nullable columns. The booking form detects the agent session and shows a shipper selector before submission.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (PostgreSQL + RLS), Tailwind CSS, DaisyUI, `@supabase/ssr`, React `useActionState`, Paystack (no changes needed for Phase 1)

---

## File Map

| Action | Path |
|--------|------|
| Create | `supabase/migrations/2026XXXX_42_agent_integration.sql` |
| Modify | `services/session.ts` |
| Create | `actions/agentActions.ts` |
| Modify | `app/onboarding/page.tsx` |
| Create | `app/onboarding/agent/page.tsx` |
| Create | `app/agent/layout.tsx` |
| Create | `app/agent/page.tsx` |
| Create | `app/agent/shippers/page.tsx` |
| Create | `app/agent/shippers/new/page.tsx` |
| Create | `app/agent/bookings/page.tsx` |
| Modify | `app/booking/[containerId]/page.tsx` |
| Modify | `app/page.tsx` |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260609_42_agent_integration.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260609_42_agent_integration.sql

-- 1. agent_profiles ─────────────────────────────────────────────────────────
create table if not exists public.agent_profiles (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  business_name     text not null,
  contact_person    text,
  phone_number      text,
  country           text not null default 'South Africa',
  status            text not null default 'active' check (status in ('active', 'suspended')),
  created_at        timestamptz not null default now()
);

create unique index if not exists agent_profiles_profile_id_idx on public.agent_profiles(profile_id);

-- 2. agent_managed_shippers ─────────────────────────────────────────────────
create table if not exists public.agent_managed_shippers (
  id                uuid primary key default gen_random_uuid(),
  agent_profile_id  uuid not null references public.agent_profiles(id) on delete cascade,
  name              text not null,
  contact_email     text,
  contact_phone     text,
  country           text,
  notes             text,
  created_at        timestamptz not null default now()
);

create index if not exists agent_managed_shippers_agent_idx
  on public.agent_managed_shippers(agent_profile_id);

-- 3. Add agent columns to bookings ──────────────────────────────────────────
alter table public.bookings
  add column if not exists agent_profile_id    uuid references public.agent_profiles(id),
  add column if not exists managed_shipper_id  uuid references public.agent_managed_shippers(id);

create index if not exists bookings_agent_profile_id_idx on public.bookings(agent_profile_id);

-- 4. RLS: agent_profiles ────────────────────────────────────────────────────
alter table public.agent_profiles enable row level security;

drop policy if exists "agents_manage_own_profile" on public.agent_profiles;
create policy "agents_manage_own_profile"
  on public.agent_profiles for all
  using (
    profile_id in (
      select id from public.profiles where user_id = auth.uid()
    )
  )
  with check (
    profile_id in (
      select id from public.profiles where user_id = auth.uid()
    )
  );

drop policy if exists "admins_all_agent_profiles" on public.agent_profiles;
create policy "admins_all_agent_profiles"
  on public.agent_profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- 5. RLS: agent_managed_shippers ────────────────────────────────────────────
alter table public.agent_managed_shippers enable row level security;

drop policy if exists "agents_manage_own_shippers" on public.agent_managed_shippers;
create policy "agents_manage_own_shippers"
  on public.agent_managed_shippers for all
  using (
    agent_profile_id in (
      select ap.id from public.agent_profiles ap
      join public.profiles p on p.id = ap.profile_id
      where p.user_id = auth.uid()
    )
  )
  with check (
    agent_profile_id in (
      select ap.id from public.agent_profiles ap
      join public.profiles p on p.id = ap.profile_id
      where p.user_id = auth.uid()
    )
  );

drop policy if exists "admins_all_managed_shippers" on public.agent_managed_shippers;
create policy "admins_all_managed_shippers"
  on public.agent_managed_shippers for all
  using (public.is_admin())
  with check (public.is_admin());

-- 6. Allow agents to read bookings they facilitated ─────────────────────────
drop policy if exists "agents_view_facilitated_bookings" on public.bookings;
create policy "agents_view_facilitated_bookings"
  on public.bookings for select
  using (
    agent_profile_id in (
      select ap.id from public.agent_profiles ap
      join public.profiles p on p.id = ap.profile_id
      where p.user_id = auth.uid()
    )
  );

-- 7. Allow agents to insert bookings (agent-facilitated) ────────────────────
drop policy if exists "agents_insert_facilitated_bookings" on public.bookings;
create policy "agents_insert_facilitated_bookings"
  on public.bookings for insert
  with check (
    agent_profile_id in (
      select ap.id from public.agent_profiles ap
      join public.profiles p on p.id = ap.profile_id
      where p.user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Apply migration to Supabase**

Run in Supabase SQL editor or via CLI:
```bash
supabase db push
```
Or paste the SQL directly into the Supabase dashboard SQL editor and execute.

- [ ] **Step 3: Verify tables exist**

In Supabase Table Editor, confirm:
- `agent_profiles` table is present with correct columns
- `agent_managed_shippers` table is present
- `bookings` table has `agent_profile_id` and `managed_shipper_id` columns

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260609_42_agent_integration.sql
git commit -m "feat: add agent_profiles, agent_managed_shippers tables and booking agent columns"
```

---

## Task 2: Session Type + Agent Actions

**Files:**
- Modify: `services/session.ts`
- Create: `actions/agentActions.ts`

- [ ] **Step 1: Update session.ts to include agent role**

Replace the `ActiveSession` type and keep everything else identical:

```ts
// services/session.ts
import { cookies } from 'next/headers';

export type ActiveSession = {
  profile_id: string;
  role_type: 'customer' | 'operator' | 'agent';
};

export async function setActiveSession(data: ActiveSession): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set('scl_active_profile', JSON.stringify(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
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

- [ ] **Step 2: Create actions/agentActions.ts**

```ts
// actions/agentActions.ts
'use server';

import { redirect } from 'next/navigation';
import { createServerActionClient } from '@/services/supabaseServer';
import { setActiveSession } from '@/services/session';

// ── createAgentProfile ────────────────────────────────────────────────────────
export async function createAgentProfile(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const supabase = await createServerActionClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'You must be logged in.' };

  // Idempotency check
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'agent')
    .maybeSingle();

  if (existingProfile) {
    const { data: existingAgentProfile } = await supabase
      .from('agent_profiles')
      .select('id')
      .eq('profile_id', existingProfile.id)
      .maybeSingle();

    if (existingAgentProfile) {
      await setActiveSession({ profile_id: existingProfile.id, role_type: 'agent' });
      redirect('/agent');
    } else {
      await supabase.from('profiles').delete().eq('id', existingProfile.id);
    }
  }

  // Step 1: create profiles row
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .insert({ user_id: user.id, role_type: 'agent' })
    .select('id')
    .single();

  if (profileError || !profile) {
    return { error: 'Failed to create agent profile. Please try again.' };
  }

  // Step 2: create agent_profiles row
  const { error: agentError } = await supabase.from('agent_profiles').insert({
    profile_id:    profile.id,
    business_name: formData.get('business_name') as string,
    contact_person: (formData.get('contact_person') as string) || null,
    phone_number:  (formData.get('phone_number') as string) || null,
    country:       (formData.get('country') as string) || 'South Africa',
  });

  if (agentError) {
    console.error('agent_profiles insert failed:', agentError);
    await supabase.from('profiles').delete().eq('id', profile.id);
    return { error: `Failed to save agent details: ${agentError.message}` };
  }

  await setActiveSession({ profile_id: profile.id, role_type: 'agent' });
  redirect('/agent');
}

// ── switchToAgent ─────────────────────────────────────────────────────────────
export async function switchToAgent(): Promise<void> {
  const supabase = await createServerActionClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'agent')
    .maybeSingle();

  if (profile) {
    await setActiveSession({ profile_id: profile.id, role_type: 'agent' });
    redirect('/agent');
  } else {
    redirect('/onboarding/agent');
  }
}

// ── addManagedShipper ─────────────────────────────────────────────────────────
export async function addManagedShipper(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const supabase = await createServerActionClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'You must be logged in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'agent')
    .maybeSingle();

  if (!profile) return { error: 'Agent profile not found.' };

  const { data: agentProfile } = await supabase
    .from('agent_profiles')
    .select('id')
    .eq('profile_id', profile.id)
    .maybeSingle();

  if (!agentProfile) return { error: 'Agent profile not found.' };

  const { error: insertError } = await supabase.from('agent_managed_shippers').insert({
    agent_profile_id: agentProfile.id,
    name:             formData.get('name') as string,
    contact_email:    (formData.get('contact_email') as string) || null,
    contact_phone:    (formData.get('contact_phone') as string) || null,
    country:          (formData.get('country') as string) || null,
    notes:            (formData.get('notes') as string) || null,
  });

  if (insertError) {
    return { error: `Failed to add shipper: ${insertError.message}` };
  }

  redirect('/agent/shippers');
}
```

- [ ] **Step 3: Commit**

```bash
git add services/session.ts actions/agentActions.ts
git commit -m "feat: add agent session type and agentActions (createAgentProfile, switchToAgent, addManagedShipper)"
```

---

## Task 3: Onboarding — Add Agent Card + Agent Onboarding Page

**Files:**
- Modify: `app/onboarding/page.tsx`
- Create: `app/onboarding/agent/page.tsx`

- [ ] **Step 1: Add Agent card to app/onboarding/page.tsx**

Replace the `grid` section (currently `grid-cols-1 sm:grid-cols-2`) to include the agent card:

```tsx
// app/onboarding/page.tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { switchToCustomer } from '@/actions/operatorActions';

export default function OnboardingPage() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}
    >
      <nav className="flex items-center px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-white">Share</span>
            <span style={{ color: '#f97316' }}>Con</span>
            <span className="text-white">Load</span>
          </span>
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white text-center mb-2">
          How would you like to use ShareConLoad?
        </h1>
        <p className="text-gray-400 text-sm mb-10 text-center">
          You can switch roles any time after setup.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl">

          {/* Operator card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: '#fff7ed' }}>
              🚢
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-800">I Have Container Space</h2>
              <p className="text-gray-500 text-sm mt-1">List available container space and earn from unused capacity</p>
            </div>
            <button
              onClick={() => router.push('/onboarding/operator')}
              className="btn w-full text-white font-bold rounded-xl mt-auto hover:opacity-90"
              style={{ backgroundColor: '#0f2044' }}
            >
              Join as Space Provider
            </button>
          </div>

          {/* Shipper card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: '#fff7ed' }}>
              📦
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-800">I Need Container Space</h2>
              <p className="text-gray-500 text-sm mt-1">Book container space for your cargo quickly and securely</p>
            </div>
            <form action={switchToCustomer}>
              <button
                type="submit"
                className="btn w-full text-white font-bold rounded-xl mt-auto hover:opacity-90"
                style={{ backgroundColor: '#f97316' }}
              >
                Continue
              </button>
            </form>
          </div>

          {/* Agent card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: '#f0fdf4' }}>
              🤝
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-800">I Am a Freight Agent</h2>
              <p className="text-gray-500 text-sm mt-1">Manage shippers, book space on their behalf, and coordinate cargo</p>
            </div>
            <button
              onClick={() => router.push('/onboarding/agent')}
              className="btn w-full text-white font-bold rounded-xl mt-auto hover:opacity-90"
              style={{ backgroundColor: '#16a34a' }}
            >
              Join as Agent
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create app/onboarding/agent/page.tsx**

```tsx
// app/onboarding/agent/page.tsx
'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { createAgentProfile } from '@/actions/agentActions';

const COUNTRIES = [
  'South Africa', 'Angola', 'Botswana', 'Cameroon', 'Congo', 'Egypt',
  'Ethiopia', 'Ghana', 'India', 'Kenya', 'Malaysia', 'Mozambique',
  'Namibia', 'Nigeria', 'Rwanda', 'Senegal', 'Tanzania', 'Uganda',
  'United Arab Emirates', 'United Kingdom', 'United States', 'Zambia', 'Zimbabwe',
].sort((a, b) => {
  if (a === 'South Africa') return -1;
  if (b === 'South Africa') return 1;
  return a.localeCompare(b);
});

export default function AgentOnboardingPage() {
  const [state, formAction, isPending] = useActionState(createAgentProfile, null);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}
    >
      <nav className="flex items-center px-6 py-4">
        <Link href="/onboarding" className="flex items-center gap-3">
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-white">Share</span>
            <span style={{ color: '#f97316' }}>Con</span>
            <span className="text-white">Load</span>
          </span>
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg">
          <div className="mb-6">
            <span className="inline-block text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-green-50 text-green-600 mb-3">
              Agent Onboarding
            </span>
            <h1 className="text-2xl font-extrabold text-gray-900">Set up your agent account</h1>
            <p className="text-gray-500 text-sm mt-1">
              You will be able to add shippers and book container space on their behalf.
            </p>
          </div>

          {state?.error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
            </div>
          )}

          <form action={formAction} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Business / Agency Name <span className="text-red-500">*</span>
              </label>
              <input
                name="business_name"
                required
                className="input input-bordered w-full text-sm"
                placeholder="e.g. FastTrack Freight Agents"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Contact Person</label>
              <input
                name="contact_person"
                className="input input-bordered w-full text-sm"
                placeholder="Full name"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
              <input
                name="phone_number"
                type="tel"
                className="input input-bordered w-full text-sm"
                placeholder="+27 82 123 4567"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Country</label>
              <select name="country" className="select select-bordered w-full text-sm">
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="btn w-full text-white font-bold rounded-xl mt-2 hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#16a34a' }}
            >
              {isPending ? <span className="loading loading-spinner loading-sm" /> : 'Create Agent Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/onboarding/page.tsx app/onboarding/agent/page.tsx
git commit -m "feat: add agent card to onboarding and agent onboarding form"
```

---

## Task 4: Agent Portal Layout + Dashboard

**Files:**
- Create: `app/agent/layout.tsx`
- Create: `app/agent/page.tsx`

- [ ] **Step 1: Create app/agent/layout.tsx**

This layout gates the `/agent` tree — redirects non-agents to onboarding.

```tsx
// app/agent/layout.tsx
import { redirect } from 'next/navigation';
import { createServerComponentClient } from '@/services/supabaseServer';

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'agent')
    .maybeSingle();

  if (!profile) redirect('/onboarding/agent');

  return <>{children}</>;
}
```

- [ ] **Step 2: Create app/agent/page.tsx**

```tsx
// app/agent/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';

type AgentProfile = {
  id: string;
  business_name: string;
  contact_person: string | null;
  country: string;
};

type BookingSummary = {
  id: string;
  total_cbm: number;
  total_price: number;
  status: string;
  created_at: string;
  managed_shipper_id: string | null;
  agent_managed_shippers: { name: string } | null;
  containers: {
    origin_city: string;
    origin_country: string;
    destination_city: string;
    destination_country: string;
    departure_date: string;
  } | null;
};

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending:    { bg: '#fff7ed', color: '#f97316', label: 'Pending' },
  confirmed:  { bg: '#eff6ff', color: '#3b82f6', label: 'Confirmed' },
  loaded:     { bg: '#f5f3ff', color: '#8b5cf6', label: 'Loaded' },
  in_transit: { bg: '#ecfeff', color: '#06b6d4', label: 'In Transit' },
  delivered:  { bg: '#f0fdf4', color: '#22c55e', label: 'Delivered' },
  cancelled:  { bg: '#f9fafb', color: '#6b7280', label: 'Cancelled' },
};

export default function AgentDashboard() {
  const router = useRouter();
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [shipperCount, setShipperCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role_type', 'agent')
        .maybeSingle();

      if (!profile) { router.push('/onboarding/agent'); return; }

      const { data: ap } = await supabase
        .from('agent_profiles')
        .select('id, business_name, contact_person, country')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (!ap) { router.push('/onboarding/agent'); return; }
      setAgentProfile(ap);

      const [{ count }, { data: recentBookings }] = await Promise.all([
        supabase
          .from('agent_managed_shippers')
          .select('id', { count: 'exact', head: true })
          .eq('agent_profile_id', ap.id),
        supabase
          .from('bookings')
          .select('id, total_cbm, total_price, status, created_at, managed_shipper_id, agent_managed_shippers(name), containers(origin_city, origin_country, destination_city, destination_country, departure_date)')
          .eq('agent_profile_id', ap.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      setShipperCount(count ?? 0);
      setBookings((recentBookings as BookingSummary[]) ?? []);
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <span className="loading loading-spinner loading-lg" style={{ color: '#16a34a' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 sm:px-10 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo1.png" alt="" width={40} height={40} className="h-9 w-auto" />
            <span className="text-xl font-extrabold tracking-tight">
              <span style={{ color: '#0f2044' }}>Share</span>
              <span style={{ color: '#f97316' }}>Con</span>
              <span style={{ color: '#0f2044' }}>Load</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-5 text-sm font-medium text-gray-600">
            <Link href="/agent" className="font-semibold" style={{ color: '#16a34a' }}>Dashboard</Link>
            <Link href="/agent/shippers" className="hover:text-gray-900 transition-colors">My Shippers</Link>
            <Link href="/agent/bookings" className="hover:text-gray-900 transition-colors">Bookings</Link>
            <Link href="/#listings" className="hover:text-gray-900 transition-colors">Browse Containers</Link>
          </div>
          <Link
            href="/auth/login"
            className="text-sm font-medium text-gray-700 hover:text-gray-900 px-4 py-1.5 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors"
          >
            Sign Out
          </Link>
        </div>
      </nav>

      {/* Header */}
      <div className="py-8 px-6 sm:px-10" style={{ background: 'linear-gradient(135deg, #14532d 0%, #16a34a 100%)' }}>
        <div className="max-w-5xl mx-auto">
          <p className="text-green-200 text-xs font-bold uppercase tracking-widest mb-1">Agent Portal</p>
          <h1 className="text-2xl font-extrabold text-white">{agentProfile?.business_name}</h1>
          <p className="text-green-200 text-sm mt-1">{agentProfile?.country}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-8 space-y-8">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Managed Shippers', value: shipperCount, href: '/agent/shippers' },
            { label: 'Total Bookings', value: bookings.length, href: '/agent/bookings' },
            { label: 'Active Bookings', value: bookings.filter(b => !['delivered','cancelled'].includes(b.status)).length, href: '/agent/bookings' },
          ].map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-green-200 transition-colors"
            >
              <p className="text-2xl font-extrabold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </Link>
          ))}
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-3">
          <Link
            href="/#listings"
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#16a34a' }}
          >
            Book Container Space
          </Link>
          <Link
            href="/agent/shippers/new"
            className="px-5 py-2.5 rounded-xl text-sm font-bold border border-gray-200 text-gray-700 hover:border-gray-400 transition-colors bg-white"
          >
            Add Shipper
          </Link>
        </div>

        {/* Recent bookings */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-extrabold text-gray-900">Recent Bookings</h2>
            <Link href="/agent/bookings" className="text-xs font-semibold text-green-600 hover:text-green-800">View all</Link>
          </div>

          {bookings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <p className="text-gray-400 text-sm">No bookings yet. Browse containers to place your first booking.</p>
              <Link href="/#listings" className="inline-block mt-4 text-sm font-bold text-green-600 hover:text-green-800">
                Browse Containers
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {bookings.map((b) => {
                const style = STATUS_STYLES[b.status] ?? STATUS_STYLES.pending;
                const c = b.containers;
                return (
                  <Link
                    key={b.id}
                    href={`/booking/track/${b.id}`}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between hover:border-green-200 transition-colors"
                  >
                    <div>
                      {c && (
                        <p className="text-sm font-bold text-gray-900">
                          {c.origin_city}, {c.origin_country} to {c.destination_city}, {c.destination_country}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {b.agent_managed_shippers?.name ?? 'Direct booking'} · {b.total_cbm} CBM · ZAR {b.total_price.toLocaleString()}
                      </p>
                    </div>
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
                      style={{ backgroundColor: style.bg, color: style.color }}
                    >
                      {style.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/agent/layout.tsx app/agent/page.tsx
git commit -m "feat: add agent portal layout and dashboard"
```

---

## Task 5: Agent Shippers Management Pages

**Files:**
- Create: `app/agent/shippers/page.tsx`
- Create: `app/agent/shippers/new/page.tsx`

- [ ] **Step 1: Create app/agent/shippers/page.tsx**

```tsx
// app/agent/shippers/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/services/supabaseClient';

type ManagedShipper = {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  country: string | null;
  notes: string | null;
  created_at: string;
};

export default function AgentShippersPage() {
  const [shippers, setShippers] = useState<ManagedShipper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role_type', 'agent')
        .maybeSingle();

      if (!profile) return;

      const { data: ap } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (!ap) return;

      const { data } = await supabase
        .from('agent_managed_shippers')
        .select('id, name, contact_email, contact_phone, country, notes, created_at')
        .eq('agent_profile_id', ap.id)
        .order('created_at', { ascending: false });

      setShippers(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 sm:px-10 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo1.png" alt="" width={40} height={40} className="h-9 w-auto" />
            <span className="text-xl font-extrabold tracking-tight">
              <span style={{ color: '#0f2044' }}>Share</span>
              <span style={{ color: '#f97316' }}>Con</span>
              <span style={{ color: '#0f2044' }}>Load</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-5 text-sm font-medium text-gray-600">
            <Link href="/agent" className="hover:text-gray-900 transition-colors">Dashboard</Link>
            <Link href="/agent/shippers" className="font-semibold" style={{ color: '#16a34a' }}>My Shippers</Link>
            <Link href="/agent/bookings" className="hover:text-gray-900 transition-colors">Bookings</Link>
          </div>
          <Link href="/agent/shippers/new" className="text-sm font-bold text-white px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity" style={{ backgroundColor: '#16a34a' }}>
            Add Shipper
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">My Shippers</h1>
            <p className="text-xs text-gray-400 mt-0.5">{shippers.length} shipper{shippers.length !== 1 ? 's' : ''} managed</p>
          </div>
          <Link
            href="/agent/shippers/new"
            className="px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#16a34a' }}
          >
            Add Shipper
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" style={{ color: '#16a34a' }} />
          </div>
        ) : shippers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <p className="text-gray-400 text-sm mb-4">No shippers added yet.</p>
            <Link href="/agent/shippers/new" className="text-sm font-bold text-green-600 hover:text-green-800">
              Add your first shipper
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {shippers.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-extrabold text-gray-900">{s.name}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      {s.contact_email && <p className="text-xs text-gray-400">{s.contact_email}</p>}
                      {s.contact_phone && <p className="text-xs text-gray-400">{s.contact_phone}</p>}
                      {s.country && <p className="text-xs text-gray-400">{s.country}</p>}
                    </div>
                    {s.notes && <p className="text-xs text-gray-400 mt-1 italic">{s.notes}</p>}
                  </div>
                  <Link
                    href={`/agent/bookings?shipper=${s.id}`}
                    className="text-xs font-semibold text-green-600 hover:text-green-800 shrink-0"
                  >
                    View Bookings
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create app/agent/shippers/new/page.tsx**

```tsx
// app/agent/shippers/new/page.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useActionState } from 'react';
import { addManagedShipper } from '@/actions/agentActions';

const COUNTRIES = [
  'South Africa', 'Angola', 'Botswana', 'Cameroon', 'Congo', 'Egypt',
  'Ethiopia', 'Ghana', 'India', 'Kenya', 'Malaysia', 'Mozambique',
  'Namibia', 'Nigeria', 'Rwanda', 'Senegal', 'Tanzania', 'Uganda',
  'United Arab Emirates', 'United Kingdom', 'United States', 'Zambia', 'Zimbabwe',
].sort((a, b) => {
  if (a === 'South Africa') return -1;
  if (b === 'South Africa') return 1;
  return a.localeCompare(b);
});

export default function AddShipperPage() {
  const [state, formAction, isPending] = useActionState(addManagedShipper, null);

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 sm:px-10 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo1.png" alt="" width={40} height={40} className="h-9 w-auto" />
            <span className="text-xl font-extrabold tracking-tight">
              <span style={{ color: '#0f2044' }}>Share</span>
              <span style={{ color: '#f97316' }}>Con</span>
              <span style={{ color: '#0f2044' }}>Load</span>
            </span>
          </Link>
          <Link href="/agent/shippers" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Shippers
          </Link>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-6 py-10">
        <h1 className="text-xl font-extrabold text-gray-900 mb-1">Add a Shipper</h1>
        <p className="text-sm text-gray-400 mb-6">Add a client you manage so you can book container space on their behalf.</p>

        {state?.error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        <form action={formAction} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Shipper Name <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              required
              className="input input-bordered w-full text-sm"
              placeholder="Company or individual name"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Contact Email</label>
            <input
              name="contact_email"
              type="email"
              className="input input-bordered w-full text-sm"
              placeholder="shipper@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Contact Phone</label>
            <input
              name="contact_phone"
              type="tel"
              className="input input-bordered w-full text-sm"
              placeholder="+27 82 123 4567"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Country</label>
            <select name="country" className="select select-bordered w-full text-sm">
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Notes</label>
            <textarea
              name="notes"
              rows={2}
              className="textarea textarea-bordered w-full text-sm"
              placeholder="Optional notes about this shipper"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="btn w-full text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#16a34a' }}
          >
            {isPending ? <span className="loading loading-spinner loading-sm" /> : 'Add Shipper'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/agent/shippers/page.tsx app/agent/shippers/new/page.tsx
git commit -m "feat: add agent shippers list and add-shipper form"
```

---

## Task 6: Agent Bookings Page

**Files:**
- Create: `app/agent/bookings/page.tsx`

- [ ] **Step 1: Create app/agent/bookings/page.tsx**

```tsx
// app/agent/bookings/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { supabase } from '@/services/supabaseClient';

type BookingRow = {
  id: string;
  total_cbm: number;
  total_price: number;
  status: string;
  created_at: string;
  managed_shipper_id: string | null;
  agent_managed_shippers: { name: string } | null;
  containers: {
    origin_city: string;
    origin_country: string;
    destination_city: string;
    destination_country: string;
    departure_date: string;
  } | null;
};

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending:    { bg: '#fff7ed', color: '#f97316', label: 'Pending' },
  confirmed:  { bg: '#eff6ff', color: '#3b82f6', label: 'Confirmed' },
  loaded:     { bg: '#f5f3ff', color: '#8b5cf6', label: 'Loaded' },
  in_transit: { bg: '#ecfeff', color: '#06b6d4', label: 'In Transit' },
  delivered:  { bg: '#f0fdf4', color: '#22c55e', label: 'Delivered' },
  cancelled:  { bg: '#f9fafb', color: '#6b7280', label: 'Cancelled' },
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function AgentBookingsContent() {
  const searchParams = useSearchParams();
  const shipperFilter = searchParams.get('shipper');

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role_type', 'agent')
        .maybeSingle();

      if (!profile) return;

      const { data: ap } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (!ap) return;

      let query = supabase
        .from('bookings')
        .select('id, total_cbm, total_price, status, created_at, managed_shipper_id, agent_managed_shippers(name), containers(origin_city, origin_country, destination_city, destination_country, departure_date)')
        .eq('agent_profile_id', ap.id)
        .order('created_at', { ascending: false });

      if (shipperFilter) {
        query = query.eq('managed_shipper_id', shipperFilter);
      }

      const { data } = await query;
      setBookings((data as BookingRow[]) ?? []);
      setLoading(false);
    }
    load();
  }, [shipperFilter]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-lg" style={{ color: '#16a34a' }} />
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
        <p className="text-gray-400 text-sm mb-4">No bookings found.</p>
        <Link href="/#listings" className="text-sm font-bold text-green-600 hover:text-green-800">
          Browse containers to place a booking
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {bookings.map((b) => {
        const style = STATUS_STYLES[b.status] ?? STATUS_STYLES.pending;
        const c = b.containers;
        return (
          <Link
            key={b.id}
            href={`/booking/track/${b.id}`}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between hover:border-green-200 transition-colors"
          >
            <div>
              {c && (
                <p className="text-sm font-bold text-gray-900">
                  {c.origin_city}, {c.origin_country} to {c.destination_city}, {c.destination_country}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">
                {b.agent_managed_shippers?.name ?? 'Direct'} · {b.total_cbm} CBM · ZAR {b.total_price.toLocaleString()} · {c ? fmt(c.departure_date) : ''}
              </p>
            </div>
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
              style={{ backgroundColor: style.bg, color: style.color }}
            >
              {style.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export default function AgentBookingsPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 sm:px-10 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo1.png" alt="" width={40} height={40} className="h-9 w-auto" />
            <span className="text-xl font-extrabold tracking-tight">
              <span style={{ color: '#0f2044' }}>Share</span>
              <span style={{ color: '#f97316' }}>Con</span>
              <span style={{ color: '#0f2044' }}>Load</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-5 text-sm font-medium text-gray-600">
            <Link href="/agent" className="hover:text-gray-900 transition-colors">Dashboard</Link>
            <Link href="/agent/shippers" className="hover:text-gray-900 transition-colors">My Shippers</Link>
            <Link href="/agent/bookings" className="font-semibold" style={{ color: '#16a34a' }}>Bookings</Link>
          </div>
          <Link href="/#listings" className="text-sm font-bold text-white px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity" style={{ backgroundColor: '#16a34a' }}>
            Book Space
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-extrabold text-gray-900">Bookings</h1>
          <Link href="/#listings" className="px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90" style={{ backgroundColor: '#16a34a' }}>
            New Booking
          </Link>
        </div>
        <Suspense fallback={<div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg" style={{ color: '#16a34a' }} /></div>}>
          <AgentBookingsContent />
        </Suspense>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/agent/bookings/page.tsx
git commit -m "feat: add agent bookings page with shipper filter"
```

---

## Task 7: Booking Form — Agent-Facilitated Flow

**Files:**
- Modify: `app/booking/[containerId]/page.tsx`

The booking form currently inserts `customer_id` from the user's customer profile. When the user is an agent, it must:
1. Detect agent session at load time
2. Fetch the agent's managed shippers
3. Show a "Booking on behalf of" select above the form
4. Include `agent_profile_id` and `managed_shipper_id` in the booking insert

- [ ] **Step 1: Add agent detection and shipper select to the booking page**

Add these state variables and the fetch near the top of the `BookingPage` component (after existing state declarations):

```tsx
// Add to state section of BookingPage
const [isAgent, setIsAgent] = useState(false);
const [agentProfileId, setAgentProfileId] = useState<string | null>(null);
const [managedShippers, setManagedShippers] = useState<{ id: string; name: string }[]>([]);
const [selectedShipperId, setSelectedShipperId] = useState<string>('');
```

Add this useEffect after the existing container fetch useEffect:

```tsx
useEffect(() => {
  async function detectAgent() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role_type', 'agent')
      .maybeSingle();

    if (!profile) return;

    const { data: ap } = await supabase
      .from('agent_profiles')
      .select('id')
      .eq('profile_id', profile.id)
      .maybeSingle();

    if (!ap) return;

    setIsAgent(true);
    setAgentProfileId(ap.id);

    const { data: shippers } = await supabase
      .from('agent_managed_shippers')
      .select('id, name')
      .eq('agent_profile_id', ap.id)
      .order('name');

    setManagedShippers(shippers ?? []);
  }
  detectAgent();
}, []);
```

- [ ] **Step 2: Add shipper selector UI to the booking form**

Inside the booking form JSX, add this block immediately before the CBM input section (look for the `total_cbm` label):

```tsx
{isAgent && (
  <div className="rounded-xl border border-green-100 bg-green-50 p-4 mb-2">
    <label className="block text-xs font-bold text-green-800 mb-1">
      Booking on behalf of <span className="text-red-500">*</span>
    </label>
    <select
      value={selectedShipperId}
      onChange={(e) => setSelectedShipperId(e.target.value)}
      className="select select-bordered w-full text-sm bg-white"
      required
    >
      <option value="">Select a shipper</option>
      {managedShippers.map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
    {managedShippers.length === 0 && (
      <p className="text-xs text-green-700 mt-1">
        No shippers added yet.{' '}
        <a href="/agent/shippers/new" className="underline font-semibold">Add a shipper first.</a>
      </p>
    )}
  </div>
)}
```

- [ ] **Step 3: Pass agent fields in the booking insert**

Find the booking insert inside the `handleSubmit` function. It will contain `.insert({ customer_id: ..., container_id: ..., ... })`. Add the two agent fields:

```tsx
// Inside the bookings insert object, add:
...(isAgent && agentProfileId ? {
  agent_profile_id: agentProfileId,
  managed_shipper_id: selectedShipperId || null,
} : {}),
```

- [ ] **Step 4: Validate shipper selection for agents**

Inside the `validate()` function, add:

```tsx
if (isAgent && !selectedShipperId) {
  errs.submit = 'Please select which shipper this booking is for.';
}
```

- [ ] **Step 5: Commit**

```bash
git add "app/booking/[containerId]/page.tsx"
git commit -m "feat: detect agent session in booking form and pass agent_profile_id and managed_shipper_id on submit"
```

---

## Task 8: Home Page — Agent Portal Link

**Files:**
- Modify: `app/page.tsx`

The home page already detects `isOperator`. Add parallel `isAgent` detection so agents see a portal link.

- [ ] **Step 1: Add isAgent state and detection to app/page.tsx**

Find the existing state declarations:
```tsx
const [isOperator, setIsOperator] = useState(false);
const [isAdmin, setIsAdmin] = useState(false);
```

Add below:
```tsx
const [isAgent, setIsAgent] = useState(false);
```

Inside `resolveUser`, after `setIsOperator(...)`:
```tsx
setIsAgent(data?.some((p) => p.role_type === 'agent') ?? false);
```

- [ ] **Step 2: Add agent portal button to the desktop nav**

Find the operator portal button in the nav (it uses `handleSwitchToOperator`). After it, add:

```tsx
{isAgent && (
  <Link
    href="/agent"
    className="hidden md:flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg text-white hover:opacity-90 transition-opacity"
    style={{ backgroundColor: '#16a34a' }}
  >
    Agent Portal
  </Link>
)}
```

- [ ] **Step 3: Add agent link to mobile nav**

Find the mobile nav links section (already has "How It Works", "Browse Containers", etc.). Add:

```tsx
{isAgent && (
  <Link
    href="/agent"
    onClick={() => setMobileNavOpen(false)}
    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-colors"
    style={{ backgroundColor: '#16a34a' }}
  >
    Agent Portal
  </Link>
)}
```

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: show agent portal link on home page nav for agent users"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|---|---|
| Agent role in profiles table | Task 1 |
| agent_profiles detail table | Task 1 |
| agent_managed_shippers table | Task 1 |
| bookings.agent_profile_id + managed_shipper_id | Task 1 |
| RLS for all new tables | Task 1 |
| Session type includes agent | Task 2 |
| createAgentProfile action | Task 2 |
| switchToAgent action | Task 2 |
| addManagedShipper action | Task 2 |
| Agent card on onboarding | Task 3 |
| Agent onboarding form | Task 3 |
| Agent portal layout (auth gate) | Task 4 |
| Agent dashboard with stats + recent bookings | Task 4 |
| Shippers list page | Task 5 |
| Add shipper form | Task 5 |
| Agent bookings page with shipper filter | Task 6 |
| Booking form detects agent and shows shipper selector | Task 7 |
| agent_profile_id + managed_shipper_id saved on booking insert | Task 7 |
| Home page shows agent portal link | Task 8 |

No gaps found.

### Placeholder scan

No TBD, TODO, or "similar to Task N" patterns present. All code blocks are complete.

### Type consistency

- `AgentProfile.id` used in Task 4 matches `agent_profiles.id` from Task 1
- `ManagedShipper.agent_profile_id` references `agent_profiles.id` consistently
- `bookings.agent_profile_id` FK to `agent_profiles.id` — consistent across Task 1 and Task 7
- `addManagedShipper` action uses `agentProfile.id` which resolves to `agent_profiles.id` — consistent
- `ActiveSession.role_type` union updated in Task 2, consumed in Task 4 layout — consistent
