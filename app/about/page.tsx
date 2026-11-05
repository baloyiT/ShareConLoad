import Link from 'next/link';
import { ArrowRight, Handshake, Search, ShieldCheck } from 'lucide-react';
import PublicFooter from '@/components/PublicFooter';
import PublicNav from '@/components/PublicNav';

export const metadata = {
  title: 'About, ShareConLoad',
  description:
    'ShareConLoad connects customers who need to move freight with independent freight operators.',
};

const POINTS = [
  {
    icon: Search,
    title: 'Easier to start',
    desc: 'You should not need to know freight terms to ask for help. Describe what you need to move in your own words and we take it from there.',
  },
  {
    icon: Handshake,
    title: 'We connect, operators deliver',
    desc: 'Independent operators carry the freight and are responsible for it. ShareConLoad introduces you and does not handle your goods or your freight payments.',
  },
  {
    icon: ShieldCheck,
    title: 'Clear about what we check',
    desc: 'Operators in our directory show exactly which check they passed. We explain what each check means and what it does not.',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white font-sans text-[#333B48]">
      <PublicNav />

      <main className="flex-1">
        <section className="bg-[#081D3A]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
            <p className="text-sm font-semibold text-[#FF6A00]">Freight. Connected.</p>
            <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-white">About ShareConLoad</h1>
            <p className="mt-4 text-base lg:text-lg text-[#D6DCE5]">
              ShareConLoad connects people who need to move freight with independent freight operators,
              by sea, air, road or rail.
            </p>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <h2 className="text-2xl font-bold text-[#081D3A]">What we do</h2>
          <p className="mt-3">
            Finding the right freight operator is hard when you are new to shipping. Customers tell us
            what they need to move. We check the details, then match them with operators who offer
            that service and cover that route. Compare any quotes you receive and choose who to work
            with.
          </p>
          <p className="mt-3">
            Using ShareConLoad is free for customers. You agree terms and payment directly with the
            operator you choose.
          </p>
        </section>

        <section className="bg-[#F4F5F7]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 sm:grid-cols-3 gap-8">
            {POINTS.map(({ icon: Icon, title, desc }) => (
              <div key={title}>
                <Icon className="w-6 h-6 text-[#FF6A00]" />
                <h3 className="mt-3 text-lg font-semibold text-[#081D3A]">{title}</h3>
                <p className="mt-1 text-sm text-[#6B7280]">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 flex flex-col sm:flex-row gap-4">
          <Link
            href="/directory"
            className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#FF6A00] px-5 py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Find operators <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/for-operators"
            className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-[#081D3A] border border-[#081D3A] px-5 py-3 rounded-xl hover:bg-[#F4F5F7] transition-colors"
          >
            For operators
          </Link>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
