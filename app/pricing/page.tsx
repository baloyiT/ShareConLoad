import Link from 'next/link';
import Image from 'next/image';

export const metadata = { title: 'Pricing, ShareConLoad' };

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm h-14 flex items-center px-6 sm:px-10 gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image src="/logo1.png" alt="" width={36} height={36} className="h-8 w-auto" />
          <span className="text-lg font-extrabold tracking-tight">
            <span style={{ color: '#0f2044' }}>Share</span>
            <span style={{ color: '#f97316' }}>Con</span>
            <span style={{ color: '#0f2044' }}>Load</span>
          </span>
        </Link>
        <div className="flex-1" />
        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>
      </nav>

      {/* Hero */}
      <div className="py-10 px-4" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}>
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#f97316' }}>Pricing</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">Simple, Transparent Pricing</h1>
          <p className="text-gray-400 text-sm">
            No hidden fees. Pay only for the space you use. Operators earn more as volumes grow.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* ── Shippers ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-10">
          <div className="flex items-center gap-3 mb-6">
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest"
              style={{ backgroundColor: '#fff7ed', color: '#f97316' }}
            >
              For Shippers
            </span>
          </div>

          <h2 className="text-lg font-extrabold text-gray-900 mb-1">How shipping costs work</h2>
          <p className="text-sm text-gray-500 mb-6">
            Each operator sets their own price per CBM (cubic metre) on their container listing. You
            pay only for the exact space your cargo occupies, no whole-container commitment required.
            Your total cost is calculated as:
          </p>

          <div className="rounded-xl border border-gray-100 bg-gray-50 px-5 py-4 text-sm font-mono text-gray-700 mb-6">
            Total Cost = CBM booked × Price per CBM (set by operator)
          </div>

          {/* Payment stages */}
          <h3 className="text-sm font-bold text-gray-800 mb-3">Payment stages</h3>
          <p className="text-sm text-gray-500 mb-5">
            Your total is never charged at once. It is split into three stages tied to shipment
            milestones, so your money moves only as the shipment progresses.
          </p>

          <div className="space-y-3 mb-6">
            {[
              {
                pct: '20%',
                label: 'Deposit, paid at booking',
                detail: 'Secures your space immediately. Refundable within 48 hours of booking confirmation. Non-refundable after that window.',
                color: '#f97316',
              },
              {
                pct: '50%',
                label: 'Pre-Departure, due 7 days before sailing',
                detail: 'Required before the container departs the origin port. Booking may be cancelled if not paid in time.',
                color: '#0f2044',
              },
              {
                pct: '30%',
                label: 'Final Release, paid at destination',
                detail: 'Due before cargo is released to you at the destination. Cargo is held until this stage is cleared.',
                color: '#0f2044',
              },
            ].map(({ pct, label, detail, color }) => (
              <div key={pct} className="flex gap-4 items-start rounded-xl border border-gray-100 px-5 py-4">
                <span
                  className="text-xl font-extrabold shrink-0 w-12 text-right"
                  style={{ color }}
                >
                  {pct}
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Platform service fee note */}
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">Platform service fee</p>
            <p>
              A non-refundable platform service fee is included in the total at checkout. This covers
              marketplace coordination, booking administration, payment processing, and transaction
              facilitation. The exact fee is displayed before you confirm your booking.
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-5 py-4 text-xs text-gray-500 space-y-1">
            <p>All amounts are denominated in South African Rand (ZAR).</p>
            <p>Payments are processed securely via Paystack.</p>
          </div>
        </div>

        {/* ── Operators ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-10">
          <div className="flex items-center gap-3 mb-6">
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest"
              style={{ backgroundColor: '#eef2ff', color: '#0f2044' }}
            >
              For Operators
            </span>
          </div>

          {/* Payout stages */}
          <h3 className="text-sm font-bold text-gray-800 mb-3">Payout schedule</h3>
          <p className="text-sm text-gray-500 mb-4">
            Payouts are released automatically as each customer payment stage clears. You receive
            three separate transfers per shipment:
          </p>

          <div className="space-y-3 mb-5">
            {[
              { stage: 'Stage 1', pct: '20%', trigger: 'Released after customer deposit clears and booking is confirmed' },
              { stage: 'Stage 2', pct: '50%', trigger: 'Released after pre-departure payment clears (7 days before sailing)' },
              { stage: 'Stage 3', pct: '30%', trigger: 'Released after final customer payment clears at destination' },
            ].map(({ stage, pct, trigger }) => (
              <div key={stage} className="flex gap-4 items-start rounded-xl border border-gray-100 px-5 py-4">
                <div className="shrink-0 text-center">
                  <p className="text-xs text-gray-400 font-semibold">{stage}</p>
                  <p className="text-lg font-extrabold" style={{ color: '#0f2044' }}>{pct}</p>
                </div>
                <p className="text-sm text-gray-500 mt-1">{trigger}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">Payout eligibility</p>
            <p>
              Payouts require a verified bank account, an active Paystack recipient code, no open
              dispute on the booking, and a 48-hour refund window to have elapsed on Stage 1. Payouts
              may be withheld if <code className="text-xs bg-amber-100 px-1 rounded">payout_hold</code> is
              active on your operator profile.
            </p>
          </div>
        </div>

        {/* ── No hidden fees callout ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
          <h2 className="text-base font-extrabold text-gray-900 mb-4">What is never charged</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-sm text-gray-600">
            {[
              'No listing fees for operators',
              'No subscription or monthly fees',
              'No charge to browse containers',
              'No charge to create an account',
              'No charge to submit a support ticket or dispute',
              'No charge for shipment tracking',
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 shrink-0 text-green-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Related links ── */}
        <div className="flex flex-col sm:flex-row gap-3 text-sm">
          <Link
            href="/payment-flow"
            className="flex-1 flex items-center justify-between rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm hover:border-orange-200 transition-colors"
          >
            <div>
              <p className="font-semibold text-gray-800">Payment Flow</p>
              <p className="text-xs text-gray-400 mt-0.5">End-to-end explanation of how Paystack processes payments</p>
            </div>
            <svg className="w-4 h-4 text-gray-400 shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="/cancellation"
            className="flex-1 flex items-center justify-between rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm hover:border-orange-200 transition-colors"
          >
            <div>
              <p className="font-semibold text-gray-800">Cancellation &amp; Refund Policy</p>
              <p className="text-xs text-gray-400 mt-0.5">Deposit windows, refund eligibility, and operator non-performance rules</p>
            </div>
            <svg className="w-4 h-4 text-gray-400 shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="/terms"
            className="flex-1 flex items-center justify-between rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm hover:border-orange-200 transition-colors"
          >
            <div>
              <p className="font-semibold text-gray-800">Terms &amp; Conditions</p>
              <p className="text-xs text-gray-400 mt-0.5">Full payment terms, booking conditions, and platform rules</p>
            </div>
            <svg className="w-4 h-4 text-gray-400 shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400 mt-2 italic">Share the Load. Connect the World.</p>
      </div>
    </div>
  );
}
