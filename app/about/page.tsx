import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About ShareConLoad – The Container Sharing Marketplace',
  description:
    'Learn how ShareConLoad connects operators, shippers, and agents to eliminate empty container space and unlock global trade for everyone.',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type ProblemCard = {
  icon: React.ReactNode;
  title: string;
  desc: string;
};

type WhoCard = {
  badgeLabel: string;
  badgeClass: string;
  title: string;
  desc: string;
};

type ValueItem = {
  title: string;
  desc: string;
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const PROBLEM_CARDS: ProblemCard[] = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 3l18 18" />
      </svg>
    ),
    title: 'Empty space = lost revenue',
    desc: 'Operators lose money every time a container sails with unfilled space. There was no marketplace to fix it, until now.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 3l18 18" />
      </svg>
    ),
    title: 'Shippers overpay',
    desc: 'Paying full FCL rates for partial loads is the norm. No platform existed to connect shippers to the space that\'s already there.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    title: 'Agents work blind',
    desc: 'Freight forwarders and clearing agents juggle operators and shippers across email, phone, and WhatsApp, with no single system of record.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 3l18 18" />
      </svg>
    ),
    title: 'No trust layer',
    desc: 'Cross-border transactions between unknown parties move on faith. Money is sent. Goods don\'t always follow. There is no escrow, no protection, no recourse.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Information asymmetry',
    desc: 'Operators don\'t know who needs space. Shippers don\'t know who has it. The global LCL market is enormous, and completely dark.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: 'SMEs locked out',
    desc: 'Small businesses in emerging markets cannot access international trade affordably. Full container costs are a wall they can\'t climb alone.',
  },
];

const WHO_CARDS: WhoCard[] = [
  {
    badgeLabel: 'Operator',
    badgeClass: 'bg-[#0f2044] text-[#f97316]',
    title: 'You have the space',
    desc: 'List your available container space, set your rates, and connect with verified shippers on your trade corridor. Stop sailing empty. Start earning on every cubic metre.',
  },
  {
    badgeLabel: 'Shipper',
    badgeClass: 'bg-[#f97316] text-white',
    title: 'You need the space',
    desc: 'Book only what you need. No full container costs, no middleman markups, no payment risk. Shippers pay zero platform fees, your goods move, your margins stay intact.',
  },
  {
    badgeLabel: 'Agent',
    badgeClass: 'bg-blue-50 text-blue-500 border border-blue-200',
    title: 'You connect both worlds',
    desc: 'Freight forwarders and clearing agents operate on both sides of the marketplace. One platform replaces the chaos of dozens of conversations, and your commission is structured, transparent, and protected.',
  },
];

const CORRIDORS = [
  'South Africa → China',
  'Ghana → UAE',
  'Nigeria → India',
  'South Africa → India',
  'Ghana → Malaysia',
  'Nigeria → China',
  'Intra-Africa routes',
  'South Africa → UAE',
  'Asia → Africa',
  'Africa → Europe',
];

const VALUES: ValueItem[] = [
  {
    title: 'Transparency',
    desc: 'Every rate, every commission, every payment milestone is visible to all parties. No hidden fees, no surprises.',
  },
  {
    title: 'Access',
    desc: 'We believe any business, anywhere in the world, should be able to participate in international trade without prohibitive cost.',
  },
  {
    title: 'Trust',
    desc: 'Verified users, milestone-based escrow, and a structured dispute framework mean every transaction is protected.',
  },
  {
    title: 'Efficiency',
    desc: 'Empty space is waste. Our entire platform is engineered to eliminate it, for operators, for shippers, for the industry.',
  },
  {
    title: 'Scale',
    desc: 'We have built for global reach from the start. Every corridor we launch is a foundation for the next.',
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AboutPage() {
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
            <Link href="/about" className="font-semibold" style={{ color: '#0f2044' }}>
              About
            </Link>
            <Link href="/how-it-works" className="hover:text-gray-900 transition-colors">
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
      <section className="relative overflow-hidden py-24 px-4" style={{ backgroundColor: '#0f2044' }}>
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <Image src="/world-map-overlay.png" alt="" fill sizes="100vw" className="object-cover" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center z-10">
          <span
            className="inline-block text-xs font-extrabold uppercase tracking-widest mb-5 px-4 py-1.5 rounded-full"
            style={{ backgroundColor: 'rgba(249,115,22,0.15)', color: '#f97316' }}
          >
            About ShareConLoad
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-5">
            The world&apos;s cargo moves in containers.{' '}
            <span style={{ color: '#f97316' }}>Most of that space sails empty.</span>
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto mb-10">
            Every day, billions of dollars of container space is wasted across global trade corridors, while
            thousands of shippers pay full container rates for half a container&apos;s worth of goods. We built
            ShareConLoad to end that.
          </p>
          <Link
            href="/auth/register"
            className="px-7 py-3 rounded-xl font-bold text-white text-sm hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#f97316' }}
          >
            Join the platform
          </Link>
        </div>
      </section>

      {/* ── The Problem ── */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-extrabold uppercase tracking-widest mb-3" style={{ color: '#f97316' }}>
            The problem
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-4 leading-snug">
            Global trade is broken for everyone who isn&apos;t a large corporation
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-3">
            The international freight industry runs on relationships, WhatsApp messages, and guesswork. Operators haul
            empty space at their own cost. Shippers overpay for space they don&apos;t need. Agents manage fragmented
            chaos across dozens of conversations. And small and medium businesses across the world remain locked out of
            international trade entirely, because the system was never built for them.
          </p>
          <p className="text-sm text-gray-500 leading-relaxed mb-8">
            These aren&apos;t isolated frustrations. They are structural failures that cost the global trade ecosystem
            billions every year. We mapped every one of them and built the solution.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROBLEM_CARDS.map((card) => (
              <div key={card.title} className="bg-[#f8fafc] rounded-2xl p-5">
                <div className="mb-3" style={{ color: '#f97316' }}>
                  {card.icon}
                </div>
                <h3 className="text-sm font-extrabold text-gray-900 mb-1">{card.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mission ── */}
      <section className="py-16 px-4" style={{ backgroundColor: '#0f2044' }}>
        <div className="max-w-2xl mx-auto text-center">
          <p
            className="text-xs font-extrabold uppercase tracking-widest mb-4"
            style={{ color: '#f97316' }}
          >
            Share the Load, Connect the World
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-snug mb-4">
            We built the marketplace that{' '}
            <span style={{ color: '#f97316' }}>global trade was missing</span>
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(251,191,36,0.6)' }}>
            ShareConLoad is a live digital container load-sharing marketplace, the first platform purpose-built to
            connect Operators, Shippers, and Agents in one verified, payments-protected ecosystem.
          </p>
        </div>
      </section>

      {/* ── The Solution ── */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-extrabold uppercase tracking-widest mb-3" style={{ color: '#f97316' }}>
            The solution
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-4 leading-snug">
            One platform. Three powerful roles. Zero wasted space.
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-8">
            ShareConLoad is a two-sided marketplace with three distinct user types, each solving a different piece of
            the same broken puzzle. Every role benefits directly from the others being on the platform.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {WHO_CARDS.map((card) => (
              <div
                key={card.badgeLabel}
                className="border border-gray-100 bg-[#f8fafc] rounded-2xl p-6 text-center"
              >
                <span
                  className={`inline-block text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full mb-4 ${card.badgeClass}`}
                >
                  {card.badgeLabel}
                </span>
                <h3 className="text-sm font-extrabold text-gray-900 mb-2">{card.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="border-t border-gray-100 mx-8" />

      {/* ── Why ShareConLoad ── */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-extrabold uppercase tracking-widest mb-3" style={{ color: '#f97316' }}>
            Why ShareConLoad
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-4 leading-snug">
            Not just a platform, a complete trade infrastructure
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-4">
            We have built more than a booking tool. ShareConLoad is a fully integrated ecosystem that handles
            discovery, matching, payment, and settlement, end to end. All payments are processed securely via
            Paystack in South African Rand (ZAR). Escrow is milestone-based: funds are released across three
            stages, 20% at booking, 50% pre-departure, and 30% at final cargo release, so every party is
            protected at every step of the shipment.
          </p>
          <p className="text-sm text-gray-500 leading-relaxed">
            There are no listing fees, no subscriptions, and no hidden charges. Shippers pay only for the
            CBM they book, nothing more.
          </p>
        </div>
      </section>

      {/* ── Trade Corridors ── */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-extrabold uppercase tracking-widest mb-3" style={{ color: '#f97316' }}>
            Trade corridors
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-4 leading-snug">
            Built for the trade routes that matter most
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            ShareConLoad launches across the highest-volume emerging market corridors, with global expansion built
            into the architecture from day one.
          </p>
          <div className="flex flex-wrap gap-2">
            {CORRIDORS.map((corridor) => (
              <span
                key={corridor}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600"
              >
                {corridor}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-extrabold uppercase tracking-widest mb-3" style={{ color: '#f97316' }}>
            Our values
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-8 leading-snug">
            The principles we have built into the platform
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {VALUES.map((value) => (
              <div key={value.title} className="border-l-2 pl-4 py-1" style={{ borderColor: '#f97316' }}>
                <h3 className="text-sm font-extrabold text-gray-900 mb-1">{value.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{value.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="border-t border-gray-100 mx-8" />

      {/* ── CTA ── */}
      <section className="relative overflow-hidden py-24 px-4" style={{ backgroundColor: '#0f2044' }}>
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <Image src="/world-map-overlay.png" alt="" fill sizes="100vw" className="object-cover" />
        </div>
        <div className="relative max-w-2xl mx-auto text-center z-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-4">
            The space exists.<br />The shippers exist.<br />
            <span style={{ color: '#f97316' }}>Now the platform exists.</span>
          </h2>
          <p className="text-gray-300 text-base mb-10 max-w-xl mx-auto">
            ShareConLoad is live and onboarding its founding community of Operators, Shippers, and Agents right now.
            Early access is limited. The businesses that join first will shape how global container load-sharing works.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/auth/register"
              className="px-7 py-3 rounded-xl font-bold text-white text-sm hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#f97316' }}
            >
              Join the platform
            </Link>
            <Link
              href="/how-it-works"
              className="px-7 py-3 rounded-xl font-bold text-white text-sm border-2 border-white/40 hover:bg-white/10 transition-colors"
            >
              Learn how it works
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
                <Link href="/pricing" className="hover:text-gray-900 transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/payment-flow" className="hover:text-gray-900 transition-colors">
                  Payment Flow
                </Link>
              </li>
              <li>
                <Link href="/operator-verification" className="hover:text-gray-900 transition-colors">
                  Operator Verification
                </Link>
              </li>
              <li>
                <Link href="/dispute-resolution" className="hover:text-gray-900 transition-colors">
                  Dispute Resolution
                </Link>
              </li>
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
                <Link href="/cancellation" className="hover:text-gray-900 transition-colors">
                  Cancellation &amp; Refund Policy
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
