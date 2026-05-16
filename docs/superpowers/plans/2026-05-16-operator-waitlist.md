# Operator Waitlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public pre-launch waitlist page that collects operator/consignor signups into Supabase, with an admin view to list and filter entries.

**Architecture:** Faithful port of the approved HTML mockup (`MyAsset/shareconload-waitlist.html`) into a Next.js page using a CSS module to scope all custom styles. Supabase browser client handles form submission directly. Admin view follows existing admin page patterns.

**Tech Stack:** Next.js App Router, TypeScript, CSS Modules, `next/font/google` (Barlow + Barlow Condensed), Supabase browser client (`@supabase/ssr`), DaisyUI (admin page only).

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `supabase/migrations/20260516_36_waitlist_entries.sql` | Table schema + RLS policies |
| Create | `app/waitlist/waitlist.module.css` | All scoped CSS ported from the mockup |
| Create | `app/waitlist/page.tsx` | Public waitlist landing page |
| Create | `app/admin/waitlist/page.tsx` | Admin table with role filter tabs |
| Modify | `app/admin/page.tsx` | Add waitlist card to operations grid |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260516_36_waitlist_entries.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260516_36_waitlist_entries.sql

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

alter table waitlist_entries enable row level security;

drop policy if exists "waitlist_public_insert" on waitlist_entries;
create policy "waitlist_public_insert"
  on waitlist_entries for insert
  to anon, authenticated
  with check (true);

drop policy if exists "waitlist_admin_select" on waitlist_entries;
create policy "waitlist_admin_select"
  on waitlist_entries for select
  to authenticated
  using (is_admin());
```

- [ ] **Step 2: Apply the migration in Supabase Studio**

Open your Supabase project → SQL Editor → paste the migration SQL → Run.

Verify: Go to Table Editor — you should see `waitlist_entries` with 9 columns. Go to Authentication → Policies — you should see two policies on `waitlist_entries`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260516_36_waitlist_entries.sql
git commit -m "feat: add waitlist_entries table with RLS"
```

---

## Task 2: CSS Module

**Files:**
- Create: `app/waitlist/waitlist.module.css`

- [ ] **Step 1: Create the CSS module**

Create `app/waitlist/waitlist.module.css` with the following content — this is a complete port of the mockup's CSS with class names converted to camelCase:

```css
/* ── CSS variables scoped to this page ───────────────────────────── */
.page {
  --navy: #0d1f3c;
  --orange: #f26522;
  --white: #ffffff;
  --muted: rgba(255,255,255,0.55);
  --border: rgba(255,255,255,0.09);
  --card: rgba(255,255,255,0.04);
  position: relative;
  background: var(--navy);
  color: var(--white);
  font-family: var(--font-barlow), sans-serif;
  overflow-x: hidden;
  min-height: 100vh;
}

/* ── Background decorations ──────────────────────────────────────── */
.bgLayer {
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background:
    radial-gradient(ellipse 90% 60% at 75% -5%, rgba(242,101,34,0.13) 0%, transparent 55%),
    radial-gradient(ellipse 50% 40% at -5% 90%, rgba(242,101,34,0.08) 0%, transparent 50%);
}

.bgGrid {
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px);
  background-size: 56px 56px;
}

.wrap { position: relative; z-index: 1; }

/* ── Nav ─────────────────────────────────────────────────────────── */
.nav {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 6%;
  border-bottom: 1px solid var(--border);
  position: sticky; top: 0;
  background: rgba(13,31,60,0.9);
  backdrop-filter: blur(14px);
  z-index: 100;
}

.navBadge {
  font-family: var(--font-barlow-condensed), sans-serif;
  font-size: 11px; font-weight: 700; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--orange);
  border: 1.5px solid var(--orange);
  padding: 5px 12px; border-radius: 2px;
}

/* ── Hero ────────────────────────────────────────────────────────── */
.hero {
  min-height: 92vh;
  display: flex; flex-direction: column;
  justify-content: center; align-items: center;
  text-align: center;
  padding: 80px 6% 60px;
}

.heroEyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 11px; font-weight: 600; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--orange);
  margin-bottom: 28px;
  opacity: 0; animation: fadeUp 0.7s 0.1s forwards;
}
.heroEyebrow::before, .heroEyebrow::after {
  content: ''; display: block; width: 28px; height: 1.5px;
  background: var(--orange); opacity: 0.6;
}

.heroHeadline {
  font-family: var(--font-barlow-condensed), sans-serif;
  font-weight: 900; line-height: 0.95;
  font-size: clamp(58px, 10vw, 110px);
  text-transform: uppercase;
  margin-bottom: 24px;
  opacity: 0; animation: fadeUp 0.7s 0.25s forwards;
}

.heroSub {
  font-size: clamp(15px, 2vw, 18px); font-weight: 400;
  color: var(--muted); max-width: 560px; line-height: 1.65;
  margin-bottom: 52px;
  opacity: 0; animation: fadeUp 0.7s 0.4s forwards;
}

/* ── Form card ───────────────────────────────────────────────────── */
.formCard {
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 36px 40px;
  width: 100%; max-width: 520px;
  backdrop-filter: blur(8px);
  opacity: 0; animation: fadeUp 0.7s 0.55s forwards;
}

.formTitle {
  font-family: var(--font-barlow-condensed), sans-serif;
  font-size: 20px; font-weight: 700; letter-spacing: 0.04em;
  text-transform: uppercase; margin-bottom: 6px;
}

.formSubtitle {
  font-size: 13px; color: var(--muted); margin-bottom: 24px; line-height: 1.5;
}

.roleRow {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  gap: 8px; margin-bottom: 16px;
}

.roleBtn {
  background: transparent; border: 1.5px solid var(--border);
  color: var(--muted); font-family: var(--font-barlow), sans-serif;
  font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; padding: 12px 6px;
  border-radius: 6px; cursor: pointer;
  transition: all 0.2s; display: flex; flex-direction: column;
  align-items: center; gap: 5px;
}
.roleBtnIcon { font-size: 18px; }
.roleBtn:hover { border-color: var(--orange); color: var(--white); }
.roleBtnActive {
  border-color: var(--orange) !important;
  background: rgba(242,101,34,0.1) !important;
  color: var(--white) !important;
}

.fieldRow { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
.fieldRowSingle { grid-template-columns: 1fr; }

.formInput,
.formSelect {
  width: 100%; background: rgba(255,255,255,0.06);
  border: 1.5px solid var(--border); color: var(--white);
  font-family: var(--font-barlow), sans-serif; font-size: 14px;
  padding: 13px 15px; border-radius: 6px;
  outline: none; transition: border-color 0.2s;
  -webkit-appearance: none; appearance: none;
}
.formInput::placeholder { color: rgba(255,255,255,0.35); }
.formInput:focus, .formSelect:focus { border-color: var(--orange); }
.formSelect option { background: #0f2345; color: var(--white); }

.submitBtn {
  width: 100%; margin-top: 14px;
  background: var(--orange); color: var(--white);
  border: none; font-family: var(--font-barlow-condensed), sans-serif;
  font-size: 16px; font-weight: 700; letter-spacing: 0.12em;
  text-transform: uppercase; padding: 16px;
  border-radius: 6px; cursor: pointer;
  transition: background 0.2s, transform 0.15s;
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.submitBtn:hover:not(:disabled) { background: #ff7a35; transform: translateY(-1px); }
.submitBtn:disabled { opacity: 0.5; cursor: not-allowed; }

.privacyNote {
  font-size: 11.5px; color: var(--muted); text-align: center;
  margin-top: 12px; line-height: 1.5;
  display: flex; align-items: center; justify-content: center; gap: 5px;
}

.errorNote {
  font-size: 13px; color: #fca5a5; text-align: center;
  margin-top: 10px; line-height: 1.5;
}

.successMsg { text-align: center; padding: 16px 0; }
.successCheck { font-size: 44px; margin-bottom: 14px; }
.successMsg h3 {
  font-family: var(--font-barlow-condensed), sans-serif;
  font-size: 24px; font-weight: 800; text-transform: uppercase; margin-bottom: 10px;
}
.successMsg p { color: var(--muted); font-size: 14px; line-height: 1.65; }

/* ── Stats strip ─────────────────────────────────────────────────── */
.statsStrip {
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  padding: 40px 6%;
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 20px; text-align: center;
}
.statNum {
  font-family: var(--font-barlow-condensed), sans-serif;
  font-size: clamp(36px, 5vw, 52px); font-weight: 900;
  color: var(--orange); line-height: 1; margin-bottom: 6px;
}
.statLabel {
  font-size: 10px; font-weight: 600; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--muted);
}

/* ── Audience section ────────────────────────────────────────────── */
.audienceSection { padding: 80px 6%; }

.sectionEyebrow {
  font-size: 11px; font-weight: 600; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--orange);
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 20px;
}
.sectionEyebrow::after { content: ''; width: 32px; height: 1.5px; background: var(--orange); opacity: 0.5; }

.sectionHeadline {
  font-family: var(--font-barlow-condensed), sans-serif;
  font-size: clamp(36px, 5vw, 56px); font-weight: 900;
  text-transform: uppercase; line-height: 1; margin-bottom: 48px;
}

.audienceGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

.audienceCard {
  background: var(--card); border: 1px solid var(--border);
  border-radius: 10px; padding: 28px 28px 32px;
  transition: border-color 0.2s, transform 0.2s;
}
.audienceCard:hover { border-color: rgba(242,101,34,0.4); transform: translateY(-2px); }
.cardIcon { font-size: 30px; margin-bottom: 14px; }
.audienceCard h3 {
  font-family: var(--font-barlow-condensed), sans-serif;
  font-size: 20px; font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.04em; margin-bottom: 10px;
}
.audienceCard p { font-size: 13.5px; color: var(--muted); line-height: 1.65; }
.audienceCard ul { list-style: none; margin-top: 14px; }
.audienceCard ul li {
  font-size: 13px; color: var(--muted); padding: 4px 0;
  display: flex; align-items: center; gap: 8px;
}
.audienceCard ul li::before {
  content: ''; width: 5px; height: 5px; border-radius: 50%;
  background: var(--orange); flex-shrink: 0;
}

/* ── How it works ────────────────────────────────────────────────── */
.howSection { padding: 80px 6%; border-top: 1px solid var(--border); }
.steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.step {
  background: var(--card); border: 1px solid var(--border);
  border-radius: 10px; padding: 28px; position: relative; overflow: hidden;
}
.step::before {
  content: attr(data-n);
  position: absolute; right: 16px; top: 12px;
  font-family: var(--font-barlow-condensed), sans-serif;
  font-size: 72px; font-weight: 900; color: rgba(242,101,34,0.08);
  line-height: 1;
}
.stepIcon { font-size: 28px; margin-bottom: 14px; }
.step h4 {
  font-family: var(--font-barlow-condensed), sans-serif;
  font-size: 18px; font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.04em; margin-bottom: 8px;
}
.step p { font-size: 13.5px; color: var(--muted); line-height: 1.6; }

/* ── Corridors ───────────────────────────────────────────────────── */
.corridorsSection { padding: 80px 6%; border-top: 1px solid var(--border); }
.corridorTags { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 32px; }
.corridorTag {
  background: var(--card); border: 1px solid var(--border);
  border-radius: 4px; padding: 9px 16px;
  font-size: 13px; font-weight: 500; color: var(--muted);
  display: flex; align-items: center; gap: 7px;
  transition: border-color 0.2s, color 0.2s;
}
.corridorTag:hover { border-color: var(--orange); color: var(--white); }
.corridorDot { width: 6px; height: 6px; border-radius: 50%; background: var(--orange); flex-shrink: 0; }

/* ── Final CTA ───────────────────────────────────────────────────── */
.ctaSection {
  padding: 90px 6%; border-top: 1px solid var(--border);
  text-align: center;
  background: linear-gradient(180deg, transparent 0%, rgba(242,101,34,0.05) 100%);
}
.ctaSection h2 {
  font-family: var(--font-barlow-condensed), sans-serif;
  font-size: clamp(40px, 6vw, 72px); font-weight: 900;
  text-transform: uppercase; line-height: 1; margin-bottom: 16px;
}
.ctaSection p { color: var(--muted); font-size: 15px; max-width: 480px; margin: 0 auto 32px; line-height: 1.6; }
.ctaBtn {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--orange); color: var(--white);
  font-family: var(--font-barlow-condensed), sans-serif;
  font-size: 16px; font-weight: 700; letter-spacing: 0.1em;
  text-transform: uppercase; padding: 16px 36px;
  border-radius: 6px; text-decoration: none;
  transition: background 0.2s, transform 0.15s;
}
.ctaBtn:hover { background: #ff7a35; transform: translateY(-2px); }

/* ── Footer ──────────────────────────────────────────────────────── */
.footer {
  padding: 28px 6%; border-top: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 12px;
}
.footer p { font-size: 12px; color: var(--muted); }

/* ── Orange text utility ─────────────────────────────────────────── */
.orange { color: var(--orange); }

/* ── Animations ──────────────────────────────────────────────────── */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(22px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Responsive ──────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .statsStrip { grid-template-columns: repeat(2, 1fr); }
  .audienceGrid { grid-template-columns: 1fr; }
  .steps { grid-template-columns: 1fr; }
  .formCard { padding: 28px 20px; }
  .fieldRow { grid-template-columns: 1fr; }
  .footer { flex-direction: column; text-align: center; }
}

@media (max-width: 480px) {
  .nav { padding: 14px 5%; }
  .hero { padding: 60px 5% 40px; }
  .audienceSection, .howSection, .corridorsSection, .ctaSection { padding: 56px 5%; }
  .statsStrip { padding: 30px 5%; }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/waitlist/waitlist.module.css
git commit -m "feat: add waitlist CSS module"
```

---

## Task 3: Waitlist Page

**Files:**
- Create: `app/waitlist/page.tsx`

- [ ] **Step 1: Create the page component**

Create `app/waitlist/page.tsx` with this complete content:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import { supabase } from '@/services/supabaseClient';
import styles from './waitlist.module.css';

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-barlow',
  display: 'swap',
});

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-barlow-condensed',
  display: 'swap',
});

type Role = 'operator' | 'consignor' | 'other';

const ROLES: { role: Role; icon: string; label: string }[] = [
  { role: 'operator',  icon: '🚢', label: "I'm an Operator" },
  { role: 'consignor', icon: '📦', label: "I'm a Consignor" },
  { role: 'other',     icon: '👀', label: 'Just Watching'   },
];

const COUNTRIES = [
  'South Africa','Zimbabwe','Zambia','Nigeria','Ghana','DRC','Kenya',
  'Tanzania','Ethiopia','Uganda','Mozambique','Namibia','Botswana',
  'China','United Kingdom','United States','Other',
];

const BIZ_TYPES = [
  'Container Operator','Freight Forwarder','Trucking Company','Shipping Agent',
  'Importer','Exporter','SME / Trader','Manufacturer','Individual','Other',
];

const STATS = [
  { num: '2',  label: 'Sides of the Market'   },
  { num: '0%', label: 'Empty Miles Tolerated'  },
  { num: '1',  label: 'Platform. Pan-African.' },
  { num: '∞',  label: 'Connections Possible'   },
];

const CORRIDORS = [
  'South Africa ↔ Zimbabwe',
  'South Africa ↔ Zambia',
  'South Africa ↔ DRC',
  'Ghana ↔ South Africa',
  'Ghana ↔ China Import Trade',
  'Nigeria ↔ South Africa',
  'East African Corridors',
  'Major African Port Cities',
  'Global Expansion →',
];

export default function WaitlistPage() {
  const [selectedRole, setSelectedRole] = useState<Role>('operator');
  const [submitting,   setSubmitting]   = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [submitError,  setSubmitError]  = useState<'duplicate' | 'generic' | null>(null);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.1 }
    );

    const els = document.querySelectorAll<HTMLElement>('[data-fade]');
    els.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = `opacity 0.5s ${i * 0.06}s ease, transform 0.5s ${i * 0.06}s ease`;
      io.observe(el);
    });

    return () => io.disconnect();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const form = e.currentTarget;
    const get = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement).value.trim();

    const { error } = await supabase.from('waitlist_entries').insert({
      first_name:    get('fname'),
      last_name:     get('lname'),
      email:         get('email'),
      phone:         get('phone') || null,
      country:       get('country') || null,
      business_type: get('biz_type') || null,
      role:          selectedRole,
    });

    if (error) {
      console.error('Waitlist insert error:', error);
      setSubmitError(error.code === '23505' ? 'duplicate' : 'generic');
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  return (
    <div className={`${barlow.variable} ${barlowCondensed.variable} ${styles.page}`}>
      <div className={styles.bgLayer} />
      <div className={styles.bgGrid} />

      <div className={styles.wrap}>

        {/* ── Nav ── */}
        <nav className={styles.nav}>
          <svg height="36" viewBox="0 0 280 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="1" width="17" height="17" rx="3" fill="#f26522"/>
            <rect x="0" y="26" width="17" height="17" rx="3" fill="#f2a07a"/>
            <rect x="21" y="14" width="17" height="17" rx="3" fill="#132d5e"/>
            <line x1="40" y1="22" x2="50" y2="22" stroke="#2a4a7f" strokeWidth="2.2" strokeLinecap="round"/>
            <polyline points="46,18 50,22 46,26" fill="none" stroke="#2a4a7f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <text x="56" y="34" fontFamily="'Barlow Condensed',sans-serif" fontWeight="800" fontSize="28" fill="white">
              Share<tspan fill="#f26522">Con</tspan>Load
            </text>
          </svg>
          <span className={styles.navBadge}>Coming Soon</span>
        </nav>

        {/* ── Hero ── */}
        <section className={styles.hero} id="form-wrap">
          <div className={styles.heroEyebrow}>Africa&apos;s Logistics Revolution</div>
          <h1 className={styles.heroHeadline}>
            Share the <span className={styles.orange}>Load.</span><br />
            Connect the <span className={styles.orange}>World.</span>
          </h1>
          <p className={styles.heroSub}>
            The global digital freight marketplace connecting container operators and carriers
            with businesses that need to move goods — smarter, cheaper, and faster across
            Africa and beyond.
          </p>

          {/* ── Form card ── */}
          <div className={styles.formCard}>
            {submitted ? (
              <div className={styles.successMsg}>
                <div className={styles.successCheck}>✅</div>
                <h3>You&apos;re on the list!</h3>
                <p>
                  We&apos;ll notify you the moment ShareConLoad goes live.<br />
                  Your information is safe — no spam, no data selling, ever.
                </p>
              </div>
            ) : (
              <>
                <div className={styles.formTitle}>Get Early Access</div>
                <div className={styles.formSubtitle}>
                  Join the waitlist. Be first when we go live. Your data is private and will never be sold or shared.
                </div>

                <div className={styles.roleRow}>
                  {ROLES.map(({ role, icon, label }) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setSelectedRole(role)}
                      className={`${styles.roleBtn} ${selectedRole === role ? styles.roleBtnActive : ''}`}
                    >
                      <span className={styles.roleBtnIcon}>{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSubmit}>
                  <div className={styles.fieldRow}>
                    <input className={styles.formInput} type="text"  name="fname" placeholder="First name" required autoComplete="given-name"  />
                    <input className={styles.formInput} type="text"  name="lname" placeholder="Last name"  required autoComplete="family-name" />
                  </div>
                  <div className={`${styles.fieldRow} ${styles.fieldRowSingle}`}>
                    <input className={styles.formInput} type="email" name="email" placeholder="Email address" required autoComplete="email" />
                  </div>
                  <div className={`${styles.fieldRow} ${styles.fieldRowSingle}`}>
                    <input className={styles.formInput} type="tel"   name="phone" placeholder="Phone number (optional)" autoComplete="tel" />
                  </div>
                  <div className={styles.fieldRow}>
                    <select className={styles.formSelect} name="country" defaultValue="">
                      <option value="" disabled>Country</option>
                      {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <select className={styles.formSelect} name="biz_type" defaultValue="">
                      <option value="" disabled>Business type</option>
                      {BIZ_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>

                  <button type="submit" className={styles.submitBtn} disabled={submitting}>
                    {submitting ? 'Submitting…' : 'Notify Me at Launch'}
                    {!submitting && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    )}
                  </button>
                </form>

                {submitError === 'duplicate' && (
                  <p className={styles.errorNote}>Looks like you&apos;re already on the list!</p>
                )}
                {submitError === 'generic' && (
                  <p className={styles.errorNote}>Something went wrong. Please try again.</p>
                )}

                <p className={styles.privacyNote}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  No spam. No selling your data. One email when we launch.
                </p>
              </>
            )}
          </div>
        </section>

        {/* ── Stats strip ── */}
        <div className={styles.statsStrip}>
          {STATS.map(({ num, label }) => (
            <div key={label} data-fade="">
              <div className={styles.statNum}>{num}</div>
              <div className={styles.statLabel}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Who it's for ── */}
        <section className={styles.audienceSection}>
          <div className={styles.sectionEyebrow}>Who This Is For</div>
          <h2 className={styles.sectionHeadline}>
            Built for the people<br />who <span className={styles.orange}>move Africa</span>
          </h2>
          <div className={styles.audienceGrid}>
            <div className={styles.audienceCard} data-fade="">
              <div className={styles.cardIcon}>🚢</div>
              <h3>Freight Capacity Providers</h3>
              <p>You have space. We find you cargo. Stop running half-empty routes and start earning on every kilometre you move.</p>
              <ul>
                <li>Container &amp; shipping operators</li>
                <li>Trucking &amp; transport companies</li>
                <li>Freight forwarders &amp; agents</li>
                <li>Independent logistics operators</li>
              </ul>
            </div>
            <div className={styles.audienceCard} data-fade="">
              <div className={styles.cardIcon}>📦</div>
              <h3>Cargo Owners &amp; Consignors</h3>
              <p>You need to move goods. We connect you to verified operators on your route — faster, transparently, and at better rates.</p>
              <ul>
                <li>Importers &amp; exporters</li>
                <li>SMEs &amp; cross-border traders</li>
                <li>Manufacturers</li>
                <li>Individuals shipping internationally</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className={styles.howSection}>
          <div className={styles.sectionEyebrow}>How It Works</div>
          <h2 className={styles.sectionHeadline} style={{ marginBottom: '36px' }}>
            Simple. <span className={styles.orange}>Powerful.</span> Digital.
          </h2>
          <div className={styles.steps}>
            {[
              { n: '1', icon: '📋', title: 'List or Search',      desc: 'Operators post available container space. Consignors search by route, date, and cargo type — all in real time.' },
              { n: '2', icon: '🤝', title: 'Match & Connect',     desc: 'AI-driven matching connects cargo demand with available capacity. Communicate directly with verified operators.' },
              { n: '3', icon: '🚀', title: 'Move Goods Smarter',  desc: 'Book and coordinate freight movement efficiently — cutting costs and eliminating empty miles across every corridor.' },
            ].map(({ n, icon, title, desc }) => (
              <div key={n} className={styles.step} data-n={n} data-fade="">
                <div className={styles.stepIcon}>{icon}</div>
                <h4>{title}</h4>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Corridors ── */}
        <section className={styles.corridorsSection}>
          <div className={styles.sectionEyebrow}>Trade Corridors</div>
          <h2 className={styles.sectionHeadline}>
            Where we&apos;re <span className={styles.orange}>launching first</span>
          </h2>
          <div className={styles.corridorTags}>
            {CORRIDORS.map((corridor) => (
              <div key={corridor} className={styles.corridorTag} data-fade="">
                <span className={styles.corridorDot} />
                {corridor}
              </div>
            ))}
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className={styles.ctaSection}>
          <h2>
            Don&apos;t get left<br /><span className={styles.orange}>on the dock.</span>
          </h2>
          <p>ShareConLoad is coming. Be among the first operators and consignors on the platform when we go live.</p>
          <a href="#form-wrap" className={styles.ctaBtn}>
            Join the Waitlist
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </a>
        </section>

        {/* ── Footer ── */}
        <footer className={styles.footer}>
          <svg height="26" viewBox="0 0 280 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="1" width="17" height="17" rx="3" fill="#f26522" opacity="0.6"/>
            <rect x="0" y="26" width="17" height="17" rx="3" fill="#f2a07a" opacity="0.6"/>
            <rect x="21" y="14" width="17" height="17" rx="3" fill="#132d5e" opacity="0.6"/>
            <text x="56" y="34" fontFamily="'Barlow Condensed',sans-serif" fontWeight="800" fontSize="28" fill="rgba(255,255,255,0.45)">
              Share<tspan fill="rgba(242,101,34,0.55)">Con</tspan>Load
            </text>
          </svg>
          <p>© 2025 ShareConLoad — Under Veyqon Group. All rights reserved.</p>
          <p style={{ fontSize: '11px', opacity: 0.4 }}>shareconload.com</p>
        </footer>

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. If you see a font import error, verify the font names: `Barlow` and `Barlow_Condensed` (underscore, not space) are the exact identifiers Next.js uses for Google Fonts.

- [ ] **Step 3: Verify in browser**

```bash
npm run dev
```

Open `http://localhost:3000/waitlist`. Check:
- Dark navy background loads
- Hero headline displays in Barlow Condensed
- Role selector buttons highlight on click (orange border)
- Form submits — check Supabase Studio → Table Editor → `waitlist_entries` for the new row
- Submit the same email again — verify "Looks like you're already on the list!" appears
- Scroll down — stats, audience cards, steps, corridors should fade in
- Resize to mobile — form fields stack, stats go 2-column

- [ ] **Step 4: Commit**

```bash
git add app/waitlist/page.tsx
git commit -m "feat: add public waitlist page"
```

---

## Task 4: Admin Waitlist Page

**Files:**
- Create: `app/admin/waitlist/page.tsx`

- [ ] **Step 1: Create the admin page**

Create `app/admin/waitlist/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

type WaitlistEntry = {
  id: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  country: string | null;
  business_type: string | null;
  role: string;
};

type RoleFilter = 'all' | 'operator' | 'consignor' | 'other';

const TABS: { key: RoleFilter; label: string }[] = [
  { key: 'all',       label: 'All'        },
  { key: 'operator',  label: 'Operators'  },
  { key: 'consignor', label: 'Consignors' },
  { key: 'other',     label: 'Other'      },
];

const ROLE_COLOURS: Record<string, string> = {
  operator:  '#f97316',
  consignor: '#0f2044',
  other:     '#6b7280',
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminWaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [filter,  setFilter]  = useState<RoleFilter>('all');

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('waitlist_entries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Waitlist fetch error:', error);
        setError('Failed to load waitlist entries.');
      } else {
        setEntries(data as WaitlistEntry[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.role === filter);

  const counts: Record<RoleFilter, number> = {
    all:       entries.length,
    operator:  entries.filter((e) => e.role === 'operator').length,
    consignor: entries.filter((e) => e.role === 'consignor').length,
    other:     entries.filter((e) => e.role === 'other').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 sm:px-10 flex items-center justify-between h-16">
          <Link
            href="/admin"
            className="text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors"
          >
            ← Admin
          </Link>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Waitlist</span>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Waitlist</h1>
          <p className="text-sm text-gray-400 mt-1">Signups collected before launch.</p>
        </div>

        {error && (
          <div className="alert alert-error text-sm">{error}</div>
        )}

        {loading && (
          <div className="flex justify-center py-24">
            <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Role filter tabs */}
            <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 shadow-sm w-fit flex-wrap">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                    filter === tab.key ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  style={filter === tab.key ? { backgroundColor: '#0f2044' } : {}}
                >
                  {tab.label}
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      filter === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {counts[tab.key]}
                  </span>
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-800">
                  {filter === 'all'
                    ? `All Signups (${entries.length})`
                    : `${TABS.find((t) => t.key === filter)?.label} (${filtered.length})`}
                </h2>
              </div>

              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <p className="text-gray-400 text-sm">No waitlist entries yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {['Name', 'Email', 'Role', 'Country', 'Business Type', 'Joined'].map((col) => (
                          <th
                            key={col}
                            className="py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-left"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((entry) => (
                        <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="font-medium text-gray-800 text-sm">
                              {entry.first_name} {entry.last_name}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-sm text-gray-600">{entry.email}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className="badge badge-sm text-white font-semibold capitalize"
                              style={{ backgroundColor: ROLE_COLOURS[entry.role] ?? '#6b7280' }}
                            >
                              {entry.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-sm text-gray-600">{entry.country ?? '—'}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-sm text-gray-600">{entry.business_type ?? '—'}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-sm text-gray-500">{fmt(entry.created_at)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify in browser**

Navigate to `http://localhost:3000/admin/waitlist` (while logged in as admin).

Check:
- Entries from Task 3 testing appear in the table
- Role filter tabs show correct counts
- Switching tabs filters the rows correctly
- "← Admin" link goes back to `/admin`
- Columns display correctly: name, email, role badge (orange for operator, navy for consignor), country, biz type, date

- [ ] **Step 4: Commit**

```bash
git add app/admin/waitlist/page.tsx
git commit -m "feat: add admin waitlist page with role filter"
```

---

## Task 5: Admin Hub Link

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Add the waitlist card**

In `app/admin/page.tsx`, find the operations array (the array passed to `.map(({ href, label, icon, desc })`) and add one entry:

Find this line in the array:
```tsx
{ href: '/admin/release',    label: 'Release',     icon: '🔓', desc: 'Cargo release auth'          },
```

Add directly after it:
```tsx
{ href: '/admin/waitlist',   label: 'Waitlist',    icon: '✉️', desc: 'Pre-launch signups'          },
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify in browser**

Navigate to `http://localhost:3000/admin`. Confirm:
- A "Waitlist" card appears in the Operations grid
- Clicking it navigates to `/admin/waitlist`

- [ ] **Step 4: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat: add waitlist link to admin hub"
```
