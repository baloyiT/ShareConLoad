# Operator KYC Documents — International Redesign

## Goal

Expand the operator compliance document set from 5 South-Africa-centric documents to 7 internationally applicable documents that properly vet a logistics operator anywhere in the world.

## Background

Operators on ShareConLoad can be registered in any country. The current document set has two problems:
1. Descriptions reference SA-specific agencies (SARS, CIPC) making them inapplicable to international operators.
2. Missing documents that are critical for a logistics marketplace: cargo insurance and proof of warehouse capacity.

---

## Final Document Set

| # | Label | `doc_type` key | Required | Notes |
|---|---|---|---|---|
| 1 | Proof of Identity | `identity` | Yes | No change needed |
| 2 | Business Registration | `business_registration` | Yes | Remove CIPC reference |
| 3 | Proof of Warehouse Address | `proof_of_warehouse_address` | Yes | Renamed from `proof_of_address`; new description |
| 4 | Tax Clearance Certificate | `tax_clearance` | Yes | Remove SARS reference |
| 5 | Banking Confirmation | `banking_confirmation` | Yes | No change needed |
| 6 | Cargo Insurance Certificate | `cargo_insurance` | Yes | New document |
| 7 | Freight Forwarding License | `freight_forwarding_license` | No (Optional) | New document; jurisdiction-dependent |

---

## Document Descriptions

| Document | Description |
|---|---|
| Proof of Identity | Valid passport or national ID of the director or owner |
| Business Registration | Certificate of incorporation or registration from your country's business registry |
| Proof of Warehouse Address | Lease agreement, rates account, or utility bill confirming your warehouse or storage facility address |
| Tax Clearance Certificate | Tax compliance certificate from your country's revenue authority — required for payout approval |
| Banking Confirmation | Official letter from your bank confirming your account details |
| Cargo Insurance Certificate | Valid cargo or freight insurance policy covering goods in your care, custody, and control |
| Freight Forwarding License | Freight forwarding or customs broker license issued by your country's relevant authority (if applicable) |

---

## UI Behaviour

### Operator Documents Page (`/operator/compliance/documents`)

- Required docs (6): show "Not uploaded" badge when empty; block submission if missing.
- Optional doc (Freight Forwarding License): shows "Optional — not uploaded" badge in gray; no block on form.
- Upload, status badge (Under Review / Approved / Rejected), rejection notes, and approved-lock behaviour remain unchanged for all 7 slots.

### Admin KYC Documents Tab (`/admin/compliance` → KYC Documents)

- All 7 doc types labelled correctly.
- No change to approve/reject flow.

---

## Database Changes

### Migration required

1. Update `doc_type` check constraint on `compliance_documents` table:
   - Remove: `proof_of_address`
   - Add: `proof_of_warehouse_address`, `cargo_insurance`, `freight_forwarding_license`

2. Rename any existing `proof_of_address` rows to `proof_of_warehouse_address` (data migration).

### No new columns needed

The `optional` concept is purely frontend — the DB stores whatever `doc_type` is uploaded; the operator page controls which slots are presented as required vs. optional.

---

## Files to Change

| File | Change |
|---|---|
| `supabase/migrations/20260512_12_documents_international.sql` | Update check constraint + data migration |
| `app/operator/compliance/documents/page.tsx` | Update `DocType` union, `DOC_DEFS` (labels, descriptions, add `optional` flag) |
| `app/admin/compliance/page.tsx` | Update `DOC_TYPE_LABELS` |

---

## Out of Scope

- Country-specific document routing (different docs per operator country)
- Making Tax Clearance optional per country
- Admin ability to waive optional documents
