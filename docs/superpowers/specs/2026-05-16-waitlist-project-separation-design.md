# Spec: Waitlist Project Separation

**Date:** 2026-05-16
**Status:** Approved

---

## Goal

Extract the waitlist page into a fully independent Next.js project so the main ShareConLoad app can be developed and tested in isolation. Both projects share the same Supabase backend.

---

## New Project: ShareConLoadWaitlist

**Location:** `C:\Users\lab\Documents\Development\ShareConLoad\website\ShareConLoadWaitlist\`

**Scaffold:** `create-next-app` with TypeScript. No Tailwind required — all styling is handled by the CSS module.

**Extra dependency:** `@supabase/ssr` (same version as main project)

### File Structure

```
ShareConLoadWaitlist/
├── app/
│   ├── layout.tsx            minimal — <html><body>{children}</body></html>
│   ├── page.tsx              waitlist page (from main project's app/waitlist/page.tsx)
│   └── waitlist.module.css   CSS module (from main project's app/waitlist/waitlist.module.css)
├── services/
│   └── supabaseClient.ts     identical copy from main project
├── .env.local                same NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
├── package.json
├── tsconfig.json
└── next.config.ts
```

### File Adaptations

| File | Change from original |
|---|---|
| `app/page.tsx` | CSS import updated: `'./waitlist.module.css'` (was `'./waitlist.module.css'` at different relative depth) |
| `app/waitlist.module.css` | No changes — identical copy |
| `services/supabaseClient.ts` | No changes — identical copy |
| `app/layout.tsx` | New minimal file — no shared fonts, no DaisyUI, no global styles beyond Next.js defaults |

### Environment

`.env.local` contains the same two variables as the main project:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The waitlist project reads from and writes to the **same** `waitlist_entries` table in the shared Supabase project.

---

## Main App Cleanup (ShareConLoad)

### Files to delete

| Path | Reason |
|---|---|
| `app/waitlist/page.tsx` | Moved to new project |
| `app/waitlist/waitlist.module.css` | Moved to new project |
| `app/admin/waitlist/page.tsx` | Waitlist admin view no longer lives in main app |

### Files to edit

| Path | Change |
|---|---|
| `app/admin/page.tsx` | Remove the `{ href: '/admin/waitlist', label: 'Waitlist', ... }` entry from the operations array |

### Files that stay

| Path | Reason |
|---|---|
| `supabase/migrations/20260516_36_waitlist_entries.sql` | DB migration history — not app code |

---

## Data Flow

```
ShareConLoadWaitlist (new project)
  └── public form → supabase.from('waitlist_entries').insert()
                        └── shared Supabase project (waitlist_entries table)

ShareConLoad (main project)
  └── admin can query waitlist_entries directly via Supabase Studio
```

---

## Out of Scope

- Deploying the new project to Vercel (done separately by the user)
- Setting up a custom domain for the waitlist
- Adding any new features to the waitlist page
- CSV export or email notification from the waitlist
