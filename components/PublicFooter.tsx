import Image from 'next/image';
import Link from 'next/link';
import { STAGE_3_PUBLIC } from '@/services/releaseFlags';

const COMPANY_LINKS = [
  { href: '/directory', label: 'Find operators' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/for-operators', label: 'For operators' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

const STAGE_3_LINKS = [
  { href: '/onboarding/operator', label: 'List your container' },
  { href: '/onboarding/agent', label: 'Become an agent' },
];

const LEGAL_LINKS = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/operator-verification', label: 'Operator verification' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
];

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-[#081D3A]">{title}</h2>
      {links.map(({ href, label }) => (
        <Link key={href} href={href} className="text-sm text-[#6B7280] hover:text-[#081D3A] transition-colors">
          {label}
        </Link>
      ))}
    </div>
  );
}

export default function PublicFooter() {
  const companyLinks = STAGE_3_PUBLIC ? [...COMPANY_LINKS, ...STAGE_3_LINKS] : COMPANY_LINKS;

  return (
    <footer className="bg-white border-t border-[#E5E7EB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
        <div className="flex flex-col gap-2">
          <Link href="/" className="flex items-center gap-2 w-fit">
            <Image src="/logo1.png" alt="" width={32} height={32} className="h-7 w-auto" />
            <span className="font-heading text-base font-bold tracking-tight text-[#081D3A]">
              Share<span className="text-[#FF6A00]">Con</span>Load
            </span>
          </Link>
          <p className="text-sm text-[#6B7280]">Freight. Connected.</p>
        </div>
        <FooterColumn title="ShareConLoad" links={companyLinks} />
        <FooterColumn title="Legal" links={LEGAL_LINKS} />
      </div>

      <div className="bg-[#F4F5F7] border-t border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col gap-1 text-sm text-[#6B7280]">
          <p>Independent operators deliver the freight and are responsible for it. ShareConLoad connects you.</p>
          <p className="text-xs">© {new Date().getFullYear()} ShareConLoad. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
