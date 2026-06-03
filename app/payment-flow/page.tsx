import Link from 'next/link';
import Image from 'next/image';

export const metadata = { title: 'Payment Flow — ShareConLoad' };

export default function PaymentFlowPage() {
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
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#f97316' }}>Transparency</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">How Payments Work</h1>
          <p className="text-gray-400 text-sm">
            End-to-end explanation of how money flows between customers, ShareConLoad, and operators — all processed securely via Paystack.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* ── Section 1: Payment Security ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-10">
          <h2 className="text-lg font-extrabold text-gray-900 mb-5">Payment Security</h2>
          <div className="space-y-3">
            {[
              'All payments processed exclusively via Paystack',
              'No card data ever stored on ShareConLoad servers',
              'Customers pay on Paystack\'s PCI-DSS compliant hosted page',
              'Paystack secret keys stored only in server-side Edge Functions',
              'Webhook signatures verified on every event',
              'Operator payouts only after full KYC approval',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-0.5 shrink-0 text-green-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-gray-700">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 2: Three-Stage Payment Model ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-10">
          <h2 className="text-lg font-extrabold text-gray-900 mb-1">Three-Stage Payment Model</h2>
          <p className="text-sm text-gray-500 mb-6">
            Customer payments are never collected in full at once. The total is split into three stages tied to shipment milestones so customer funds move only as the shipment progresses.
          </p>

          <div className="space-y-3">
            {[
              {
                pct: '20%',
                label: 'Deposit',
                detail: 'Paid at booking to secure the space. Refundable within 48 hours of booking confirmation. Non-refundable after that window.',
                color: '#f97316',
              },
              {
                pct: '50%',
                label: 'Pre-Departure',
                detail: 'Due 7 days before the container departs the origin port. Required for the container to sail.',
                color: '#0f2044',
              },
              {
                pct: '30%',
                label: 'Final Release',
                detail: 'Due at the destination before cargo is released to the consignee. Cargo is held until this stage clears.',
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
        </div>

        {/* ── Section 3: End-to-End Money Flow ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-10">
          <h2 className="text-lg font-extrabold text-gray-900 mb-1">End-to-End Money Flow</h2>
          <p className="text-sm text-gray-500 mb-8">
            How each payment travels from the customer to the operator.
          </p>

          <div className="relative">
            {/* Vertical connector line */}
            <div
              className="absolute left-5 top-6 bottom-6 w-0.5"
              style={{ backgroundColor: '#e5e7eb' }}
              aria-hidden="true"
            />

            <div className="space-y-0">
              {[
                {
                  step: 1,
                  actor: 'Customer',
                  actorColor: '#f97316',
                  actorBg: '#fff7ed',
                  action: 'Initiates payment',
                  detail:
                    "Customer clicks Pay Now on the staged payment page. ShareConLoad's Edge Function generates a Paystack payment link. The customer is redirected to Paystack's secure hosted payment page — no card data touches ShareConLoad servers.",
                },
                {
                  step: 2,
                  actor: 'Paystack',
                  actorColor: '#0f2044',
                  actorBg: '#eef2ff',
                  action: 'Processes the transaction',
                  detail:
                    'Paystack handles all card processing, 3D Secure verification, and fraud checks. On completion, Paystack sends a signed webhook event to ShareConLoad.',
                },
                {
                  step: 3,
                  actor: 'ShareConLoad',
                  actorColor: '#0f2044',
                  actorBg: '#eef2ff',
                  action: 'Verifies & records',
                  detail:
                    'Our Edge Function verifies the Paystack webhook signature, confirms the payment reference, and marks the payment stage as paid in the database. The booking progresses to the next status.',
                },
                {
                  step: 4,
                  actor: 'ShareConLoad',
                  actorColor: '#0f2044',
                  actorBg: '#eef2ff',
                  action: 'Releases payout to operator',
                  detail:
                    "Once payout eligibility conditions are met (KYC approved, no active dispute, refund window elapsed), ShareConLoad initiates a Paystack Transfer to the operator's verified bank account — minus the tiered platform commission.",
                },
                {
                  step: 5,
                  actor: 'Operator',
                  actorColor: '#f97316',
                  actorBg: '#fff7ed',
                  action: 'Receives net payout',
                  detail:
                    'The operator receives the net amount (gross payout minus commission) directly into their registered bank account via Paystack.',
                },
              ].map(({ step, actor, actorColor, actorBg, action, detail }) => (
                <div key={step} className="relative flex gap-5 pb-8 last:pb-0">
                  {/* Step circle */}
                  <div
                    className="relative z-10 flex items-center justify-center w-10 h-10 rounded-full shrink-0 text-sm font-extrabold text-white shadow-sm"
                    style={{ backgroundColor: actorColor }}
                  >
                    {step}
                  </div>
                  {/* Content */}
                  <div className="flex-1 pt-1 pb-2">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold mb-1.5"
                      style={{ backgroundColor: actorBg, color: actorColor }}
                    >
                      {actor}
                    </span>
                    <p className="text-sm font-semibold text-gray-800 mb-1">{action}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Section 4: Operator Payout Eligibility ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-10">
          <h2 className="text-lg font-extrabold text-gray-900 mb-1">Operator Payout Eligibility</h2>
          <p className="text-sm text-gray-500 mb-5">
            A payout to an operator is only released when ALL of the following conditions are satisfied:
          </p>

          <div className="space-y-3 mb-6">
            {[
              'Corresponding customer payment stage is confirmed as paid',
              'Operator has a verified Paystack recipient code (bank account registered)',
              'Operator KYC documents are approved (payout_enabled = true)',
              'No active dispute on the booking',
              '48-hour refund window has elapsed (Stage 1 only)',
              'No payout_hold flag active on the operator profile',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-0.5 shrink-0 text-green-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-gray-700">{item}</span>
              </div>
            ))}
          </div>

          {/* Refunds warning card */}
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">Refunds</p>
            <p>
              Refunds are never automatic. They are initiated by an admin through the Paystack API only after a formal review of the customer&apos;s cancellation or dispute.{' '}
              <Link href="/cancellation" className="underline font-medium hover:text-amber-900 transition-colors">
                See the Cancellation &amp; Refund Policy for full details.
              </Link>
            </p>
          </div>
        </div>

        {/* ── Related links ── */}
        <div className="flex flex-col sm:flex-row gap-3 text-sm">
          <Link
            href="/pricing"
            className="flex-1 flex items-center justify-between rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm hover:border-orange-200 transition-colors"
          >
            <div>
              <p className="font-semibold text-gray-800">Pricing &amp; Commission</p>
              <p className="text-xs text-gray-400 mt-0.5">Tiered operator commission rates and payment stage breakdown</p>
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
              <p className="text-xs text-gray-400 mt-0.5">Deposit windows, refund eligibility, and operator rules</p>
            </div>
            <svg className="w-4 h-4 text-gray-400 shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="/operator-verification"
            className="flex-1 flex items-center justify-between rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm hover:border-orange-200 transition-colors"
          >
            <div>
              <p className="font-semibold text-gray-800">Operator Verification (KYC)</p>
              <p className="text-xs text-gray-400 mt-0.5">Documents and checks required for logistics providers</p>
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
