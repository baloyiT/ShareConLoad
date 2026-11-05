import Link from 'next/link';
import { ArrowRight, BadgeCheck, MapPin, Users } from 'lucide-react';
import PublicFooter from '@/components/PublicFooter';
import PublicNav from '@/components/PublicNav';
import { OPERATOR_SIGNUP_OPEN } from '@/services/releaseFlags';

export const metadata = {
  title: 'For Operators, ShareConLoad',
  description: 'List your freight services and routes. Listing is free during our founding period.',
};

const BENEFITS = [
  {
    icon: MapPin,
    title: 'Be found',
    desc: 'List the services you offer and the routes you cover in a public directory that customers can search without an account.',
  },
  {
    icon: Users,
    title: 'Receive customer leads',
    desc: 'We check customer enquiries and may match them to you when they fit your services and routes. We do not promise any volume of enquiries.',
  },
  {
    icon: BadgeCheck,
    title: 'Show what we checked',
    desc: 'Your profile shows the check you passed, Business verified or Identity verified.',
  },
];

export default function ForOperatorsPage() {
  const ctaClass =
    'inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#FF6A00] px-5 py-3 rounded-xl hover:opacity-90 transition-opacity';

  return (
    <div className="min-h-screen flex flex-col bg-white font-sans text-[#333B48]">
      <PublicNav />

      <main className="flex-1">
        <section className="bg-[#081D3A]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
            <p className="text-sm font-semibold text-[#FF6A00]">Freight. Connected.</p>
            <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-white">For freight operators</h1>
            <p className="mt-4 text-base lg:text-lg text-[#D6DCE5]">
              Show customers the services you offer and the routes you cover. Listing is free during our
              founding period.
            </p>
            <div className="mt-6">
              {OPERATOR_SIGNUP_OPEN ? (
                <Link href="/onboarding/operator" className={ctaClass}>
                  Sign up <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link href="/contact" className={ctaClass}>
                  Register your interest <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          <h2 className="text-2xl font-bold text-[#081D3A]">What you get</h2>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-8">
            {BENEFITS.map(({ icon: Icon, title, desc }) => (
              <div key={title}>
                <Icon className="w-6 h-6 text-[#FF6A00]" />
                <h3 className="mt-3 text-lg font-semibold text-[#081D3A]">{title}</h3>
                <p className="mt-1 text-sm text-[#6B7280]">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#F4F5F7]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-[#081D3A]">Free founding period</h2>
              <p className="mt-3">
                Listing in the directory is free, and so are leads during our founding period. We have
                not set a price for leads after that, and we will tell founding operators before
                anything changes.
              </p>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#081D3A]">How verification works</h2>
              <p className="mt-3">
                Companies upload an identity document and a business registration document and earn
                the Business verified label. Individuals upload an identity document and earn the
                Identity verified label. Neither label guarantees service quality.{' '}
                <Link href="/operator-verification" className="font-semibold text-[#FF6A00] hover:underline">
                  Read exactly what each label means.
                </Link>
              </p>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#081D3A]">Your responsibilities</h2>
              <p className="mt-3">
                Independent operators deliver the freight and are responsible for it. ShareConLoad
                connects you with customers and does not carry or handle freight.
              </p>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
