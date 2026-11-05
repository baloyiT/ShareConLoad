import Link from 'next/link';
import { BadgeCheck, UserCheck } from 'lucide-react';
import PublicFooter from '@/components/PublicFooter';
import PublicNav from '@/components/PublicNav';

export const metadata = {
  title: 'Operator Verification, ShareConLoad',
  description: 'What Business verified and Identity verified each mean, and what they do not.',
};

const LABELS = [
  {
    icon: BadgeCheck,
    name: 'Business verified',
    who: 'For registered companies.',
    checked: [
      'The company has uploaded an identity document, and it has been approved.',
      'The company has uploaded its business registration document, and it has been approved.',
    ],
  },
  {
    icon: UserCheck,
    name: 'Identity verified',
    who: 'For individuals operating without a registered company.',
    checked: ['The individual has uploaded an identity document, and it has been approved.'],
  },
];

const NOT_CHECKED = [
  "The quality, speed or reliability of an operator's service.",
  'That an operator will win or complete any job.',
  'The price an operator quotes.',
];

export default function OperatorVerificationPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white font-sans text-[#333B48]">
      <PublicNav />

      <main className="flex-1">
        <section className="bg-[#081D3A]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
            <p className="text-sm font-semibold text-[#FF6A00]">Freight. Connected.</p>
            <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-white">Operator verification</h1>
            <p className="mt-4 text-base lg:text-lg text-[#D6DCE5]">
              Every operator in our directory shows the check they passed. Here is exactly what each
              label means.
            </p>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          {LABELS.map(({ icon: Icon, name, who, checked }) => (
            <div key={name} className="rounded-2xl border border-[#E5E7EB] p-6">
              <Icon className="w-6 h-6 text-[#FF6A00]" />
              <h2 className="mt-3 text-xl font-bold text-[#081D3A]">{name}</h2>
              <p className="mt-1 text-sm text-[#6B7280]">{who}</p>
              <p className="mt-4 text-sm font-semibold text-[#081D3A]">What it means</p>
              <ul className="mt-2 space-y-2 text-sm list-disc pl-5">
                {checked.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="bg-[#F4F5F7]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
            <h2 className="text-2xl font-bold text-[#081D3A]">What verification does not guarantee</h2>
            <p className="mt-3">
              Neither label guarantees the quality of an operator&apos;s service. They tell you what
              we checked, not how well the operator will perform. Please do your own checks before you
              choose an operator.
            </p>
            <p className="mt-4 text-sm font-semibold text-[#081D3A]">Verification does not cover</p>
            <ul className="mt-2 space-y-2 text-sm list-disc pl-5">
              {NOT_CHECKED.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-[#6B7280]">
              Questions?{' '}
              <Link href="/contact" className="font-semibold text-[#FF6A00] hover:underline">
                Contact us.
              </Link>
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
