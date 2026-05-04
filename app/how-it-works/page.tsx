import Image from 'next/image';
import Link from 'next/link';

// ─── Data ─────────────────────────────────────────────────────────────────────

const CUSTOMER_STEPS = [
  { number: 1, title: 'Find a Container',       desc: 'Browse available routes and departure dates to find a container that fits your shipment.' },
  { number: 2, title: 'Book Space',             desc: 'Enter the CBM you need and your shipment details to reserve your space.' },
  { number: 3, title: 'Declare Your Goods',     desc: 'Provide item descriptions and declared values, then confirm your goods declaration.' },
  { number: 4, title: 'Drop Off Your Items',    desc: 'Deliver your goods to the operator at the agreed collection point.' },
  { number: 5, title: 'Track & Receive',        desc: 'Follow your shipment status and collect your goods at the destination.' },
];

const OPERATOR_STEPS = [
  { number: 1, title: 'Create a Container Listing', desc: 'Define your route, departure date, total capacity, and price per CBM.' },
  { number: 2, title: 'Receive Bookings',            desc: 'Shippers browse and book space in your container through the platform.' },
  { number: 3, title: 'Manage Shipments',            desc: 'View all booked goods, review declarations, and organise your load.' },
  { number: 4, title: 'Transport Goods',             desc: 'Execute the shipment as planned with full visibility of what is on board.' },
  { number: 5, title: 'Update Status & Deliver',     desc: 'Keep customers informed at every stage and confirm delivery at the destination.' },
];

const CUSTOMER_BENEFITS = ['Lower shipping costs', 'Flexible space booking', 'Transparent pricing', 'Structured process'];
const OPERATOR_BENEFITS = ['Monetize unused capacity', 'Reach more customers', 'Manage bookings digitally', 'Increase load efficiency'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepCard({ number, title, desc, accent }: { number: number; title: string; desc: string; accent: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-3">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-extrabold shrink-0"
        style={{ backgroundColor: accent }}
      >
        {number}
      </div>
      <h3 className="font-bold text-gray-900 text-base">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

function BenefitItem({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2.5 text-sm text-gray-700">
      <svg className="w-4 h-4 shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
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
              <span style={{ color: '#0f2044' }}>Share</span><span style={{ color: '#f97316' }}>Con</span><span style={{ color: '#0f2044' }}>Load</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-5 text-sm font-medium text-gray-600">
            <Link href="/how-it-works" className="font-semibold" style={{ color: '#0f2044' }}>How It Works</Link>
            <Link href="/#listings" className="hover:text-gray-900 transition-colors">I Need Container Space</Link>
            <Link href="#" className="hover:text-gray-900 transition-colors">About Us</Link>
            <Link href="#" className="hover:text-gray-900 transition-colors">Contact</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/auth/login" className="text-sm font-medium text-gray-700 hover:text-gray-900 px-4 py-1.5 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors">
              Login
            </Link>
            <Link href="/auth/register" className="text-sm font-semibold text-white px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity" style={{ backgroundColor: '#f97316' }}>
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden py-20 px-4" style={{ backgroundColor: '#0f2044' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ mixBlendMode: 'screen', opacity: 0.2 }}>
          <Image src="/world-map-overlay.png" alt="" fill className="object-cover" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center z-10">
          <span
            className="inline-block text-xs font-bold uppercase tracking-widest mb-4 px-3 py-1.5 rounded-full"
            style={{ backgroundColor: 'rgba(249,115,22,0.15)', color: '#f97316' }}
          >
            Platform Guide
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-4">
            How <span style={{ color: '#f97316' }}>ShareConLoad</span> Works
          </h1>
          <p className="text-gray-300 text-lg mb-10 max-w-xl mx-auto">
            Simple, reliable shared container shipping for customers and operators.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/#listings"
              className="px-6 py-3 rounded-xl font-semibold text-white text-sm hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#f97316' }}
            >
              Browse Containers
            </Link>
            <Link
              href="/auth/register"
              className="px-6 py-3 rounded-xl font-semibold text-sm border border-white/30 text-white hover:bg-white/10 transition-colors"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </section>

      {/* ── For Shippers ── */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10">
            <span
              className="inline-block text-xs font-bold uppercase tracking-widest mb-3 px-3 py-1.5 rounded-full"
              style={{ backgroundColor: '#fff7ed', color: '#f97316' }}
            >
              For Shippers
            </span>
            <h2 className="text-3xl font-extrabold text-gray-900">Shipping Made Simple</h2>
            <p className="text-gray-500 text-sm mt-2">Five steps from booking to delivery.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {CUSTOMER_STEPS.map((step) => (
              <StepCard key={step.number} {...step} accent="#f97316" />
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4">
        <div className="h-px bg-gray-200" />
      </div>

      {/* ── For Operators ── */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10">
            <span
              className="inline-block text-xs font-bold uppercase tracking-widest mb-3 px-3 py-1.5 rounded-full"
              style={{ backgroundColor: '#eef2ff', color: '#0f2044' }}
            >
              For Operators
            </span>
            <h2 className="text-3xl font-extrabold text-gray-900">Turn Your Container into Revenue</h2>
            <p className="text-gray-500 text-sm mt-2">List, manage, and deliver with complete visibility.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {OPERATOR_STEPS.map((step) => (
              <StepCard key={step.number} {...step} accent="#0f2044" />
            ))}
          </div>
        </div>
      </section>

      {/* ── Why ShareConLoad ── */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-extrabold text-gray-900 text-center mb-10">Why ShareConLoad?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: '#fff7ed' }}>📦</div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f97316' }}>Shippers</p>
                  <h3 className="font-bold text-gray-800">Ship smarter</h3>
                </div>
              </div>
              <ul className="flex flex-col gap-3">{CUSTOMER_BENEFITS.map((b) => <BenefitItem key={b} text={b} />)}</ul>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: '#eef2ff' }}>🚢</div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#0f2044' }}>Operators</p>
                  <h3 className="font-bold text-gray-800">Earn more</h3>
                </div>
              </div>
              <ul className="flex flex-col gap-3">{OPERATOR_BENEFITS.map((b) => <BenefitItem key={b} text={b} />)}</ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative overflow-hidden py-20 px-4" style={{ backgroundColor: '#0f2044' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ mixBlendMode: 'screen', opacity: 0.2 }}>
          <Image src="/world-map-overlay.png" alt="" fill className="object-cover" />
        </div>
        <div className="relative max-w-2xl mx-auto text-center z-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Start Using ShareConLoad Today
          </h2>
          <p className="text-gray-300 text-base mb-10">
            Whether you&apos;re shipping goods or offering container space, we&apos;ve got you covered.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/#listings" className="px-7 py-3 rounded-xl font-bold text-white text-sm hover:opacity-90 transition-opacity" style={{ backgroundColor: '#f97316' }}>
              Browse Containers
            </Link>
            <Link href="/auth/register" className="px-7 py-3 rounded-xl font-bold text-white text-sm border border-white/30 hover:bg-white/10 transition-colors">
              Become an Operator
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-gray-100 py-6 px-4 text-center">
        <p className="text-xs text-gray-400">© {new Date().getFullYear()} ShareConLoad. All rights reserved.</p>
      </footer>
    </div>
  );
}
