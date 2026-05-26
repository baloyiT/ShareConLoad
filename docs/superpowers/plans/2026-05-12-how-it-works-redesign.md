# How It Works Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `app/how-it-works/page.tsx` into an 8-section marketing page with a concept explainer, alternating-row step journeys, a payment stage section, and an updated footer — no new routes, no DB changes, single file only.

**Architecture:** Static server component (no `'use client'`). All content lives as typed data constants at the top of the file. Sub-components (`StepContent`, `StepRow`, `BenefitItem`) are defined inline in the same file. Desktop layout uses a 3-column grid with a center vertical spine; mobile collapses to a left-spine single-column list.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS — no new dependencies.

---

### Task 1: Rewrite `app/how-it-works/page.tsx`

**Files:**
- Modify: `app/how-it-works/page.tsx`

- [ ] **Step 1: Verify TypeScript is clean before touching anything**

```bash
npx tsc --noEmit
```

Expected: zero errors (or only pre-existing errors unrelated to this file).

- [ ] **Step 2: Replace the file with the new implementation**

Replace the entire contents of `app/how-it-works/page.tsx` with:

```tsx
import Image from 'next/image';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = {
  num: number;
  title: string;
  desc: string;
  badge?: string;
  numColor: string;
};

type PaymentStage = {
  pct: number;
  label: string;
  trigger: string;
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const SHIPPER_STEPS: Step[] = [
  {
    num: 1,
    title: 'Find a Container',
    desc: 'Browse verified operators with open routes. Filter by origin city, destination, departure date, and price per CBM. Every listing shows available space and operator compliance status.',
    numColor: '#f97316',
  },
  {
    num: 2,
    title: 'Book Your Space',
    desc: 'Enter the CBM you need — no whole-container commitment. Add shipment details and reserve your slot. Space is held once the deposit is paid.',
    badge: 'Takes under 5 minutes',
    numColor: '#f97316',
  },
  {
    num: 3,
    title: 'Declare & Pay Deposit',
    desc: 'Provide item descriptions and declared values for customs. Pay the 20% deposit to confirm the booking. The remaining balance is split into two further stages as the shipment progresses.',
    badge: '20% deposit secures your space',
    numColor: '#f97316',
  },
  {
    num: 4,
    title: 'Drop Off Your Goods',
    desc: "Deliver goods to the operator's warehouse or collection point before the loading deadline. The operator handles packing, loading, and customs coordination.",
    numColor: '#f97316',
  },
  {
    num: 5,
    title: 'Track & Receive',
    desc: 'Follow the shipment through every milestone — loading, departure, transit, arrival, customs clearance, delivery. Pay the remaining 30% before cargo is released at the destination.',
    badge: 'Cargo released once final payment clears',
    numColor: '#0f2044',
  },
];

const OPERATOR_STEPS: Step[] = [
  {
    num: 1,
    title: 'Create a Listing',
    desc: 'Define route, departure date, total capacity, and price per CBM. The container goes live on the marketplace immediately, visible to shippers searching that route.',
    numColor: '#0f2044',
  },
  {
    num: 2,
    title: 'Complete Verification',
    desc: 'Submit KYC documents — identity, business registration, banking, insurance, and warehouse address. Done once. Verified operators display a trust badge on all listings.',
    badge: 'One-time compliance check',
    numColor: '#0f2044',
  },
  {
    num: 3,
    title: 'Accept Bookings',
    desc: 'Shippers find the listing and book space. Review declarations, manage the manifest, and coordinate collection — all from the operator portal.',
    numColor: '#0f2044',
  },
  {
    num: 4,
    title: 'Ship & Update Milestones',
    desc: 'Execute the shipment as planned. Post milestones at each stage so shippers stay informed automatically.',
    numColor: '#0f2044',
  },
  {
    num: 5,
    title: 'Get Paid',
    desc: 'Payouts are released as each payment stage clears — after booking confirmation, pre-departure, and final cargo release. Minus the 5% platform commission.',
    badge: 'Staged payouts — predictable cash flow',
    numColor: '#f97316',
  },
];

const PAYMENT_STAGES: PaymentStage[] = [
  { pct: 20, label: 'Deposit',       trigger: 'Paid at booking to secure space' },
  { pct: 50, label: 'Pre-Departure', trigger: 'Due 7 days before the container departs' },
  { pct: 30, label: 'On Release',    trigger: 'Final payment before cargo is released at destination' },
];

const SHIPPER_BENEFITS = [
  'Pay only for space you use',
  'No waiting for full container loads',
  'Transparent staged payments',
  'Real-time shipment tracking',
  'Verified, compliant operators',
];

const OPERATOR_BENEFITS = [
  'Fill unused container capacity',
  'Reach verified shippers globally',
  'Payments guaranteed per stage',
  'Digital booking management',
  'Dispute protection built in',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepContent({
  step,
  align,
  accentColor,
  badgeVariant,
}: {
  step: Step;
  align: 'left' | 'right';
  accentColor: string;
  badgeVariant: 'orange' | 'navy';
}) {
  const textAlign = align === 'left' ? 'lg:text-right' : 'lg:text-left';
  const badgeClass =
    badgeVariant === 'orange'
      ? 'bg-[#fff7ed] text-[#f97316]'
      : 'bg-[#eef2ff] text-[#0f2044]';

  return (
    <div className={`text-left ${textAlign}`}>
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest mb-1"
        style={{ color: accentColor }}
      >
        Step {step.num}
      </p>
      <h3 className="text-base font-extrabold text-gray-900 leading-snug mb-2">
        {step.title}
      </h3>
      <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
      {step.badge && (
        <span
          className={`inline-block mt-2 text-[10px] font-bold px-3 py-1 rounded-full ${badgeClass}`}
        >
          {step.badge}
        </span>
      )}
    </div>
  );
}

function StepRow({
  step,
  side,
  spineColor,
  accentColor,
  badgeVariant,
  isFirst,
  isLast,
}: {
  step: Step;
  side: 'left' | 'right';
  spineColor: string;
  accentColor: string;
  badgeVariant: 'orange' | 'navy';
  isFirst: boolean;
  isLast: boolean;
}) {
  const lineStyle = { backgroundColor: spineColor };

  const centerCol = (
    <div className="flex flex-col items-center h-full">
      <div
        className={`w-0.5 flex-1 min-h-[20px]${isFirst ? ' invisible' : ''}`}
        style={lineStyle}
      />
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center text-white font-extrabold text-sm shadow-md shrink-0 z-10 ring-4 ring-[#f8fafc]"
        style={{ backgroundColor: step.numColor }}
      >
        {step.num}
      </div>
      <div
        className={`w-0.5 flex-1 min-h-[20px]${isLast ? ' invisible' : ''}`}
        style={lineStyle}
      />
    </div>
  );

  return (
    <>
      {/* ── Desktop: alternating 3-column grid ── */}
      <div className="hidden lg:grid grid-cols-[1fr_56px_1fr] items-stretch min-h-[110px]">
        {side === 'left' ? (
          <>
            <div className="pr-8 py-6 flex items-center justify-end">
              <StepContent
                step={step}
                align="left"
                accentColor={accentColor}
                badgeVariant={badgeVariant}
              />
            </div>
            <div className="py-1">{centerCol}</div>
            <div />
          </>
        ) : (
          <>
            <div />
            <div className="py-1">{centerCol}</div>
            <div className="pl-8 py-6 flex items-center">
              <StepContent
                step={step}
                align="right"
                accentColor={accentColor}
                badgeVariant={badgeVariant}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Mobile: left-spine single column ── */}
      <div className="flex lg:hidden items-stretch">
        <div className="flex flex-col items-center shrink-0 w-11">
          <div
            className={`w-0.5 flex-1 min-h-[16px]${isFirst ? ' invisible' : ''}`}
            style={lineStyle}
          />
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-white font-extrabold text-sm shadow-md shrink-0 ring-4 ring-[#f8fafc]"
            style={{ backgroundColor: step.numColor }}
          >
            {step.num}
          </div>
          <div
            className={`w-0.5 flex-1 min-h-[24px]${isLast ? ' invisible' : ''}`}
            style={lineStyle}
          />
        </div>
        <div className="flex-1 pl-4 py-4">
          <StepContent
            step={step}
            align="right"
            accentColor={accentColor}
            badgeVariant={badgeVariant}
          />
        </div>
      </div>
    </>
  );
}

function BenefitItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-gray-700">
      <svg
        className="w-4 h-4 mt-0.5 shrink-0 text-green-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M5 13l4 4L19 7"
        />
      </svg>
      {text}
    </li>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 sm:px-10 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo1.png" alt="" width={40} height={40} className="h-9 w-auto" />
            <span className="text-xl font-extrabold tracking-tight">
              <span style={{ color: '#0f2044' }}>Share</span>
              <span style={{ color: '#f97316' }}>Con</span>
              <span style={{ color: '#0f2044' }}>Load</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-5 text-sm font-medium text-gray-600">
            <Link
              href="/how-it-works"
              className="font-semibold"
              style={{ color: '#0f2044' }}
            >
              How It Works
            </Link>
            <Link href="/#listings" className="hover:text-gray-900 transition-colors">
              Browse Containers
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-gray-700 hover:text-gray-900 px-4 py-1.5 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/auth/register"
              className="text-sm font-semibold text-white px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#f97316' }}
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden py-24 px-4"
        style={{ backgroundColor: '#0f2044' }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <Image src="/world-map-overlay.png" alt="" fill className="object-cover" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center z-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-4">
            Ship smarter.{' '}
            <span style={{ color: '#f97316' }}>Share the container.</span>
          </h1>
          <p className="text-gray-300 text-lg mb-10 max-w-2xl mx-auto">
            ShareConLoad lets multiple shippers share a single container — so you only pay for the
            space you actually use, on a route that&apos;s already going your way.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/#listings"
              className="px-6 py-3 rounded-xl font-bold text-white text-sm hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#f97316' }}
            >
              Browse Containers
            </Link>
            <Link
              href="/onboarding/operator"
              className="px-6 py-3 rounded-xl font-bold text-sm border-2 border-white/40 text-white hover:bg-white/10 transition-colors"
            >
              List Your Container
            </Link>
          </div>
        </div>
      </section>

      {/* ── Concept Explainer ── */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <p
            className="text-xs font-extrabold uppercase tracking-widest mb-3"
            style={{ color: '#f97316' }}
          >
            What is shared container shipping?
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-4 leading-snug">
            You don&apos;t need the whole container.{' '}
            <span className="text-gray-400 font-bold">You just need your share.</span>
          </h2>
          <p className="text-gray-600 text-sm leading-relaxed mb-6">
            Small and mid-size businesses have historically been forced to pay for a full container
            or wait for a consolidator to fill one. ShareConLoad changes that — operators list spare
            capacity, shippers book exactly the CBM they need, and everyone pays their fair share.
          </p>
          <blockquote className="border-l-4 pl-5 py-2" style={{ borderColor: '#f97316' }}>
            <p className="text-gray-700 text-sm italic leading-relaxed">
              &ldquo;Instead of booking a full 20ft container for $3,000+, book 3 CBM for your
              actual goods and pay only for that space.&rdquo;
            </p>
          </blockquote>
        </div>
      </section>

      {/* ── Shipper Journey ── */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <span
            className="inline-block text-xs font-extrabold uppercase tracking-widest mb-3 px-3 py-1.5 rounded-full"
            style={{ backgroundColor: '#fff7ed', color: '#f97316' }}
          >
            For Shippers
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-1">
            Book space in minutes
          </h2>
          <p className="text-gray-400 text-sm mb-8">
            From discovery to delivery — five steps, fully online.
          </p>
          <div>
            {SHIPPER_STEPS.map((step, i) => (
              <StepRow
                key={step.num}
                step={step}
                side={i % 2 === 0 ? 'left' : 'right'}
                spineColor="#f97316"
                accentColor="#f97316"
                badgeVariant={step.numColor === '#0f2044' ? 'navy' : 'orange'}
                isFirst={i === 0}
                isLast={i === SHIPPER_STEPS.length - 1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Payment Stages ── */}
      <section className="py-16 px-4" style={{ backgroundColor: '#0f2044' }}>
        <div className="max-w-3xl mx-auto">
          <p
            className="text-xs font-extrabold uppercase tracking-widest mb-3"
            style={{ color: '#f97316' }}
          >
            How payments work
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
            Pay in three stages — never all at once
          </h2>
          <p className="text-gray-400 text-sm mb-10">
            Your payment is split across the shipment lifecycle. You&apos;re protected at every
            stage — no large upfront risk.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            {PAYMENT_STAGES.map((stage, i) => (
              <div key={stage.label} className="flex flex-col sm:flex-row items-center gap-3 flex-1">
                {i > 0 && (
                  <svg
                    className="w-5 h-5 text-gray-500 shrink-0 rotate-90 sm:rotate-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
                <div className="bg-white/10 rounded-2xl p-5 flex-1 w-full">
                  <div
                    className="text-4xl font-extrabold mb-1"
                    style={{ color: '#f97316' }}
                  >
                    {stage.pct}%
                  </div>
                  <div className="text-white font-bold text-sm mb-1">{stage.label}</div>
                  <div className="text-gray-400 text-xs leading-relaxed">{stage.trigger}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Operator Journey ── */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <span
            className="inline-block text-xs font-extrabold uppercase tracking-widest mb-3 px-3 py-1.5 rounded-full"
            style={{ backgroundColor: '#eef2ff', color: '#0f2044' }}
          >
            For Operators
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-1">
            Turn empty space into revenue
          </h2>
          <p className="text-gray-400 text-sm mb-8">
            List your container, fill it with verified shippers, get paid.
          </p>
          <div>
            {OPERATOR_STEPS.map((step, i) => (
              <StepRow
                key={step.num}
                step={step}
                side={i % 2 === 0 ? 'right' : 'left'}
                spineColor="#0f2044"
                accentColor="#0f2044"
                badgeVariant={step.numColor === '#f97316' ? 'orange' : 'navy'}
                isFirst={i === 0}
                isLast={i === OPERATOR_STEPS.length - 1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Why ShareConLoad ── */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 text-center mb-2">
            Why choose ShareConLoad?
          </h2>
          <p className="text-gray-400 text-sm text-center mb-10">
            Benefits for both sides of the marketplace
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <span
                className="inline-block text-xs font-extrabold uppercase tracking-widest mb-1 px-2.5 py-1 rounded-full"
                style={{ backgroundColor: '#fff7ed', color: '#f97316' }}
              >
                Shippers
              </span>
              <h3 className="font-extrabold text-gray-900 text-base mt-2 mb-4">
                Ship smarter, spend less
              </h3>
              <ul className="flex flex-col gap-3">
                {SHIPPER_BENEFITS.map((b) => (
                  <BenefitItem key={b} text={b} />
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <span
                className="inline-block text-xs font-extrabold uppercase tracking-widest mb-1 px-2.5 py-1 rounded-full"
                style={{ backgroundColor: '#eef2ff', color: '#0f2044' }}
              >
                Operators
              </span>
              <h3 className="font-extrabold text-gray-900 text-base mt-2 mb-4">
                Earn more per trip
              </h3>
              <ul className="flex flex-col gap-3">
                {OPERATOR_BENEFITS.map((b) => (
                  <BenefitItem key={b} text={b} />
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section
        className="relative overflow-hidden py-24 px-4"
        style={{ backgroundColor: '#0f2044' }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <Image src="/world-map-overlay.png" alt="" fill className="object-cover" />
        </div>
        <div className="relative max-w-2xl mx-auto text-center z-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Ready to ship smarter?
          </h2>
          <p className="text-gray-300 text-base mb-10">
            Join shippers and operators already using ShareConLoad to move goods across the world.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/#listings"
              className="px-7 py-3 rounded-xl font-bold text-white text-sm hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#f97316' }}
            >
              Browse Containers →
            </Link>
            <Link
              href="/onboarding/operator"
              className="px-7 py-3 rounded-xl font-bold text-white text-sm border-2 border-white/40 hover:bg-white/10 transition-colors"
            >
              Become an Operator
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-gray-100 py-12 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
          <div>
            <Link href="/" className="flex items-center gap-2 mb-3">
              <Image src="/logo1.png" alt="" width={32} height={32} className="h-8 w-auto" />
              <span className="font-extrabold text-base">
                <span style={{ color: '#0f2044' }}>Share</span>
                <span style={{ color: '#f97316' }}>Con</span>
                <span style={{ color: '#0f2044' }}>Load</span>
              </span>
            </Link>
            <p className="text-xs text-gray-400 leading-relaxed">
              The smarter way to ship. Share container space, reduce costs, move goods.
            </p>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-gray-400 mb-3">
              Platform
            </p>
            <ul className="flex flex-col gap-2 text-sm text-gray-600">
              <li>
                <Link href="/how-it-works" className="hover:text-gray-900 transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/#listings" className="hover:text-gray-900 transition-colors">
                  Browse Containers
                </Link>
              </li>
              <li>
                <Link href="/onboarding/operator" className="hover:text-gray-900 transition-colors">
                  List Your Container
                </Link>
              </li>
              <li>
                <Link href="/auth/register" className="hover:text-gray-900 transition-colors">
                  Create Account
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-gray-400 mb-3">
              Legal
            </p>
            <ul className="flex flex-col gap-2 text-sm text-gray-600">
              <li>
                <Link href="/privacy" className="hover:text-gray-900 transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-gray-900 transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-gray-900 transition-colors">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-5xl mx-auto border-t border-gray-100 pt-6">
          <p className="text-xs text-gray-400 text-center">
            © {new Date().getFullYear()} ShareConLoad. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript still compiles clean**

```bash
npx tsc --noEmit
```

Expected: zero errors introduced by this file.

- [ ] **Step 4: Visually verify the page**

Start the dev server and open `http://localhost:3000/how-it-works`. Check:

- Hero: navy background, world map, new headline + two CTA buttons (orange "Browse Containers", outlined "List Your Container")
- Concept Explainer: white background, orange eyebrow label, orange left-border blockquote
- Shipper Journey: step 1 LEFT on desktop, alternating, orange spine line, step 5 has navy number circle
- Payment Stages: navy background, three tiles with arrows, percentages in orange
- Operator Journey: step 1 RIGHT on desktop, alternating, navy spine line, step 5 has orange number circle
- Why ShareConLoad: two benefit cards side-by-side on desktop
- Final CTA: navy background, world map, two buttons
- Footer: three columns (Brand, Platform, Legal) on sm+
- Mobile (<1024px): all step rows collapse to left-spine vertical list, number circles on left with connecting line, content to the right

- [ ] **Step 5: Commit**

```bash
git add app/how-it-works/page.tsx
git commit -m "feat: redesign how-it-works page with alternating-row journeys and payment stages"
```
