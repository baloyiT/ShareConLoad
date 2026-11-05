'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { Menu, Package, Settings, X } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import RoleSwitcher from '@/components/RoleSwitcher';

const NAV_LINKS = [
  { href: '/directory', label: 'Find operators' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/for-operators', label: 'For operators' },
];

// Starts with / so the button also works from pages other than home.
const GET_QUOTES_HREF = '/#get-quotes';

function Wordmark() {
  return (
    <span className="font-heading text-lg font-bold tracking-tight text-[#081D3A]">
      Share<span className="text-[#FF6A00]">Con</span>Load
    </span>
  );
}

export default function PublicNav() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    async function resolveUser(u: User | null) {
      setUser(u);
      if (!u) {
        setIsAdmin(false);
        return;
      }
      // A user can hold several profile rows, so read them all.
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('user_id', u.id);
      if (error) console.error('Could not load profiles for navigation:', error);
      setIsAdmin(data?.some((p) => p.is_admin === true) ?? false);
    }

    supabase.auth.getUser().then(({ data }) => resolveUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.refresh();
  }

  const closeMenu = () => setMobileNavOpen(false);

  const userName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? '';
  const userInitials = user
    ? ((user.user_metadata?.full_name as string | undefined)
        ?.split(' ')
        .map((n: string) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() ??
      user.email?.[0]?.toUpperCase() ??
      '')
    : '';

  return (
    <>
      <nav aria-label="Main" className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image src="/logo1.png" alt="" width={36} height={36} className="h-8 w-auto" />
            <Wordmark />
          </Link>

          <div className="hidden lg:flex items-center gap-6 text-sm font-medium text-[#333B48]">
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className="hover:text-[#FF6A00] transition-colors whitespace-nowrap">
                {label}
              </Link>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {user ? (
              // The signed-in controls need more room than the visitor ones, so they wait for xl.
              <div className="hidden xl:flex items-center gap-3">
                <Link
                  href="/bookings"
                  className="flex items-center gap-1.5 text-sm font-semibold text-[#081D3A] hover:text-[#FF6A00] transition-colors whitespace-nowrap"
                >
                  <Package className="w-4 h-4" /> My Bookings
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-1.5 text-sm font-semibold text-[#081D3A] hover:text-[#FF6A00] transition-colors"
                  >
                    <Settings className="w-4 h-4" /> Admin
                  </Link>
                )}
                <RoleSwitcher currentRole="customer" />
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#081D3A] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {userInitials}
                  </div>
                  <span className="text-sm font-medium text-[#333B48] max-w-[130px] truncate">{userName}</span>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-sm font-medium text-[#6B7280] hover:text-[#081D3A] transition-colors whitespace-nowrap"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <Link
                href="/auth/login"
                className="hidden lg:block text-sm font-medium text-[#333B48] hover:text-[#FF6A00] transition-colors whitespace-nowrap"
              >
                Log in
              </Link>
            )}

            <Link
              href={GET_QUOTES_HREF}
              className="text-sm font-semibold text-white bg-[#FF6A00] px-3.5 py-2 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Get quotes
            </Link>

            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${user ? 'xl:hidden' : 'lg:hidden'}`}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5 text-[#333B48]" />
            </button>
          </div>
        </div>
      </nav>

      {mobileNavOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50 xl:hidden" onClick={closeMenu} />

          <aside className="fixed top-0 right-0 h-full w-72 max-w-full bg-white z-50 shadow-xl flex flex-col xl:hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
              <Wordmark />
              <button
                type="button"
                onClick={closeMenu}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>

            <div className="flex flex-col gap-1 px-3 py-4 flex-1 overflow-y-auto">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={closeMenu}
                  className="px-3 py-2.5 rounded-xl text-sm font-medium text-[#333B48] hover:bg-gray-50 transition-colors"
                >
                  {label}
                </Link>
              ))}

              {user && (
                <>
                  <div className="border-t border-[#E5E7EB] my-2" />
                  <Link
                    href="/bookings"
                    onClick={closeMenu}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#081D3A] hover:bg-gray-50 transition-colors"
                  >
                    <Package className="w-4 h-4" /> My Bookings
                  </Link>
                  <RoleSwitcher variant="flat" currentRole="customer" onNavigate={closeMenu} />
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={closeMenu}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#081D3A] hover:bg-gray-50 transition-colors"
                    >
                      <Settings className="w-4 h-4" /> Admin Dashboard
                    </Link>
                  )}
                </>
              )}
            </div>

            <div className="px-4 py-4 border-t border-[#E5E7EB]">
              {user ? (
                <button
                  type="button"
                  onClick={() => { closeMenu(); handleSignOut(); }}
                  className="w-full text-sm font-medium text-[#6B7280] px-4 py-2.5 rounded-xl border border-[#E5E7EB] hover:text-[#081D3A] transition-colors"
                >
                  Sign out
                </button>
              ) : (
                <Link
                  href="/auth/login"
                  onClick={closeMenu}
                  className="block w-full text-center text-sm font-medium text-[#333B48] px-4 py-2.5 rounded-xl border border-[#E5E7EB] hover:border-[#6B7280] transition-colors"
                >
                  Log in
                </Link>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}
