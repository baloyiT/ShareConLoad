'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  Calendar, Package, Banknote, User, Hash,
  CreditCard, MessageCircle, MoreHorizontal,
  AlertTriangle, AlertCircle, Headphones,
  Clock, CheckCircle, Ship, CheckCircle2, XCircle,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import PageHero from '@/components/PageHero';
import RatingBanner from '@/components/RatingBanner';
import RatingModal  from '@/components/RatingModal';
import { supabase } from '@/services/supabaseClient';
import { markAsRead } from '@/services/notificationService';

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
    operator_id: string;
  } | null;
};

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'loaded' | 'in_transit' | 'delivered' | 'cancelled';

type UnreadNotif = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  metadata: Record<string, string>;
};

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending:    { label: 'Pending',    color: '#f97316', bg: '#fff7ed', dot: '#f97316' },
  confirmed:  { label: 'Confirmed',  color: '#3b82f6', bg: '#eff6ff', dot: '#3b82f6' },
  loaded:     { label: 'Loaded',     color: '#8b5cf6', bg: '#f5f3ff', dot: '#8b5cf6' },
  in_transit: { label: 'In Transit', color: '#06b6d4', bg: '#ecfeff', dot: '#06b6d4' },
  delivered:  { label: 'Delivered',  color: '#22c55e', bg: '#f0fdf4', dot: '#22c55e' },
  cancelled:  { label: 'Cancelled',  color: '#6b7280', bg: '#f9fafb', dot: '#9ca3af' },
};

const STATUS_MESSAGE: Record<string, { icon: ReactNode; text: string; color: string; bg: string; border: string }> = {
  pending:    { icon: <Clock className="w-4 h-4 shrink-0" />,         text: 'Awaiting operator confirmation, your space is reserved but not yet accepted.', color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  confirmed:  { icon: <CheckCircle className="w-4 h-4 shrink-0" />,   text: 'Booking confirmed by operator. Proceed with your payment schedule.', color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
  loaded:     { icon: <Package className="w-4 h-4 shrink-0" />,       text: 'Your cargo has been loaded into the container.', color: '#5b21b6', bg: '#f5f3ff', border: '#ddd6fe' },
  in_transit: { icon: <Ship className="w-4 h-4 shrink-0" />,          text: 'Your container is on its way to the destination.', color: '#0e7490', bg: '#ecfeff', border: '#a5f3fc' },
  delivered:  { icon: <CheckCircle2 className="w-4 h-4 shrink-0" />,  text: 'Your cargo has arrived. Ensure all final payments are complete for release.', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  cancelled:  { icon: <XCircle className="w-4 h-4 shrink-0" />,       text: 'This booking was cancelled. Contact support if you need assistance.', color: '#374151', bg: '#f9fafb', border: '#e5e7eb' },
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

const PAYMENT_STAGE_ORDER = ['deposit_20', 'pre_departure_50', 'final_release_30'] as const;
const PAYMENT_STAGE_SHORT: Record<string, string> = {
  deposit_20:       '20%',
  pre_departure_50: '50%',
  final_release_30: '30%',
};
const STAGE_LABELS: Record<string, string> = {
  deposit_20:       'Deposit (20%)',
  pre_departure_50: 'Pre-Departure (50%)',
  final_release_30: 'Final Release (30%)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function shortId(id: string) { return id.slice(0, 8).toUpperCase(); }
function daysUntilDeparture(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dep   = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((dep.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyBookingsPage() {
  const router = useRouter();

  const [bookings, setBookings]           = useState<BookingRow[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>('all');
  const [userName, setUserName]           = useState('');
  const [userInitials, setUserInitials]   = useState('');
  const [ratedBookingIds, setRatedBookingIds]         = useState<Set<string>>(new Set());
  const [ratingModal, setRatingModal]                 = useState<{ bookingId: string; rateeId: string } | null>(null);
  const [messageCounts, setMessageCounts]             = useState<Record<string, number>>({});
  const [unreadNotifs, setUnreadNotifs]               = useState<UnreadNotif[]>([]);
  const [notifOpen, setNotifOpen]                     = useState(false);
  const [paymentStagesByBooking, setPaymentStagesByBooking] = useState<Record<string, Record<string, string>>>({});
  const [operatorNames, setOperatorNames]             = useState<Record<string, string>>({});

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
          containers(origin_city, origin_country, destination_city, destination_country, departure_date, arrival_date, operator_id)`)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        setError('Could not load your bookings. Please try again.');
      } else {
        const rows = data as unknown as BookingRow[];
        setBookings(rows);

        const { data: myRatings } = await supabase
          .from('booking_ratings')
          .select('booking_id')
          .eq('rater_id', user.id);
        setRatedBookingIds(new Set((myRatings ?? []).map((r: { booking_id: string }) => r.booking_id)));

        const bookingIds  = rows.map((b) => b.id);
        const operatorIds = [...new Set(rows.map((b) => b.containers?.operator_id).filter(Boolean))] as string[];

        if (bookingIds.length > 0) {
          // Messages
          const { data: msgs } = await supabase
            .from('booking_messages')
            .select('booking_id')
            .in('booking_id', bookingIds)
            .neq('sender_id', user.id);
          const counts: Record<string, number> = {};
          (msgs ?? []).forEach((m: { booking_id: string }) => {
            counts[m.booking_id] = (counts[m.booking_id] ?? 0) + 1;
          });
          setMessageCounts(counts);

          // Payment stage statuses
          const { data: paymentRows } = await supabase
            .from('payments')
            .select('booking_id, stage, status')
            .in('booking_id', bookingIds);
          const stageMap: Record<string, Record<string, string>> = {};
          for (const p of paymentRows ?? []) {
            if (!stageMap[p.booking_id]) stageMap[p.booking_id] = {};
            stageMap[p.booking_id][p.stage] = p.status;
          }
          setPaymentStagesByBooking(stageMap);
        }

        // Operator display names
        if (operatorIds.length > 0) {
          const { data: profileRows } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', operatorIds);
          const nameMap: Record<string, string> = {};
          for (const p of profileRows ?? []) nameMap[p.user_id] = p.full_name ?? '';
          setOperatorNames(nameMap);
        }

        const { data: notifData } = await supabase
          .from('notifications')
          .select('id, title, body, created_at, metadata')
          .eq('recipient_id', user.id)
          .eq('event', 'message.new')
          .eq('read', false)
          .order('created_at', { ascending: false });
        setUnreadNotifs((notifData ?? []) as UnreadNotif[]);
      }
      setLoading(false);
    }
    fetchBookings();
  }, [router]);

  const filtered = (statusFilter === 'all'
    ? bookings
    : bookings.filter((b) => b.status === statusFilter)
  ).slice().sort((a, b) => {
    const da = a.containers?.departure_date ?? '9999-12-31';
    const db = b.containers?.departure_date ?? '9999-12-31';
    return da.localeCompare(db);
  });

  async function openFromNotification(notif: UnreadNotif) {
    await markAsRead(notif.id);
    setUnreadNotifs((prev) => prev.filter((n) => n.id !== notif.id));
    setNotifOpen(false);
    const bookingId = notif.metadata?.bookingId;
    if (bookingId) router.push(`/booking/track/${bookingId}`);
  }

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

            {/* Notification bell */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Notifications"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadNotifs.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white rounded-full" style={{ backgroundColor: '#f97316' }}>
                    {unreadNotifs.length > 9 ? '9+' : unreadNotifs.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-11 z-50 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-800">Messages</span>
                      {unreadNotifs.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-white" style={{ backgroundColor: '#f97316' }}>
                          {unreadNotifs.length} unread
                        </span>
                      )}
                    </div>
                    {unreadNotifs.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">No new messages</p>
                    ) : (
                      <ul className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                        {unreadNotifs.map((n) => (
                          <li key={n.id}>
                            <button
                              onClick={() => openFromNotification(n)}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                            >
                              <p className="text-sm font-semibold text-gray-800 truncate">{n.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                              <p className="text-[10px] text-gray-400 mt-1">
                                {new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>

            <Link href="/" className="text-sm font-medium text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
              ← Home
            </Link>
          </div>
        </div>
      </nav>

      <PageHero label="Shipper Portal" title="My Bookings" showMap />

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
              <div key={booking.id}>
                {booking.status === 'delivered' &&
                 !ratedBookingIds.has(booking.id) &&
                 booking.containers?.operator_id && (
                  <RatingBanner
                    label="How was your experience with this operator?"
                    onRate={() => setRatingModal({
                      bookingId: booking.id,
                      rateeId:   booking.containers!.operator_id,
                    })}
                  />
                )}
                <BookingCard
                  booking={booking}
                  messageCount={messageCounts[booking.id] ?? 0}
                  paymentStages={paymentStagesByBooking[booking.id] ?? {}}
                  operatorName={operatorNames[booking.containers?.operator_id ?? ''] ?? ''}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {ratingModal && (
        <RatingModal
          bookingId={ratingModal.bookingId}
          rateeId={ratingModal.rateeId}
          title="Rate your operator"
          onClose={() => setRatingModal(null)}
          onSubmitted={() => {
            setRatedBookingIds(prev => new Set([...prev, ratingModal!.bookingId]));
            setRatingModal(null);
          }}
        />
      )}
    </div>
  );
}

// ─── BookingCard ──────────────────────────────────────────────────────────────

function BookingCard({
  booking,
  messageCount,
  paymentStages,
  operatorName,
}: {
  booking: BookingRow;
  messageCount: number;
  paymentStages: Record<string, string>;
  operatorName: string;
}) {
  const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;
  const c   = booking.containers;

  const daysLeft = c ? daysUntilDeparture(c.departure_date) : null;
  const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7
    && ['pending', 'confirmed', 'goods_received'].includes(booking.status);

  // Whether any stage is still unpaid (drives "Make Payment" prominence)
  const hasPendingPayment = Object.values(paymentStages).some((s) => s === 'pending');

  return (
    <div className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow overflow-hidden ${isUrgent ? 'border-orange-200' : 'border-gray-100'}`}>
      <div className="h-1 w-full" style={{ backgroundColor: isUrgent ? '#f97316' : cfg.color }} />

      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

          {/* Left — route, chips, payment dots */}
          <div className="flex-1 min-w-0">

            {/* Route + urgency badge */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                {c ? (
                  <>
                    <span className="text-lg font-extrabold text-gray-900">{c.origin_city}</span>
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#f97316' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    <span className="text-lg font-extrabold text-gray-900">{c.destination_city}</span>
                  </>
                ) : (
                  <span className="text-lg font-bold text-gray-400">Route unavailable</span>
                )}
              </div>
              {isUrgent && daysLeft !== null && (
                <span
                  className="shrink-0 text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap"
                  style={{ backgroundColor: daysLeft <= 3 ? '#fef2f2' : '#fff7ed', color: daysLeft <= 3 ? '#ef4444' : '#f97316' }}
                >
                  <span className="inline-flex items-center gap-1">
                    {daysLeft === 0
                      ? <><AlertCircle className="w-3 h-3" /> Departs today</>
                      : <><AlertTriangle className="w-3 h-3" /> {daysLeft}d to departure</>}
                  </span>
                </span>
              )}
            </div>

            {c && <p className="text-xs text-gray-400 mb-3">{c.origin_country} → {c.destination_country}</p>}

            {/* Info chips */}
            <div className="flex flex-wrap gap-2 mb-3">
              {c && <Chip icon={<Calendar />} label={`Departs ${fmt(c.departure_date)}`} />}
              <Chip icon={<Package />} label={`${booking.total_cbm} CBM`} />
              <Chip icon={<Banknote />} label={`${booking.total_price.toFixed(2)}`} />
              {operatorName && <Chip icon={<User />} label={`Operator: ${operatorName}`} muted />}
              <Chip icon={<Hash />} label={`#${shortId(booking.id)}`} muted />
            </div>

            {/* Payment stage dots */}
            {Object.keys(paymentStages).length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-400">Payments:</span>
                <div className="flex items-center gap-1.5">
                  {PAYMENT_STAGE_ORDER.map((stage) => {
                    const status = paymentStages[stage];
                    return (
                      <span
                        key={stage}
                        title={`${STAGE_LABELS[stage]}: ${status ?? 'not yet due'}`}
                        className="flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full border"
                        style={
                          status === 'paid'
                            ? { backgroundColor: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }
                            : status === 'pending'
                            ? { backgroundColor: '#fff7ed', color: '#f97316', borderColor: '#fed7aa' }
                            : { backgroundColor: '#f9fafb', color: '#9ca3af', borderColor: '#e5e7eb' }
                        }
                      >
                        {status === 'paid' ? '✓' : '○'} {PAYMENT_STAGE_SHORT[stage]}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right — status + actions */}
          <div className="flex flex-col items-stretch gap-2 shrink-0 w-full sm:w-40">
            <div className="flex items-center justify-between sm:flex-col sm:items-end sm:gap-1">
              <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
                {cfg.label}
              </span>
            </div>

            {/* Primary: Make Payment — highlighted when a stage is pending */}
            {!['cancelled', 'delivered'].includes(booking.status) && (
              <Link
                href={`/payments/${booking.id}`}
                className="btn btn-sm font-bold rounded-lg hover:opacity-90 text-xs text-white w-full justify-center"
                style={{ backgroundColor: hasPendingPayment ? '#f97316' : '#0f2044' }}
              >
                {hasPendingPayment
                  ? <><CreditCard className="w-3.5 h-3.5" /> Pay Now</>
                  : 'Payments'}
              </Link>
            )}

            <Link
              href={`/booking/track/${booking.id}`}
              className="btn btn-sm font-semibold rounded-lg hover:opacity-90 text-xs w-full justify-center border border-gray-200 text-gray-700"
            >
              Track →
            </Link>

            <Link
              href={`/booking/track/${booking.id}`}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors w-full justify-center"
            >
              <MessageCircle className="w-4 h-4" />
              {messageCount > 0 && (
                <span className="flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white rounded-full" style={{ backgroundColor: '#f97316' }}>
                  {messageCount > 9 ? '9+' : messageCount}
                </span>
              )}
              <span className="text-sm">Messages</span>
            </Link>

            {/* ⋯ overflow: Raise Dispute + Support */}
            <div className="dropdown dropdown-end w-full">
              <button
                tabIndex={0}
                className="btn btn-sm btn-ghost rounded-lg text-xs text-gray-400 border border-gray-200 w-full justify-center gap-1"
              >
                <MoreHorizontal className="w-4 h-4" /> More
              </button>
              <ul
                tabIndex={0}
                className="dropdown-content z-20 menu p-1.5 shadow-lg bg-white rounded-xl border border-gray-100 w-44 mt-1"
              >
                {['confirmed', 'loaded', 'in_transit', 'delivered'].includes(booking.status) && (
                  <li>
                    <Link
                      href={`/disputes/new?bookingId=${booking.id}`}
                      className="flex items-center gap-2 text-sm text-red-500 px-3 py-2 rounded-lg hover:bg-red-50"
                    >
                      <AlertTriangle className="w-4 h-4" /> Raise Dispute
                    </Link>
                  </li>
                )}
                <li>
                  <Link
                    href="/support/new"
                    className="flex items-center gap-2 text-sm text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50"
                  >
                    <Headphones className="w-4 h-4" /> Support
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Status banner + progress bar */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          {STATUS_MESSAGE[booking.status] && (() => {
            const msg = STATUS_MESSAGE[booking.status];
            return (
              <div
                className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium mb-4"
                style={{ backgroundColor: msg.bg, color: msg.color, border: `1px solid ${msg.border}` }}
              >
                {msg.icon}
                <span>{msg.text}</span>
              </div>
            );
          })()}
          {booking.status !== 'cancelled' && <StatusProgress status={booking.status} />}
        </div>
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

function Chip({ icon, label, muted }: { icon?: ReactNode; label: string; muted?: boolean }) {
  return (
    <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium ${muted ? 'text-gray-400 bg-gray-50' : 'text-gray-600 bg-gray-100'}`}>
      {icon && <span className="[&>svg]:w-3 [&>svg]:h-3 shrink-0">{icon}</span>}
      {label}
    </span>
  );
}
