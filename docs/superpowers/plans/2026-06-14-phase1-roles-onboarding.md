# Phase 1: New Roles & Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cargo Measurement Agent and Transporter roles to ShareConLoad — including DB tables, storage buckets, multi-step onboarding flows, dedicated portals (dashboard only), and admin review pages.

**Architecture:** Two new profile tables (`measurement_agent_profiles`, `transporter_profiles`) follow the same pattern as `operator_profiles` and `agent_profiles`. Onboarding uses multi-step client-side forms with server actions, mirroring the existing agent onboarding pattern. Admin approve/reject uses the same server-action pattern as `adminAgentActions.ts`.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, DaisyUI, Supabase (PostgreSQL + Storage), Server Actions

**Spec:** `docs/superpowers/specs/2026-06-14-cargo-measurement-pickup-services-design.md`

---

## File Map

### New files
- `supabase/migrations/20260614_52_new_role_types.sql` — add measurement_agent + transporter to role_type enum
- `supabase/migrations/20260614_53_measurement_agent_profiles.sql` — measurement_agent_profiles table + RLS
- `supabase/migrations/20260614_54_transporter_profiles.sql` — transporter_profiles table + RLS
- `supabase/migrations/20260614_55_new_storage_buckets.sql` — measurement-agent-docs + transporter-docs buckets
- `actions/measurementAgentActions.ts` — createMeasurementAgentProfile server action
- `actions/transporterActions.ts` — createTransporterProfile server action
- `actions/adminMeasurementAgentActions.ts` — approve/reject measurement agent
- `actions/adminTransporterActions.ts` — approve/reject transporter
- `app/onboarding/measurement-agent/page.tsx` — 4-step onboarding form
- `app/onboarding/transporter/page.tsx` — 4-step onboarding form
- `app/measurement-agent/page.tsx` — agent dashboard (stub with pending/approved gate)
- `app/transporter/page.tsx` — transporter dashboard (stub with pending/approved gate)
- `app/admin/measurement-agents/page.tsx` — admin list + approve/reject
- `app/admin/transporters/page.tsx` — admin list + approve/reject

### Modified files
- `app/onboarding/page.tsx` — add two new role cards (Measurement Agent, Transporter)
- `app/page.tsx` — extend login redirect to send measurement_agent → /measurement-agent, transporter → /transporter
- `app/admin/page.tsx` — add links to /admin/measurement-agents and /admin/transporters

---

## Task 1: DB Migration — New Role Types

**Files:**
- Create: `supabase/migrations/20260614_52_new_role_types.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260614_52_new_role_types.sql
-- Add measurement_agent and transporter to the role_type enum used by profiles.

do $$ begin
  alter type public.role_type add value if not exists 'measurement_agent';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.role_type add value if not exists 'transporter';
exception when duplicate_object then null;
end $$;
```

- [ ] **Step 2: Apply via MCP**

Use the `mcp__plugin_supabase_supabase__apply_migration` tool with:
- project_id: `fkhfbifgvebygafsewot`
- name: `20260614_52_new_role_types`
- query: (contents of the file above)

- [ ] **Step 3: Verify**

Run SQL via `mcp__plugin_supabase_supabase__execute_sql`:
```sql
select enum_range(null::public.role_type);
```
Expected: array includes `measurement_agent` and `transporter`.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/20260614_52_new_role_types.sql
git commit -m "feat: add measurement_agent and transporter to role_type enum"
```

---

## Task 2: DB Migration — measurement_agent_profiles Table

**Files:**
- Create: `supabase/migrations/20260614_53_measurement_agent_profiles.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260614_53_measurement_agent_profiles.sql

create table if not exists public.measurement_agent_profiles (
  id                          uuid primary key default gen_random_uuid(),
  profile_id                  uuid not null unique references public.profiles(id) on delete cascade,
  full_name                   text not null,
  phone_number                text,
  base_city                   text not null,
  base_country                text not null,
  id_document_url             text,
  selfie_url                  text,
  equipment_photo_url         text,
  certification_test_passed   boolean not null default false,
  service_agreement_signed_at timestamptz,
  status                      text not null default 'pending'
                                check (status in ('pending','approved','rejected','suspended')),
  rejection_reason            text,
  average_rating              numeric(3,2),
  total_jobs_completed        int not null default 0,
  paystack_recipient_code     text,
  payout_enabled              boolean not null default false,
  payout_hold                 boolean not null default false,
  created_at                  timestamptz not null default now()
);

alter table public.measurement_agent_profiles enable row level security;

-- Owner can read and update their own row
drop policy if exists "measurement_agent_profiles_owner_select" on public.measurement_agent_profiles;
create policy "measurement_agent_profiles_owner_select"
  on public.measurement_agent_profiles for select
  using (
    profile_id in (
      select id from public.profiles where user_id = auth.uid()
    )
  );

drop policy if exists "measurement_agent_profiles_owner_update" on public.measurement_agent_profiles;
create policy "measurement_agent_profiles_owner_update"
  on public.measurement_agent_profiles for update
  using (
    profile_id in (
      select id from public.profiles where user_id = auth.uid()
    )
  );

-- Authenticated users can insert (during onboarding)
drop policy if exists "measurement_agent_profiles_insert" on public.measurement_agent_profiles;
create policy "measurement_agent_profiles_insert"
  on public.measurement_agent_profiles for insert
  with check (
    profile_id in (
      select id from public.profiles where user_id = auth.uid()
    )
  );

-- Admins can read and update all rows
drop policy if exists "measurement_agent_profiles_admin_select" on public.measurement_agent_profiles;
create policy "measurement_agent_profiles_admin_select"
  on public.measurement_agent_profiles for select
  using (public.is_admin());

drop policy if exists "measurement_agent_profiles_admin_update" on public.measurement_agent_profiles;
create policy "measurement_agent_profiles_admin_update"
  on public.measurement_agent_profiles for update
  using (public.is_admin());
```

- [ ] **Step 2: Apply via MCP**

Use `mcp__plugin_supabase_supabase__apply_migration` with:
- project_id: `fkhfbifgvebygafsewot`
- name: `20260614_53_measurement_agent_profiles`
- query: (file contents above)

- [ ] **Step 3: Verify table exists**

```sql
select column_name, data_type
from information_schema.columns
where table_name = 'measurement_agent_profiles'
order by ordinal_position;
```

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/20260614_53_measurement_agent_profiles.sql
git commit -m "feat: add measurement_agent_profiles table with RLS"
```

---

## Task 3: DB Migration — transporter_profiles Table

**Files:**
- Create: `supabase/migrations/20260614_54_transporter_profiles.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260614_54_transporter_profiles.sql

create table if not exists public.transporter_profiles (
  id                          uuid primary key default gen_random_uuid(),
  profile_id                  uuid not null unique references public.profiles(id) on delete cascade,
  full_name                   text not null,
  phone_number                text,
  base_city                   text not null,
  base_country                text not null,
  vehicle_type                text not null
                                check (vehicle_type in ('bakkie','small_truck','large_truck')),
  vehicle_capacity_kg         numeric,
  vehicle_capacity_cbm        numeric,
  vehicle_registration_number text,
  drivers_licence_url         text,
  vehicle_ownership_url       text,
  vehicle_photo_1_url         text,
  vehicle_photo_2_url         text,
  vehicle_photo_3_url         text,
  vehicle_photo_4_url         text,
  service_agreement_signed_at timestamptz,
  status                      text not null default 'pending'
                                check (status in ('pending','approved','rejected','suspended')),
  rejection_reason            text,
  average_rating              numeric(3,2),
  total_jobs_completed        int not null default 0,
  paystack_recipient_code     text,
  payout_enabled              boolean not null default false,
  payout_hold                 boolean not null default false,
  created_at                  timestamptz not null default now()
);

alter table public.transporter_profiles enable row level security;

drop policy if exists "transporter_profiles_owner_select" on public.transporter_profiles;
create policy "transporter_profiles_owner_select"
  on public.transporter_profiles for select
  using (
    profile_id in (
      select id from public.profiles where user_id = auth.uid()
    )
  );

drop policy if exists "transporter_profiles_owner_update" on public.transporter_profiles;
create policy "transporter_profiles_owner_update"
  on public.transporter_profiles for update
  using (
    profile_id in (
      select id from public.profiles where user_id = auth.uid()
    )
  );

drop policy if exists "transporter_profiles_insert" on public.transporter_profiles;
create policy "transporter_profiles_insert"
  on public.transporter_profiles for insert
  with check (
    profile_id in (
      select id from public.profiles where user_id = auth.uid()
    )
  );

drop policy if exists "transporter_profiles_admin_select" on public.transporter_profiles;
create policy "transporter_profiles_admin_select"
  on public.transporter_profiles for select
  using (public.is_admin());

drop policy if exists "transporter_profiles_admin_update" on public.transporter_profiles;
create policy "transporter_profiles_admin_update"
  on public.transporter_profiles for update
  using (public.is_admin());
```

- [ ] **Step 2: Apply via MCP**

Use `mcp__plugin_supabase_supabase__apply_migration` with:
- project_id: `fkhfbifgvebygafsewot`
- name: `20260614_54_transporter_profiles`
- query: (file contents above)

- [ ] **Step 3: Verify**

```sql
select column_name from information_schema.columns
where table_name = 'transporter_profiles'
order by ordinal_position;
```

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/20260614_54_transporter_profiles.sql
git commit -m "feat: add transporter_profiles table with RLS"
```

---

## Task 4: DB Migration — Storage Buckets

**Files:**
- Create: `supabase/migrations/20260614_55_new_storage_buckets.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260614_55_new_storage_buckets.sql
-- Storage for measurement agent docs (ID, selfie, equipment) and transporter docs (licence, ownership, vehicle photos).

insert into storage.buckets (id, name, public)
values ('measurement-agent-docs', 'measurement-agent-docs', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('transporter-docs', 'transporter-docs', false)
on conflict (id) do nothing;

-- Measurement agent: owner can upload
drop policy if exists "measurement_agent_docs_upload" on storage.objects;
create policy "measurement_agent_docs_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'measurement-agent-docs'
    and auth.role() = 'authenticated'
  );

drop policy if exists "measurement_agent_docs_owner_read" on storage.objects;
create policy "measurement_agent_docs_owner_read"
  on storage.objects for select
  using (
    bucket_id = 'measurement-agent-docs'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_admin()
    )
  );

-- Transporter: owner can upload
drop policy if exists "transporter_docs_upload" on storage.objects;
create policy "transporter_docs_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'transporter-docs'
    and auth.role() = 'authenticated'
  );

drop policy if exists "transporter_docs_owner_read" on storage.objects;
create policy "transporter_docs_owner_read"
  on storage.objects for select
  using (
    bucket_id = 'transporter-docs'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_admin()
    )
  );
```

- [ ] **Step 2: Apply via MCP**

Use `mcp__plugin_supabase_supabase__apply_migration` with:
- project_id: `fkhfbifgvebygafsewot`
- name: `20260614_55_new_storage_buckets`
- query: (file contents above)

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/20260614_55_new_storage_buckets.sql
git commit -m "feat: add measurement-agent-docs and transporter-docs storage buckets"
```

---

## Task 5: Server Action — createMeasurementAgentProfile

**Files:**
- Create: `actions/measurementAgentActions.ts`

This action is called from the final step of the measurement agent onboarding form. It:
1. Looks up the current user's `profiles.id` where `role_type = 'measurement_agent'` (creating the profile row first if needed)
2. Inserts into `measurement_agent_profiles`

- [ ] **Step 1: Create the file**

```typescript
// actions/measurementAgentActions.ts
'use server';

import { createServerActionClient } from '@/services/supabaseServer';
import { redirect } from 'next/navigation';

export type MeasurementAgentFormState = {
  error?: string;
  success?: boolean;
};

export async function createMeasurementAgentProfile(
  _prev: MeasurementAgentFormState | null,
  formData: FormData,
): Promise<MeasurementAgentFormState> {
  const supabase = await createServerActionClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  const fullName          = formData.get('full_name') as string;
  const phoneNumber       = formData.get('phone_number') as string;
  const baseCity          = formData.get('base_city') as string;
  const baseCountry       = formData.get('base_country') as string;
  const idDocumentUrl     = formData.get('id_document_url') as string;
  const selfieUrl         = formData.get('selfie_url') as string;
  const equipmentPhotoUrl = formData.get('equipment_photo_url') as string;

  if (!fullName?.trim() || !baseCity?.trim() || !baseCountry?.trim()) {
    return { error: 'Full name, base city, and base country are required.' };
  }

  // Ensure a profile row exists for this user with role measurement_agent
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'measurement_agent')
    .maybeSingle();

  let profileId: string;

  if (existingProfile) {
    profileId = existingProfile.id;
  } else {
    const { data: newProfile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: user.id,
        role_type: 'measurement_agent',
        email: user.email,
        full_name: fullName.trim(),
      })
      .select('id')
      .single();

    if (profileError || !newProfile) {
      console.error('Profile insert error:', profileError);
      return { error: 'Failed to create profile.' };
    }
    profileId = newProfile.id;
  }

  // Check if measurement_agent_profile already exists for this profile
  const { data: existing } = await supabase
    .from('measurement_agent_profiles')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (existing) {
    redirect('/measurement-agent');
  }

  const { error } = await supabase
    .from('measurement_agent_profiles')
    .insert({
      profile_id:                  profileId,
      full_name:                   fullName.trim(),
      phone_number:                phoneNumber?.trim() || null,
      base_city:                   baseCity.trim(),
      base_country:                baseCountry.trim(),
      id_document_url:             idDocumentUrl || null,
      selfie_url:                  selfieUrl || null,
      equipment_photo_url:         equipmentPhotoUrl || null,
      certification_test_passed:   true, // client enforces passing before reaching Step 4
      service_agreement_signed_at: new Date().toISOString(),
      status:                      'pending',
    });

  if (error) {
    console.error('Measurement agent profile insert error:', error);
    return { error: 'Failed to save profile. Please try again.' };
  }

  // Notify user that their application was received
  await supabase.from('notifications').insert({
    user_id: user.id,
    title:   'Application Received',
    message: 'Your Cargo Measurement Agent application has been submitted and is under review. We will notify you once a decision has been made.',
    type:    'info',
  });

  redirect('/measurement-agent');
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors related to `measurementAgentActions.ts`.

- [ ] **Step 3: Commit**
```bash
git add actions/measurementAgentActions.ts
git commit -m "feat: add createMeasurementAgentProfile server action"
```

---

## Task 6: Server Action — createTransporterProfile

**Files:**
- Create: `actions/transporterActions.ts`

- [ ] **Step 1: Create the file**

```typescript
// actions/transporterActions.ts
'use server';

import { createServerActionClient } from '@/services/supabaseServer';
import { redirect } from 'next/navigation';

export type TransporterFormState = {
  error?: string;
  success?: boolean;
};

export async function createTransporterProfile(
  _prev: TransporterFormState | null,
  formData: FormData,
): Promise<TransporterFormState> {
  const supabase = await createServerActionClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  const fullName            = formData.get('full_name') as string;
  const phoneNumber         = formData.get('phone_number') as string;
  const baseCity            = formData.get('base_city') as string;
  const baseCountry         = formData.get('base_country') as string;
  const vehicleType         = formData.get('vehicle_type') as string;
  const capacityKg          = formData.get('vehicle_capacity_kg') as string;
  const capacityCbm         = formData.get('vehicle_capacity_cbm') as string;
  const vehicleReg          = formData.get('vehicle_registration_number') as string;
  const driversLicenceUrl   = formData.get('drivers_licence_url') as string;
  const vehicleOwnershipUrl = formData.get('vehicle_ownership_url') as string;
  const vehiclePhoto1       = formData.get('vehicle_photo_1_url') as string;
  const vehiclePhoto2       = formData.get('vehicle_photo_2_url') as string;
  const vehiclePhoto3       = formData.get('vehicle_photo_3_url') as string;
  const vehiclePhoto4       = formData.get('vehicle_photo_4_url') as string;

  if (!fullName?.trim() || !baseCity?.trim() || !baseCountry?.trim() || !vehicleType) {
    return { error: 'Full name, base city, base country, and vehicle type are required.' };
  }

  const validTypes = ['bakkie', 'small_truck', 'large_truck'];
  if (!validTypes.includes(vehicleType)) {
    return { error: 'Invalid vehicle type.' };
  }

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .eq('role_type', 'transporter')
    .maybeSingle();

  let profileId: string;

  if (existingProfile) {
    profileId = existingProfile.id;
  } else {
    const { data: newProfile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: user.id,
        role_type: 'transporter',
        email: user.email,
        full_name: fullName.trim(),
      })
      .select('id')
      .single();

    if (profileError || !newProfile) {
      console.error('Transporter profile insert error:', profileError);
      return { error: 'Failed to create profile.' };
    }
    profileId = newProfile.id;
  }

  const { data: existing } = await supabase
    .from('transporter_profiles')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (existing) {
    redirect('/transporter');
  }

  const { error } = await supabase
    .from('transporter_profiles')
    .insert({
      profile_id:                  profileId,
      full_name:                   fullName.trim(),
      phone_number:                phoneNumber?.trim() || null,
      base_city:                   baseCity.trim(),
      base_country:                baseCountry.trim(),
      vehicle_type:                vehicleType,
      vehicle_capacity_kg:         capacityKg  ? parseFloat(capacityKg)  : null,
      vehicle_capacity_cbm:        capacityCbm ? parseFloat(capacityCbm) : null,
      vehicle_registration_number: vehicleReg?.trim() || null,
      drivers_licence_url:         driversLicenceUrl || null,
      vehicle_ownership_url:       vehicleOwnershipUrl || null,
      vehicle_photo_1_url:         vehiclePhoto1 || null,
      vehicle_photo_2_url:         vehiclePhoto2 || null,
      vehicle_photo_3_url:         vehiclePhoto3 || null,
      vehicle_photo_4_url:         vehiclePhoto4 || null,
      service_agreement_signed_at: new Date().toISOString(),
      status:                      'pending',
    });

  if (error) {
    console.error('Transporter profile insert error:', error);
    return { error: 'Failed to save profile. Please try again.' };
  }

  // Notify user that their application was received
  await supabase.from('notifications').insert({
    user_id: user.id,
    title:   'Application Received',
    message: 'Your Transporter application has been submitted and is under review. We will notify you once a decision has been made.',
    type:    'info',
  });

  redirect('/transporter');
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**
```bash
git add actions/transporterActions.ts
git commit -m "feat: add createTransporterProfile server action"
```

---

## Task 7: Admin Server Actions

**Files:**
- Create: `actions/adminMeasurementAgentActions.ts`
- Create: `actions/adminTransporterActions.ts`

- [ ] **Step 1: Create adminMeasurementAgentActions.ts**

```typescript
// actions/adminMeasurementAgentActions.ts
'use server';

import { createServerActionClient } from '@/services/supabaseServer';
import { revalidatePath } from 'next/cache';

async function assertAdmin(supabase: Awaited<ReturnType<typeof createServerActionClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from('profiles').select('is_admin').eq('user_id', user.id);
  return Array.isArray(data) && data.some((p) => p.is_admin === true);
}

export async function approveMeasurementAgent(agentProfileId: string): Promise<{ error?: string }> {
  const supabase = await createServerActionClient();
  if (!await assertAdmin(supabase)) return { error: 'Admin access required.' };

  const { data: ap } = await supabase
    .from('measurement_agent_profiles')
    .select('profile_id')
    .eq('id', agentProfileId)
    .maybeSingle();

  if (!ap) return { error: 'Agent profile not found.' };

  const { error } = await supabase
    .from('measurement_agent_profiles')
    .update({ status: 'approved', rejection_reason: null })
    .eq('id', agentProfileId);

  if (error) return { error: error.message };

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('id', ap.profile_id)
    .maybeSingle();

  if (profile?.user_id) {
    await supabase.from('notifications').insert({
      user_id: profile.user_id,
      title:   'Measurement Agent Application Approved',
      message: 'Your application has been approved. You can now log in to access your agent portal.',
      type:    'success',
    });
  }

  revalidatePath('/admin/measurement-agents');
  return {};
}

export async function rejectMeasurementAgent(agentProfileId: string, reason: string): Promise<{ error?: string }> {
  const supabase = await createServerActionClient();
  if (!await assertAdmin(supabase)) return { error: 'Admin access required.' };

  const { data: ap } = await supabase
    .from('measurement_agent_profiles')
    .select('profile_id')
    .eq('id', agentProfileId)
    .maybeSingle();

  if (!ap) return { error: 'Agent profile not found.' };

  const { error } = await supabase
    .from('measurement_agent_profiles')
    .update({ status: 'rejected', rejection_reason: reason })
    .eq('id', agentProfileId);

  if (error) return { error: error.message };

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('id', ap.profile_id)
    .maybeSingle();

  if (profile?.user_id) {
    await supabase.from('notifications').insert({
      user_id: profile.user_id,
      title:   'Measurement Agent Application Update',
      message: `Your application was not approved. Reason: ${reason}`,
      type:    'warning',
    });
  }

  revalidatePath('/admin/measurement-agents');
  return {};
}
```

- [ ] **Step 2: Create adminTransporterActions.ts**

```typescript
// actions/adminTransporterActions.ts
'use server';

import { createServerActionClient } from '@/services/supabaseServer';
import { revalidatePath } from 'next/cache';

async function assertAdmin(supabase: Awaited<ReturnType<typeof createServerActionClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from('profiles').select('is_admin').eq('user_id', user.id);
  return Array.isArray(data) && data.some((p) => p.is_admin === true);
}

export async function approveTransporter(transporterProfileId: string): Promise<{ error?: string }> {
  const supabase = await createServerActionClient();
  if (!await assertAdmin(supabase)) return { error: 'Admin access required.' };

  const { data: tp } = await supabase
    .from('transporter_profiles')
    .select('profile_id')
    .eq('id', transporterProfileId)
    .maybeSingle();

  if (!tp) return { error: 'Transporter profile not found.' };

  const { error } = await supabase
    .from('transporter_profiles')
    .update({ status: 'approved', rejection_reason: null })
    .eq('id', transporterProfileId);

  if (error) return { error: error.message };

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('id', tp.profile_id)
    .maybeSingle();

  if (profile?.user_id) {
    await supabase.from('notifications').insert({
      user_id: profile.user_id,
      title:   'Transporter Application Approved',
      message: 'Your transporter application has been approved. You can now access the Transporter Portal.',
      type:    'success',
    });
  }

  revalidatePath('/admin/transporters');
  return {};
}

export async function rejectTransporter(transporterProfileId: string, reason: string): Promise<{ error?: string }> {
  const supabase = await createServerActionClient();
  if (!await assertAdmin(supabase)) return { error: 'Admin access required.' };

  const { data: tp } = await supabase
    .from('transporter_profiles')
    .select('profile_id')
    .eq('id', transporterProfileId)
    .maybeSingle();

  if (!tp) return { error: 'Transporter profile not found.' };

  const { error } = await supabase
    .from('transporter_profiles')
    .update({ status: 'rejected', rejection_reason: reason })
    .eq('id', transporterProfileId);

  if (error) return { error: error.message };

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('id', tp.profile_id)
    .maybeSingle();

  if (profile?.user_id) {
    await supabase.from('notifications').insert({
      user_id: profile.user_id,
      title:   'Transporter Application Update',
      message: `Your transporter application was not approved. Reason: ${reason}`,
      type:    'warning',
    });
  }

  revalidatePath('/admin/transporters');
  return {};
}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**
```bash
git add actions/adminMeasurementAgentActions.ts actions/adminTransporterActions.ts
git commit -m "feat: add admin approve/reject server actions for measurement agents and transporters"
```

---

## Task 8: Measurement Agent Onboarding Page

**Files:**
- Create: `app/onboarding/measurement-agent/page.tsx`

This is a 4-step multi-step form managed entirely client-side. Steps:
1. Personal Info (name, phone, city, country)
2. Documents (upload ID photo, selfie with ID, equipment photo — stored in Supabase Storage bucket `measurement-agent-docs`)
3. Certification Test (5 hardcoded questions, need 4/5 to proceed)
4. Service Agreement (display text, click to confirm → submits form via server action)

Document uploads happen directly from the browser to Supabase Storage before the form submits. The `createMeasurementAgentProfile` server action only saves text fields; URLs are passed as hidden inputs after upload.

- [ ] **Step 1: Create the file**

```tsx
// app/onboarding/measurement-agent/page.tsx
'use client';

import Link from 'next/link';
import { useState, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';
import { createMeasurementAgentProfile, type MeasurementAgentFormState } from '@/actions/measurementAgentActions';

const COUNTRIES = [
  'South Africa', 'Angola', 'Botswana', 'Cameroon', 'Congo', 'Egypt',
  'Ethiopia', 'Ghana', 'India', 'Kenya', 'Mozambique', 'Namibia', 'Nigeria',
  'Rwanda', 'Senegal', 'Tanzania', 'Uganda', 'United Kingdom', 'United States',
  'Zambia', 'Zimbabwe',
].sort((a, b) => (a === 'South Africa' ? -1 : b === 'South Africa' ? 1 : a.localeCompare(b)));

const QUIZ: { question: string; options: string[]; correct: number }[] = [
  {
    question: 'When measuring cargo length, you measure:',
    options: ['The shortest side', 'The longest horizontal side', 'The diagonal', 'The height'],
    correct: 1,
  },
  {
    question: 'CBM stands for:',
    options: ['Cargo Box Measurement', 'Cubic Bar Metric', 'Cubic Metre', 'Cargo Bulk Mass'],
    correct: 2,
  },
  {
    question: 'You must take how many cargo photos per job?',
    options: ['2', '4', '6', '1'],
    correct: 1,
  },
  {
    question: 'If a box is 1.2m × 0.8m × 0.5m, its CBM is:',
    options: ['2.5', '0.48', '1.0', '0.96'],
    correct: 1,
  },
  {
    question: 'The location photo must show:',
    options: ['The street sign only', 'The cargo inside', 'You standing next to the cargo at the collection address', 'Your vehicle'],
    correct: 2,
  },
];

const STEPS = ['Personal Info', 'Documents', 'Certification', 'Agreement'];

type DocField = 'id_document_url' | 'selfie_url' | 'equipment_photo_url';

export default function MeasurementAgentOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [state, formAction, isPending] = useActionState<MeasurementAgentFormState | null, FormData>(
    createMeasurementAgentProfile,
    null,
  );

  // Step 1 fields
  const [fullName, setFullName]       = useState('');
  const [phone, setPhone]             = useState('');
  const [baseCity, setBaseCity]       = useState('');
  const [baseCountry, setBaseCountry] = useState('South Africa');

  // Step 2: upload state
  const [uploads, setUploads] = useState<Record<DocField, string>>({
    id_document_url: '',
    selfie_url: '',
    equipment_photo_url: '',
  });
  const [uploadLoading, setUploadLoading] = useState<Record<DocField, boolean>>({
    id_document_url: false,
    selfie_url: false,
    equipment_photo_url: false,
  });
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Step 3: quiz
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const quizScore = quizSubmitted
    ? QUIZ.filter((q, i) => answers[i] === q.correct).length
    : 0;
  const quizPassed = quizScore >= 4;

  // Step 1 validation
  const step1Valid = fullName.trim() && baseCity.trim() && baseCountry;

  // Step 2 validation
  const step2Valid = uploads.id_document_url && uploads.selfie_url && uploads.equipment_photo_url;

  async function handleUpload(field: DocField, file: File) {
    setUploadLoading((prev) => ({ ...prev, [field]: true }));
    setUploadError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploadError('Please log in first.'); setUploadLoading((p) => ({ ...p, [field]: false })); return; }

    const ext  = file.name.split('.').pop();
    const path = `${user.id}/${field}.${ext}`;

    const { error } = await supabase.storage
      .from('measurement-agent-docs')
      .upload(path, file, { upsert: true });

    if (error) {
      setUploadError(`Upload failed: ${error.message}`);
    } else {
      const { data } = supabase.storage.from('measurement-agent-docs').getPublicUrl(path);
      setUploads((prev) => ({ ...prev, [field]: data.publicUrl }));
    }
    setUploadLoading((prev) => ({ ...prev, [field]: false }));
  }

  function handleQuizSubmit() {
    setQuizSubmitted(true);
  }

  const canGoNext = [
    !!step1Valid,
    !!step2Valid,
    quizPassed,
    true,
  ][step];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}>
      <nav className="flex items-center px-6 py-4">
        <Link href="/onboarding" className="text-2xl font-extrabold tracking-tight">
          <span className="text-white">Share</span><span style={{ color: '#f97316' }}>Con</span><span className="text-white">Load</span>
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i <= step ? 'bg-orange-500 text-white' : 'bg-white/20 text-white/60'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="w-8 h-0.5 bg-white/20" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg">
          <span className="inline-block text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-orange-50 text-orange-600 mb-3">
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </span>

          {/* ── Step 1: Personal Info ── */}
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Tell us about yourself</h1>
              <p className="text-gray-500 text-sm mb-2">We use this to match you with jobs in your area.</p>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Full Name *</label>
                <input
                  className="input input-bordered w-full"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full legal name"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
                <input
                  className="input input-bordered w-full"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+27 82 123 4567"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Base City *</label>
                <input
                  className="input input-bordered w-full"
                  value={baseCity}
                  onChange={(e) => setBaseCity(e.target.value)}
                  placeholder="e.g. Johannesburg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Country *</label>
                <select
                  className="select select-bordered w-full"
                  value={baseCountry}
                  onChange={(e) => setBaseCountry(e.target.value)}
                >
                  {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <button
                onClick={() => setStep(1)}
                disabled={!step1Valid}
                className="btn text-white w-full mt-2 font-bold rounded-xl disabled:opacity-50"
                style={{ backgroundColor: '#f97316' }}
              >
                Next →
              </button>
            </div>
          )}

          {/* ── Step 2: Documents ── */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Upload your documents</h1>
              <p className="text-gray-500 text-sm mb-2">All three uploads are required.</p>

              {uploadError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{uploadError}</div>
              )}

              {([
                { field: 'id_document_url' as DocField, label: 'ID Document', hint: 'Clear photo of your national ID or passport' },
                { field: 'selfie_url' as DocField, label: 'Selfie Holding ID', hint: 'Photo of you holding your ID document' },
                { field: 'equipment_photo_url' as DocField, label: 'Measuring Equipment', hint: 'Photo showing your measuring tape and tools' },
              ] as const).map(({ field, label, hint }) => (
                <div key={field}>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{label} *</label>
                  <p className="text-xs text-gray-400 mb-1">{hint}</p>
                  {uploads[field] ? (
                    <div className="flex items-center gap-2 text-sm text-green-600 font-semibold">
                      <span>✓</span> Uploaded
                      <button
                        className="text-xs text-gray-400 underline ml-2"
                        onClick={() => setUploads((p) => ({ ...p, [field]: '' }))}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-orange-300 transition-colors">
                      {uploadLoading[field] ? (
                        <span className="loading loading-spinner loading-sm" style={{ color: '#f97316' }} />
                      ) : (
                        <>
                          <span className="text-sm text-gray-400">Click to upload</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUpload(field, file);
                            }}
                          />
                        </>
                      )}
                    </label>
                  )}
                </div>
              ))}

              <div className="flex gap-2 mt-2">
                <button onClick={() => setStep(0)} className="btn btn-ghost flex-1">← Back</button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!step2Valid}
                  className="btn text-white flex-1 font-bold rounded-xl disabled:opacity-50"
                  style={{ backgroundColor: '#f97316' }}
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Certification Test ── */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Certification Test</h1>
              <p className="text-gray-500 text-sm mb-2">Answer 4 out of 5 questions correctly to proceed.</p>

              {quizSubmitted && (
                <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${quizPassed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {quizPassed
                    ? `✓ You scored ${quizScore}/5 — you passed!`
                    : `You scored ${quizScore}/5 — you need 4/5. Review the answers and try again.`}
                </div>
              )}

              <div className="flex flex-col gap-5">
                {QUIZ.map((q, qi) => (
                  <div key={qi}>
                    <p className="text-sm font-semibold text-gray-800 mb-2">{qi + 1}. {q.question}</p>
                    <div className="flex flex-col gap-1.5">
                      {q.options.map((opt, oi) => {
                        const isSelected = answers[qi] === oi;
                        const isCorrect  = quizSubmitted && oi === q.correct;
                        const isWrong    = quizSubmitted && isSelected && oi !== q.correct;
                        return (
                          <button
                            key={oi}
                            onClick={() => !quizSubmitted && setAnswers((p) => ({ ...p, [qi]: oi }))}
                            className={`text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                              isCorrect ? 'bg-green-50 border-green-400 text-green-700' :
                              isWrong   ? 'bg-red-50 border-red-300 text-red-600' :
                              isSelected ? 'border-orange-400 bg-orange-50 text-orange-700' :
                              'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-2">
                <button onClick={() => setStep(1)} className="btn btn-ghost flex-1">← Back</button>
                {!quizSubmitted ? (
                  <button
                    onClick={handleQuizSubmit}
                    disabled={Object.keys(answers).length < QUIZ.length}
                    className="btn text-white flex-1 font-bold rounded-xl disabled:opacity-50"
                    style={{ backgroundColor: '#0f2044' }}
                  >
                    Submit Answers
                  </button>
                ) : quizPassed ? (
                  <button
                    onClick={() => setStep(3)}
                    className="btn text-white flex-1 font-bold rounded-xl"
                    style={{ backgroundColor: '#f97316' }}
                  >
                    Next →
                  </button>
                ) : (
                  <button
                    onClick={() => { setAnswers({}); setQuizSubmitted(false); }}
                    className="btn flex-1 font-bold rounded-xl"
                    style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Step 4: Service Agreement ── */}
          {step === 3 && (
            <form action={formAction}>
              {/* Hidden fields */}
              <input type="hidden" name="full_name"            value={fullName} />
              <input type="hidden" name="phone_number"         value={phone} />
              <input type="hidden" name="base_city"            value={baseCity} />
              <input type="hidden" name="base_country"         value={baseCountry} />
              <input type="hidden" name="id_document_url"      value={uploads.id_document_url} />
              <input type="hidden" name="selfie_url"           value={uploads.selfie_url} />
              <input type="hidden" name="equipment_photo_url"  value={uploads.equipment_photo_url} />

              <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Service Agreement</h1>
              <p className="text-gray-500 text-sm mb-4">Please read and confirm the terms below.</p>

              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed mb-5 max-h-48 overflow-y-auto">
                <p className="font-bold mb-2">Cargo Measurement Agent Agreement</p>
                <p>By signing this agreement, you confirm that you will:</p>
                <ul className="list-disc ml-4 mt-2 flex flex-col gap-1">
                  <li>Accurately measure cargo dimensions using approved tools</li>
                  <li>Upload all 7 required photos for each job</li>
                  <li>Not misrepresent measurements or fabricate photos</li>
                  <li>Maintain professional conduct with shippers</li>
                  <li>Accept that 20% of each job fee is retained by ShareConLoad</li>
                  <li>Contact support@shareconload.com for any disputes</li>
                </ul>
                <p className="mt-3">Platform commission: 20%. Agent earnings: 80% of job fee, paid after report submission.</p>
              </div>

              {state?.error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {state.error}
                </div>
              )}

              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(2)} className="btn btn-ghost flex-1">← Back</button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn text-white flex-1 font-bold rounded-xl disabled:opacity-50"
                  style={{ backgroundColor: '#f97316' }}
                >
                  {isPending ? <span className="loading loading-spinner loading-sm" /> : 'I Agree & Submit'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**
```bash
git add app/onboarding/measurement-agent/page.tsx
git commit -m "feat: add measurement agent onboarding flow (4 steps)"
```

---

## Task 9: Transporter Onboarding Page

**Files:**
- Create: `app/onboarding/transporter/page.tsx`

4 steps: Personal Info → Vehicle Details + Documents → Vehicle Photos → Service Agreement.

- [ ] **Step 1: Create the file**

```tsx
// app/onboarding/transporter/page.tsx
'use client';

import Link from 'next/link';
import { useState, useActionState } from 'react';
import { supabase } from '@/services/supabaseClient';
import { createTransporterProfile, type TransporterFormState } from '@/actions/transporterActions';

const COUNTRIES = [
  'South Africa', 'Angola', 'Botswana', 'Cameroon', 'Congo', 'Egypt',
  'Ethiopia', 'Ghana', 'Kenya', 'Mozambique', 'Namibia', 'Nigeria',
  'Rwanda', 'Tanzania', 'Uganda', 'Zambia', 'Zimbabwe',
].sort((a, b) => (a === 'South Africa' ? -1 : b === 'South Africa' ? 1 : a.localeCompare(b)));

const VEHICLE_TYPES = [
  { value: 'bakkie', label: 'Bakkie / Light Truck (up to 1.5t)' },
  { value: 'small_truck', label: 'Small Truck (1.5t – 4t)' },
  { value: 'large_truck', label: 'Large Truck (4t+)' },
];

const STEPS = ['Personal Info', 'Vehicle & Docs', 'Vehicle Photos', 'Agreement'];

type PhotoField = 'vehicle_photo_1_url' | 'vehicle_photo_2_url' | 'vehicle_photo_3_url' | 'vehicle_photo_4_url';
type DocField = 'drivers_licence_url' | 'vehicle_ownership_url';

const PHOTO_LABELS: Record<PhotoField, string> = {
  vehicle_photo_1_url: 'Front of vehicle',
  vehicle_photo_2_url: 'Back of vehicle',
  vehicle_photo_3_url: 'Driver side',
  vehicle_photo_4_url: 'Load area / cargo bay',
};

// Defined outside the page component to prevent remounting on every render
function UploadSlot({ label, url, loading, onFile }: { label: string; url: string; loading: boolean; onFile: (f: File) => void }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-700 mb-1">{label} *</label>
      {url ? (
        <p className="text-sm text-green-600 font-semibold">✓ Uploaded</p>
      ) : (
        <label className="flex items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-3 cursor-pointer hover:border-orange-300 transition-colors">
          {loading ? <span className="loading loading-spinner loading-sm" style={{ color: '#f97316' }} /> : <span className="text-sm text-gray-400">Click to upload</span>}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        </label>
      )}
    </div>
  );
}

export default function TransporterOnboarding() {
  const [step, setStep] = useState(0);
  const [state, formAction, isPending] = useActionState<TransporterFormState | null, FormData>(
    createTransporterProfile,
    null,
  );

  // Step 1
  const [fullName, setFullName]       = useState('');
  const [phone, setPhone]             = useState('');
  const [baseCity, setBaseCity]       = useState('');
  const [baseCountry, setBaseCountry] = useState('South Africa');

  // Step 2
  const [vehicleType, setVehicleType]   = useState('bakkie');
  const [capacityKg, setCapacityKg]     = useState('');
  const [capacityCbm, setCapacityCbm]   = useState('');
  const [vehicleReg, setVehicleReg]     = useState('');
  const [docs, setDocs]                 = useState<Record<DocField, string>>({ drivers_licence_url: '', vehicle_ownership_url: '' });
  const [docLoading, setDocLoading]     = useState<Record<DocField, boolean>>({ drivers_licence_url: false, vehicle_ownership_url: false });

  // Step 3
  const [photos, setPhotos]         = useState<Record<PhotoField, string>>({ vehicle_photo_1_url: '', vehicle_photo_2_url: '', vehicle_photo_3_url: '', vehicle_photo_4_url: '' });
  const [photoLoading, setPhotoLoading] = useState<Record<PhotoField, boolean>>({ vehicle_photo_1_url: false, vehicle_photo_2_url: false, vehicle_photo_3_url: false, vehicle_photo_4_url: false });

  const [uploadError, setUploadError] = useState<string | null>(null);

  const step1Valid = fullName.trim() && baseCity.trim() && baseCountry;
  const step2Valid = docs.drivers_licence_url && docs.vehicle_ownership_url;
  const step3Valid = Object.values(photos).every(Boolean);

  async function handleUpload(bucket: string, field: string, file: File, setter: (url: string) => void, setLoading: (v: boolean) => void) {
    setLoading(true);
    setUploadError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploadError('Please log in.'); setLoading(false); return; }
    const ext  = file.name.split('.').pop();
    const path = `${user.id}/${field}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) { setUploadError(`Upload failed: ${error.message}`); } else {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      setter(data.publicUrl);
    }
    setLoading(false);
  }

  function handleDocUpload(field: DocField, file: File) {
    handleUpload(
      'transporter-docs', field, file,
      (url) => setDocs((p) => ({ ...p, [field]: url })),
      (v)   => setDocLoading((p) => ({ ...p, [field]: v })),
    );
  }

  function handlePhotoUpload(field: PhotoField, file: File) {
    handleUpload(
      'transporter-docs', field, file,
      (url) => setPhotos((p) => ({ ...p, [field]: url })),
      (v)   => setPhotoLoading((p) => ({ ...p, [field]: v })),
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}>
      <nav className="flex items-center px-6 py-4">
        <Link href="/onboarding" className="text-2xl font-extrabold tracking-tight">
          <span className="text-white">Share</span><span style={{ color: '#f97316' }}>Con</span><span className="text-white">Load</span>
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i <= step ? 'bg-orange-500 text-white' : 'bg-white/20 text-white/60'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="w-8 h-0.5 bg-white/20" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg">
          <span className="inline-block text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-orange-50 text-orange-600 mb-3">
            Step {step + 1} of {STEPS.length} — {STEPS[step]}
          </span>

          {uploadError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{uploadError}</div>
          )}

          {/* Step 1 */}
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Your details</h1>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Full Name *</label>
                <input className="input input-bordered w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full legal name" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
                <input className="input input-bordered w-full" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+27 82 123 4567" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Base City *</label>
                <input className="input input-bordered w-full" value={baseCity} onChange={(e) => setBaseCity(e.target.value)} placeholder="e.g. Cape Town" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Country *</label>
                <select className="select select-bordered w-full" value={baseCountry} onChange={(e) => setBaseCountry(e.target.value)}>
                  {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={() => setStep(1)} disabled={!step1Valid} className="btn text-white w-full mt-2 font-bold rounded-xl disabled:opacity-50" style={{ backgroundColor: '#f97316' }}>Next →</button>
            </div>
          )}

          {/* Step 2: Vehicle + Docs */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Vehicle & documents</h1>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Vehicle Type *</label>
                <select className="select select-bordered w-full" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                  {VEHICLE_TYPES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Capacity (kg)</label>
                  <input type="number" className="input input-bordered w-full" value={capacityKg} onChange={(e) => setCapacityKg(e.target.value)} placeholder="e.g. 1500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Capacity (CBM)</label>
                  <input type="number" className="input input-bordered w-full" value={capacityCbm} onChange={(e) => setCapacityCbm(e.target.value)} placeholder="e.g. 8" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Vehicle Registration Number</label>
                <input className="input input-bordered w-full" value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value)} placeholder="e.g. CA 123-456" />
              </div>
              <UploadSlot label="Driver's Licence" url={docs.drivers_licence_url} loading={docLoading.drivers_licence_url} onFile={(f) => handleDocUpload('drivers_licence_url', f)} />
              <UploadSlot label="Vehicle Ownership / Registration Papers" url={docs.vehicle_ownership_url} loading={docLoading.vehicle_ownership_url} onFile={(f) => handleDocUpload('vehicle_ownership_url', f)} />
              <div className="flex gap-2 mt-2">
                <button onClick={() => setStep(0)} className="btn btn-ghost flex-1">← Back</button>
                <button onClick={() => setStep(2)} disabled={!step2Valid} className="btn text-white flex-1 font-bold rounded-xl disabled:opacity-50" style={{ backgroundColor: '#f97316' }}>Next →</button>
              </div>
            </div>
          )}

          {/* Step 3: Vehicle Photos */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Vehicle photos</h1>
              <p className="text-gray-500 text-sm mb-2">All 4 photos are required.</p>
              {(Object.keys(PHOTO_LABELS) as PhotoField[]).map((field) => (
                <UploadSlot
                  key={field}
                  label={PHOTO_LABELS[field]}
                  url={photos[field]}
                  loading={photoLoading[field]}
                  onFile={(f) => handlePhotoUpload(field, f)}
                />
              ))}
              <div className="flex gap-2 mt-2">
                <button onClick={() => setStep(1)} className="btn btn-ghost flex-1">← Back</button>
                <button onClick={() => setStep(3)} disabled={!step3Valid} className="btn text-white flex-1 font-bold rounded-xl disabled:opacity-50" style={{ backgroundColor: '#f97316' }}>Next →</button>
              </div>
            </div>
          )}

          {/* Step 4: Agreement */}
          {step === 3 && (
            <form action={formAction}>
              <input type="hidden" name="full_name"                   value={fullName} />
              <input type="hidden" name="phone_number"                value={phone} />
              <input type="hidden" name="base_city"                   value={baseCity} />
              <input type="hidden" name="base_country"                value={baseCountry} />
              <input type="hidden" name="vehicle_type"                value={vehicleType} />
              <input type="hidden" name="vehicle_capacity_kg"         value={capacityKg} />
              <input type="hidden" name="vehicle_capacity_cbm"        value={capacityCbm} />
              <input type="hidden" name="vehicle_registration_number" value={vehicleReg} />
              <input type="hidden" name="drivers_licence_url"         value={docs.drivers_licence_url} />
              <input type="hidden" name="vehicle_ownership_url"       value={docs.vehicle_ownership_url} />
              <input type="hidden" name="vehicle_photo_1_url"         value={photos.vehicle_photo_1_url} />
              <input type="hidden" name="vehicle_photo_2_url"         value={photos.vehicle_photo_2_url} />
              <input type="hidden" name="vehicle_photo_3_url"         value={photos.vehicle_photo_3_url} />
              <input type="hidden" name="vehicle_photo_4_url"         value={photos.vehicle_photo_4_url} />

              <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Service Agreement</h1>
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed mb-5 max-h-48 overflow-y-auto">
                <p className="font-bold mb-2">Transporter Service Agreement</p>
                <ul className="list-disc ml-4 flex flex-col gap-1">
                  <li>Collect cargo from the shipper's address as scheduled</li>
                  <li>Deliver cargo intact to the operator's warehouse</li>
                  <li>Confirm collection and delivery within the app</li>
                  <li>Not misuse or damage cargo in your care</li>
                  <li>Accept that 15% of each job fee is retained by ShareConLoad</li>
                  <li>Contact support@shareconload.com for any issues</li>
                </ul>
                <p className="mt-3">Platform commission: 15%. Transporter earnings: 85%, paid on warehouse delivery confirmation.</p>
              </div>
              {state?.error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(2)} className="btn btn-ghost flex-1">← Back</button>
                <button type="submit" disabled={isPending} className="btn text-white flex-1 font-bold rounded-xl disabled:opacity-50" style={{ backgroundColor: '#f97316' }}>
                  {isPending ? <span className="loading loading-spinner loading-sm" /> : 'I Agree & Submit'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**
```bash
git add app/onboarding/transporter/page.tsx
git commit -m "feat: add transporter onboarding flow (4 steps)"
```

---

## Task 10: Portal Dashboard Pages

**Files:**
- Create: `app/measurement-agent/page.tsx`
- Create: `app/transporter/page.tsx`

These are stub dashboards. They gate on profile status (pending/approved/rejected) and will be extended in Phase 2 and 3.

- [ ] **Step 1: Create app/measurement-agent/page.tsx**

```tsx
// app/measurement-agent/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';

type AgentProfile = {
  id: string;
  full_name: string;
  base_city: string;
  base_country: string;
  status: string;
  rejection_reason: string | null;
  average_rating: number | null;
  total_jobs_completed: number;
};

export default function MeasurementAgentDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role_type', 'measurement_agent');

      const profileIds = (profiles ?? []).map((p) => p.id);
      if (profileIds.length === 0) { router.push('/onboarding/measurement-agent'); return; }

      const { data } = await supabase
        .from('measurement_agent_profiles')
        .select('id, full_name, base_city, base_country, status, rejection_reason, average_rating, total_jobs_completed')
        .in('profile_id', profileIds)
        .maybeSingle();

      if (!data) { router.push('/onboarding/measurement-agent'); return; }
      setProfile(data as AgentProfile);
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo1.png" alt="" width={36} height={36} className="h-8 w-auto" />
            <span className="text-lg font-extrabold tracking-tight">
              <span style={{ color: '#0f2044' }}>Share</span><span style={{ color: '#f97316' }}>Con</span><span style={{ color: '#0f2044' }}>Load</span>
            </span>
          </Link>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Measurement Agent Portal</span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10">
        {profile.status === 'pending' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">⏳</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Application Under Review</h2>
            <p className="text-gray-500 text-sm">Your application has been submitted and is being reviewed by our team. You will receive a notification once a decision has been made.</p>
          </div>
        )}

        {profile.status === 'rejected' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">❌</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Application Not Approved</h2>
            {profile.rejection_reason && (
              <p className="text-gray-600 text-sm mb-3">Reason: {profile.rejection_reason}</p>
            )}
            <p className="text-gray-500 text-sm">Contact <a href="mailto:support@shareconload.com" className="underline">support@shareconload.com</a> for assistance.</p>
          </div>
        )}

        {profile.status === 'suspended' && (
          <div className="bg-gray-100 border border-gray-200 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">🚫</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Account Suspended</h2>
            <p className="text-gray-500 text-sm">Contact <a href="mailto:support@shareconload.com" className="underline">support@shareconload.com</a> for more information.</p>
          </div>
        )}

        {profile.status === 'approved' && (
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Welcome, {profile.full_name}</h1>
              <p className="text-gray-500 text-sm">Base: {profile.base_city}, {profile.base_country}</p>
              {profile.average_rating != null && (
                <p className="text-sm text-gray-600 mt-1">Rating: {profile.average_rating.toFixed(1)} ★ · {profile.total_jobs_completed} jobs completed</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center justify-center gap-2 text-center">
                <div className="text-3xl font-extrabold text-orange-500">{profile.total_jobs_completed}</div>
                <div className="text-sm text-gray-500">Jobs Completed</div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center justify-center gap-2 text-center">
                <div className="text-3xl font-extrabold text-orange-500">
                  {profile.average_rating != null ? profile.average_rating.toFixed(1) + ' ★' : '—'}
                </div>
                <div className="text-sm text-gray-500">Average Rating</div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-sm text-blue-700">
              Job assignments will appear here once the Cargo Measurement Service launches. You will receive a notification when a job is assigned to you.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create app/transporter/page.tsx**

```tsx
// app/transporter/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';

type TransporterProfile = {
  id: string;
  full_name: string;
  base_city: string;
  base_country: string;
  vehicle_type: string;
  status: string;
  rejection_reason: string | null;
  average_rating: number | null;
  total_jobs_completed: number;
};

export default function TransporterDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<TransporterProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role_type', 'transporter');

      const profileIds = (profiles ?? []).map((p) => p.id);
      if (profileIds.length === 0) { router.push('/onboarding/transporter'); return; }

      const { data } = await supabase
        .from('transporter_profiles')
        .select('id, full_name, base_city, base_country, vehicle_type, status, rejection_reason, average_rating, total_jobs_completed')
        .in('profile_id', profileIds)
        .maybeSingle();

      if (!data) { router.push('/onboarding/transporter'); return; }
      setProfile(data as TransporterProfile);
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
      </div>
    );
  }

  if (!profile) return null;

  const vehicleLabel: Record<string, string> = {
    bakkie: 'Bakkie / Light Truck',
    small_truck: 'Small Truck',
    large_truck: 'Large Truck',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo1.png" alt="" width={36} height={36} className="h-8 w-auto" />
            <span className="text-lg font-extrabold tracking-tight">
              <span style={{ color: '#0f2044' }}>Share</span><span style={{ color: '#f97316' }}>Con</span><span style={{ color: '#0f2044' }}>Load</span>
            </span>
          </Link>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Transporter Portal</span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10">
        {profile.status === 'pending' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">⏳</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Application Under Review</h2>
            <p className="text-gray-500 text-sm">Your application has been submitted and is being reviewed. You will be notified once approved.</p>
          </div>
        )}

        {profile.status === 'rejected' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">❌</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Application Not Approved</h2>
            {profile.rejection_reason && <p className="text-gray-600 text-sm mb-3">Reason: {profile.rejection_reason}</p>}
            <p className="text-gray-500 text-sm">Contact <a href="mailto:support@shareconload.com" className="underline">support@shareconload.com</a>.</p>
          </div>
        )}

        {profile.status === 'suspended' && (
          <div className="bg-gray-100 border border-gray-200 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-3">🚫</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Account Suspended</h2>
            <p className="text-gray-500 text-sm">Contact <a href="mailto:support@shareconload.com" className="underline">support@shareconload.com</a>.</p>
          </div>
        )}

        {profile.status === 'approved' && (
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Welcome, {profile.full_name}</h1>
              <p className="text-gray-500 text-sm">Base: {profile.base_city}, {profile.base_country} · {vehicleLabel[profile.vehicle_type] ?? profile.vehicle_type}</p>
              {profile.average_rating != null && (
                <p className="text-sm text-gray-600 mt-1">Rating: {profile.average_rating.toFixed(1)} ★ · {profile.total_jobs_completed} jobs completed</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center gap-2 text-center">
                <div className="text-3xl font-extrabold text-orange-500">{profile.total_jobs_completed}</div>
                <div className="text-sm text-gray-500">Jobs Completed</div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center gap-2 text-center">
                <div className="text-3xl font-extrabold text-orange-500">
                  {profile.average_rating != null ? profile.average_rating.toFixed(1) + ' ★' : '—'}
                </div>
                <div className="text-sm text-gray-500">Average Rating</div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-sm text-blue-700">
              Pickup job assignments will appear here once the Pickup &amp; Drop-off Service launches. You will receive a notification when a job is assigned to you.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**
```bash
git add app/measurement-agent/page.tsx app/transporter/page.tsx
git commit -m "feat: add measurement agent and transporter portal dashboard pages"
```

---

## Task 11: Admin Review Pages

**Files:**
- Create: `app/admin/measurement-agents/page.tsx`
- Create: `app/admin/transporters/page.tsx`

These pages list all applications and allow approve/reject. They follow the exact same pattern as `app/admin/agents/page.tsx`.

- [ ] **Step 1: Create app/admin/measurement-agents/page.tsx**

```tsx
// app/admin/measurement-agents/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';
import { approveMeasurementAgent, rejectMeasurementAgent } from '@/actions/adminMeasurementAgentActions';

type AgentRow = {
  id: string;
  full_name: string;
  base_city: string;
  base_country: string;
  phone_number: string | null;
  id_document_url: string | null;
  selfie_url: string | null;
  equipment_photo_url: string | null;
  certification_test_passed: boolean;
  status: string;
  rejection_reason: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#fff7ed', color: '#f97316' },
  approved:  { bg: '#f0fdf4', color: '#16a34a' },
  rejected:  { bg: '#fef2f2', color: '#ef4444' },
  suspended: { bg: '#f3f4f6', color: '#6b7280' },
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminMeasurementAgentsPage() {
  const [agents, setAgents]             = useState<AgentRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState<AgentRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError]   = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from('measurement_agent_profiles')
      .select('id, full_name, base_city, base_country, phone_number, id_document_url, selfie_url, equipment_photo_url, certification_test_passed, status, rejection_reason, created_at')
      .order('created_at', { ascending: false });
    setAgents((data ?? []) as AgentRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleApprove(id: string) {
    setActionLoading(true); setActionError(null);
    const { error } = await approveMeasurementAgent(id);
    if (error) { setActionError(error); } else { setSelected(null); await load(); }
    setActionLoading(false);
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) { setActionError('Rejection reason is required.'); return; }
    setActionLoading(true); setActionError(null);
    const { error } = await rejectMeasurementAgent(id, rejectReason.trim());
    if (error) { setActionError(error); } else { setSelected(null); setRejectReason(''); await load(); }
    setActionLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">← Admin</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-extrabold text-gray-900">Measurement Agent Applications</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} /></div>
        ) : agents.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">No applications yet.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {agents.map((a) => {
              const s = STATUS_STYLES[a.status] ?? STATUS_STYLES.pending;
              return (
                <div key={a.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-800">{a.full_name}</p>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>
                        {a.status}
                      </span>
                      {a.certification_test_passed && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-600">✓ Test Passed</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{a.base_city}, {a.base_country}{a.phone_number ? ` · ${a.phone_number}` : ''}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Applied {fmt(a.created_at)}</p>
                    {a.rejection_reason && <p className="text-xs text-red-500 mt-1">Reason: {a.rejection_reason}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setSelected(a)}
                      className="btn btn-sm rounded-xl font-semibold"
                      style={{ backgroundColor: '#e8eef8', color: '#0f2044' }}
                    >
                      Review
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Review modal */}
        {selected && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-lg font-extrabold text-gray-900 mb-1">{selected.full_name}</h2>
              <p className="text-sm text-gray-500 mb-4">{selected.base_city}, {selected.base_country}</p>

              <div className="flex flex-col gap-2 mb-4 text-sm">
                {selected.id_document_url && <a href={selected.id_document_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">View ID Document</a>}
                {selected.selfie_url && <a href={selected.selfie_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">View Selfie</a>}
                {selected.equipment_photo_url && <a href={selected.equipment_photo_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">View Equipment Photo</a>}
              </div>

              {actionError && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>
              )}

              {selected.status === 'pending' ? (
                <>
                  <textarea
                    className="textarea textarea-bordered w-full mb-3 text-sm"
                    placeholder="Rejection reason (required to reject)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(selected.id)}
                      disabled={actionLoading}
                      className="btn flex-1 text-white font-bold rounded-xl disabled:opacity-50"
                      style={{ backgroundColor: '#16a34a' }}
                    >
                      {actionLoading ? <span className="loading loading-spinner loading-sm" /> : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleReject(selected.id)}
                      disabled={actionLoading}
                      className="btn flex-1 font-bold rounded-xl disabled:opacity-50"
                      style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}
                    >
                      Reject
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400 italic">This application has already been {selected.status}.</p>
              )}

              <button onClick={() => { setSelected(null); setRejectReason(''); setActionError(null); }} className="btn btn-ghost w-full mt-3 text-sm">Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create app/admin/transporters/page.tsx**

Identical structure to measurement-agents page, using `transporter_profiles` table and `adminTransporterActions`:

```tsx
// app/admin/transporters/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';
import { approveTransporter, rejectTransporter } from '@/actions/adminTransporterActions';

type TransporterRow = {
  id: string;
  full_name: string;
  base_city: string;
  base_country: string;
  phone_number: string | null;
  vehicle_type: string;
  vehicle_capacity_kg: number | null;
  vehicle_capacity_cbm: number | null;
  vehicle_registration_number: string | null;
  drivers_licence_url: string | null;
  vehicle_ownership_url: string | null;
  vehicle_photo_1_url: string | null;
  vehicle_photo_2_url: string | null;
  vehicle_photo_3_url: string | null;
  vehicle_photo_4_url: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#fff7ed', color: '#f97316' },
  approved:  { bg: '#f0fdf4', color: '#16a34a' },
  rejected:  { bg: '#fef2f2', color: '#ef4444' },
  suspended: { bg: '#f3f4f6', color: '#6b7280' },
};

const VEHICLE_LABELS: Record<string, string> = {
  bakkie: 'Bakkie',
  small_truck: 'Small Truck',
  large_truck: 'Large Truck',
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminTransportersPage() {
  const [transporters, setTransporters] = useState<TransporterRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState<TransporterRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError]   = useState<string | null>(null);

  async function load() {
    const { data } = await supabase
      .from('transporter_profiles')
      .select('id, full_name, base_city, base_country, phone_number, vehicle_type, vehicle_capacity_kg, vehicle_capacity_cbm, vehicle_registration_number, drivers_licence_url, vehicle_ownership_url, vehicle_photo_1_url, vehicle_photo_2_url, vehicle_photo_3_url, vehicle_photo_4_url, status, rejection_reason, created_at')
      .order('created_at', { ascending: false });
    setTransporters((data ?? []) as TransporterRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleApprove(id: string) {
    setActionLoading(true); setActionError(null);
    const { error } = await approveTransporter(id);
    if (error) { setActionError(error); } else { setSelected(null); await load(); }
    setActionLoading(false);
  }

  async function handleReject(id: string) {
    if (!rejectReason.trim()) { setActionError('Rejection reason is required.'); return; }
    setActionLoading(true); setActionError(null);
    const { error } = await rejectTransporter(id, rejectReason.trim());
    if (error) { setActionError(error); } else { setSelected(null); setRejectReason(''); await load(); }
    setActionLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">← Admin</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-extrabold text-gray-900">Transporter Applications</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} /></div>
        ) : transporters.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">No applications yet.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {transporters.map((t) => {
              const s = STATUS_STYLES[t.status] ?? STATUS_STYLES.pending;
              return (
                <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-800">{t.full_name}</p>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>{t.status}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{VEHICLE_LABELS[t.vehicle_type] ?? t.vehicle_type}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{t.base_city}, {t.base_country}{t.vehicle_capacity_cbm ? ` · ${t.vehicle_capacity_cbm} CBM` : ''}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Applied {fmt(t.created_at)}</p>
                    {t.rejection_reason && <p className="text-xs text-red-500 mt-1">Reason: {t.rejection_reason}</p>}
                  </div>
                  <button onClick={() => setSelected(t)} className="btn btn-sm rounded-xl font-semibold shrink-0" style={{ backgroundColor: '#e8eef8', color: '#0f2044' }}>Review</button>
                </div>
              );
            })}
          </div>
        )}

        {selected && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-screen overflow-y-auto">
              <h2 className="text-lg font-extrabold text-gray-900 mb-1">{selected.full_name}</h2>
              <p className="text-sm text-gray-500 mb-1">{selected.base_city}, {selected.base_country}</p>
              <p className="text-sm text-gray-500 mb-4">
                {VEHICLE_LABELS[selected.vehicle_type] ?? selected.vehicle_type}
                {selected.vehicle_capacity_cbm ? ` · ${selected.vehicle_capacity_cbm} CBM` : ''}
                {selected.vehicle_capacity_kg ? ` · ${selected.vehicle_capacity_kg} kg` : ''}
              </p>

              <div className="flex flex-col gap-2 mb-4 text-sm">
                {selected.drivers_licence_url && <a href={selected.drivers_licence_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">View Driver's Licence</a>}
                {selected.vehicle_ownership_url && <a href={selected.vehicle_ownership_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">View Ownership Papers</a>}
                {[1,2,3,4].map((n) => {
                  const url = selected[`vehicle_photo_${n}_url` as keyof TransporterRow] as string | null;
                  return url ? <a key={n} href={url} target="_blank" rel="noreferrer" className="text-blue-600 underline">View Vehicle Photo {n}</a> : null;
                })}
              </div>

              {actionError && (
                <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>
              )}

              {selected.status === 'pending' ? (
                <>
                  <textarea
                    className="textarea textarea-bordered w-full mb-3 text-sm"
                    placeholder="Rejection reason (required to reject)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleApprove(selected.id)} disabled={actionLoading} className="btn flex-1 text-white font-bold rounded-xl disabled:opacity-50" style={{ backgroundColor: '#16a34a' }}>
                      {actionLoading ? <span className="loading loading-spinner loading-sm" /> : 'Approve'}
                    </button>
                    <button onClick={() => handleReject(selected.id)} disabled={actionLoading} className="btn flex-1 font-bold rounded-xl disabled:opacity-50" style={{ backgroundColor: '#fef2f2', color: '#ef4444' }}>
                      Reject
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400 italic">This application has already been {selected.status}.</p>
              )}

              <button onClick={() => { setSelected(null); setRejectReason(''); setActionError(null); }} className="btn btn-ghost w-full mt-3 text-sm">Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**
```bash
git add app/admin/measurement-agents/page.tsx app/admin/transporters/page.tsx
git commit -m "feat: add admin review pages for measurement agents and transporters"
```

---

## Task 12: Update Onboarding Role Selection Page

**Files:**
- Modify: `app/onboarding/page.tsx`

Add two new role cards after the existing three. Also extend the `heldRoles` check to include the new types.

- [ ] **Step 1: Update the file**

In `app/onboarding/page.tsx`:

Replace:
```tsx
type HeldRole = 'operator' | 'agent';
```
With:
```tsx
type HeldRole = 'operator' | 'agent' | 'measurement_agent' | 'transporter';
```

Replace:
```tsx
      const roles: HeldRole[] = [];
      data?.forEach((p) => {
        if (p.role_type === 'operator') roles.push('operator');
        if (p.role_type === 'agent') roles.push('agent');
      });
```
With:
```tsx
      const roles: HeldRole[] = [];
      data?.forEach((p) => {
        if (p.role_type === 'operator')          roles.push('operator');
        if (p.role_type === 'agent')             roles.push('agent');
        if (p.role_type === 'measurement_agent') roles.push('measurement_agent');
        if (p.role_type === 'transporter')       roles.push('transporter');
      });
```

Replace:
```tsx
  const operatorHeld = heldRoles.includes('operator');
  const agentHeld = heldRoles.includes('agent');
```
With:
```tsx
  const operatorHeld          = heldRoles.includes('operator');
  const agentHeld             = heldRoles.includes('agent');
  const measurementAgentHeld  = heldRoles.includes('measurement_agent');
  const transporterHeld       = heldRoles.includes('transporter');
```

Change the grid from `sm:grid-cols-3` to `sm:grid-cols-2 lg:grid-cols-5` to fit 5 cards:
```tsx
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 w-full max-w-5xl">
```

Then add two new cards after the existing Agent card (before the closing `</div>`):

```tsx
            {/* Measurement Agent card */}
            <div className={`bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-4 ${measurementAgentHeld && isAuthed ? 'opacity-80' : ''}`}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: '#fef3c7' }}>📐</div>
              <div>
                <h2 className="text-lg font-extrabold text-gray-800">Cargo Measurement Agent</h2>
                <p className="text-gray-500 text-sm mt-1">Travel to shippers, measure cargo on-site, and earn per verified report</p>
              </div>
              {measurementAgentHeld && isAuthed ? (
                <div className="flex flex-col gap-2 mt-auto">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-green-600"><span>✓</span> You have this role</div>
                  <Link href="/measurement-agent" className="btn w-full font-bold rounded-xl hover:opacity-90 text-sm" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
                    Go to Agent Portal
                  </Link>
                </div>
              ) : (
                <button
                  onClick={() => router.push('/onboarding/measurement-agent')}
                  className="btn w-full text-white font-bold rounded-xl mt-auto hover:opacity-90"
                  style={{ backgroundColor: '#f59e0b' }}
                >
                  {isAuthed ? 'Register as Agent' : 'Join as Measurement Agent'}
                </button>
              )}
            </div>

            {/* Transporter card */}
            <div className={`bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-4 ${transporterHeld && isAuthed ? 'opacity-80' : ''}`}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: '#eff6ff' }}>🚛</div>
              <div>
                <h2 className="text-lg font-extrabold text-gray-800">Transporter</h2>
                <p className="text-gray-500 text-sm mt-1">Collect cargo from shippers and deliver to operator warehouses</p>
              </div>
              {transporterHeld && isAuthed ? (
                <div className="flex flex-col gap-2 mt-auto">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-green-600"><span>✓</span> You have this role</div>
                  <Link href="/transporter" className="btn w-full font-bold rounded-xl hover:opacity-90 text-sm" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
                    Go to Transporter Portal
                  </Link>
                </div>
              ) : (
                <button
                  onClick={() => router.push('/onboarding/transporter')}
                  className="btn w-full text-white font-bold rounded-xl mt-auto hover:opacity-90"
                  style={{ backgroundColor: '#3b82f6' }}
                >
                  {isAuthed ? 'Register as Transporter' : 'Join as Transporter'}
                </button>
              )}
            </div>
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**
```bash
git add app/onboarding/page.tsx
git commit -m "feat: add measurement agent and transporter cards to onboarding role selection"
```

---

## Task 13: Update Home Page Login Redirect

**Files:**
- Modify: `app/page.tsx`

The `resolveUser` function in `app/page.tsx` (lines ~158–180) handles post-login routing. Extend it to redirect `measurement_agent` and `transporter` users to their portals.

- [ ] **Step 1: Update resolveUser in app/page.tsx**

Find this block (around line 173):
```tsx
      if (isNewLogin) {
        if (data?.some((p) => p.is_admin)) {
          router.push("/admin");
        } else if (data?.some((p) => p.role_type === "operator")) {
          router.push("/operator");
        } else if (data?.some((p) => p.role_type === "agent")) {
          router.push("/agent");
        }
      }
```

Replace with:
```tsx
      if (isNewLogin) {
        if (data?.some((p) => p.is_admin)) {
          router.push("/admin");
        } else if (data?.some((p) => p.role_type === "operator")) {
          router.push("/operator");
        } else if (data?.some((p) => p.role_type === "agent")) {
          router.push("/agent");
        } else if (data?.some((p) => p.role_type === "measurement_agent")) {
          router.push("/measurement-agent");
        } else if (data?.some((p) => p.role_type === "transporter")) {
          router.push("/transporter");
        }
      }
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**
```bash
git add app/page.tsx
git commit -m "feat: extend login redirect to measurement-agent and transporter portals"
```

---

## Task 14: Update Admin Hub

**Files:**
- Modify: `app/admin/page.tsx`

Add links to the new admin pages in the Operations grid.

- [ ] **Step 1: Add two entries to the operations links array in app/admin/page.tsx**

Find the operations links array (around line 175):
```tsx
                  { href: '/admin/customers', label: 'Customers',   icon: '🪪', desc: 'Review customer identity KYC'  },
```

Add after it:
```tsx
                  { href: '/admin/measurement-agents', label: 'Meas. Agents', icon: '📐', desc: 'Review agent applications' },
                  { href: '/admin/transporters',       label: 'Transporters',  icon: '🚛', desc: 'Review transporter applications' },
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**
```bash
git add app/admin/page.tsx
git commit -m "feat: add measurement agents and transporters links to admin hub"
```

---

## Task 15: Manual Testing Checklist

- [ ] **Test 1: Role selection page**
  - Navigate to `/onboarding`
  - Confirm 5 role cards render correctly (Operator, Shipper, Agent, Measurement Agent, Transporter)
  - Click "Join as Measurement Agent" → redirects to `/onboarding/measurement-agent`
  - Click "Join as Transporter" → redirects to `/onboarding/transporter`

- [ ] **Test 2: Measurement Agent onboarding**
  - Complete Step 1 (personal info). Click Next. Confirm Step 2 loads.
  - Upload 3 docs in Step 2. Confirm checkmarks appear. Click Next.
  - In Step 3, answer all 5 questions. Click Submit. Confirm score shown.
  - If score < 4: confirm Retry button shown, can retake.
  - If score ≥ 4: confirm Next button appears.
  - Step 4: click "I Agree & Submit". Confirm redirect to `/measurement-agent`.

- [ ] **Test 3: Measurement Agent portal**
  - Verify pending state shows "Application Under Review" message.
  - Approve via admin page → reload → verify approved dashboard shows.

- [ ] **Test 4: Transporter onboarding**
  - Complete all 4 steps, upload all docs and photos.
  - Submit → confirm redirect to `/transporter`.
  - Verify pending state on transporter dashboard.

- [ ] **Test 5: Admin review pages**
  - Log in as admin, go to `/admin/measurement-agents`.
  - Confirm submitted applications appear.
  - Click Review → Approve → confirm status updates to approved.
  - Submit a new application → Reject with reason → confirm rejection_reason saved.

- [ ] **Test 6: Admin hub**
  - Go to `/admin` → confirm "Meas. Agents" and "Transporters" tiles appear and link correctly.

- [ ] **Test 7: Login redirect**
  - Log in as a user who has only `measurement_agent` role → confirm redirect to `/measurement-agent`.
  - Log in as a user who has only `transporter` role → confirm redirect to `/transporter`.
