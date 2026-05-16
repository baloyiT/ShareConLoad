# Spec: Operator Waitlist Page

**Date:** 2026-05-16
**Status:** Approved

---

## Goal

Build a public pre-launch waitlist page that collects interest from operators, consignors, and others before ShareConLoad goes live. Entries are stored in Supabase and viewable by admins inside the app.

---

## Approach

Faithful port of the existing HTML mockup (`MyAsset/shareconload-waitlist.html`) into a Next.js page using a CSS module. No design changes — Barlow Condensed fonts, dark navy + orange color system, animations, and layout are preserved exactly.

---

## Files

| File | Purpose |
|---|---|
| `supabase/migrations/20260516_36_waitlist_entries.sql` | Table schema + RLS |
| `app/waitlist/page.tsx` | Public waitlist landing page |
| `app/waitlist/waitlist.module.css` | Scoped CSS ported from the mockup |
| `app/admin/waitlist/page.tsx` | Admin view: table + role filter tabs |
| `app/admin/page.tsx` | Add waitlist card link (existing file, minor edit) |

---

## Database

### Table: `waitlist_entries`

```sql
create table if not exists waitlist_entries (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  first_name    text not null,
  last_name     text not null,
  email         text not null unique,
  phone         text,
  country       text,
  business_type text,
  role          text not null default 'other'
);
```

### RLS Policies

- **INSERT**: open to all (including unauthenticated) — anyone can join the waitlist
- **SELECT**: admin only — uses existing `is_admin()` SECURITY DEFINER function

---

## Waitlist Page (`/waitlist`)

- Standalone page — uses its own nav and footer from the mockup (no shared app layout)
- Barlow + Barlow Condensed fonts loaded via `next/font/google`
- All CSS ported to `waitlist.module.css` (scoped, no leakage into the rest of the app)
- Role selector: Operator (default) / Consignor / Just Watching
- Form fields: first name, last name, email (required), phone (optional), country, business type
- Submission:
  - Calls `supabase.from('waitlist_entries').insert(...)` via the browser client
  - On success: hides the form, shows the "You're on the list!" success card
  - On duplicate email: shows "Looks like you're already on the list!" (not an error state)
  - On other failure: shows "Something went wrong. Please try again." — re-enables submit button
- No authentication required — fully public route

---

## Admin Waitlist Page (`/admin/waitlist`)

- Protected by existing admin layout (`app/admin/layout.tsx`)
- Fetches all rows from `waitlist_entries` ordered by `created_at desc`
- Role filter tabs at top: All / Operators / Consignors / Other — each with a count badge
- DaisyUI table columns: Name, Email, Role, Country, Business Type, Joined
- Empty state: "No waitlist entries yet."
- Error state: simple message if Supabase fetch fails

---

## Admin Hub (`/admin`)

Add a "Waitlist" card to the existing admin navigation hub (`app/admin/page.tsx`), linking to `/admin/waitlist`.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Duplicate email | "Looks like you're already on the list!" — no hard error |
| Required fields missing | HTML5 native `required` validation |
| Supabase network failure | "Something went wrong. Please try again." — button re-enables |
| Admin: no entries | Empty state message |
| Admin: fetch failure | Error message in place of table |

---

## Out of Scope

- Email notification on signup (can be added later via Edge Function + mail API)
- CSV export of entries
- Unsubscribe / removal flow
- Waitlist-to-account conversion flow
