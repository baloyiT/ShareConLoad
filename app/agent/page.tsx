'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';

type AgentProfile = {
  id: string;
  business_name: string;
  contact_person: string | null;
  country: string;
};

type BookingSummary = {
  id: string;
  total_cbm: number;
  total_price: number;
  status: string;
  created_at: string;
  managed_shipper_id: string | null;
  agent_managed_shippers: { name: string } | null;
  containers: {
    origin_city: string;
    origin_country: string;
    destination_city: string;
    destination_country: string;
    departure_date: string;
  } | null;
};

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending:    { bg: '#fff7ed', color: '#f97316', label: 'Pending' },
  confirmed:  { bg: '#eff6ff', color: '#3b82f6', label: 'Confirmed' },
  loaded:     { bg: '#f5f3ff', color: '#8b5cf6', label: 'Loaded' },
  in_transit: { bg: '#ecfeff', color: '#06b6d4', label: 'In Transit' },
  delivered:  { bg: '#f0fdf4', color: '#22c55e', label: 'Delivered' },
  cancelled:  { bg: '#f9fafb', color: '#6b7280', label: 'Cancelled' },
};

export default function AgentDashboard() {
  const router = useRouter();
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [shipperCount, setShipperCount] = useState(0);
  const [bookingCount, setBookingCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role_type', 'agent')
        .maybeSingle();

      if (!profile) { router.push('/onboarding/agent'); return; }

      const { data: ap } = await supabase
        .from('agent_profiles')
        .select('id, business_name, contact_person, country')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (!ap) { router.push('/onboarding/agent'); return; }
      setAgentProfile(ap);

      const [{ count: sCount }, { count: bCount }, { count: aCount }, { data: recentBookings }] = await Promise.all([
        supabase
          .from('agent_managed_shippers')
          .select('id', { count: 'exact', head: true })
          .eq('agent_profile_id', ap.id),
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('agent_profile_id', ap.id),
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('agent_profile_id', ap.id)
          .not('status', 'in', '("delivered","cancelled")'),
        supabase
          .from('bookings')
          .select('id, total_cbm, total_price, status, created_at, managed_shipper_id, agent_managed_shippers(name), containers(origin_city, origin_country, destination_city, destination_country, departure_date)')
          .eq('agent_profile_id', ap.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      setShipperCount(sCount ?? 0);
      setBookingCount(bCount ?? 0);
      setActiveCount(aCount ?? 0);
      setBookings((recentBookings as BookingSummary[]) ?? []);
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <span className="loading loading-spinner loading-lg" style={{ color: '#16a34a' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 sm:px-10 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo1.png" alt="ShareConLoad" width={40} height={40} className="h-9 w-auto" />
            <span className="text-xl font-extrabold tracking-tight">
              <span style={{ color: '#0f2044' }}>Share</span>
              <span style={{ color: '#f97316' }}>Con</span>
              <span style={{ color: '#0f2044' }}>Load</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-5 text-sm font-medium text-gray-600">
            <Link href="/agent" className="font-semibold" style={{ color: '#16a34a' }}>Dashboard</Link>
            <Link href="/agent/shippers" className="hover:text-gray-900 transition-colors">My Shippers</Link>
            <Link href="/agent/bookings" className="hover:text-gray-900 transition-colors">Bookings</Link>
            <Link href="/#listings" className="hover:text-gray-900 transition-colors">Browse Containers</Link>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/auth/login');
            }}
            className="text-sm font-medium text-gray-700 hover:text-gray-900 px-4 py-1.5 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </nav>

      <div className="py-8 px-6 sm:px-10" style={{ background: 'linear-gradient(135deg, #14532d 0%, #16a34a 100%)' }}>
        <div className="max-w-5xl mx-auto">
          <p className="text-green-200 text-xs font-bold uppercase tracking-widest mb-1">Agent Portal</p>
          <h1 className="text-2xl font-extrabold text-white">{agentProfile?.business_name}</h1>
          <p className="text-green-200 text-sm mt-1">{agentProfile?.country}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-8 space-y-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Managed Shippers', value: shipperCount, href: '/agent/shippers' },
            { label: 'Total Bookings', value: bookingCount, href: '/agent/bookings' },
            { label: 'Active Bookings', value: activeCount, href: '/agent/bookings' },
          ].map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-green-200 transition-colors"
            >
              <p className="text-2xl font-extrabold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/#listings"
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#16a34a' }}
          >
            Book Container Space
          </Link>
          <Link
            href="/agent/shippers/new"
            className="px-5 py-2.5 rounded-xl text-sm font-bold border border-gray-200 text-gray-700 hover:border-gray-400 transition-colors bg-white"
          >
            Add Shipper
          </Link>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-extrabold text-gray-900">Recent Bookings</h2>
            <Link href="/agent/bookings" className="text-xs font-semibold text-green-600 hover:text-green-800">View all</Link>
          </div>

          {bookings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <p className="text-gray-400 text-sm">No bookings yet. Browse containers to place your first booking.</p>
              <Link href="/#listings" className="inline-block mt-4 text-sm font-bold text-green-600 hover:text-green-800">
                Browse Containers
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {bookings.map((b) => {
                const style = STATUS_STYLES[b.status] ?? STATUS_STYLES.pending;
                const c = b.containers;
                return (
                  <Link
                    key={b.id}
                    href={`/booking/track/${b.id}`}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between hover:border-green-200 transition-colors"
                  >
                    <div>
                      {c && (
                        <p className="text-sm font-bold text-gray-900">
                          {c.origin_city}, {c.origin_country} to {c.destination_city}, {c.destination_country}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {b.agent_managed_shippers?.name ?? 'Direct booking'} · {b.total_cbm} CBM · ZAR {b.total_price.toLocaleString()}
                      </p>
                    </div>
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
                      style={{ backgroundColor: style.bg, color: style.color }}
                    >
                      {style.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
