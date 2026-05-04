'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingRow = {
  id: string;
  total_cbm: number;
  total_price: number;
  status: string;
  created_at: string;
  containers: {
    origin_city: string;
    origin_country: string;
    destination_city: string;
    destination_country: string;
    departure_date: string;
    arrival_date: string | null;
  } | null;
};

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'loaded' | 'in_transit' | 'delivered' | 'cancelled';

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending:    { label: 'Pending',    color: '#f97316', bg: '#fff7ed', dot: '#f97316' },
  confirmed:  { label: 'Confirmed',  color: '#3b82f6', bg: '#eff6ff', dot: '#3b82f6' },
  loaded:     { label: 'Loaded',     color: '#8b5cf6', bg: '#f5f3ff', dot: '#8b5cf6' },
  in_transit: { label: 'In Transit', color: '#06b6d4', bg: '#ecfeff', dot: '#06b6d4' },
  delivered:  { label: 'Delivered',  color: '#22c55e', bg: '#f0fdf4', dot: '#22c55e' },
  cancelled:  { label: 'Cancelled',  color: '#6b7280', bg: '#f9fafb', dot: '#9ca3af' },
};

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all',        label: 'All'        },
  { value: 'pending',    label: 'Pending'    },
  { value: 'confirmed',  label: 'Confirmed'  },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered',  label: 'Delivered'  },
  { value: 'cancelled',  label: 'Cancelled'  },
];

const STEPS = ['pending', 'confirmed', 'loaded', 'in_transit', 'delivered'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function shortId(id: string) { return id.slice(0, 8).toUpperCase(); }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyBookingsPage() {
  const router = useRouter();

  const [bookings, setBookings]           = useState<BookingRow[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>('all');
  const [userName, setUserName]           = useState('');
  const [userInitials, setUserInitials]   = useState('');

  useEffect(() => {
    async function fetchBookings() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/login?next=/bookings'); return; }

      const name = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? '';
      setUserName(name);
      setUserInitials(
        name.includes(' ')
          ? name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
          : name[0]?.toUpperCase() ?? '',
      );

      const { data, error } = await supabase
        .from('bookings')
        .select(`id, total_cbm, total_price, status, created_at,
          containers(origin_city, origin_country, destination_city, destination_country, departure_date, arrival_date)`)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        setError('Could not load your bookings. Please try again.');
      } else {
        setBookings(data as unknown as BookingRow[]);
      }
      setLoading(false);
    }
    fetchBookings();
  }, [router]);

  const filtered = statusFilter === 'all' ? bookings : bookings.filter((b) => b.status === statusFilter);

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 sm:px-10 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo1.png" alt="" width={40} height={40} className="h-9 w-auto" />
            <span className="text-xl font-extrabold tracking-tight">
              <span style={{ color: '#0f2044' }}>Share</span><span style={{ color: '#f97316' }}>Con</span><span style={{ color: '#0f2044' }}>Load</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {userName && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: '#0f2044' }}>
                  {userInitials}
                </div>
                <div className="hidden sm:flex flex-col leading-tight">
                  <span className="text-sm font-medium text-gray-700 max-w-[130px] truncate">{userName}</span>
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full w-fit mt-0.5" style={{ backgroundColor: '#e8eef8', color: '#0f2044' }}>
                    👤 Shipper
                  </span>
                </div>
              </div>
            )}
            <Link href="/" className="text-sm font-medium text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
              ← Home
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero header ── */}
      <div className="relative overflow-hidden py-10 px-4" style={{ backgroundColor: '#0f2044' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ mixBlendMode: 'screen', opacity: 0.15 }}>
          <Image src="/world-map-overlay.png" alt="" fill className="object-cover" />
        </div>
        <div className="relative max-w-6xl mx-auto z-10">
          <p className="text-gray-400 text-sm mb-1 font-medium">Shipper Portal</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">My Bookings</h1>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Status filter tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {STATUS_TABS.map(({ value, label }) => {
            const count = value === 'all' ? bookings.length : bookings.filter((b) => b.status === value).length;
            const active = statusFilter === value;
            return (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border"
                style={active
                  ? { backgroundColor: '#0f2044', color: '#fff', borderColor: '#0f2044' }
                  : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}
              >
                {label}
                {count > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                    style={active
                      ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }
                      : { backgroundColor: '#f3f4f6', color: '#374151' }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading && <div className="flex justify-center py-24"><span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} /></div>}
        {error   && <div className="alert alert-error text-sm max-w-lg mx-auto"><span>{error}</span></div>}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-2xl border border-gray-100">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4" style={{ backgroundColor: '#fff7ed' }}>📦</div>
            <h2 className="text-xl font-bold text-gray-700 mb-2">
              {statusFilter === 'all' ? 'No bookings yet' : `No ${STATUS_CONFIG[statusFilter]?.label ?? statusFilter} bookings`}
            </h2>
            <p className="text-gray-400 text-sm mb-6 max-w-xs">
              {statusFilter === 'all' ? 'Browse available containers and make your first booking.' : 'Try a different filter to see your other bookings.'}
            </p>
            {statusFilter === 'all' && (
              <Link href="/#listings" className="btn text-white font-bold rounded-xl hover:opacity-90" style={{ backgroundColor: '#f97316' }}>
                Browse Containers
              </Link>
            )}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="flex flex-col gap-4">
            {filtered.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── BookingCard ──────────────────────────────────────────────────────────────

function BookingCard({ booking }: { booking: BookingRow }) {
  const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;
  const c   = booking.containers;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="h-1 w-full" style={{ backgroundColor: cfg.color }} />
      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            {c ? (
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-lg font-extrabold text-gray-900">{c.origin_city}</span>
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#f97316' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <span className="text-lg font-extrabold text-gray-900">{c.destination_city}</span>
              </div>
            ) : (
              <p className="text-lg font-bold text-gray-400 mb-1">Route unavailable</p>
            )}
            {c && <p className="text-xs text-gray-400 mb-3">{c.origin_country} → {c.destination_country}</p>}
            <div className="flex flex-wrap gap-2">
              {c && <Chip label={`Departs ${fmt(c.departure_date)}`} />}
              <Chip label={`${booking.total_cbm} CBM`} />
              <Chip label={`$${booking.total_price.toFixed(2)}`} />
              <Chip label={`Booked ${fmt(booking.created_at)}`} muted />
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end gap-3 shrink-0">
            <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
              {cfg.label}
            </span>
            <span className="text-xs text-gray-400 font-mono">#{shortId(booking.id)}</span>
            <Link href={`/booking/track/${booking.id}`} className="btn btn-sm text-white font-semibold rounded-lg hover:opacity-90 text-xs" style={{ backgroundColor: '#0f2044' }}>
              View Details →
            </Link>
          </div>
        </div>

        {booking.status !== 'cancelled' && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <StatusProgress status={booking.status} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── StatusProgress ───────────────────────────────────────────────────────────

function StatusProgress({ status }: { status: string }) {
  const current = STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const done   = i < current;
        const active = i === current;
        const cfg    = STATUS_CONFIG[step];
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full border-2 transition-colors"
                style={done || active
                  ? { backgroundColor: cfg.color, borderColor: cfg.color }
                  : { backgroundColor: '#fff', borderColor: '#d1d5db' }} />
              <span className="text-xs hidden sm:block whitespace-nowrap"
                style={{ color: done || active ? cfg.color : '#9ca3af', fontWeight: active ? 700 : 400 }}>
                {cfg.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-0.5 mx-1 mb-3"
                style={{ backgroundColor: done ? STATUS_CONFIG[STEPS[i]].color : '#e5e7eb' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium ${muted ? 'text-gray-400 bg-gray-50' : 'text-gray-600 bg-gray-100'}`}>
      {label}
    </span>
  );
}
