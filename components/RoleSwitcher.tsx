'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

import { Check, ChevronDown, Handshake, Package, Settings, Ship, type LucideIcon } from 'lucide-react';
type RoleKey = 'customer' | 'operator' | 'agent' | 'admin';

type RoleConfig = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const ROLES: Record<RoleKey, RoleConfig> = {
  customer: { label: 'Shipper Portal',  href: '/bookings', icon: Package },
  operator: { label: 'Operator Portal', href: '/operator', icon: Ship },
  agent:    { label: 'Agent Portal',    href: '/agent',    icon: Handshake },
  admin:    { label: 'Admin',           href: '/admin',    icon: Settings },
};

type Props = {
  currentRole?: RoleKey;
  variant?: 'dropdown' | 'flat';
  onNavigate?: () => void;
};

export default function RoleSwitcher({ currentRole = 'customer', variant = 'dropdown', onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<RoleKey[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('role_type, is_admin')
        .eq('user_id', user.id);

      if (!data) return;

      const found = new Set<RoleKey>(['customer']);
      data.forEach((p) => {
        if (p.role_type === 'operator') found.add('operator');
        if (p.role_type === 'agent') found.add('agent');
        if (p.is_admin) found.add('admin');
      });

      setAvailableRoles([...found]);
    }
    load();
  }, []);

  useEffect(() => {
    if (variant !== 'dropdown') return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [variant]);

  const ALL_REGISTERABLE: RoleKey[] = ['customer', 'operator', 'agent'];
  const canAddRole = ALL_REGISTERABLE.some((r) => !availableRoles.includes(r));

  if (availableRoles.length <= 1 && !canAddRole) return null;

  const otherRoles = availableRoles.filter((r) => r !== currentRole);

  if (variant === 'flat') {
    return (
      <>
        {otherRoles.map((role) => {
          const cfg = ROLES[role];
          const Icon = cfg.icon;
          return (
            <Link
              key={role}
              href={cfg.href}
              onClick={onNavigate}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Icon className="w-4 h-4" /> Switch to {cfg.label}
            </Link>
          );
        })}
        {canAddRole && (
          <Link
            href="/onboarding"
            onClick={onNavigate}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
          >
            ＋ Add a role
          </Link>
        )}
      </>
    );
  }

  const activeCfg = ROLES[currentRole];
  const ActiveIcon = activeCfg.icon;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-700"
      >
        <ActiveIcon className="w-4 h-4" />
        <span className="hidden sm:inline max-w-[110px] truncate">{activeCfg.label}</span>
        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl border border-gray-100 shadow-lg z-50 py-1 overflow-hidden">
          <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Switch Role
          </p>
          {availableRoles.map((role) => {
            const cfg = ROLES[role];
            const Icon = cfg.icon;
            const isActive = role === currentRole;
            return (
              <Link
                key={role}
                href={cfg.href}
                onClick={() => { setOpen(false); onNavigate?.(); }}
                className={`flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-gray-50 font-semibold text-gray-900'
                    : 'font-medium text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{cfg.label}</span>
                {isActive && (
                  <Check className="w-3.5 h-3.5 ml-auto text-gray-400 shrink-0" strokeWidth={2.5} />
                )}
              </Link>
            );
          })}
          {canAddRole && (
            <>
              <div className="border-t border-gray-100 my-1" />
              <Link
                href="/onboarding"
                onClick={() => { setOpen(false); onNavigate?.(); }}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <span className="text-gray-400">＋</span>
                <span>Add a role</span>
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
