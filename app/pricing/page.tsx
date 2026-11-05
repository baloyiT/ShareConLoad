import Link from 'next/link';
import { Check } from 'lucide-react';
import PublicFooter from '@/components/PublicFooter';
import PublicNav from '@/components/PublicNav';

export const metadata = {
  title: 'Pricing, ShareConLoad',
  description: 'ShareConLoad is free for customers. Listings and founding-operator leads are free.',
};

const CUSTOMER_POINTS = [
  'Sending an enquiry costs nothing.',
  'Browsing the operator directory costs nothing.',
  'Comparing any quotes you receive costs nothing.',
  'You agree the price and terms directly with the operator you choose, and pay that operator directly.',
];

const OPERATOR_POINTS = [
  'Listing is free during our founding period.',
  'Leads during our founding period are free.',
  'We have not set a price for leads after the founding period.',
];

function Panel({ title, points }: { title: string; points: string[] }) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] p-6">
      <h2 className="text-xl font-bold text-[#081D3A]">{title}</h2>
      <ul className="mt-4 space-y-3">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm">
            <Check className="w-4 h-4 mt-0.5 shrink-0 text-[#FF6A00]" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white font-sans text-[#333B48]">
      <PublicNav />

      <main className="flex-1">
        <section className="bg-[#081D3A]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
            <p className="text-sm font-semibold text-[#FF6A00]">Freight. Connected.</p>
            <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-white">Pricing</h1>
            <p className="mt-4 text-base lg:text-lg text-[#D6DCE5]">
              Customers pay nothing to use ShareConLoad. Operators list for free.
            </p>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Panel title="For customers: free" points={CUSTOMER_POINTS} />
          <Panel title="For operators: free to start" points={OPERATOR_POINTS} />
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-12">
          <p className="text-sm text-[#6B7280]">
            ShareConLoad does not take payment for freight at this stage. Freight prices are set by
            the operators.{' '}
            <Link href="/contact" className="font-semibold text-[#FF6A00] hover:underline">
              Questions? Contact us.
            </Link>
          </p>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
