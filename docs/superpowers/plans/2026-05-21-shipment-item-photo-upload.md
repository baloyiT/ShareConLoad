# Shipment Item Photo Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional per-item photo upload (up to 3 photos, max 5 MB each) to the customer booking form, storing photos in Supabase Storage and saving their public URLs in `shipment_items.photo_urls`.

**Architecture:** All frontend changes are in `app/booking/[containerId]/page.tsx`. Photos are held as `File[]` in form state with `URL.createObjectURL` previews until submission. After the shipment items are inserted, photos are uploaded to a public Supabase Storage bucket (`item-photos`) and the resulting URLs are patched back onto each `shipment_items` row. Photo upload failure is caught separately — the booking proceeds regardless.

**Tech Stack:** Next.js App Router, TypeScript, Supabase JS client (Storage + DB), DaisyUI/Tailwind

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260521_40_shipment_item_photos.sql` | Create | Add `photo_urls` column; create `item-photos` bucket + storage policies |
| `app/booking/[containerId]/page.tsx` | Modify | Types, state, helpers, per-item photo UI, submit handler |

---

### Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260521_40_shipment_item_photos.sql`

- [ ] **Step 1.1: Create the migration file**

Create `supabase/migrations/20260521_40_shipment_item_photos.sql` with exactly this content:

```sql
-- Add photo_urls column to shipment_items
alter table public.shipment_items
  add column if not exists photo_urls text[] default '{}';

-- Create item-photos storage bucket (public, matches dispute-evidence pattern)
insert into storage.buckets (id, name, public)
  values ('item-photos', 'item-photos', true)
  on conflict (id) do nothing;

-- Allow authenticated users to upload
drop policy if exists "authenticated_upload_item_photos" on storage.objects;
create policy "authenticated_upload_item_photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'item-photos');

-- Allow public read
drop policy if exists "public_read_item_photos" on storage.objects;
create policy "public_read_item_photos" on storage.objects
  for select using (bucket_id = 'item-photos');
```

- [ ] **Step 1.2: Apply the migration in Supabase**

Open the Supabase dashboard → SQL Editor → paste the file contents → Run.

Verify:
- `shipment_items` table shows a `photo_urls` column of type `text[]` with default `{}`
- Storage → Buckets shows `item-photos` (public)

- [ ] **Step 1.3: Commit**

```bash
git add supabase/migrations/20260521_40_shipment_item_photos.sql
git commit -m "feat: add photo_urls to shipment_items and item-photos storage bucket"
```

---

### Task 2: Update Types, State and Helpers

**Files:**
- Modify: `app/booking/[containerId]/page.tsx`

- [ ] **Step 2.1: Add `photos` to `ItemForm` and `emptyItem`**

`ItemForm` is defined at the top of the file. Replace it with:

```ts
type ItemForm = {
  _key: string;
  description: string;
  category: string;
  quantity: string;
  estimated_value: string;
  weight_kg: string;
  volume_cbm: string;
  photos: File[];
};
```

Replace `emptyItem()` with:

```ts
function emptyItem(): ItemForm {
  return {
    _key: crypto.randomUUID(),
    description: '',
    category: '',
    quantity: '1',
    estimated_value: '',
    weight_kg: '',
    volume_cbm: '',
    photos: [],
  };
}
```

- [ ] **Step 2.2: Add `photoPreviews` state**

Inside `BookingPage`, add this state declaration directly after the `items` state line (`const [items, setItems] = ...`):

```ts
const [photoPreviews, setPhotoPreviews] = useState<Record<string, string[]>>({});
```

- [ ] **Step 2.3: Add `addItemPhoto` and `removeItemPhoto` helpers**

Add both helpers after the existing `updateItem` callback. They must be `useCallback` for consistency with the other item helpers:

```ts
const addItemPhoto = useCallback((key: string, files: FileList | null) => {
  if (!files) return;
  const fileArray = Array.from(files);
  const oversized = fileArray.find((f) => f.size > 5 * 1024 * 1024);
  if (oversized) {
    setErrors((e) => ({ ...e, [`photo_size_${key}`]: `"${oversized.name}" exceeds 5 MB limit.` }));
    return;
  }
  setErrors((e) => ({ ...e, [`photo_size_${key}`]: undefined }));
  const target = items.find((i) => i._key === key);
  if (!target) return;
  const slots = 3 - target.photos.length;
  if (slots <= 0) return;
  const newFiles = fileArray.slice(0, slots);
  const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
  setItems((prev) =>
    prev.map((i) => (i._key === key ? { ...i, photos: [...i.photos, ...newFiles] } : i))
  );
  setPhotoPreviews((prev) => ({
    ...prev,
    [key]: [...(prev[key] ?? []), ...newPreviews],
  }));
}, [items]);

const removeItemPhoto = useCallback((key: string, index: number) => {
  setPhotoPreviews((prev) => {
    const preview = prev[key]?.[index];
    if (preview) URL.revokeObjectURL(preview);
    const updated = [...(prev[key] ?? [])];
    updated.splice(index, 1);
    return { ...prev, [key]: updated };
  });
  setItems((prev) =>
    prev.map((i) => {
      if (i._key !== key) return i;
      const updated = [...i.photos];
      updated.splice(index, 1);
      return { ...i, photos: updated };
    })
  );
  setErrors((prev) => ({ ...prev, [`photo_size_${key}`]: undefined }));
}, []);
```

- [ ] **Step 2.4: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors. If you see errors on `ItemForm` or the new helpers, check that `photos: File[]` is present in both the type and `emptyItem()`, and that `photoPreviews` is declared before the callbacks.

- [ ] **Step 2.5: Commit**

```bash
git add app/booking/[containerId]/page.tsx
git commit -m "feat: add photos field to ItemForm and photo state helpers"
```

---

### Task 3: Per-Item Photo Upload UI

**Files:**
- Modify: `app/booking/[containerId]/page.tsx`

- [ ] **Step 3.1: Add photo block to each item card**

Inside the `items.map((item, idx) => ...)` loop, find the closing `</div>` of the `<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">` grid (the one containing Description, Category, Quantity, Value, Weight, Volume fields). Add the photo block **after** that grid's closing `</div>` but **before** the outer item card `</div>`:

```tsx
{/* Photo upload */}
<div className="mt-4 pt-4 border-t border-gray-100">
  <div className="flex items-center justify-between mb-2">
    <span className="text-xs font-semibold text-gray-600">
      Item Photos
      <span className="font-normal text-gray-400 ml-1">(optional · up to 3 · JPG/PNG/WEBP)</span>
    </span>
    {item.photos.length < 3 && (
      <button
        type="button"
        onClick={() =>
          (document.getElementById(`photo-input-${item._key}`) as HTMLInputElement | null)?.click()
        }
        className="btn btn-xs btn-outline border-gray-300 text-gray-600 hover:border-orange-400 hover:text-orange-500 gap-1"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Photo
      </button>
    )}
  </div>
  <input
    id={`photo-input-${item._key}`}
    type="file"
    accept=".jpg,.jpeg,.png,.webp"
    multiple
    className="hidden"
    onChange={(e) => {
      addItemPhoto(item._key, e.target.files);
      e.target.value = '';
    }}
  />
  {(photoPreviews[item._key] ?? []).length > 0 && (
    <div className="flex flex-wrap gap-2 mt-2">
      {(photoPreviews[item._key] ?? []).map((url, photoIdx) => (
        <div
          key={photoIdx}
          className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 group"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`Item ${idx + 1} photo ${photoIdx + 1}`}
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={() => removeItemPhoto(item._key, photoIdx)}
            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Remove photo"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )}
  {errors[`photo_size_${item._key}`] && (
    <p className="text-red-500 text-xs mt-1">{errors[`photo_size_${item._key}`]}</p>
  )}
</div>
```

- [ ] **Step 3.2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors. The `eslint-disable-next-line` comment suppresses the Next.js `<img>` lint rule — blob URLs are not compatible with `<Image>`.

- [ ] **Step 3.3: Visual check**

Start the dev server:

```bash
npm run dev
```

Navigate to a booking form (you need a valid container ID — find one in your Supabase `containers` table). Verify:

- "Item Photos (optional · up to 3 · JPG/PNG/WEBP)" label appears at the bottom of each item card
- "Add Photo" button is visible
- Clicking "Add Photo" opens the OS file picker
- Selecting a JPG/PNG shows a `64×64` thumbnail
- Hovering a thumbnail reveals the × button; clicking it removes the photo and the thumbnail disappears
- When 3 photos are selected, the "Add Photo" button disappears
- Selecting a file larger than 5 MB shows an error message below the photo section
- Adding another item via "+ Add another item" shows a fresh photo block with no photos

- [ ] **Step 3.4: Commit**

```bash
git add app/booking/[containerId]/page.tsx
git commit -m "feat: add per-item photo upload UI to booking form"
```

---

### Task 4: Submit Handler — Upload Photos

**Files:**
- Modify: `app/booking/[containerId]/page.tsx`

- [ ] **Step 4.1: Change shipment items insert to return IDs**

Locate the shipment items insert inside `handleSubmit`:

```ts
const { error: itemsError } = await supabase.from('shipment_items').insert(shipmentRows);
if (itemsError) throw itemsError;
```

Replace with:

```ts
const { data: insertedItems, error: itemsError } = await supabase
  .from('shipment_items')
  .insert(shipmentRows)
  .select('id');
if (itemsError || !insertedItems) throw itemsError ?? new Error('shipment_items insert returned no data');
```

- [ ] **Step 4.2: Add photo upload block immediately after the items insert**

Directly after the `if (itemsError || !insertedItems)` line from Step 4.1, add:

```ts
// ── Step 2b: Upload item photos (non-blocking) ──────────────────────────────
try {
  for (let i = 0; i < items.length; i++) {
    const itemPhotos = items[i].photos;
    if (itemPhotos.length === 0) continue;
    const urls: string[] = [];
    for (const file of itemPhotos) {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const filePath = `${booking.id}/${i}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('item-photos')
        .upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from('item-photos')
        .getPublicUrl(filePath);
      urls.push(urlData.publicUrl);
    }
    await supabase
      .from('shipment_items')
      .update({ photo_urls: urls })
      .eq('id', insertedItems[i].id);
  }
} catch (photoErr) {
  console.error('Item photo upload failed (non-blocking):', photoErr);
}
```

- [ ] **Step 4.3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors. `insertedItems` is `{ id: string }[]`, so `insertedItems[i].id` is valid. `items[i].photos` is `File[]` per the type from Task 2.

- [ ] **Step 4.4: End-to-end manual test**

With the dev server running and a test account logged in:

1. Navigate to a booking form for an open container
2. Add CBM (e.g. `2`)
3. Add an item — attach 2 photos (JPGs under 5 MB)
4. Check the declaration checkbox
5. Click "Submit Booking"

Expected:
- Page redirects to `/payments/{bookingId}`
- In Supabase Storage → `item-photos` bucket: files appear at `{bookingId}/0/{uuid}.jpg`
- In Supabase Table Editor → `shipment_items`: the row for this booking shows `photo_urls` = `["https://...supabase.co/storage/v1/object/public/item-photos/..."]`
- Browser console has no uncaught errors

Also test the non-blocking path:
- Temporarily disable the `item-photos` bucket (rename it in the dashboard)
- Submit a booking with photos attached
- Expected: booking is created and redirect proceeds; browser console logs "Item photo upload failed (non-blocking)"
- Re-enable the bucket afterward

- [ ] **Step 4.5: Commit**

```bash
git add app/booking/[containerId]/page.tsx
git commit -m "feat: upload item photos to Supabase Storage on booking submit"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| `photo_urls text[]` on `shipment_items` | Task 1 |
| `item-photos` Supabase Storage bucket | Task 1 |
| Authenticated upload / public read policies | Task 1 |
| `photos: File[]` added to `ItemForm` | Task 2 |
| `emptyItem()` initialises `photos: []` | Task 2 |
| Max 3 photos enforced (client-side) | Task 2 `addItemPhoto` |
| Max 5 MB per file enforced (client-side) | Task 2 `addItemPhoto` |
| Optional — no submit-blocking validation | Not added to `validate()` — correct |
| Accept JPG/PNG/WEBP | Task 3 `accept` attribute |
| Thumbnail previews with × remove | Task 3 |
| "Add Photo" button hidden at 3 photos | Task 3 |
| File path `{bookingId}/{itemIndex}/{uuid}.ext` | Task 4 |
| Upload after items insert, before declaration | Task 4 |
| Patch `photo_urls` using inserted item IDs | Task 4 |
| Non-blocking: photo failure does not abort booking | Task 4 try/catch |

**Type consistency:**
- `ItemForm.photos: File[]` — defined Task 2, read in Task 3 (`item.photos.length`) and Task 4 (`items[i].photos`)
- `photoPreviews: Record<string, string[]>` — defined Task 2, read in Task 3 (`photoPreviews[item._key]`)
- `addItemPhoto(key: string, files: FileList | null)` — defined Task 2, called in Task 3 with `(item._key, e.target.files)`
- `removeItemPhoto(key: string, index: number)` — defined Task 2, called in Task 3 with `(item._key, photoIdx)`
- `insertedItems: { id: string }[]` — returned in Task 4 Step 4.1, indexed in Task 4 Step 4.2
- `errors[\`photo_size_${key}\`]` — set in `addItemPhoto` (Task 2), cleared in `removeItemPhoto` (Task 2), displayed in Task 3

All consistent. No mismatched names.
