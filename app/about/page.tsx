import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { CircleDollarSign, ClipboardList, Info, Lock, PackageX, ShieldOff } from 'lucide-react';
export const metadata: Metadata = {
  title: 'About ShareConLoad – The Container Sharing Marketplace',
  description:
    'Learn how ShareConLoad connects operators, shippers, agents, measurement agents, and transporters to eliminate empty container space and unlock global trade for everyone.',
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
      <PackageX className="w-5 h-5" strokeWidth={1.75} />
    ),
    title: 'Empty space = lost revenue',
    desc: 'Operators lose money every time a container sails with unfilled space. There was no marketplace to fix it, until now.',
  },
  {
    icon: (
      <CircleDollarSign className="w-5 h-5" strokeWidth={1.75} />
    ),
    title: 'Shippers overpay',
    desc: 'Paying full FCL rates for partial loads is the norm. No platform existed to connect shippers to the space that\'s already there.',
  },
  {
    icon: (
      <ClipboardList className="w-5 h-5" strokeWidth={1.75} />
    ),
    title: 'Agents work blind',
    desc: 'Freight forwarders and clearing agents juggle operators and shippers across email, phone, and WhatsApp, with no single system of record.',
  },
  {
    icon: (
      <ShieldOff className="w-5 h-5" strokeWidth={1.75} />
    ),
    title: 'No trust layer',
    desc: 'Cross-border transactions between unknown parties move on faith. Money is sent. Goods don\'t always follow. There is no escrow, no protection, no recourse.',
  },
  {
    icon: (
      <Info className="w-5 h-5" strokeWidth={1.75} />
    ),
    title: 'Information asymmetry',
    desc: 'Operators don\'t know who needs space. Shippers don\'t know who has it. The global LCL market is enormous, and completely dark.',
  },
  {
    icon: (
      <Lock className="w-5 h-5" strokeWidth={1.75} />
    ),
    title: 'SMEs locked out',
    desc: 'Small businesses in emerging markets cannot access international trade affordably. Full container costs are a wall they can\'t climb alone.',
  },
];

const WHO_CARDS: WhoCard[] = [
  {
    badgeLabel: 'Operator',
    badgeClass: 'bg-[#0b103a] text-[#ff6a00]',
    title: 'You have the space',
    desc: 'List your available container space, set your rates, and connect with verified shippers on your trade corridor. Stop sailing empty. Start earning on every cubic metre.',
  },
  {
    badgeLabel: 'Shipper',
    badgeClass: 'bg-[#ff6a00] text-white',
    title: 'You need the space',
    desc: 'Book only what you need. No full container costs, no middleman markups, no payment risk. Shippers pay zero platform fees, your goods move, your margins stay intact.',
  },
  {
    badgeLabel: 'Agent',
    badgeClass: 'bg-blue-50 text-blue-500 border border-blue-200',
    title: 'You connect both worlds',
    desc: 'Freight forwarders and clearing agents operate on both sides of the marketplace. One platform replaces the chaos of dozens of conversations, and your commission is structured, transparent, and protected.',
  },
  {
    badgeLabel: 'Measurement Agent',
    badgeClass: 'bg-green-50 text-green-600 border border-green-200',
    title: 'You verify the cargo',
    desc: 'Measure and certify cargo dimensions on the ground, giving shippers and operators a trusted, accurate CBM for fair pricing and space allocation. Get matched to measurement jobs and earn on every verified report.',
  },
  {
    badgeLabel: 'Transporter',
    badgeClass: 'bg-purple-50 text-purple-600 border border-purple-200',
    title: 'You move it first & last mile',
    desc: 'Handle pickup and delivery between the shipper\'s door and the container. Get matched to transport jobs on your routes, and get paid for every completed leg.',
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
              <span style={{ color: '#0b103a' }}>Share</span>
              <span style={{ color: '#ff6a00' }}>Con</span>
              <span style={{ color: '#0b103a' }}>Load</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-5 text-sm font-medium text-gray-600">
            <Link href="/about" className="font-semibold" style={{ color: '#0b103a' }}>
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
              style={{ backgroundColor: '#ff6a00' }}
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden py-24 px-4" style={{ backgroundColor: '#0b103a' }}>
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <Image src="/world-map-overlay.png" alt="" fill sizes="100vw" className="object-cover" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center z-10">
          <span
            className="inline-block text-xs font-extrabold uppercase tracking-widest mb-5 px-4 py-1.5 rounded-full"
            style={{ backgroundColor: 'rgba(249,115,22,0.15)', color: '#ff6a00' }}
          >
            About ShareConLoad
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-5">
            The world&apos;s cargo moves in containers.{' '}
            <span style={{ color: '#ff6a00' }}>Most of that space sails empty.</span>
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto mb-10">
            Every day, billions of dollars of container space is wasted across global trade corridors, while
            thousands of shippers pay full container rates for half a container&apos;s worth of goods. We built
            ShareConLoad to end that.
          </p>
          <Link
            href="/auth/register"
            className="px-7 py-3 rounded-xl font-bold text-white text-sm hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#ff6a00' }}
          >
            Join the platform
          </Link>
        </div>
      </section>

      {/* ── The Problem ── */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-extrabold uppercase tracking-widest mb-3" style={{ color: '#ff6a00' }}>
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
                <div className="mb-3" style={{ color: '#ff6a00' }}>
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
      <section className="py-16 px-4" style={{ backgroundColor: '#0b103a' }}>
        <div className="max-w-2xl mx-auto text-center">
          <p
            className="text-xs font-extrabold uppercase tracking-widest mb-4"
            style={{ color: '#ff6a00' }}
          >
            Share the Load, Connect the World
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-snug mb-4">
            We built the marketplace that{' '}
            <span style={{ color: '#ff6a00' }}>global trade was missing</span>
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(251,191,36,0.6)' }}>
            ShareConLoad is a live digital container load-sharing marketplace, the first platform purpose-built to
            connect Operators, Shippers, Agents, Measurement Agents, and Transporters in one verified,
            payments-protected ecosystem.
          </p>
        </div>
      </section>

      {/* ── The Solution ── */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-extrabold uppercase tracking-widest mb-3" style={{ color: '#ff6a00' }}>
            The solution
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-4 leading-snug">
            One platform. Five powerful roles. Zero wasted space.
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-8">
            ShareConLoad is a multi-sided marketplace with five distinct user types, each solving a different piece of
            the same broken puzzle. Every role benefits directly from the others being on the platform.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <p className="text-xs font-extrabold uppercase tracking-widest mb-3" style={{ color: '#ff6a00' }}>
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
          <p className="text-xs font-extrabold uppercase tracking-widest mb-3" style={{ color: '#ff6a00' }}>
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
          <p className="text-xs font-extrabold uppercase tracking-widest mb-3" style={{ color: '#ff6a00' }}>
            Our values
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-8 leading-snug">
            The principles we have built into the platform
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {VALUES.map((value) => (
              <div key={value.title} className="border-l-2 pl-4 py-1" style={{ borderColor: '#ff6a00' }}>
                <h3 className="text-sm font-extrabold text-gray-900 mb-1">{value.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{value.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="border-t border-gray-100 mx-8" />

      {/* ── CTA ── */}
      <section className="relative overflow-hidden py-24 px-4" style={{ backgroundColor: '#0b103a' }}>
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <Image src="/world-map-overlay.png" alt="" fill sizes="100vw" className="object-cover" />
        </div>
        <div className="relative max-w-2xl mx-auto text-center z-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-4">
            The space exists.<br />The shippers exist.<br />
            <span style={{ color: '#ff6a00' }}>Now the platform exists.</span>
          </h2>
          <p className="text-gray-300 text-base mb-10 max-w-xl mx-auto">
            ShareConLoad is live and onboarding its founding community of Operators, Shippers, and Agents right now.
            Early access is limited. The businesses that join first will shape how global container load-sharing works.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/auth/register"
              className="px-7 py-3 rounded-xl font-bold text-white text-sm hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#ff6a00' }}
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
                <span style={{ color: '#0b103a' }}>Share</span>
                <span style={{ color: '#ff6a00' }}>Con</span>
                <span style={{ color: '#0b103a' }}>Load</span>
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
