'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/services/supabaseClient';

type Booking = {
  id: string;
  total_cbm: number;
  total_price: number;
  status: string;
  created_at: string;
  managed_shipper_id: string | null;
  shipper_name: string | null;
  origin_city: string | null;
  origin_country: string | null;
  destination_city: string | null;
  destination_country: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'badge-warning',
  confirmed: 'badge-info',
  loaded: 'badge-primary',
  in_transit: 'badge-secondary',
  delivered: 'badge-success',
  cancelled: 'badge-error',
};

function AgentBookingsContent() {
  const searchParams = useSearchParams();
  const shipperFilter = searchParams.get('shipper');

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [shipperName, setShipperName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role_type', 'agent')
        .maybeSingle();

      if (!profile) return;

      const { data: ap } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (!ap) return;

      let query = supabase
        .from('bookings')
        .select(`
          id, total_cbm, total_price, status, created_at, managed_shipper_id,
          agent_managed_shippers(name),
          containers(origin_city, origin_country, destination_city, destination_country)
        `)
        .eq('agent_profile_id', ap.id)
        .order('created_at', { ascending: false });

      if (shipperFilter) {
        query = query.eq('managed_shipper_id', shipperFilter);
        const { data: s } = await supabase
          .from('agent_managed_shippers')
          .select('name')
          .eq('id', shipperFilter)
          .maybeSingle();
        if (s) setShipperName(s.name);
      }

      const { data } = await query;

      const mapped: Booking[] = (data ?? []).map((b: any) => ({
        id: b.id,
        total_cbm: b.total_cbm,
        total_price: b.total_price,
        status: b.status,
        created_at: b.created_at,
        managed_shipper_id: b.managed_shipper_id,
        shipper_name: b.agent_managed_shippers?.name ?? null,
        origin_city: b.containers?.origin_city ?? null,
        origin_country: b.containers?.origin_country ?? null,
        destination_city: b.containers?.destination_city ?? null,
        destination_country: b.containers?.destination_country ?? null,
      }));

      setBookings(mapped);
      setLoading(false);
    }
    load();
  }, [shipperFilter]);

  return (
    <div className="max-w-4xl mx-auto px-6 sm:px-10 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Bookings</h1>
          {shipperName ? (
            <p className="text-xs text-gray-400 mt-0.5">Showing bookings for <span className="font-semibold text-gray-600">{shipperName}</span></p>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">{bookings.length} booking{bookings.length !== 1 ? 's' : ''} facilitated</p>
          )}
        </div>
        <Link
          href="/"
          className="px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#16a34a' }}
        >
          Book Space
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg" style={{ color: '#16a34a' }} />
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm mb-4">No bookings yet.</p>
          <Link href="/" className="text-sm font-bold text-green-600 hover:text-green-800">
            Browse available containers
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {bookings.map((b) => (
            <div key={b.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  {b.shipper_name && (
                    <p className="text-xs font-semibold text-green-700 mb-0.5">{b.shipper_name}</p>
                  )}
                  <p className="text-sm font-extrabold text-gray-900">
                    {b.origin_city ?? '?'}, {b.origin_country ?? '?'} &rarr; {b.destination_city ?? '?'}, {b.destination_country ?? '?'}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                    <p className="text-xs text-gray-400">{b.total_cbm} CBM</p>
                    <p className="text-xs text-gray-400">R{b.total_price.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{new Date(b.created_at).toLocaleDateString('en-ZA')}</p>
                  </div>
                </div>
                <span className={`badge ${STATUS_COLORS[b.status] ?? 'badge-neutral'} badge-sm shrink-0 mt-0.5`}>
                  {b.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgentBookingsPage() {
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
            <Link href="/agent" className="hover:text-gray-900 transition-colors">Dashboard</Link>
            <Link href="/agent/shippers" className="hover:text-gray-900 transition-colors">My Shippers</Link>
            <Link href="/agent/bookings" className="font-semibold" style={{ color: '#16a34a' }}>Bookings</Link>
          </div>
        </div>
      </nav>

      <Suspense fallback={
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg" style={{ color: '#16a34a' }} />
        </div>
      }>
        <AgentBookingsContent />
      </Suspense>
    </div>
  );
}
