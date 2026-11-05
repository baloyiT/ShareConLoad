import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import PublicFooter from '@/components/PublicFooter';
import PublicNav from '@/components/PublicNav';

export const metadata = {
  title: 'How It Works, ShareConLoad',
  description: 'Describe what you need to move, and we match you with independent freight operators.',
};

const CUSTOMER_STEPS = [
  {
    title: 'Describe it',
    desc: 'Tell us what you need to move and where from and to. Approximate details are fine, and "not sure" is a valid answer.',
  },
  {
    title: 'We check and match',
    desc: 'Our team calls or WhatsApps you to understand the job, then matches you with up to three operators who fit.',
  },
  {
    title: 'Compare and choose',
    desc: "See the operators' quotes side by side. You choose who to work with and pay your chosen operator directly.",
  },
];

const OPERATOR_STEPS = [
  { title: 'Register', desc: 'Tell us about your business, the services you offer and the routes you cover.' },
  { title: 'Get verified', desc: 'Upload your documents. Once checked, your profile shows the check you passed.' },
  { title: 'Be found', desc: 'Appear in the directory, and receive customer leads that match your services and routes.' },
];

function Steps({ steps }: { steps: { title: string; desc: string }[] }) {
  return (
    <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-8">
      {steps.map(({ title, desc }, i) => (
        <div key={title}>
          <span className="font-heading text-xl font-bold text-[#FF6A00]">{i + 1}</span>
          <h3 className="mt-1 text-lg font-semibold text-[#081D3A]">{title}</h3>
          <p className="mt-1 text-sm text-[#6B7280]">{desc}</p>
        </div>
      ))}
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white font-sans text-[#333B48]">
      <PublicNav />

      <main className="flex-1">
        <section className="bg-[#081D3A]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
            <p className="text-sm font-semibold text-[#FF6A00]">Freight. Connected.</p>
            <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-white">How it works</h1>
            <p className="mt-4 text-base lg:text-lg text-[#D6DCE5]">
              You do not need to know freight terms. Describe what you need to move and we help from
              there.
            </p>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <h2 className="text-2xl font-bold text-[#081D3A]">If you need to move freight</h2>
          <Steps steps={CUSTOMER_STEPS} />
          <p className="mt-6 text-sm text-[#6B7280]">
            Independent operators deliver the freight and are responsible for it. ShareConLoad does
            not take payment for freight. Using ShareConLoad is free for customers.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-4">
            <Link
              href="/#get-quotes"
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#FF6A00] px-5 py-3 rounded-xl hover:opacity-90 transition-opacity"
            >
              Get quotes <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/directory"
              className="inline-flex items-center justify-center text-sm font-semibold text-[#081D3A] border border-[#081D3A] px-5 py-3 rounded-xl hover:bg-[#F4F5F7] transition-colors"
            >
              Browse operators
            </Link>
          </div>
        </section>

        <section className="bg-[#F4F5F7]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
            <h2 className="text-2xl font-bold text-[#081D3A]">If you are a freight operator</h2>
            <Steps steps={OPERATOR_STEPS} />
            <p className="mt-6 text-sm text-[#6B7280]">
              We do not promise any volume of enquiries. See{' '}
              <Link href="/for-operators" className="font-semibold text-[#FF6A00] hover:underline">
                For operators
              </Link>{' '}
              for details.
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
