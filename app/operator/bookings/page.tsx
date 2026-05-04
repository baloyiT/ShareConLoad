'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';
import { notify } from '@/services/notificationService';

// ─── Types ────────────────────────────────────────────────────────────────────

type ContainerInfo = {
  id: string;
  origin_city: string;
  origin_country: string;
  destination_city: string;
  destination_country: string;
  departure_date: string;
};

type OperatorBooking = {
  id: string;
  container_id: string;
  customer_id: string;
  total_cbm: number;
  total_price: number;
  status: string;
  created_at: string;
  container: ContainerInfo | null;
};

type PendingAction = {
  booking: OperatorBooking;
  newStatus: string;
};

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'loaded' | 'in_transit' | 'delivered' | 'cancelled';

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Pending',    color: '#f97316', bg: '#fff7ed' },
  confirmed:  { label: 'Confirmed',  color: '#3b82f6', bg: '#eff6ff' },
  loaded:     { label: 'Loaded',     color: '#8b5cf6', bg: '#f5f3ff' },
  in_transit: { label: 'In Transit', color: '#06b6d4', bg: '#ecfeff' },
  delivered:  { label: 'Delivered',  color: '#22c55e', bg: '#f0fdf4' },
  cancelled:  { label: 'Cancelled',  color: '#6b7280', bg: '#f9fafb' },
};

// next valid status for each current status
const NEXT_STATUS: Record<string, string | null> = {
  pending:    'confirmed',
  confirmed:  'loaded',
  loaded:     'in_transit',
  in_transit: 'delivered',
  delivered:  null,
  cancelled:  null,
};

// what the action button says (keyed by TARGET status)
const ACTION_CONFIG: Record<string, { label: string; icon: string; color: string; description: string }> = {
  confirmed:  {
    label:       'Confirm Booking',
    icon:        '✅',
    color:       '#3b82f6',
    description: 'Accept this booking and notify the customer.',
  },
  loaded: {
    label:       'Mark as Loaded',
    icon:        '📦',
    color:       '#8b5cf6',
    description: 'Confirm that goods have been loaded into the container.',
  },
  in_transit: {
    label:       'Mark In Transit',
    icon:        '🚢',
    color:       '#06b6d4',
    description: 'The container has departed and is on its way.',
  },
  delivered: {
    label:       'Mark Delivered',
    icon:        '✔️',
    color:       '#22c55e',
    description: 'Confirm that goods have arrived at the destination.',
  },
};

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all',        label: 'All'        },
  { value: 'pending',    label: 'Pending'    },
  { value: 'confirmed',  label: 'Confirmed'  },
  { value: 'loaded',     label: 'Loaded'     },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered',  label: 'Delivered'  },
  { value: 'cancelled',  label: 'Cancelled'  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function shortId(id: string) { return id.slice(0, 8).toUpperCase(); }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OperatorBookingsPage() {
  const router = useRouter();

  const [bookings, setBookings]         = useState<OperatorBooking[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [userName, setUserName]         = useState('');
  const [userInitials, setUserInitials] = useState('');

  // Confirmation modal state
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [updating, setUpdating]           = useState(false);
  const [updateError, setUpdateError]     = useState<string | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchBookings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/auth/login?next=/operator/bookings'); return; }

    const name = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? '';
    setUserName(name);
    setUserInitials(
      name.includes(' ')
        ? name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
        : name[0]?.toUpperCase() ?? '',
    );

    // Step 1: operator's containers
    const { data: containerRows, error: cErr } = await supabase
      .from('containers')
      .select('id, origin_city, origin_country, destination_city, destination_country, departure_date')
      .eq('operator_id', user.id);

    if (cErr) { setError('Could not load containers.'); setLoading(false); return; }
    if (!containerRows || containerRows.length === 0) { setBookings([]); setLoading(false); return; }

    const containerMap: Record<string, ContainerInfo> = Object.fromEntries(
      containerRows.map((c) => [c.id, c]),
    );
    const containerIds = containerRows.map((c) => c.id);

    // Step 2: bookings for those containers
    const { data: bookingRows, error: bErr } = await supabase
      .from('bookings')
      .select('id, container_id, customer_id, total_cbm, total_price, status, created_at')
      .in('container_id', containerIds)
      .order('created_at', { ascending: false });

    if (bErr) { setError('Could not load bookings.'); setLoading(false); return; }

    setBookings(
      (bookingRows ?? []).map((b) => ({
        ...b,
        container: containerMap[b.container_id] ?? null,
      })),
    );
    setLoading(false);
  }, [router]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  // ── Status update ─────────────────────────────────────────────────────────
  async function confirmUpdate() {
    if (!pendingAction) return;
    setUpdating(true);
    setUpdateError(null);

    const { booking, newStatus } = pendingAction;

    const { error } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', booking.id);

    if (error) {
      setUpdateError(error.message);
      setUpdating(false);
      return;
    }

    // Update local state optimistically
    setBookings((prev) =>
      prev.map((b) => (b.id === booking.id ? { ...b, status: newStatus } : b)),
    );

    // Notify customer
    if (booking.container) {
      await notify('booking.status_updated', {
        bookingId:   booking.id,
        recipientId: booking.customer_id,
        route:       `${booking.container.origin_city} → ${booking.container.destination_city}`,
        oldStatus:   booking.status,
        newStatus,
      });
    }

    setPendingAction(null);
    setUpdating(false);
  }

  async function cancelBooking(booking: OperatorBooking) {
    setPendingAction({ booking: { ...booking, status: booking.status }, newStatus: 'cancelled' });
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtered = statusFilter === 'all'
    ? bookings
    : bookings.filter((b) => b.status === statusFilter);

  const pendingCount = bookings.filter((b) => b.status === 'pending').length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">

      {/* Navbar */}
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
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: '#f97316' }}>
                  {userInitials}
                </div>
                <div className="hidden sm:flex flex-col leading-tight">
                  <span className="text-sm font-medium text-gray-700 max-w-[130px] truncate">{userName}</span>
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full w-fit mt-0.5" style={{ backgroundColor: '#fff7ed', color: '#f97316' }}>
                    🚢 Operator
                  </span>
                </div>
              </div>
            )}
            <Link href="/operator" className="text-sm font-medium text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
              ← My Containers
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden py-10 px-4" style={{ backgroundColor: '#0f2044' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ mixBlendMode: 'screen', opacity: 0.15 }}>
          <Image src="/world-map-overlay.png" alt="" fill className="object-cover" />
        </div>
        <div className="relative max-w-5xl mx-auto z-10">
          <p className="text-gray-400 text-sm mb-1 font-medium">Operator Portal</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">Manage Bookings</h1>
          <p className="text-gray-400 text-sm">
            Review and update shipment statuses for your containers.
          </p>

          {/* Pending alert */}
          {!loading && pendingCount > 0 && (
            <div className="mt-5 flex items-center gap-3 bg-orange-500/20 border border-orange-400/30 rounded-xl px-4 py-3">
              <span className="text-2xl">⏳</span>
              <div>
                <p className="text-white font-bold text-sm">
                  {pendingCount} booking{pendingCount !== 1 ? 's' : ''} awaiting your confirmation
                </p>
                <p className="text-orange-200 text-xs">
                  Shippers are waiting — confirm or cancel to keep your rating high.
                </p>
              </div>
              <button
                onClick={() => setStatusFilter('pending')}
                className="ml-auto text-xs font-bold px-3 py-1.5 rounded-lg text-white border border-orange-300/50 hover:bg-orange-400/20 transition-colors shrink-0"
              >
                View →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Status tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {STATUS_TABS.map(({ value, label }) => {
            const count  = value === 'all' ? bookings.length : bookings.filter((b) => b.status === value).length;
            const active = statusFilter === value;
            const isPending = value === 'pending' && count > 0;
            return (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border"
                style={
                  active
                    ? { backgroundColor: '#0f2044', color: '#fff', borderColor: '#0f2044' }
                    : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }
                }
              >
                {label}
                {count > 0 && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                    style={
                      active
                        ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }
                        : isPending
                          ? { backgroundColor: '#fff7ed', color: '#f97316' }
                          : { backgroundColor: '#f3f4f6', color: '#374151' }
                    }
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-24">
            <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="alert alert-error text-sm">{error}</div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-xl font-bold text-gray-700 mb-2">
              {statusFilter === 'all' ? 'No bookings yet' : `No ${STATUS_CONFIG[statusFilter]?.label ?? ''} bookings`}
            </h2>
            <p className="text-gray-400 text-sm max-w-xs">
              {statusFilter === 'all'
                ? 'Bookings will appear here once customers reserve space on your containers.'
                : 'Try a different filter to see other bookings.'}
            </p>
          </div>
        )}

        {/* Booking cards */}
        {!loading && !error && filtered.length > 0 && (
          <div className="flex flex-col gap-4">
            {filtered.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onAction={(b, newStatus) => { setUpdateError(null); setPendingAction({ booking: b, newStatus }); }}
                onCancel={cancelBooking}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Confirmation Modal ─────────────────────────────────────────────── */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

            {/* Modal header */}
            <div
              className="px-6 py-4 flex items-center gap-3"
              style={{
                backgroundColor: pendingAction.newStatus === 'cancelled'
                  ? '#fef2f2'
                  : ACTION_CONFIG[pendingAction.newStatus]?.color
                    ? `${ACTION_CONFIG[pendingAction.newStatus].color}18`
                    : '#f8fafc',
              }}
            >
              <span className="text-2xl">
                {pendingAction.newStatus === 'cancelled'
                  ? '❌'
                  : ACTION_CONFIG[pendingAction.newStatus]?.icon}
              </span>
              <div>
                <h3 className="font-extrabold text-gray-800 text-base">
                  {pendingAction.newStatus === 'cancelled'
                    ? 'Cancel Booking'
                    : ACTION_CONFIG[pendingAction.newStatus]?.label}
                </h3>
                <p className="text-gray-500 text-xs mt-0.5">
                  {pendingAction.newStatus === 'cancelled'
                    ? 'This action cannot be undone. The customer will be notified.'
                    : ACTION_CONFIG[pendingAction.newStatus]?.description}
                </p>
              </div>
            </div>

            {/* Booking summary */}
            <div className="px-6 py-4 border-y border-gray-100 bg-gray-50">
              {pendingAction.booking.container ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-gray-800">
                      {pendingAction.booking.container.origin_city}
                    </span>
                    <span className="text-orange-400">→</span>
                    <span className="font-bold text-gray-800">
                      {pendingAction.booking.container.destination_city}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>📦 {pendingAction.booking.total_cbm} CBM</span>
                    <span>💵 ${pendingAction.booking.total_price.toFixed(2)}</span>
                    <span>📅 Departs {fmt(pendingAction.booking.container.departure_date)}</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500">Booking #{shortId(pendingAction.booking.id)}</p>
              )}
            </div>

            {/* Status arrow */}
            <div className="px-6 py-3 flex items-center gap-3">
              <StatusBadge status={pendingAction.booking.status} />
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
              <StatusBadge status={pendingAction.newStatus} />
            </div>

            {/* Error */}
            {updateError && (
              <div className="mx-6 mb-2 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                {updateError}
              </div>
            )}

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => { setPendingAction(null); setUpdateError(null); }}
                disabled={updating}
                className="flex-1 btn btn-ghost rounded-xl text-sm text-gray-500"
              >
                Go Back
              </button>
              <button
                onClick={confirmUpdate}
                disabled={updating}
                className="flex-1 btn text-white font-bold rounded-xl text-sm hover:opacity-90 disabled:opacity-60"
                style={{
                  backgroundColor: pendingAction.newStatus === 'cancelled'
                    ? '#ef4444'
                    : ACTION_CONFIG[pendingAction.newStatus]?.color ?? '#0f2044',
                }}
              >
                {updating
                  ? <span className="loading loading-spinner loading-sm" />
                  : pendingAction.newStatus === 'cancelled' ? 'Yes, Cancel Booking' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BookingCard ──────────────────────────────────────────────────────────────

function BookingCard({
  booking,
  onAction,
  onCancel,
}: {
  booking: OperatorBooking;
  onAction: (b: OperatorBooking, newStatus: string) => void;
  onCancel: (b: OperatorBooking) => void;
}) {
  const nextStatus = NEXT_STATUS[booking.status];
  const actionCfg  = nextStatus ? ACTION_CONFIG[nextStatus] : null;
  const cfg        = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;
  const c          = booking.container;
  const cancellable = !['delivered', 'cancelled'].includes(booking.status);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="h-1 w-full" style={{ backgroundColor: cfg.color }} />

      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">

          {/* Left */}
          <div className="flex-1 min-w-0">
            {c ? (
              <>
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-lg font-extrabold text-gray-900">{c.origin_city}</span>
                  <svg className="w-5 h-5 text-orange-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                  <span className="text-lg font-extrabold text-gray-900">{c.destination_city}</span>
                </div>
                <p className="text-xs text-gray-400 mb-3">{c.origin_country} → {c.destination_country}</p>
              </>
            ) : (
              <p className="text-gray-400 text-sm mb-3">Route unavailable</p>
            )}

            <div className="flex flex-wrap gap-2 mb-4">
              {c && <Chip icon="📅" label={`Departs ${fmt(c.departure_date)}`} />}
              <Chip icon="📦" label={`${booking.total_cbm} CBM`} />
              <Chip icon="💵" label={`$${booking.total_price.toFixed(2)}`} />
              <Chip icon="🕐" label={`Booked ${fmt(booking.created_at)}`} muted />
              <Chip icon="👤" label={`Ref #${shortId(booking.id)}`} muted />
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {actionCfg && nextStatus && (
                <button
                  onClick={() => onAction(booking, nextStatus)}
                  className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: actionCfg.color }}
                >
                  <span>{actionCfg.icon}</span>
                  {actionCfg.label}
                </button>
              )}

              {cancellable && (
                <button
                  onClick={() => onCancel(booking)}
                  className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                >
                  ❌ Cancel
                </button>
              )}

              {booking.status === 'delivered' && (
                <span className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl text-green-600 bg-green-50">
                  ✔️ Delivered — no further action needed
                </span>
              )}

              {booking.status === 'cancelled' && (
                <span className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl text-gray-400 bg-gray-50">
                  Booking cancelled
                </span>
              )}
            </div>
          </div>

          {/* Right: status badge */}
          <div className="shrink-0 flex sm:flex-col items-center sm:items-end gap-2">
            <StatusBadge status={booking.status} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span
      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function Chip({ icon, label, muted }: { icon: string; label: string; muted?: boolean }) {
  return (
    <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${muted ? 'text-gray-400 bg-gray-50' : 'text-gray-600 bg-gray-100'}`}>
      <span>{icon}</span>
      {label}
    </span>
  );
}
