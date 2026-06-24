# Entity-Aware Operator Onboarding & Compliance — Design Spec

**Date:** 2026-06-24
**Status:** Approved for planning
**Author:** Justice Baloyi (with Claude)

---

## 1. Overview

Operators are either a **Company** or an **Individual**. Today `operator_profiles.entity_type`
exists and both the onboarding form and the Business Profile step show an Individual/Company
selector, but **nothing branches on it**: the same fields are requested for both, and every
operator must upload the same five compliance documents — including a **business registration**
and **tax clearance**, which an individual cannot provide.

This change makes the **form fields** and the **required compliance documents** adapt to the
selected entity type.

### Goals
- Onboarding (and the Business Profile compliance step) request fields appropriate to the entity type.
- Individuals provide structured personal ID (type + number); companies provide registration details.
- Required compliance documents differ by entity type; the compliance hub and the create-container
  gate respect that difference.

### Non-goals
- No change to the 5-step compliance flow structure (Profile → Contact → Bank → Documents → Agreement).
- No change to payments/payouts/commission.
- No new `doc_type` values (reuse existing; only labels and required-sets vary).

---

## 2. Data Model

New migration: `supabase/migrations/20260624_NN_operator_individual_id_fields.sql` (idempotent).

Add to `operator_profiles`:

| Column | Type | Notes |
|---|---|---|
| `id_type` | `text` (nullable) | Individual's ID document type: `passport` \| `national_id` \| `drivers_license`. Null for companies. |
| `id_number` | `text` (nullable) | Individual's ID number. Null for companies. |

No constraint forcing presence by entity type at the DB layer (kept nullable for existing rows and
company rows); the application validates the required field per entity type. RLS unchanged.

---

## 3. Shared source of truth — required documents by entity type

Introduce a single helper (e.g. `services/operatorCompliance.ts`) so the documents step, the
compliance hub, and the create-container gate agree:

```ts
export type EntityType = 'individual' | 'company';

export const REQUIRED_DOCS: Record<EntityType, string[]> = {
  company:    ['identity', 'business_registration', 'proof_of_warehouse_address', 'tax_clearance', 'banking_confirmation'],
  individual: ['identity', 'proof_of_warehouse_address', 'banking_confirmation'],
};

// Entity-aware labels for shared doc_type values
export function docLabel(docType: string, entity: EntityType): string;
```

- `identity` → "Proof of Identity (Director/Owner)" (company) · "Proof of Identity" (individual)
- `proof_of_warehouse_address` → "Proof of Business Address" (company) · "Proof of Residential Address" (individual)
- Other doc types keep their existing labels.

Optional extras (`cargo_insurance`, `freight_forwarding_license`) remain **optional for both** entity types.

---

## 4. Field branching (form)

Applies identically to **`app/onboarding/operator/page.tsx`** and the **Business Profile** step
**`app/operator/compliance/profile/page.tsx`** (both already have the entity_type selector).

**Company:**
- Company Name (`legal_name`, required)
- Registration Number (`registration_number`, **required**)
- VAT Number (`vat_number`, optional)
- Contact Person (`contact_person`, optional)
- Country (required), Phone

**Individual:**
- Full Legal Name (`legal_name`, required)
- ID Type (`id_type`, select: Passport / National ID / Driver's Licence, required)
- ID Number (`id_number`, **required**)
- Country (required), Phone
- **Hidden:** Registration Number, VAT, Contact Person

Selecting the entity type toggles which fields render. On submit/save, only the relevant set is
written; the other set is nulled (company → `id_type`/`id_number` null; individual →
`registration_number`/`vat_number`/`contact_person` null).

### Validation
- Company: `legal_name` and `registration_number` required.
- Individual: `legal_name`, `id_type`, and `id_number` required.
- Country + phone validation unchanged for both.

### Server action / save changes
- `actions/operatorActions.ts → createOperatorProfile`: read `id_type`/`id_number` from the form and
  include in the `operator_profiles` insert; apply the per-type validation (return `{ error }` on miss).
- `compliance/profile` save (`update`): same — persist `id_type`/`id_number` and null the opposite set.

---

## 5. Documents step (`app/operator/compliance/documents/page.tsx`)

- Fetch `operator_profiles.entity_type`.
- Render only the required docs for that entity type (`REQUIRED_DOCS[entity]`) plus the optional extras.
- Use `docLabel(type, entity)` for entity-aware labels/descriptions.
- The "all required uploaded" check uses `REQUIRED_DOCS[entity]` instead of the hardcoded 5-type list.

---

## 6. Compliance hub (`app/operator/compliance/page.tsx`)

- Fetch `entity_type` (already fetches operator_profiles).
- Replace the module-level `REQUIRED_DOC_TYPES` usage with `REQUIRED_DOCS[entity]`.
- "Documents" step is complete when every doc in `REQUIRED_DOCS[entity]` is uploaded.
- Step structure (5 steps) and labels are unchanged.

---

## 7. Create-container gate (`app/operator/create/page.tsx`)

The compliance check currently requires exactly 5 approved docs of fixed types. Change to entity-aware:

- Fetch `entity_type` (already fetches the operator_profiles row in `checkCompliance`).
- Required set = `REQUIRED_DOCS[entity]`; query approved `compliance_documents` whose `doc_type` is in
  that set; **compliant requires approved count === required set length** (3 for individual, 5 for company),
  alongside the existing `legal_name` / `phone_number` / `paystack_recipient_code` /
  `service_agreement_signed_at` checks.
- The existing `pending` vs `blocked` distinction (status `pending_verification`) is unchanged.

This removes the bug where an individual can never satisfy the gate (no business registration / tax clearance).

---

## 8. Edge Cases

- **Switching entity type** after uploading documents: allowed in the Business Profile step. The
  required-set logic simply ignores uploads of now-irrelevant doc types (they are not deleted). If the
  operator switches company→individual, their extra company docs remain on file but don't block; if
  individual→company, they'll be prompted for the additional company docs.
- **Existing operators:** keep their current `entity_type`; `id_type`/`id_number` stay null until edited.
- **Optional doc types** (cargo insurance, freight licence): available to both, never required.

---

## 9. Testing

- **Migration:** apply; confirm `id_type`/`id_number` exist and are nullable; existing rows unaffected.
- **Onboarding form:** select Individual → ID Type/Number shown, Registration/VAT/Contact hidden;
  select Company → reverse. Submit each → correct columns populated, opposite set null.
- **Validation:** Individual without ID number blocked; Company without registration number blocked.
- **Documents step:** Individual sees 3 required docs with residential/personal labels; Company sees 5
  with business labels; optional extras shown for both.
- **Hub:** "Documents" step completes after 3 (individual) / 5 (company) uploads.
- **Create gate:** an individual with ID + residential address + bank approved (3) can list a container;
  a company still needs all 5. Regression: company flow unchanged.
- Extend Playwright operator onboarding specs where practical.

---

## 10. Files Touched

- `supabase/migrations/20260624_NN_operator_individual_id_fields.sql` (new)
- `services/operatorCompliance.ts` (new — `REQUIRED_DOCS`, `docLabel`, `EntityType`)
- `app/onboarding/operator/page.tsx` — entity-aware fields + validation
- `actions/operatorActions.ts` — persist `id_type`/`id_number`, per-type validation
- `app/operator/compliance/profile/page.tsx` — entity-aware fields + save
- `app/operator/compliance/documents/page.tsx` — entity-aware required set + labels
- `app/operator/compliance/page.tsx` — entity-aware doc completion
- `app/operator/create/page.tsx` — entity-aware compliance gate
