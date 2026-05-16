'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';
import PageHero from '@/components/PageHero';

type WaitlistEntry = {
  id: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  country: string | null;
  business_type: string | null;
  role: string;
};

type RoleFilter = 'all' | 'operator' | 'consignor' | 'other';

const TABS: { key: RoleFilter; label: string }[] = [
  { key: 'all',       label: 'All'        },
  { key: 'operator',  label: 'Operators'  },
  { key: 'consignor', label: 'Consignors' },
  { key: 'other',     label: 'Other'      },
];

const ROLE_COLOURS: Record<string, string> = {
  operator:  '#f97316',
  consignor: '#3b82f6',
  other:     '#6b7280',
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminWaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [filter,  setFilter]  = useState<RoleFilter>('all');

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('waitlist_entries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Waitlist fetch error:', error);
        setError('Failed to load waitlist entries.');
      } else {
        setEntries(data as WaitlistEntry[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = filter === 'all' ? entries : entries.filter((e) => e.role === filter);

  const counts: Record<RoleFilter, number> = {
    all:       entries.length,
    operator:  entries.filter((e) => e.role === 'operator').length,
    consignor: entries.filter((e) => e.role === 'consignor').length,
    other:     entries.filter((e) => e.role === 'other').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 sm:px-10 flex items-center justify-between h-16">
          <Link
            href="/admin"
            className="text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors"
          >
            ← Admin
          </Link>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Waitlist</span>
        </div>
      </nav>

      <PageHero gradient label="Admin" title="Waitlist" description="Signups collected before launch." />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

        {error && (
          <div className="alert alert-error text-sm">{error}</div>
        )}

        {loading && (
          <div className="flex justify-center py-24">
            <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Role filter tabs */}
            <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 shadow-sm w-fit flex-wrap">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                    filter === tab.key ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                  style={filter === tab.key ? { backgroundColor: '#0f2044' } : {}}
                >
                  {tab.label}
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      filter === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {counts[tab.key]}
                  </span>
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-800">
                  {filter === 'all'
                    ? `All Signups (${entries.length})`
                    : `${TABS.find((t) => t.key === filter)?.label} (${filtered.length})`}
                </h2>
              </div>

              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <p className="text-gray-400 text-sm">No waitlist entries yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {['Name', 'Email', 'Role', 'Country', 'Business Type', 'Joined'].map((col) => (
                          <th
                            key={col}
                            className="py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-left"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((entry) => (
                        <tr key={entry.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="font-medium text-gray-800 text-sm">
                              {entry.first_name} {entry.last_name}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-sm text-gray-600">{entry.email}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className="badge badge-sm text-white font-semibold capitalize"
                              style={{ backgroundColor: ROLE_COLOURS[entry.role] ?? '#6b7280' }}
                            >
                              {entry.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-sm text-gray-600">{entry.country ?? '—'}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-sm text-gray-600">{entry.business_type ?? '—'}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-sm text-gray-500">{fmt(entry.created_at)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
