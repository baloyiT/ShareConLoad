'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

import { ArrowLeft, Check, ClipboardList, Clock, CreditCard, Package, Plus } from 'lucide-react';
import { NEW_OPERATOR_STEPS, loadOperatorProgress, type OperatorProgress } from '@/services/operatorSteps';

type OperatorInfo = {
  name: string;
  initials: string;
  established: boolean;
  steps: OperatorProgress['steps'];
};

function CheckIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#22c55e' }}>
        <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
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
        ? { backgroundColor: '#f0f4ff', color: '#0b103a' }
        : { color: '#6b7280' }}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="text-xs font-bold text-white px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: '#ff6a00' }}>
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
  notOpen,
  onClick,
}: {
  href: string;
  label: string;
  done: boolean;
  notOpen: boolean;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const active   = pathname === href || pathname.startsWith(href + '/');

  const color = done
    ? '#16a34a'
    : active
      ? '#0b103a'
      : '#6b7280';

  const bg = done ? '#f0fdf4' : active ? '#f0f4ff' : 'transparent';

  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
      style={{ color, backgroundColor: bg }}
    >
      {notOpen ? <Clock className="w-4 h-4 shrink-0 text-gray-400" /> : <CheckIcon done={done} />}
      <span className="flex-1 min-w-0">
        <span className="block truncate">{label}</span>
        {notOpen && <span className="block text-xs font-normal text-gray-400">Not open yet</span>}
      </span>
      {done && (
        <Check className="w-3 h-3 shrink-0" style={{ color: '#16a34a' }} strokeWidth={2.5} />
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

      const { established, steps } = await loadOperatorProgress(user.id);
      setInfo({ name, initials, established, steps });
    }
    load();
  }, [pathname]);

  // Until we know, show the new-operator steps with nothing done: never a Stage 3 link.
  const steps = info?.steps ?? NEW_OPERATOR_STEPS.map((step) => ({ ...step, done: false, notOpen: false }));
  const totalSteps = steps.length;
  const totalDone = steps.filter((step) => step.done).length;

  return (
    <div className="flex flex-col h-full">

      {/* Operator identity */}
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ backgroundColor: '#ff6a00' }}
          >
            {info?.initials ?? '…'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-800 truncate">{info?.name ?? '…'}</p>
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#fff7ed', color: '#ff6a00' }}>
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
              style={totalDone === totalSteps
                ? { backgroundColor: '#dcfce7', color: '#16a34a' }
                : { backgroundColor: '#f3f4f6', color: '#6b7280' }}
            >
              {totalDone}/{totalSteps}
            </span>
          </div>
          {/* Progress bar */}
          <div className="mx-3 mb-3 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(totalDone / totalSteps) * 100}%`,
                backgroundColor: totalDone === totalSteps ? '#22c55e' : '#ff6a00',
                minWidth: totalDone > 0 ? '8px' : '0',
              }}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            {steps.map((step) => (
              <ComplianceItem
                key={step.href}
                href={step.href}
                label={step.label}
                done={step.done}
                notOpen={step.notOpen}
                onClick={onClose}
              />
            ))}
          </div>
        </div>

        {/* Stage 3: only for operators who already have containers */}
        {info?.established && (
          <>
            {/* Operations */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 px-3 mb-1.5">Operations</p>
              <div className="flex flex-col gap-0.5">
                <NavItem href="/operator" label="My Containers" icon={<Package className="w-4 h-4" />} exact onClick={onClose} />
                <NavItem href="/operator/create" label="Create Container" icon={<Plus className="w-4 h-4" />} exact onClick={onClose} />
                <NavItem href="/operator/bookings" label="Manage Bookings" icon={<ClipboardList className="w-4 h-4" />} onClick={onClose} />
              </div>
            </div>

            {/* Finance */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 px-3 mb-1.5">Finance</p>
              <div className="flex flex-col gap-0.5">
                <NavItem href="/operator/payouts" label="Payout History" icon={<CreditCard className="w-4 h-4" />} onClick={onClose} />
              </div>
            </div>
          </>
        )}

      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-100">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          onClick={onClose}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to home
        </Link>
      </div>
    </div>
  );
}
