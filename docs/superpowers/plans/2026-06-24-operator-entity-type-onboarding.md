# Entity-Aware Operator Onboarding & Compliance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make operator onboarding and compliance request fields and documents appropriate to the operator's entity type — Individual (personal ID) vs Company (registration details), with a 3-doc vs 5-doc requirement.

**Architecture:** A single shared helper (`services/operatorCompliance.ts`) defines the per-entity required document set and entity-aware labels. The onboarding form, Business Profile step, Documents step, compliance hub, and create-container gate all branch off `operator_profiles.entity_type` via that helper. Two new nullable columns store the individual's ID type/number.

**Tech Stack:** Next.js (App Router, client components + one server action), TypeScript, Tailwind/DaisyUI, Supabase (Postgres + RLS). Spec: `docs/superpowers/specs/2026-06-24-operator-entity-type-onboarding-design.md`.

## Global Constraints

- Schema changes are idempotent SQL migrations in `supabase/migrations/`, named `YYYYMMDD_NN_short_description.sql`; commit immediately.
- No `any`. Functional components + hooks. Tailwind/DaisyUI; brand colors `#0b103a`, `#ff6a00`.
- **Entity logic is binary on `individual`**: `entity_type === 'individual'` → individual treatment; **any other value** (`company`, `partnership`, `trust`) → company treatment.
- Individual required docs (3): `identity`, `proof_of_warehouse_address`, `banking_confirmation`. Company required docs (5): `identity`, `business_registration`, `proof_of_warehouse_address`, `tax_clearance`, `banking_confirmation`.
- Reuse existing `doc_type` values; only labels and required-sets vary. Optional docs (`cargo_insurance`, `freight_forwarding_license`) stay optional for both.
- Verification harness is `npx tsc --noEmit` (no client unit runner) + SQL checks for the migration. Each task ends with a passing typecheck.

---

### Task 1: Migration — individual ID columns

**Files:**
- Create: `supabase/migrations/20260624_72_operator_individual_id_fields.sql`

**Interfaces:**
- Produces: `operator_profiles.id_type` (text, nullable), `operator_profiles.id_number` (text, nullable).

- [ ] **Step 1: Write the migration**

```sql
-- Individual operators provide a structured ID (type + number). Nullable: company
-- rows and existing rows leave them null; the app enforces presence for individuals.
alter table operator_profiles add column if not exists id_type text;
alter table operator_profiles add column if not exists id_number text;
```

- [ ] **Step 2: Apply it**

Apply via Supabase MCP `apply_migration` (project `fkhfbifgvebygafsewot`, name `operator_individual_id_fields`).

- [ ] **Step 3: Verify**

```sql
select column_name, is_nullable from information_schema.columns
where table_name='operator_profiles' and column_name in ('id_type','id_number') order by column_name;
```
Expected: both rows present, `is_nullable = YES`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260624_72_operator_individual_id_fields.sql
git commit -m "feat: add operator_profiles id_type/id_number for individual operators"
```

---

### Task 2: Shared compliance helper

**Files:**
- Create: `services/operatorCompliance.ts`

**Interfaces:**
- Produces:
  - `isIndividual(entity: string | null | undefined): boolean`
  - `requiredDocTypes(entity: string | null | undefined): string[]`
  - `docLabelOverride(docType: string, entity: string | null | undefined): { label?: string; desc?: string }`
  - `ID_TYPES: { value: string; label: string }[]`

- [ ] **Step 1: Create the helper**

```ts
// services/operatorCompliance.ts
// Single source of truth for entity-aware operator compliance requirements.

export const COMPANY_DOC_TYPES = [
  'identity',
  'business_registration',
  'proof_of_warehouse_address',
  'tax_clearance',
  'banking_confirmation',
] as const;

export const INDIVIDUAL_DOC_TYPES = [
  'identity',
  'proof_of_warehouse_address',
  'banking_confirmation',
] as const;

export const ID_TYPES: { value: string; label: string }[] = [
  { value: 'passport',        label: 'Passport' },
  { value: 'national_id',     label: 'National ID' },
  { value: 'drivers_license', label: "Driver's Licence" },
];

// Entity logic is binary: only 'individual' is treated as an individual;
// company / partnership / trust all use the company requirements.
export function isIndividual(entity: string | null | undefined): boolean {
  return entity === 'individual';
}

export function requiredDocTypes(entity: string | null | undefined): string[] {
  return isIndividual(entity) ? [...INDIVIDUAL_DOC_TYPES] : [...COMPANY_DOC_TYPES];
}

// Entity-aware label/description overrides for the two doc types whose meaning
// differs by entity. Returns {} when the default (company-oriented) text applies.
export function docLabelOverride(
  docType: string,
  entity: string | null | undefined,
): { label?: string; desc?: string } {
  if (!isIndividual(entity)) return {};
  if (docType === 'identity') {
    return { label: 'Proof of Identity', desc: 'Your valid passport or national ID' };
  }
  if (docType === 'proof_of_warehouse_address') {
    return {
      label: 'Proof of Residential Address',
      desc: 'Utility bill, bank statement, or lease agreement confirming your home address',
    };
  }
  return {};
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add services/operatorCompliance.ts
git commit -m "feat: shared entity-aware operator compliance helper"
```

---

### Task 3: Onboarding form + server action

**Files:**
- Modify: `app/onboarding/operator/page.tsx`
- Modify: `actions/operatorActions.ts`

**Interfaces:**
- Consumes: `ID_TYPES` from Task 2.
- Produces: operator_profiles rows with `id_type`/`id_number` (individual) or `registration_number`/`vat_number`/`contact_person` (company).

- [ ] **Step 1: Make form fields entity-aware**

In `app/onboarding/operator/page.tsx`, add `import { ID_TYPES } from '@/services/operatorCompliance';` and track the selected entity type in React state so fields can toggle. Add near the other `useState`s:

```tsx
  const [entityType, setEntityType] = useState('individual');
  const isIndividual = entityType === 'individual';
```

Change the Entity Type `<select>` to drive that state (keep `name="entity_type"` so it still posts):

```tsx
              <Field label="Entity Type">
                <select name="entity_type" value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="select select-bordered w-full">
                  <option value="individual">Individual</option>
                  <option value="company">Company</option>
                </select>
              </Field>
```

Update the **Legal Name** field label/placeholder to suit both, then **replace the Registration Number + VAT fields** with this conditional block, and make Contact Person conditional:

```tsx
              {/* Company-only: registration + VAT */}
              {!isIndividual && (
                <>
                  <Field label="Registration Number" required error={fieldErrors.registration_number}>
                    <input type="text" name="registration_number"
                      placeholder="Company registration number"
                      className={`input input-bordered w-full ${fieldErrors.registration_number ? 'input-error' : ''}`}
                      onChange={() => setFieldErrors((p) => ({ ...p, registration_number: '' }))} />
                  </Field>
                  <Field label="VAT Number" hint="optional">
                    <input type="text" name="vat_number" placeholder="VAT number"
                      className="input input-bordered w-full" />
                  </Field>
                </>
              )}

              {/* Individual-only: ID type + number */}
              {isIndividual && (
                <>
                  <Field label="ID Type" required>
                    <select name="id_type" className="select select-bordered w-full">
                      {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </Field>
                  <Field label="ID Number" required error={fieldErrors.id_number}>
                    <input type="text" name="id_number" placeholder="Your ID or passport number"
                      className={`input input-bordered w-full ${fieldErrors.id_number ? 'input-error' : ''}`}
                      onChange={() => setFieldErrors((p) => ({ ...p, id_number: '' }))} />
                  </Field>
                </>
              )}
```

Wrap the existing **Contact Person** `<Field>` in `{!isIndividual && ( … )}`.

- [ ] **Step 2: Add client validation in `handleSubmit`**

In the existing `handleSubmit`, after the legal-name check, add:

```tsx
    if (entityType === 'company') {
      const reg = (form.elements.namedItem('registration_number') as HTMLInputElement)?.value?.trim();
      if (!reg) errors.registration_number = 'Registration number is required for companies.';
    } else {
      const idNum = (form.elements.namedItem('id_number') as HTMLInputElement)?.value?.trim();
      if (!idNum) errors.id_number = 'ID number is required.';
    }
```
(The `fieldErrors` state already accepts arbitrary string keys via `Record<string, string>`.)

- [ ] **Step 3: Persist the fields in the server action**

In `actions/operatorActions.ts → createOperatorProfile`, change the `operator_profiles` insert (Step 2 of the action) to branch the entity-specific columns:

```ts
    const entityType = (formData.get('entity_type') as string) || 'individual';
    const individual = entityType === 'individual';

    const { error: opError } = await supabase.from('operator_profiles').insert({
      profile_id:          profile.id,
      entity_type:         entityType,
      legal_name:          formData.get('legal_name') as string,
      registration_number: individual ? null : ((formData.get('registration_number') as string) || null),
      vat_number:          individual ? null : ((formData.get('vat_number') as string) || null),
      contact_person:      individual ? null : ((formData.get('contact_person') as string) || null),
      id_type:             individual ? ((formData.get('id_type') as string) || null) : null,
      id_number:           individual ? ((formData.get('id_number') as string) || null) : null,
      country:             (formData.get('country') as string) || 'South Africa',
      phone_number:        (formData.get('phone_number') as string) || null,
      status:              'draft',
    });
```
Also add a server-side guard right before the insert (defence in depth):

```ts
    if (individual && !(formData.get('id_number') as string)?.trim()) {
      await supabase.from('profiles').delete().eq('id', profile.id);
      return { error: 'ID number is required for individual operators.' };
    }
    if (!individual && !(formData.get('registration_number') as string)?.trim()) {
      await supabase.from('profiles').delete().eq('id', profile.id);
      return { error: 'Registration number is required for companies.' };
    }
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/onboarding/operator/page.tsx actions/operatorActions.ts
git commit -m "feat: entity-aware operator onboarding fields + validation"
```

---

### Task 4: Business Profile compliance step

**Files:**
- Modify: `app/operator/compliance/profile/page.tsx`

**Interfaces:**
- Consumes: `ID_TYPES` from Task 2.

- [ ] **Step 1: Extend the form type + state + load**

Add `import { ID_TYPES } from '@/services/operatorCompliance';`. Extend `ProfileForm` and the initial state and the loaded values to include `id_type` and `id_number`:

```ts
type ProfileForm = {
  entity_type:         string;
  legal_name:          string;
  registration_number: string;
  vat_number:          string;
  id_type:             string;
  id_number:           string;
};
```
Initial state: add `id_type: 'passport', id_number: ''`. In `load()`, change the select to `'entity_type, legal_name, registration_number, vat_number, id_type, id_number'` and set `id_type: op.id_type ?? 'passport'`, `id_number: op.id_number ?? ''`.

- [ ] **Step 2: Branch the rendered fields**

Add `const isIndividual = form.entity_type === 'individual';` before the return. Wrap the Registration Number + VAT `<div>`s in `{!isIndividual && ( … )}`, and add an individual block after Legal Name:

```tsx
        {isIndividual && (
          <>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">ID Type <span className="text-red-500">*</span></label>
              <select value={form.id_type} onChange={(e) => update('id_type', e.target.value)} className="select select-bordered w-full">
                {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">ID Number <span className="text-red-500">*</span></label>
              <input type="text" value={form.id_number} onChange={(e) => update('id_number', e.target.value)}
                placeholder="Your ID or passport number" className="input input-bordered w-full" />
            </div>
          </>
        )}
```

- [ ] **Step 3: Branch validation + save**

In `handleSubmit`, after the legal-name check add:

```tsx
    if (form.entity_type === 'individual' && !form.id_number.trim()) { setError('ID number is required.'); return; }
    if (form.entity_type !== 'individual' && !form.registration_number.trim()) { setError('Registration number is required for companies.'); return; }
```
Change the `update({...})` payload to null the opposite set:

```tsx
        entity_type:         form.entity_type,
        legal_name:          form.legal_name.trim(),
        registration_number: form.entity_type === 'individual' ? null : (form.registration_number.trim() || null),
        vat_number:          form.entity_type === 'individual' ? null : (form.vat_number.trim() || null),
        id_type:             form.entity_type === 'individual' ? form.id_type : null,
        id_number:           form.entity_type === 'individual' ? (form.id_number.trim() || null) : null,
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add "app/operator/compliance/profile/page.tsx"
git commit -m "feat: entity-aware fields in operator Business Profile step"
```

---

### Task 5: Documents step — entity-aware required set + labels

**Files:**
- Modify: `app/operator/compliance/documents/page.tsx`

**Interfaces:**
- Consumes: `requiredDocTypes`, `docLabelOverride` from Task 2.

- [ ] **Step 1: Fetch entity_type and store it**

Add `import { requiredDocTypes, docLabelOverride } from '@/services/operatorCompliance';`. Add state `const [entityType, setEntityType] = useState<string>('company');`. In the load effect, when fetching the operator profile, also select `entity_type` and `setEntityType(op.entity_type ?? 'company')`. (The page already loads the operator_profiles row to get `op.id`; add `entity_type` to that select.)

- [ ] **Step 2: Build the visible doc list from the entity's required set + optionals, with overrides**

Where `slots` are built from `DOC_DEFS`, filter to the entity's required types plus the optional extras, and apply label overrides:

```tsx
  const required = requiredDocTypes(entityType);
  const visibleDefs = DOC_DEFS
    .filter((d) => required.includes(d.type) || d.optional)
    .map((d) => {
      const o = docLabelOverride(d.type, entityType);
      return { ...d, label: o.label ?? d.label, desc: o.desc ?? d.desc };
    });
```
Use `visibleDefs` (instead of `DOC_DEFS`) wherever slots are initialised/mapped for rendering.

- [ ] **Step 3: Make the required count entity-aware**

Replace the hardcoded `REQUIRED_TYPES` array (lines ~173-179) and the "of 5" usages:

```tsx
  const REQUIRED_TYPES = requiredDocTypes(entityType);
  const requiredCount = REQUIRED_TYPES.length;
  const uploadedCount = slots.filter((s) => REQUIRED_TYPES.includes(s.type) && s.record !== null).length;
```
Replace the progress text `{uploadedCount} of 5 required documents uploaded` → `{uploadedCount} of {requiredCount} required documents uploaded`, the bar width `(uploadedCount / 5)` → `(uploadedCount / requiredCount)`, and the completion gate `uploadedCount >= 5` → `uploadedCount >= requiredCount`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add "app/operator/compliance/documents/page.tsx"
git commit -m "feat: entity-aware required documents + labels in compliance documents step"
```

---

### Task 6: Compliance hub — entity-aware document completion

**Files:**
- Modify: `app/operator/compliance/page.tsx`

**Interfaces:**
- Consumes: `requiredDocTypes` from Task 2.

- [ ] **Step 1: Use the entity's required set for the Documents step**

Add `import { requiredDocTypes } from '@/services/operatorCompliance';`. In `load()`, the operator_profiles select already includes `status`; add `entity_type`. Replace the module-level `REQUIRED_DOC_TYPES` usage:

```tsx
      const required = requiredDocTypes(op.entity_type);
      const uploadedTypes = new Set((docs ?? []).map((d: DocRecord) => d.doc_type));
      const allDocsUploaded = required.every((t) => uploadedTypes.has(t));
```
(Remove the now-unused module-level `REQUIRED_DOC_TYPES` const if nothing else references it.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add "app/operator/compliance/page.tsx"
git commit -m "feat: compliance hub document step respects entity type"
```

---

### Task 7: Create-container gate — entity-aware approved-doc check

**Files:**
- Modify: `app/operator/create/page.tsx`

**Interfaces:**
- Consumes: `requiredDocTypes` from Task 2.

- [ ] **Step 1: Make the approved-doc requirement entity-aware**

Add `import { requiredDocTypes } from '@/services/operatorCompliance';`. In `checkCompliance`, the operator_profiles select already includes `status`; add `entity_type`. Replace the hardcoded `.in('doc_type', [...])` + `=== 5` logic:

```ts
      const required = requiredDocTypes(op.entity_type);
      const { count } = await supabase
        .from('compliance_documents')
        .select('id', { count: 'exact', head: true })
        .eq('operator_profile_id', op.id)
        .in('doc_type', required)
        .eq('status', 'approved');

      const compliant =
        !!op.legal_name &&
        !!op.phone_number &&
        !!op.paystack_recipient_code &&
        !!op.service_agreement_signed_at &&
        (count ?? 0) === required.length;
```
(The `pending` vs `blocked` branch on `op.status === 'pending_verification'` is unchanged.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 3: Manual verification (dev)**

As an individual operator: complete onboarding (ID type/number), upload only the 3 individual docs, and once approved confirm `/operator/create` is unblocked. As a company: confirm 5 docs still required. SQL spot-check:

```sql
select entity_type, id_type, id_number, registration_number from operator_profiles order by created_at desc limit 3;
```

- [ ] **Step 4: Commit**

```bash
git add "app/operator/create/page.tsx"
git commit -m "feat: create-container compliance gate respects entity-specific docs"
```

---

## Self-Review

**Spec coverage:**
- §2 Schema (id_type/id_number) → Task 1 ✓
- §3 Shared source of truth (REQUIRED_DOCS + labels) → Task 2 ✓ (named `requiredDocTypes` / `docLabelOverride`)
- §4 Field branching (onboarding + profile) → Tasks 3 & 4 ✓ (incl. required-field validation, contact hidden for individuals, nulling opposite set)
- §5 Documents step → Task 5 ✓
- §6 Compliance hub → Task 6 ✓
- §7 Create gate → Task 7 ✓
- §8 Edge cases: binary `individual` treatment (partnership/trust → company) covers the 4-option selector; switching type just changes required set (old uploads ignored, not deleted) ✓
- §9 Testing: per-task typecheck + Task 7 manual + SQL ✓

**Placeholder scan:** All code steps contain concrete code. No TBD/TODO.

**Type consistency:** `requiredDocTypes(entity)`, `docLabelOverride(docType, entity)`, `isIndividual(entity)`, `ID_TYPES` used identically across Tasks 3–7 as defined in Task 2. `id_type`/`id_number` columns (Task 1) match the form/action field names (Tasks 3–4) and are read in the gate/profile selects. Entity branching uses `=== 'individual'` consistently everywhere.
