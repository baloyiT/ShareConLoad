import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'Dispute Resolution, ShareConLoad',
  description: 'How disputes are raised, reviewed, and resolved on ShareConLoad.',
};

// ── Data ────────────────────────────────────────────────────────────────────

interface DisputeType {
  label: string;
  desc: string;
}

interface ProcessStep {
  num: number;
  title: string;
  detail: string;
  badge?: string;
}

interface Outcome {
  title: string;
  desc: string;
}

const DISPUTE_TYPES: DisputeType[] = [
  {
    label: 'Cargo Damage',
    desc: 'Goods arrived damaged, broken, or wet.',
  },
  {
    label: 'Short Delivery',
    desc: 'Quantity received is less than booked.',
  },
  {
    label: 'Overcharge',
    desc: 'Charged more than the agreed booking price.',
  },
  {
    label: 'Unreasonable Delay',
    desc: 'Shipment significantly delayed without notice or justification.',
  },
  {
    label: 'Other',
    desc: 'Any other operational issue not covered above.',
  },
];

const PROCESS_STEPS: ProcessStep[] = [
  {
    num: 1,
    title: 'Submit the dispute',
    detail:
      'Log in to your account, go to My Bookings, and click Raise a Dispute on the relevant booking. Select the dispute type and describe the issue in detail.',
    badge: 'Available from booking confirmation onwards',
  },
  {
    num: 2,
    title: 'Upload evidence',
    detail:
      'Attach supporting files, photos of damaged goods, weight certificates, payment records, or communications with the operator. Multiple files are accepted.',
  },
  {
    num: 3,
    title: 'Automatic payout hold',
    detail:
      'As soon as a dispute is submitted, any pending payout to the operator for that booking is automatically blocked. Money does not move to the operator while a dispute is open.',
    badge: 'Immediate protection',
  },
  {
    num: 4,
    title: 'Admin review',
    detail:
      'The ShareConLoad operations team reviews the dispute within 2 business days. They may request additional information from either party. Both parties are kept informed.',
    badge: '2 business days',
  },
  {
    num: 5,
    title: 'Resolution',
    detail: 'The admin determines an outcome based on the evidence. See possible outcomes below.',
  },
];

const OUTCOMES: Outcome[] = [
  {
    title: 'Full refund to customer',
    desc: 'If the operator is found to be at fault and no goods were delivered.',
  },
  {
    title: 'Partial refund',
    desc: 'Where partial delivery or partial fault is established.',
  },
  {
    title: 'Payout released to operator',
    desc: 'If the dispute is found to be unsubstantiated after review.',
  },
  {
    title: 'Platform credits',
    desc: 'Offered at discretion where a cash refund is not feasible.',
  },
  {
    title: 'Operator penalty',
    desc: 'Trust-score reduction, reduced visibility, suspension, or removal from the platform for substantiated operator failures.',
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DisputeResolutionPage() {
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
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#f97316' }}>Customer Protection</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">Dispute Resolution</h1>
          <p className="text-gray-400 text-sm">
            If something goes wrong with your shipment, our dispute process protects your payment and ensures a fair investigation.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* ── Section 1: What Can Be Disputed ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-10">
          <h2 className="text-lg font-extrabold text-gray-900 mb-1">What Can Be Disputed</h2>
          <p className="text-sm text-gray-500 mb-6">
            Disputes can be raised against any confirmed, in-transit, or delivered shipment.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            {DISPUTE_TYPES.map(({ label, desc }) => (
              <div key={label} className="rounded-xl border border-gray-100 px-4 py-3">
                <p className="text-sm font-bold text-gray-800 mb-0.5">{label}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 2: How the Process Works ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-10">
          <h2 className="text-lg font-extrabold text-gray-900 mb-1">How the Process Works</h2>
          <p className="text-sm text-gray-500 mb-8">
            Five steps from dispute submission to resolution.
          </p>

          <div className="relative">
            {/* Vertical connector line */}
            <div
              className="absolute left-5 top-6 bottom-6 w-0.5"
              style={{ backgroundColor: '#e5e7eb' }}
              aria-hidden="true"
            />

            <div>
              {PROCESS_STEPS.map(({ num, title, detail, badge }) => (
                <div key={num} className="relative flex gap-5 pb-8 last:pb-0">
                  {/* Step circle */}
                  <div
                    className="relative z-10 flex items-center justify-center w-10 h-10 rounded-full shrink-0 text-sm font-extrabold text-white shadow-sm"
                    style={{ backgroundColor: '#0f2044' }}
                  >
                    {num}
                  </div>
                  {/* Content */}
                  <div className="flex-1 pt-1 pb-2">
                    <p className="text-sm font-semibold text-gray-800 mb-1">{title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed mb-1.5">{detail}</p>
                    {badge && (
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: '#fff7ed', color: '#f97316' }}
                      >
                        {badge}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Section 3: Possible Outcomes ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-10">
          <h2 className="text-lg font-extrabold text-gray-900 mb-1">Possible Outcomes</h2>
          <p className="text-sm text-gray-500 mb-6">
            The admin determines the outcome based on the evidence provided by both parties.
          </p>

          <div className="space-y-3">
            {OUTCOMES.map(({ title, desc }) => (
              <div key={title} className="flex items-start gap-4 rounded-xl border border-gray-100 px-5 py-4">
                <svg
                  className="w-4 h-4 mt-0.5 shrink-0"
                  style={{ color: '#0f2044' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <div>
                  <p className="text-sm font-bold text-gray-800 mb-0.5">{title}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 4: Contact card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-10">
          <h2 className="text-lg font-extrabold text-gray-900 mb-1">Need to raise a dispute?</h2>
          <p className="text-sm text-gray-500 mb-6">
            Log in to your account and go to My Bookings, or contact our support team directly.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: '#0f2044' }}
            >
              Log in to raise a dispute
            </Link>
            <a
              href="mailto:support@shareconload.com"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-700 border border-gray-200 transition-colors hover:border-gray-300 hover:bg-gray-50"
            >
              support@shareconload.com
            </a>
          </div>
        </div>

        {/* ── Related links ── */}
        <div className="flex flex-col sm:flex-row gap-3 text-sm">
          <Link
            href="/cancellation"
            className="flex-1 flex items-center justify-between rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm hover:border-orange-200 transition-colors"
          >
            <div>
              <p className="font-semibold text-gray-800">Cancellation &amp; Refund Policy</p>
              <p className="text-xs text-gray-400 mt-0.5">Full refund eligibility rules</p>
            </div>
            <svg className="w-4 h-4 text-gray-400 shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="/payment-flow"
            className="flex-1 flex items-center justify-between rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm hover:border-orange-200 transition-colors"
          >
            <div>
              <p className="font-semibold text-gray-800">How Payments Work</p>
              <p className="text-xs text-gray-400 mt-0.5">End-to-end money flow and payout holds</p>
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
