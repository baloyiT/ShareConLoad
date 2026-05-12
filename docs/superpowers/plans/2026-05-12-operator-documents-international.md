# Operator KYC Documents — International Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the compliance document set from 5 SA-specific documents to 7 internationally applicable documents, rename Proof of Address to Proof of Warehouse Address, and mark Freight Forwarding License as optional.

**Architecture:** Three-file change: (1) a new SQL migration updates the DB check constraint and renames existing `proof_of_address` rows; (2) the operator documents page gets an updated `DocType` union, `DOC_DEFS` array with `optional` flag, and conditional badge rendering; (3) the admin compliance page gets updated `DOC_TYPE_LABELS`. No new components or API calls needed.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, DaisyUI, Supabase PostgreSQL

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/20260512_12_documents_international.sql` | Update doc_type check constraint + rename existing rows |
| Modify | `app/operator/compliance/documents/page.tsx` | DocType union, DOC_DEFS, DocSlot optional flag, badge |
| Modify | `app/admin/compliance/page.tsx` | DOC_TYPE_LABELS |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260512_12_documents_international.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260512_12_documents_international.sql

-- Step 1: rename any existing proof_of_address rows before changing the constraint
update public.compliance_documents
  set doc_type = 'proof_of_warehouse_address'
  where doc_type = 'proof_of_address';

-- Step 2: drop the old check constraint (name matches the one created by the previous migration)
alter table public.compliance_documents
  drop constraint if exists compliance_documents_doc_type_check;

-- Step 3: add the new check constraint with all 7 doc types
alter table public.compliance_documents
  add constraint compliance_documents_doc_type_check
  check (doc_type in (
    'identity',
    'business_registration',
    'proof_of_warehouse_address',
    'tax_clearance',
    'banking_confirmation',
    'cargo_insurance',
    'freight_forwarding_license'
  ));
```

- [ ] **Step 2: Apply the migration in Supabase SQL Editor**

Open your Supabase project → SQL Editor → New query. Paste and run the migration. Verify:
- Table Editor → `compliance_documents` → any existing `proof_of_address` rows should now say `proof_of_warehouse_address`
- The check constraint should accept the 7 new values

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260512_12_documents_international.sql
git commit -m "feat: update compliance_documents doc_type constraint for international documents"
```

---

## Task 2: Operator Documents Page

**Files:**
- Modify: `app/operator/compliance/documents/page.tsx`

Four things change in this file:
1. `DocType` union — add 2 types, rename `proof_of_address`
2. `DocSlot` type — add `optional: boolean` field
3. `DOC_DEFS` — update all labels/descriptions, add `optional` flag, add 2 new entries
4. JSX — "Not uploaded" badge becomes "Optional" badge for optional slots

- [ ] **Step 1: Replace the `DocType` union (line 9)**

Old:
```ts
type DocType = 'identity' | 'business_registration' | 'proof_of_address' | 'tax_clearance' | 'banking_confirmation';
```

New:
```ts
type DocType =
  | 'identity'
  | 'business_registration'
  | 'proof_of_warehouse_address'
  | 'tax_clearance'
  | 'banking_confirmation'
  | 'cargo_insurance'
  | 'freight_forwarding_license';
```

- [ ] **Step 2: Add `optional` to `DocSlot` type**

Old:
```ts
type DocSlot = {
  type: DocType;
  label: string;
  desc: string;
  record: DocRecord | null;
  uploading: boolean;
  error: string | null;
};
```

New:
```ts
type DocSlot = {
  type: DocType;
  label: string;
  desc: string;
  optional: boolean;
  record: DocRecord | null;
  uploading: boolean;
  error: string | null;
};
```

- [ ] **Step 3: Replace `DOC_DEFS` entirely**

Old:
```ts
const DOC_DEFS: { type: DocType; label: string; desc: string }[] = [
  { type: 'identity',              label: 'Proof of Identity',         desc: 'Valid passport or national ID (director/owner)' },
  { type: 'business_registration', label: 'Business Registration',     desc: 'Certificate of incorporation or CIPC document' },
  { type: 'proof_of_address',      label: 'Proof of Address',          desc: 'Utility bill or bank statement (not older than 3 months)' },
  { type: 'tax_clearance',         label: 'Tax Clearance Certificate', desc: 'Issued by SARS — required for payout approval' },
  { type: 'banking_confirmation',  label: 'Banking Confirmation',      desc: 'Official letter from your bank confirming your account details' },
];
```

New:
```ts
const DOC_DEFS: { type: DocType; label: string; desc: string; optional?: boolean }[] = [
  { type: 'identity',                   label: 'Proof of Identity',            desc: 'Valid passport or national ID of the director or owner' },
  { type: 'business_registration',      label: 'Business Registration',        desc: "Certificate of incorporation or registration from your country's business registry" },
  { type: 'proof_of_warehouse_address', label: 'Proof of Warehouse Address',   desc: 'Lease agreement, rates account, or utility bill confirming your warehouse or storage facility address' },
  { type: 'tax_clearance',              label: 'Tax Clearance Certificate',    desc: "Tax compliance certificate from your country's revenue authority — required for payout approval" },
  { type: 'banking_confirmation',       label: 'Banking Confirmation',         desc: 'Official letter from your bank confirming your account details' },
  { type: 'cargo_insurance',            label: 'Cargo Insurance Certificate',  desc: 'Valid cargo or freight insurance policy covering goods in your care, custody, and control' },
  { type: 'freight_forwarding_license', label: 'Freight Forwarding License',   desc: "Freight forwarding or customs broker license issued by your country's relevant authority (if applicable)", optional: true },
];
```

- [ ] **Step 4: Update `useState` initialiser to spread `optional`**

The initial `slots` state must include `optional`. Find this line:

```ts
const [slots, setSlots] = useState<DocSlot[]>(
  DOC_DEFS.map((d) => ({ ...d, record: null, uploading: false, error: null }))
);
```

Change to:
```ts
const [slots, setSlots] = useState<DocSlot[]>(
  DOC_DEFS.map((d) => ({ ...d, optional: d.optional ?? false, record: null, uploading: false, error: null }))
);
```

- [ ] **Step 5: Update the `setSlots` call in `useEffect` to include `optional`**

Find the `setSlots` inside the `load` function:

```ts
setSlots(DOC_DEFS.map((d) => ({
  ...d,
  record: recordMap[d.type] ?? null,
  uploading: false,
  error: null,
})));
```

Change to:
```ts
setSlots(DOC_DEFS.map((d) => ({
  ...d,
  optional: d.optional ?? false,
  record: recordMap[d.type] ?? null,
  uploading: false,
  error: null,
})));
```

- [ ] **Step 6: Update the "Not uploaded" badge in JSX to show "Optional" for optional slots**

Find this block inside the card JSX:
```tsx
{!slot.record && !slot.uploading && (
  <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 bg-gray-100 text-gray-500">
    Not uploaded
  </span>
)}
```

Replace with:
```tsx
{!slot.record && !slot.uploading && (
  <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 bg-gray-100 text-gray-500">
    {slot.optional ? 'Optional' : 'Not uploaded'}
  </span>
)}
```

- [ ] **Step 7: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
git add app/operator/compliance/documents/page.tsx
git commit -m "feat: update operator documents to international set with optional freight license"
```

---

## Task 3: Admin Compliance Page — Update Labels

**Files:**
- Modify: `app/admin/compliance/page.tsx`

- [ ] **Step 1: Replace `DOC_TYPE_LABELS`**

Old:
```ts
const DOC_TYPE_LABELS: Record<string, string> = {
  identity:              'Proof of Identity',
  business_registration: 'Business Registration',
  proof_of_address:      'Proof of Address',
  tax_clearance:         'Tax Clearance Certificate',
  banking_confirmation:  'Banking Confirmation',
};
```

New:
```ts
const DOC_TYPE_LABELS: Record<string, string> = {
  identity:                   'Proof of Identity',
  business_registration:      'Business Registration',
  proof_of_warehouse_address: 'Proof of Warehouse Address',
  tax_clearance:              'Tax Clearance Certificate',
  banking_confirmation:       'Banking Confirmation',
  cargo_insurance:            'Cargo Insurance Certificate',
  freight_forwarding_license: 'Freight Forwarding License',
};
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/compliance/page.tsx
git commit -m "feat: update admin compliance doc type labels for international document set"
```

---

## Task 4: Smoke Test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify operator documents page**

Navigate to `/operator/compliance/documents` as an operator.

Check:
- 7 cards render in order: Proof of Identity, Business Registration, Proof of Warehouse Address, Tax Clearance Certificate, Banking Confirmation, Cargo Insurance Certificate, Freight Forwarding License
- First 6 cards show "Not uploaded" badge
- Freight Forwarding License card shows "Optional" badge (gray)
- Descriptions are country-agnostic (no SARS, no CIPC)
- Upload works on at least one card — file goes through, badge changes to "Under Review"

- [ ] **Step 3: Verify admin compliance page**

Navigate to `/admin/compliance` → KYC Documents tab.

Check:
- Any uploaded doc shows the correct new label (e.g., "Proof of Warehouse Address" not "Proof of Address")
- `proof_of_warehouse_address` key renders correctly via `DOC_TYPE_LABELS`
- Any existing `proof_of_address` docs (renamed by migration) display as "Proof of Warehouse Address"
