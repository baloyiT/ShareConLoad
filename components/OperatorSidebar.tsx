'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

type CompletionStatus = {
  profile:   boolean;
  contact:   boolean;
  account:   boolean;
  documents: boolean;
  agreement: boolean;
};

type OperatorInfo = {
  name: string;
  initials: string;
  completion: CompletionStatus;
};

function CheckIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#22c55e' }}>
        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  return (
    <span className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
  );
}

function NavItem({
  href,
  label,
  icon,
  badge,
  exact = false,
  onClick,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
  exact?: boolean;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const active   = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors relative"
      style={active
        ? { backgroundColor: '#f0f4ff', color: '#0f2044' }
        : { color: '#6b7280' }}
    >
      {icon && <span className="text-base leading-none shrink-0">{icon}</span>}
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-xs font-bold text-white px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: '#f97316' }}>
          {badge}
        </span>
      )}
    </Link>
  );
}

function ComplianceItem({
  href,
  label,
  done,
  onClick,
}: {
  href: string;
  label: string;
  done: boolean;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const active   = pathname === href || pathname.startsWith(href + '/');

  const color = active
    ? '#0f2044'
    : done
      ? '#16a34a'
      : '#6b7280';

  const bg = active ? '#f0f4ff' : done ? '#f0fdf4' : 'transparent';

  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
      style={{ color, backgroundColor: bg }}
    >
      <CheckIcon done={done} />
      <span className="flex-1 truncate">{label}</span>
      {done && !active && (
        <svg className="w-3 h-3 shrink-0" style={{ color: '#16a34a' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </Link>
  );
}

export default function OperatorSidebar({ onClose }: { onClose?: () => void }) {
  const [info, setInfo] = useState<OperatorInfo | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const name     = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? '';
      const initials = name.includes(' ')
        ? name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
        : (name[0]?.toUpperCase() ?? '');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role_type', 'operator')
        .single();

      if (!profile) { setInfo({ name, initials, completion: { profile: false, contact: false, account: false, documents: false, agreement: false } }); return; }

      const { data: op } = await supabase
        .from('operator_profiles')
        .select('id, legal_name, phone_number, paystack_recipient_code, service_agreement_signed_at')
        .eq('profile_id', profile.id)
        .single();

      const REQUIRED_DOCS = [
        'identity',
        'business_registration',
        'proof_of_warehouse_address',
        'tax_clearance',
        'banking_confirmation',
        'cargo_insurance',
      ] as const;

      let documentsComplete = false;
      if (op?.id) {
        const { data: docs } = await supabase
          .from('compliance_documents')
          .select('doc_type, status')
          .eq('operator_profile_id', op.id)
          .eq('status', 'approved');

        const approvedTypes = new Set((docs ?? []).map((d) => d.doc_type));
        documentsComplete = REQUIRED_DOCS.every((t) => approvedTypes.has(t));
      }

      setInfo({
        name,
        initials,
        completion: {
          profile:   !!op?.legal_name,
          contact:   !!op?.phone_number,
          account:   !!op?.paystack_recipient_code,
          documents: documentsComplete,
          agreement: !!op?.service_agreement_signed_at,
        },
      });
    }
    load();
  }, [pathname]);

  const complianceItems: { href: string; label: string; key: keyof CompletionStatus }[] = [
    { href: '/operator/compliance/profile',   label: 'Profile',           key: 'profile'   },
    { href: '/operator/compliance/contact',   label: 'Contact',           key: 'contact'   },
    { href: '/operator/bank',                 label: 'Account',           key: 'account'   },
    { href: '/operator/compliance/documents', label: 'Documents',         key: 'documents' },
    { href: '/operator/compliance/agreement', label: 'Service Agreement', key: 'agreement' },
  ];

  const totalDone = info
    ? Object.values(info.completion).filter(Boolean).length
    : 0;

  return (
    <div className="flex flex-col h-full">

      {/* Operator identity */}
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ backgroundColor: '#f97316' }}
          >
            {info?.initials ?? '…'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-800 truncate">{info?.name ?? '…'}</p>
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#fff7ed', color: '#f97316' }}>
              Operator
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-5">

        {/* Compliance */}
        <div>
          <div className="flex items-center justify-between px-3 mb-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Compliance</p>
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded-full"
              style={totalDone === 5
                ? { backgroundColor: '#dcfce7', color: '#16a34a' }
                : { backgroundColor: '#f3f4f6', color: '#6b7280' }}
            >
              {totalDone}/5
            </span>
          </div>
          {/* Progress bar */}
          <div className="mx-3 mb-3 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(totalDone / 5) * 100}%`,
                backgroundColor: totalDone === 5 ? '#22c55e' : '#f97316',
                minWidth: totalDone > 0 ? '8px' : '0',
              }}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            {complianceItems.map((item) => (
              <ComplianceItem
                key={item.href}
                href={item.href}
                label={item.label}
                done={info?.completion[item.key] ?? false}
                onClick={onClose}
              />
            ))}
          </div>
        </div>

        {/* Operations */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 px-3 mb-1.5">Operations</p>
          <div className="flex flex-col gap-0.5">
            <NavItem href="/operator" label="My Containers" icon="📦" exact onClick={onClose} />
            <NavItem href="/operator/create" label="Create Container" icon="➕" exact onClick={onClose} />
            <NavItem href="/operator/bookings" label="Manage Bookings" icon="📋" onClick={onClose} />
          </div>
        </div>

        {/* Finance */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 px-3 mb-1.5">Finance</p>
          <div className="flex flex-col gap-0.5">
            <NavItem href="/operator/payouts" label="Payout History" icon="💳" onClick={onClose} />
          </div>
        </div>

      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-100">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          onClick={onClose}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to marketplace
        </Link>
      </div>
    </div>
  );
}
