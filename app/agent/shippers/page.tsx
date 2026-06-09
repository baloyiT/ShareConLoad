'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/services/supabaseClient';

type ManagedShipper = {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  country: string | null;
  notes: string | null;
  created_at: string;
};

export default function AgentShippersPage() {
  const [shippers, setShippers] = useState<ManagedShipper[]>([]);
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

      const { data } = await supabase
        .from('agent_managed_shippers')
        .select('id, name, contact_email, contact_phone, country, notes, created_at')
        .eq('agent_profile_id', ap.id)
        .order('created_at', { ascending: false });

      setShippers(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

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
            <Link href="/agent/shippers" className="font-semibold" style={{ color: '#16a34a' }}>My Shippers</Link>
            <Link href="/agent/bookings" className="hover:text-gray-900 transition-colors">Bookings</Link>
          </div>
          <Link
            href="/agent/shippers/new"
            className="text-sm font-bold text-white px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#16a34a' }}
          >
            Add Shipper
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">My Shippers</h1>
            <p className="text-xs text-gray-400 mt-0.5">{shippers.length} shipper{shippers.length !== 1 ? 's' : ''} managed</p>
          </div>
          <Link
            href="/agent/shippers/new"
            className="px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#16a34a' }}
          >
            Add Shipper
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" style={{ color: '#16a34a' }} />
          </div>
        ) : shippers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <p className="text-gray-400 text-sm mb-4">No shippers added yet.</p>
            <Link href="/agent/shippers/new" className="text-sm font-bold text-green-600 hover:text-green-800">
              Add your first shipper
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {shippers.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-extrabold text-gray-900">{s.name}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      {s.contact_email && <p className="text-xs text-gray-400">{s.contact_email}</p>}
                      {s.contact_phone && <p className="text-xs text-gray-400">{s.contact_phone}</p>}
                      {s.country && <p className="text-xs text-gray-400">{s.country}</p>}
                    </div>
                    {s.notes && <p className="text-xs text-gray-400 mt-1 italic">{s.notes}</p>}
                  </div>
                  <Link
                    href={`/agent/bookings?shipper=${s.id}`}
                    className="text-xs font-semibold text-green-600 hover:text-green-800 shrink-0"
                  >
                    View Bookings
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
