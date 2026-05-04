'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/services/supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

type Profile = {
  id: string;
  full_name: string | null;
  active_role: string;
  created_at: string;
};

type Container = {
  id: string;
  origin_city: string;
  origin_country: string;
  destination_city: string;
  destination_country: string;
  departure_date: string;
  total_capacity_cbm: number;
  available_capacity_cbm: number;
  price_per_cbm: number;
  status: string;
  operator_name: string | null;
  created_at: string;
};

type Booking = {
  id: string;
  customer_id: string;
  total_cbm: number;
  total_price: number;
  status: string;
  created_at: string;
  containers: {
    origin_city: string;
    destination_city: string;
  } | null;
};

type Tab = 'overview' | 'users' | 'containers' | 'bookings';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLOURS: Record<string, string> = {
  open:       '#22c55e',
  closed:     '#6b7280',
  in_transit: '#3b82f6',
  delivered:  '#8b5cf6',
  pending:    '#f59e0b',
  confirmed:  '#3b82f6',
  loaded:     '#8b5cf6',
  cancelled:  '#ef4444',
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function shortId(id: string) {
  return id.slice(0, 8) + '…';
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const [users,      setUsers]      = useState<Profile[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [bookings,   setBookings]   = useState<Booking[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    async function loadAll() {
      const [usersRes, containersRes, bookingsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('containers').select('*').order('created_at', { ascending: false }),
        supabase
          .from('bookings')
          .select('id, customer_id, total_cbm, total_price, status, created_at, containers(origin_city, destination_city)')
          .order('created_at', { ascending: false }),
      ]);

      const anyError = usersRes.error ?? containersRes.error ?? bookingsRes.error;
      if (anyError) {
        console.error('Admin data fetch error:', anyError);
        setError('Failed to load dashboard data. Check your Supabase connection.');
      } else {
        setUsers(usersRes.data as Profile[]);
        setContainers(containersRes.data as Container[]);
        setBookings(bookingsRes.data as Booking[]);
      }
      setLoading(false);
    }
    loadAll();
  }, []);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = {
    totalUsers:      users.length,
    customers:       users.filter((u) => u.active_role === 'customer').length,
    operators:       users.filter((u) => u.active_role === 'operator').length,
    totalContainers: containers.length,
    openContainers:  containers.filter((c) => c.status === 'open').length,
    totalBookings:   bookings.length,
    pendingBookings: bookings.filter((b) => b.status === 'pending').length,
    totalRevenue:    bookings
      .filter((b) => b.status !== 'cancelled')
      .reduce((s, b) => s + b.total_price, 0),
  };

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview',   label: 'Overview'   },
    { key: 'users',      label: 'Users',      count: stats.totalUsers      },
    { key: 'containers', label: 'Containers', count: stats.totalContainers },
    { key: 'bookings',   label: 'Bookings',   count: stats.totalBookings   },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 font-sans">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 sm:px-10 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo1.png" alt="" width={40} height={40} className="h-9 w-auto" />
            <span className="text-xl font-extrabold tracking-tight">
              <span style={{ color: '#0f2044' }}>Share</span><span style={{ color: '#f97316' }}>Con</span><span style={{ color: '#0f2044' }}>Load</span>
            </span>
          </Link>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Admin Dashboard
          </span>
        </div>
      </nav>

      {/* Header */}
      <div className="py-8 px-4" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}>
        <div className="max-w-7xl mx-auto">
          <p className="text-gray-400 text-sm mb-1">Admin</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">System Overview</h1>
          <p className="text-gray-400 text-sm mt-1">Platform data across all users, containers, and bookings.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

        {/* Error */}
        {error && (
          <div className="alert alert-error text-sm">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
            </svg>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-24">
            <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
          </div>
        )}

        {!loading && !error && (
          <>
            {/* ── Stat cards ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Total Users"      value={stats.totalUsers}                         />
              <StatCard label="Open Containers"  value={stats.openContainers}  highlight          />
              <StatCard label="Total Bookings"   value={stats.totalBookings}                      />
              <StatCard label="Platform Revenue" value={`$${stats.totalRevenue.toLocaleString()}`} highlight />
            </div>

            {/* ── Tabs ────────────────────────────────────────────────────── */}
            <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 shadow-sm w-fit flex-wrap">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                    activeTab === tab.key
                      ? 'text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  style={activeTab === tab.key ? { backgroundColor: '#0f2044' } : {}}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                        activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Overview tab ────────────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <BreakdownCard
                  title="Users"
                  rows={[
                    { label: 'Total',     value: stats.totalUsers   },
                    { label: 'Shippers',  value: stats.customers    },
                    { label: 'Operators', value: stats.operators    },
                  ]}
                  onView={() => setActiveTab('users')}
                />
                <BreakdownCard
                  title="Containers"
                  rows={[
                    { label: 'Total',     value: stats.totalContainers                                },
                    { label: 'Open',      value: stats.openContainers                                 },
                    { label: 'Closed',    value: containers.filter((c) => c.status === 'closed').length },
                    { label: 'In Transit',value: containers.filter((c) => c.status === 'in_transit').length },
                  ]}
                  onView={() => setActiveTab('containers')}
                />
                <BreakdownCard
                  title="Bookings"
                  rows={[
                    { label: 'Total',     value: stats.totalBookings                                      },
                    { label: 'Pending',   value: stats.pendingBookings                                    },
                    { label: 'Confirmed', value: bookings.filter((b) => b.status === 'confirmed').length  },
                    { label: 'Delivered', value: bookings.filter((b) => b.status === 'delivered').length  },
                    { label: 'Cancelled', value: bookings.filter((b) => b.status === 'cancelled').length  },
                  ]}
                  onView={() => setActiveTab('bookings')}
                />
              </div>
            )}

            {/* ── Users table ─────────────────────────────────────────────── */}
            {activeTab === 'users' && (
              <TableCard
                title="All Users"
                empty={users.length === 0}
                emptyMessage="No users registered yet."
              >
                <thead>
                  <Th cols={['User ID', 'Name', 'Role', 'Joined']} />
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <Td><span className="font-mono text-xs text-gray-400">{shortId(u.id)}</span></Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                            style={{ backgroundColor: '#0f2044' }}
                          >
                            {(u.full_name ?? '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-800 text-sm">
                            {u.full_name ?? <span className="text-gray-400 italic">No name</span>}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <span
                          className="badge badge-sm text-white font-semibold"
                          style={{ backgroundColor: u.active_role === 'operator' ? '#f97316' : '#0f2044' }}
                        >
                          {u.active_role}
                        </span>
                      </Td>
                      <Td><span className="text-gray-500 text-sm">{fmt(u.created_at)}</span></Td>
                    </tr>
                  ))}
                </tbody>
              </TableCard>
            )}

            {/* ── Containers table ─────────────────────────────────────────── */}
            {activeTab === 'containers' && (
              <TableCard
                title="All Containers"
                empty={containers.length === 0}
                emptyMessage="No containers created yet."
              >
                <thead>
                  <Th cols={['ID', 'Route', 'Departure', 'Capacity', 'Price / CBM', 'Status', '']} />
                </thead>
                <tbody>
                  {containers.map((c) => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <Td><span className="font-mono text-xs text-gray-400">{shortId(c.id)}</span></Td>
                      <Td>
                        <p className="font-semibold text-gray-800 text-sm">
                          {c.origin_city} → {c.destination_city}
                        </p>
                        <p className="text-xs text-gray-400">{c.origin_country} → {c.destination_country}</p>
                      </Td>
                      <Td><span className="text-sm text-gray-600">{fmt(c.departure_date)}</span></Td>
                      <Td>
                        <p className="text-sm text-gray-700">{c.available_capacity_cbm} / {c.total_capacity_cbm} CBM</p>
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${((c.total_capacity_cbm - c.available_capacity_cbm) / c.total_capacity_cbm) * 100}%`,
                              backgroundColor: '#f97316',
                            }}
                          />
                        </div>
                      </Td>
                      <Td>
                        <span className="font-semibold text-sm" style={{ color: '#f97316' }}>
                          ${c.price_per_cbm}
                        </span>
                      </Td>
                      <Td>
                        <StatusBadge status={c.status} />
                      </Td>
                      <Td>
                        <Link
                          href={`/container/${c.id}`}
                          className="btn btn-ghost btn-xs text-gray-400 hover:text-gray-700 rounded-lg"
                        >
                          View →
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableCard>
            )}

            {/* ── Bookings table ───────────────────────────────────────────── */}
            {activeTab === 'bookings' && (
              <TableCard
                title="All Bookings"
                empty={bookings.length === 0}
                emptyMessage="No bookings made yet."
              >
                <thead>
                  <Th cols={['Booking ID', 'Route', 'CBM', 'Total Price', 'Status', 'Date', '']} />
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <Td><span className="font-mono text-xs text-gray-400">{shortId(b.id)}</span></Td>
                      <Td>
                        {b.containers ? (
                          <span className="text-sm font-medium text-gray-700">
                            {b.containers.origin_city} → {b.containers.destination_city}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Container removed</span>
                        )}
                      </Td>
                      <Td><span className="text-sm text-gray-700">{b.total_cbm} CBM</span></Td>
                      <Td>
                        <span className="font-semibold text-sm" style={{ color: '#f97316' }}>
                          ${b.total_price.toFixed(2)}
                        </span>
                      </Td>
                      <Td><StatusBadge status={b.status} /></Td>
                      <Td><span className="text-sm text-gray-500">{fmt(b.created_at)}</span></Td>
                      <Td>
                        <Link
                          href={`/booking/track/${b.id}`}
                          className="btn btn-ghost btn-xs text-gray-400 hover:text-gray-700 rounded-lg"
                        >
                          Track →
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableCard>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p
        className="text-2xl font-extrabold"
        style={{ color: highlight ? '#f97316' : '#111827' }}
      >
        {value}
      </p>
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
  onView,
}: {
  title: string;
  rows: { label: string; value: number }[];
  onView: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
      <h3 className="font-bold text-gray-800">{title}</h3>
      <div className="flex flex-col gap-2">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-gray-500">{label}</span>
            <span className="font-semibold text-gray-800">{value}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onView}
        className="mt-auto text-xs font-semibold hover:underline text-left"
        style={{ color: '#f97316' }}
      >
        View all →
      </button>
    </div>
  );
}

function TableCard({
  title,
  empty,
  emptyMessage,
  children,
}: {
  title: string;
  empty: boolean;
  emptyMessage: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="font-bold text-gray-800">{title}</h2>
      </div>
      {empty ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-gray-400 text-sm">{emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table w-full">{children}</table>
        </div>
      )}
    </div>
  );
}

function Th({ cols }: { cols: string[] }) {
  return (
    <tr className="border-b border-gray-100 bg-gray-50">
      {cols.map((col) => (
        <th
          key={col}
          className="py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-left"
        >
          {col}
        </th>
      ))}
    </tr>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="py-3.5 px-4">{children}</td>;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className="badge badge-sm text-white font-semibold capitalize"
      style={{ backgroundColor: STATUS_COLOURS[status] ?? '#6b7280' }}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
