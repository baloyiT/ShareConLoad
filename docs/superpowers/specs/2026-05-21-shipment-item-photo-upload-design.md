# Shipment Item Photo Upload — Design Spec

**Date:** 2026-05-21
**Scope:** `app/booking/[containerId]/page.tsx` + one DB migration + Supabase Storage bucket

---

## Problem

Customers booking container space have no way to attach photos of the goods they are shipping. Photos provide a shared visual record for operators (verification before acceptance), customers (proof of condition), and admins (compliance, disputes, cargo release).

---

## Decision Summary

| Decision | Choice | Reason |
|---|---|---|
| Upload timing | On form submit | Avoids orphaned files; fits existing submit flow |
| Requirement | Optional | Reduces form friction; photos are a trust signal, not a gate |
| Max photos per item | 3 | Enough for multiple angles; bounded storage use |
| Storage location | Supabase Storage `item-photos` bucket | Consistent with existing Storage use (dispute evidence) |
| Schema change | `photo_urls text[]` on `shipment_items` | Minimal; no new table needed for MVP |
| Visibility | Customer + Operator + Admin | Shared record across all parties |

---

## Schema

### Migration file
`supabase/migrations/YYYYMMDD_NN_shipment_item_photos.sql`

```sql
ALTER TABLE shipment_items
  ADD COLUMN IF NOT EXISTS photo_urls text[] DEFAULT '{}';
```

### Supabase Storage bucket
- **Bucket name:** `item-photos`
- **Public:** false (private, URL-signed or policy-gated)
- **File path pattern:** `{bookingId}/{itemIndex}/{filename}`
- **RLS policies:**
  - Upload: authenticated users only (enforced by Supabase Auth; path scoped to `bookingId` ensures ownership)
  - Read: any authenticated user with the file URL (matches the pattern used by the dispute evidence bucket — private bucket, authenticated read)

---

## UI Changes (`app/booking/[containerId]/page.tsx`)

### Type change
```ts
type ItemForm = {
  _key: string;
  description: string;
  category: string;
  quantity: string;
  estimated_value: string;
  weight_kg: string;
  volume_cbm: string;
  photos: File[];          // NEW
};

function emptyItem(): ItemForm {
  return { ..., photos: [] };
}
```

### Per-item photo block
Added at the bottom of each item card, below the Weight/Volume fields:

- Label: **"Item Photos"** with `(optional · up to 3 · JPG/PNG/WEBP)` hint
- **"Add Photo" button** — triggers a hidden `<input type="file" accept=".jpg,.jpeg,.png,.webp" multiple />`. Hidden when 3 photos already selected.
- **Thumbnail row** — `64×64` square previews generated via `URL.createObjectURL`. Each thumbnail has an × button to remove that file.
- Max file size enforced client-side: 5 MB per file. Files exceeding this show an inline error on that item.
- No submit-blocking validation — photos are optional.

---

## Submit Flow

Existing steps are unchanged. Two new steps are inserted after step 2 (shipment items insert):

```
1. Insert booking                              (existing)
2. Insert shipment items → collect row IDs     (existing, updated to return IDs)
3. Upload photos to Supabase Storage           (NEW)
   - For each item with photos.length > 0:
     - Upload each File to item-photos/{bookingId}/{itemIndex}/{filename}
     - Collect resulting public/signed URLs
4. Patch shipment_items.photo_urls             (NEW)
   - UPDATE shipment_items SET photo_urls = $urls WHERE id = $itemId
5. Insert declaration                          (existing)
6. Update container available_capacity_cbm     (existing)
7. Fire booking.created notification           (existing)
8. router.push(`/payments/${booking.id}`)      (existing)
```

### Error handling for photo steps
Photo upload/patch failure is **non-blocking**:
- Booking creation, items, declaration, and capacity update are unaffected.
- A dismissible warning banner is shown: _"Booking created — photos could not be saved. You can add them later from My Bookings."_
- User is still redirected to payments after the warning.
- Error is logged to console for debugging.

---

## Files Changed

| File | Change |
|---|---|
| `app/booking/[containerId]/page.tsx` | Add `photos: File[]` to `ItemForm`; add photo upload UI to each item card; extend submit handler with steps 3–4 |
| `supabase/migrations/YYYYMMDD_NN_shipment_item_photos.sql` | Add `photo_urls text[]` to `shipment_items` |

No new components. No new service files. No changes to other pages.

---

## Out of Scope

- Displaying uploaded photos on the booking track page, operator bookings page, or admin pages (follow-on work)
- Retrying failed photo uploads from My Bookings (follow-on work)
- Server-side file size or MIME validation (client-side check is sufficient for MVP)
- Compression or resizing of uploaded images
