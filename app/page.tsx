'use client';

import { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabaseClient';
import ContainerList from '@/components/ContainerList';
import { Container } from '@/components/ContainerCard';

const NAV_LINKS = [
  { label: 'Browse Containers', href: '#listings' },
  { label: 'How It Works',      href: '/how-it-works' },
  { label: 'For Operators',     href: '/operator' },
  { label: 'Pricing',           href: '#' },
  { label: 'About Us',          href: '#' },
];

const FEATURES = [
  {
    icon: '🔒',
    title: 'Secure Bookings',
    desc: 'Your booking and data are safe with us.',
  },
  {
    icon: '🕐',
    title: '24/7 Support',
    desc: 'We are here to help you with anything, anytime.',
  },
  {
    icon: '📋',
    title: 'Flexible Bookings',
    desc: 'Cancel or change your booking with ease.',
  },
  {
    icon: '💡',
    title: 'Transparent Pricing',
    desc: 'You always know exactly what you pay.',
  },
];

export default function HomePage() {
  const router = useRouter();

  const [user, setUser]           = useState<User | null>(null);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const [originFilter, setOriginFilter] = useState('');
  const [destinationFilter, setDestinationFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [searched, setSearched] = useState(false);

  // ── Auth state ─────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.refresh();
  }

  async function handleSwitchToOperator() {
    if (!user || switchingRole) return;
    setSwitchingRole(true);

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role_type', 'operator')
      .maybeSingle();

    setSwitchingRole(false);

    if (profile) {
      router.push('/operator');
    } else {
      router.push('/onboarding/operator');
    }
  }

  useEffect(() => {
    async function fetchContainers() {
      const { data, error } = await supabase
        .from('containers')
        .select('*')
        .eq('status', 'open')
        .order('departure_date', { ascending: true });

      if (error) {
        console.error('Failed to fetch containers:', error);
        setError('Could not load containers. Please try again later.');
      } else {
        setContainers(data as Container[]);
      }
      setLoading(false);
    }
    fetchContainers();
  }, []);

  const filteredContainers = useMemo(() => {
    if (!searched) return containers;
    return containers.filter((c) => {
      const originMatch =
        !originFilter ||
        c.origin_city.toLowerCase().includes(originFilter.toLowerCase()) ||
        c.origin_country.toLowerCase().includes(originFilter.toLowerCase());

      const destMatch =
        !destinationFilter ||
        c.destination_city.toLowerCase().includes(destinationFilter.toLowerCase()) ||
        c.destination_country.toLowerCase().includes(destinationFilter.toLowerCase());

      const dateMatch =
        !dateFilter || c.departure_date >= dateFilter;

      const priceMatch =
        !maxPrice || c.price_per_cbm <= parseFloat(maxPrice);

      return originMatch && destMatch && dateMatch && priceMatch;
    });
  }, [containers, originFilter, destinationFilter, dateFilter, maxPrice, searched]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearched(true);
  }

  function handleReset() {
    setOriginFilter('');
    setDestinationFilter('');
    setDateFilter('');
    setMaxPrice('');
    setSearched(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Image src="/logo_v4.png" alt="ShareConLoad" width={36} height={36} className="rounded-md" />
            <span className="text-xl font-bold" style={{ color: '#0f2044' }}>
              ShareConLoad
            </span>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            {NAV_LINKS.map(({ label, href }) => (
              <Link key={label} href={href} className="hover:text-gray-900 transition-colors">
                {label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* Switch to Operator */}
                <button
                  onClick={handleSwitchToOperator}
                  disabled={switchingRole}
                  className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-60"
                  style={{ backgroundColor: '#fff7ed', color: '#f97316', borderColor: '#fed7aa' }}
                >
                  {switchingRole ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <>🚢 Switch to Operator</>
                  )}
                </button>

                {/* Avatar + name */}
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: '#0f2044' }}
                  >
                    {(user.user_metadata?.full_name as string | undefined)
                      ?.split(' ')
                      .map((n: string) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase() ?? user.email?.[0]?.toUpperCase()}
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[140px] truncate">
                    {(user.user_metadata?.full_name as string | undefined) ?? user.email}
                  </span>
                </div>

                {/* Sign out */}
                <button
                  onClick={handleSignOut}
                  className="text-sm font-medium text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/auth/register"
                  className="text-sm font-semibold text-white px-4 py-1.5 rounded-lg transition-colors"
                  style={{ backgroundColor: '#f97316' }}
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="relative py-20 px-4"
        style={{
          background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 60%, #0f2044 100%)',
        }}
      >
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,0.5) 40px, rgba(255,255,255,0.5) 41px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.5) 40px, rgba(255,255,255,0.5) 41px)',
          }}
        />

        <div className="relative max-w-5xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-4">
            Ship Globally.{' '}
            <span style={{ color: '#f97316' }}>Save Together.</span>
          </h1>
          <p className="text-gray-300 text-lg mb-8 max-w-2xl mx-auto">
            Find shared container space on trusted routes worldwide and ship your goods affordably.
          </p>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm text-gray-300">
            {[
              { icon: '🌍', label: 'Global Reach', sub: '50+ countries & ports' },
              { icon: '✅', label: 'Trusted Operators', sub: 'Verified and reviewed' },
              { icon: '🛡️', label: 'Secure & Reliable', sub: 'Your cargo, protected' },
            ].map(({ icon, label, sub }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-2xl">{icon}</span>
                <div className="text-left">
                  <p className="font-semibold text-white text-xs">{label}</p>
                  <p className="text-gray-400 text-xs">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Search form */}
          <form
            onSubmit={handleSearch}
            className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 text-left"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Origin Country or City
                </label>
                <input
                  type="text"
                  placeholder="e.g. China, Shanghai"
                  value={originFilter}
                  onChange={(e) => setOriginFilter(e.target.value)}
                  className="input input-bordered w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Destination Country or City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Nigeria, Lagos"
                  value={destinationFilter}
                  onChange={(e) => setDestinationFilter(e.target.value)}
                  className="input input-bordered w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Departure Date
                </label>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="input input-bordered w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                  Max Price per CBM ($)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 200"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="input input-bordered w-full text-sm"
                  min={0}
                />
              </div>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              {searched && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-sm text-gray-400 hover:text-gray-600 underline"
                >
                  Clear filters
                </button>
              )}
              <button
                type="submit"
                className="ml-auto text-white font-semibold px-8 py-2.5 rounded-xl transition-colors text-sm"
                style={{ backgroundColor: '#0f2044' }}
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Container listing */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Available Containers</h2>
            {searched && !loading && (
              <p className="text-sm text-gray-400 mt-0.5">
                {filteredContainers.length} result{filteredContainers.length !== 1 ? 's' : ''} found
              </p>
            )}
          </div>
          <Link href="#" className="text-sm font-semibold hover:underline" style={{ color: '#f97316' }}>
            View all containers →
          </Link>
        </div>

        {loading && (
          <div className="flex justify-center py-24">
            <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
          </div>
        )}

        {error && (
          <div className="alert alert-error max-w-lg mx-auto">
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && <ContainerList containers={filteredContainers} />}
      </section>

      {/* Features */}
      <section className="border-t border-gray-100 bg-white py-14 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {FEATURES.map(({ icon, title, desc }) => (
            <div key={title} className="flex flex-col items-center gap-3">
              <span className="text-4xl">{icon}</span>
              <h3 className="font-bold text-gray-800">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-gray-400 border-t border-gray-100">
        © {new Date().getFullYear()} ShareConLoad. All rights reserved.
      </footer>
    </div>
  );
}
