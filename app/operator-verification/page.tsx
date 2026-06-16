import Link from 'next/link';
import Image from 'next/image';

import { ArrowLeft, ChevronRight } from 'lucide-react';
export const metadata = {
  title: 'Operator Verification, ShareConLoad',
  description: 'KYC documents and vetting process required for logistics providers on ShareConLoad.',
};

// ── Data ────────────────────────────────────────────────────────────────────

interface Step {
  num: number;
  title: string;
  detail: string;
}

interface DocDef {
  label: string;
  required: boolean;
  desc: string;
  purpose: string;
}

const STEPS: Step[] = [
  {
    num: 1,
    title: 'Register & onboard',
    detail:
      'Create an account, choose the Operator role, and complete the onboarding form (legal name, entity type, country, contact details).',
  },
  {
    num: 2,
    title: 'Submit KYC documents',
    detail:
      'Upload each required document through the operator compliance portal. Documents can be PDF, JPG, or PNG and must be under 10 MB each.',
  },
  {
    num: 3,
    title: 'Admin review',
    detail:
      'The ShareConLoad compliance team reviews each document individually, typically within 2 business days. Documents are approved or rejected, a reason is always provided for rejections.',
  },
  {
    num: 4,
    title: 'List and ship',
    detail:
      'Once all required documents are approved, the operator is marked as verified and can receive payouts. Listings can be created before KYC is complete, but payouts are withheld until full approval.',
  },
];

const DOCS: DocDef[] = [
  {
    label: 'Proof of Identity',
    required: true,
    desc: 'Valid passport or national ID of the company director or individual owner.',
    purpose: 'Identity verification, confirms the person behind the account.',
  },
  {
    label: 'Business Registration',
    required: true,
    desc: "Certificate of incorporation or registration from your country's business registry.",
    purpose: 'Entity verification, confirms the business is legally registered.',
  },
  {
    label: 'Proof of Warehouse Address',
    required: true,
    desc: 'Lease agreement, rates account, or utility bill confirming your warehouse or storage facility address.',
    purpose: 'Address verification, confirms a legitimate operational location.',
  },
  {
    label: 'Tax Clearance Certificate',
    required: true,
    desc: "Tax compliance certificate issued by your country's revenue authority.",
    purpose: 'Tax compliance, required for payout approval.',
  },
  {
    label: 'Banking Confirmation',
    required: true,
    desc: 'Official letter from your bank confirming your account number and details.',
    purpose: 'Account verification, required before any payout can be initiated via Paystack.',
  },
  {
    label: 'Cargo Insurance Certificate',
    required: true,
    desc: 'Valid cargo or freight insurance policy covering goods in your care, custody, and control.',
    purpose: 'Insurance verification, protects customers whose goods you carry.',
  },
  {
    label: 'Freight Forwarding License',
    required: false,
    desc: "Freight forwarding or customs broker license issued by your country's relevant authority.",
    purpose: 'Applicable where regulated by national law.',
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function OperatorVerificationPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm h-14 flex items-center px-6 sm:px-10 gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image src="/logo1.png" alt="" width={36} height={36} className="h-8 w-auto" />
          <span className="text-lg font-extrabold tracking-tight">
            <span style={{ color: '#0b103a' }}>Share</span>
            <span style={{ color: '#ff6a00' }}>Con</span>
            <span style={{ color: '#0b103a' }}>Load</span>
          </span>
        </Link>
        <div className="flex-1" />
        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Home
        </Link>
      </nav>

      {/* Hero */}
      <div className="py-10 px-4" style={{ background: 'linear-gradient(135deg, #0b103a 0%, #1a3a6b 100%)' }}>
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#ff6a00' }}>Transparency</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">Operator Verification</h1>
          <p className="text-gray-400 text-sm">
            Every logistics provider (operator) on ShareConLoad undergoes a mandatory identity and compliance check before receiving any payments.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* ── Section 1: Why We Verify Operators ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-10">
          <h2 className="text-lg font-extrabold text-gray-900 mb-4">Why We Verify Operators</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            ShareConLoad connects customers to independent freight operators who handle real goods across international borders. To protect customers and comply with financial regulations, every operator must pass a KYC (Know Your Customer) review before they can receive payouts. No payout is ever released to an operator whose documents have not been approved by our compliance team.
          </p>
        </div>

        {/* ── Section 2: Verification Process ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-10">
          <h2 className="text-lg font-extrabold text-gray-900 mb-1">Verification Process</h2>
          <p className="text-sm text-gray-500 mb-8">
            Four steps from registration to verified operator status.
          </p>

          <div className="relative">
            {/* Vertical connector line */}
            <div
              className="absolute left-5 top-6 bottom-6 w-0.5"
              style={{ backgroundColor: '#e5e7eb' }}
              aria-hidden="true"
            />

            <div>
              {STEPS.map(({ num, title, detail }) => (
                <div key={num} className="relative flex gap-5 pb-8 last:pb-0">
                  {/* Step circle */}
                  <div
                    className="relative z-10 flex items-center justify-center w-10 h-10 rounded-full shrink-0 text-sm font-extrabold text-white shadow-sm"
                    style={{ backgroundColor: '#0b103a' }}
                  >
                    {num}
                  </div>
                  {/* Content */}
                  <div className="flex-1 pt-1 pb-2">
                    <p className="text-sm font-semibold text-gray-800 mb-1">{title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Section 3: Required Documents ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-10">
          <h2 className="text-lg font-extrabold text-gray-900 mb-1">Required Documents</h2>
          <p className="text-sm text-gray-500 mb-6">
            All documents are reviewed and stored securely. Rejected documents can be re-uploaded with a corrected version.
          </p>

          <div className="space-y-3">
            {DOCS.map(({ label, required, desc, purpose }) => (
              <div key={label} className="rounded-xl border border-gray-100 px-5 py-4">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className="text-sm font-bold text-gray-800">{label}</span>
                  {required ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600">
                      Required
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                      Optional
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mb-1">{desc}</p>
                <p className="text-xs italic text-gray-400">{purpose}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Section 4: Payout Gate (amber callout) ── */}
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-5 py-5">
          <p className="text-sm font-semibold text-amber-800 mb-1">Payout gate</p>
          <p className="text-sm text-amber-700 leading-relaxed">
            Operators cannot receive any payment until all required documents are individually approved by the ShareConLoad compliance team. This check is enforced at the system level, payouts cannot be manually bypassed.{' '}
            See{' '}
            <Link href="/payment-flow" style={{ color: '#ff6a00' }} className="font-medium hover:underline">
              How Payments Work
            </Link>{' '}
            for the full payout eligibility conditions.
          </p>
        </div>

        {/* ── Related links ── */}
        <div className="flex flex-col sm:flex-row gap-3 text-sm">
          <Link
            href="/payment-flow"
            className="flex-1 flex items-center justify-between rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm hover:border-orange-200 transition-colors"
          >
            <div>
              <p className="font-semibold text-gray-800">Payment Flow</p>
              <p className="text-xs text-gray-400 mt-0.5">How money moves between customers and operators</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 ml-4" />
          </Link>
          <Link
            href="/dispute-resolution"
            className="flex-1 flex items-center justify-between rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm hover:border-orange-200 transition-colors"
          >
            <div>
              <p className="font-semibold text-gray-800">Dispute Resolution</p>
              <p className="text-xs text-gray-400 mt-0.5">How customer complaints are handled</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 ml-4" />
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400 mt-2 italic">Share the Load. Connect the World.</p>
      </div>
    </div>
  );
}
