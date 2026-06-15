'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';
import { notify, markAsRead } from '@/services/notificationService';
import PageHero from '@/components/PageHero';
import RatingBanner from '@/components/RatingBanner';
import RatingModal  from '@/components/RatingModal';
import MessageThread from '@/components/MessageThread';

// ─── Types ────────────────────────────────────────────────────────────────────

type ContainerInfo = {
  id: string;
  origin_city: string;
  origin_country: string;
  destination_city: string;
  destination_country: string;
  departure_date: string;
  price_per_cbm: number;
  available_capacity_cbm: number;
};

type OperatorBooking = {
  id: string;
  container_id: string;
  customer_id: string;
  total_cbm: number;
  total_price: number;
  status: string;
  created_at: string;
  actual_cbm_at_loading: number | null;
  cbm_reconciliation_status: string | null;
  container: ContainerInfo | null;
};

type ReceiptModal = {
  booking: OperatorBooking;
  step: 'input' | 'excess_choice';
  actualCbm: string;
  variance: number;
  newTotalPrice: number;
  excessCbm: number;
  capacityAvailable: boolean;
};

type PendingAction = {
  booking: OperatorBooking;
  newStatus: string;
};

type MilestoneModal = {
  booking: OperatorBooking;
};

type UnreadNotif = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  metadata: Record<string, string>;
};

const OPERATOR_MILESTONES: { value: string; label: string }[] = [
  { value: 'cargo_received',    label: 'Cargo Received'    },
  { value: 'container_loaded',  label: 'Container Loaded'  },
  { value: 'vessel_departed',   label: 'Vessel Departed'   },
  { value: 'destination_arrival', label: 'Arrived at Destination' },
  { value: 'customs_cleared',   label: 'Customs Cleared'   },
  { value: 'release_authorized',label: 'Release Authorized'},
  { value: 'cargo_collected',   label: 'Cargo Collected'   },
  { value: 'shipment_completed',label: 'Shipment Completed'},
];

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'goods_received' | 'loaded' | 'in_transit' | 'delivered' | 'cancelled';

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:         { label: 'Pending',        color: '#f97316', bg: '#fff7ed' },
  confirmed:       { label: 'Confirmed',      color: '#3b82f6', bg: '#eff6ff' },
  goods_received:  { label: 'Goods Received', color: '#0891b2', bg: '#ecfeff' },
  loaded:          { label: 'Loaded',         color: '#8b5cf6', bg: '#f5f3ff' },
  in_transit:      { label: 'In Transit',     color: '#06b6d4', bg: '#ecfeff' },
  delivered:       { label: 'Delivered',      color: '#22c55e', bg: '#f0fdf4' },
  cancelled:       { label: 'Cancelled',      color: '#6b7280', bg: '#f9fafb' },
};

// next valid status for each current status
const NEXT_STATUS: Record<string, string | null> = {
  pending:        'confirmed',
  confirmed:      'goods_received',  // via receipt modal, not generic action
  goods_received: 'loaded',
  loaded:         'in_transit',
  in_transit:     'delivered',
  delivered:      null,
  cancelled:      null,
};

// what the action button says (keyed by TARGET status)
const ACTION_CONFIG: Record<string, { label: string; icon: string; color: string; description: string }> = {
  confirmed: {
    label:       'Confirm Booking',
    icon:        '✅',
    color:       '#3b82f6',
    description: 'Accept this booking and notify the customer.',
  },
  // goods_received is handled by the receipt modal, not here
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
  { value: 'all',            label: 'All'            },
  { value: 'pending',        label: 'Pending'        },
  { value: 'confirmed',      label: 'Confirmed'      },
  { value: 'goods_received', label: 'Goods Received' },
  { value: 'loaded',         label: 'Loaded'         },
  { value: 'in_transit',     label: 'In Transit'     },
  { value: 'delivered',      label: 'Delivered'      },
  { value: 'cancelled',      label: 'Cancelled'      },
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

  // Rating state
  const [ratedBookingIds, setRatedBookingIds] = useState<Set<string>>(new Set());
  const [ratingModal, setRatingModal] = useState<{ bookingId: string; rateeId: string } | null>(null);

  // Messages state
  const [messageBooking, setMessageBooking]   = useState<OperatorBooking | null>(null);
  const [currentUserId, setCurrentUserId]     = useState<string | null>(null);
  const [messageCounts, setMessageCounts]     = useState<Record<string, number>>({});
  const [unreadNotifs, setUnreadNotifs]       = useState<UnreadNotif[]>([]);
  const [notifOpen, setNotifOpen]             = useState(false);

  // Milestone modal state
  const [milestoneModal,   setMilestoneModal]   = useState<MilestoneModal | null>(null);
  const [milestoneType,    setMilestoneType]    = useState(OPERATOR_MILESTONES[0].value);
  const [milestoneNotes,   setMilestoneNotes]   = useState('');
  const [milestoneError,   setMilestoneError]   = useState<string | null>(null);
  const [recordingMilestone, setRecordingMilestone] = useState(false);
  const [operatorProfileId,  setOperatorProfileId]  = useState<string | null>(null);

  // Receipt / CBM reconciliation modal state
  const [receiptModal,    setReceiptModal]    = useState<ReceiptModal | null>(null);
  const [receiptSaving,   setReceiptSaving]   = useState(false);
  const [receiptError,    setReceiptError]    = useState<string | null>(null);

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
    if (user) setCurrentUserId(user.id);

    const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).single();
    if (profile) setOperatorProfileId(profile.id);

    // Step 1: operator's containers
    const { data: containerRows, error: cErr } = await supabase
      .from('containers')
      .select('id, origin_city, origin_country, destination_city, destination_country, departure_date, price_per_cbm, available_capacity_cbm')
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
      .select('id, container_id, customer_id, total_cbm, total_price, status, created_at, actual_cbm_at_loading, cbm_reconciliation_status')
      .in('container_id', containerIds)
      .order('created_at', { ascending: false });

    if (bErr) { setError('Could not load bookings.'); setLoading(false); return; }

    setBookings(
      (bookingRows ?? []).map((b) => ({
        ...b,
        container: containerMap[b.container_id] ?? null,
      })),
    );

    const { data: myRatings } = await supabase
      .from('booking_ratings')
      .select('booking_id')
      .eq('rater_id', user.id);
    setRatedBookingIds(new Set((myRatings ?? []).map((r: { booking_id: string }) => r.booking_id)));

    // Count inbound messages per booking (from customers, not the operator)
    if (containerIds.length > 0) {
      const { data: msgs } = await supabase
        .from('booking_messages')
        .select('booking_id')
        .in('booking_id', (bookingRows ?? []).map(b => b.id))
        .neq('sender_id', user.id);
      const counts: Record<string, number> = {};
      for (const m of msgs ?? []) counts[m.booking_id] = (counts[m.booking_id] ?? 0) + 1;
      setMessageCounts(counts);
    }

    // Fetch unread message.new notifications
    const { data: notifs } = await supabase
      .from('notifications')
      .select('id, title, body, created_at, metadata')
      .eq('recipient_id', user.id)
      .eq('event', 'message.new')
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(10);
    setUnreadNotifs((notifs ?? []) as UnreadNotif[]);

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

  async function openFromNotification(notif: UnreadNotif) {
    setNotifOpen(false);
    await markAsRead(notif.id);
    setUnreadNotifs(prev => prev.filter(n => n.id !== notif.id));
    const bookingId = notif.metadata?.bookingId;
    if (!bookingId) return;
    const booking = bookings.find(b => b.id === bookingId);
    if (booking) {
      setStatusFilter('all');
      setMessageBooking(booking);
    }
  }

  async function recordMilestone() {
    if (!milestoneModal) return;
    setRecordingMilestone(true);
    setMilestoneError(null);

    const { error } = await supabase.from('shipment_milestones').insert({
      booking_id:   milestoneModal.booking.id,
      milestone:    milestoneType,
      notes:        milestoneNotes.trim() || null,
      occurred_at:  new Date().toISOString(),
      recorded_by:  operatorProfileId,
    });

    if (error) {
      setMilestoneError(error.message);
    } else {
      setMilestoneModal(null);
      setMilestoneNotes('');
      setMilestoneType(OPERATOR_MILESTONES[0].value);
    }
    setRecordingMilestone(false);
  }

  // ── CBM Receipt / Reconciliation ──────────────────────────────────────────
  function openReceiptModal(booking: OperatorBooking) {
    setReceiptError(null);
    setReceiptModal({
      booking,
      step: 'input',
      actualCbm: '',
      variance: 0,
      newTotalPrice: 0,
      excessCbm: 0,
      capacityAvailable: false,
    });
  }

  async function handleReceiptSubmit() {
    if (!receiptModal) return;
    const { booking } = receiptModal;
    const c = booking.container;
    if (!c) { setReceiptError('Container data missing.'); return; }

    const actualCbm = parseFloat(receiptModal.actualCbm);
    if (isNaN(actualCbm) || actualCbm <= 0) {
      setReceiptError('Please enter a valid CBM value.');
      return;
    }

    const bookedCbm = booking.total_cbm;
    const variancePct = ((actualCbm - bookedCbm) / bookedCbm) * 100;

    if (Math.abs(variancePct) <= 5) {
      // Within threshold — confirm receipt, no payment change
      await finaliseReceipt(booking, actualCbm, variancePct, 'within_threshold', false);
    } else if (actualCbm < bookedCbm) {
      // Reduced — auto-accept, recalculate down
      await finaliseReceipt(booking, actualCbm, variancePct, 'accepted', false);
    } else {
      // Excess — check capacity then show accept/decline
      const excessCbm = actualCbm - bookedCbm;
      const capacityAvailable = c.available_capacity_cbm >= excessCbm;
      setReceiptModal((prev) => prev ? {
        ...prev,
        step: 'excess_choice',
        variance: variancePct,
        newTotalPrice: actualCbm * c.price_per_cbm,
        excessCbm,
        capacityAvailable,
      } : null);
    }
  }

  async function finaliseReceipt(
    booking: OperatorBooking,
    actualCbm: number,
    variancePct: number,
    reconciliationStatus: 'within_threshold' | 'accepted' | 'declined',
    isDeclined: boolean,
  ) {
    setReceiptSaving(true);
    setReceiptError(null);

    const c = booking.container!;
    const effectiveCbm = isDeclined ? booking.total_cbm : actualCbm;
    const newTotalPrice = effectiveCbm * c.price_per_cbm;
    const cbmVarianceAdj = isDeclined ? 0 : newTotalPrice - booking.total_price;

    // 1. Update booking
    const { error: bookingErr } = await supabase
      .from('bookings')
      .update({
        status:                    'goods_received',
        actual_cbm_at_loading:     actualCbm,
        cbm_variance_pct:          variancePct,
        cbm_variance_adjustment:   cbmVarianceAdj,
        cbm_reconciliation_status: reconciliationStatus,
        goods_received_at:         new Date().toISOString(),
      })
      .eq('id', booking.id);

    if (bookingErr) { setReceiptError(bookingErr.message); setReceiptSaving(false); return; }

    // 2. Recalculate Stage 2 and Stage 3 if not within threshold and not declined
    if (reconciliationStatus !== 'within_threshold' && !isDeclined) {
      const stage2 = newTotalPrice * 0.50;
      const stage3 = newTotalPrice * 0.30;

      await supabase
        .from('payments')
        .update({ amount: stage2 })
        .eq('booking_id', booking.id)
        .eq('stage', 'pre_departure_50')
        .eq('status', 'pending');

      await supabase
        .from('payments')
        .update({ amount: stage3 })
        .eq('booking_id', booking.id)
        .eq('stage', 'final_release_30')
        .eq('status', 'pending');
    }

    // 3. Adjust container capacity for non-declined reconciliations
    if (!isDeclined && reconciliationStatus !== 'within_threshold') {
      const capacityDelta = booking.total_cbm - actualCbm; // positive = freed, negative = consumed more
      await supabase
        .from('containers')
        .update({ available_capacity_cbm: c.available_capacity_cbm + capacityDelta })
        .eq('id', booking.container_id);
    }

    // 4. Record milestone
    await supabase.from('shipment_milestones').insert({
      booking_id:  booking.id,
      milestone:   'cargo_received',
      notes:       isDeclined
        ? `Goods received. Excess CBM declined — proceeding at booked ${booking.total_cbm} CBM.`
        : `Goods received. Actual CBM: ${actualCbm}. Variance: ${variancePct.toFixed(1)}%.`,
      occurred_at: new Date().toISOString(),
      recorded_by: operatorProfileId,
    });

    // 5. Notify customer
    let notifBody = '';
    if (reconciliationStatus === 'within_threshold') {
      notifBody = `Your cargo has been received at the warehouse. CBM variance is within threshold — no payment changes.`;
    } else if (isDeclined) {
      notifBody = `Your cargo has been received. The actual CBM exceeded your booking. Excess cargo was declined — your booking continues at the original ${booking.total_cbm} CBM.`;
    } else if (actualCbm < booking.total_cbm) {
      notifBody = `Your cargo has been received. Actual CBM: ${actualCbm} (booked: ${booking.total_cbm}). Your Stage 2 and Stage 3 payments have been adjusted downward.`;
    } else {
      notifBody = `Your cargo has been received. Actual CBM: ${actualCbm} (booked: ${booking.total_cbm}). The extra space has been accepted — your Stage 2 and Stage 3 payments have been adjusted.`;
    }

    await supabase.from('notifications').insert({
      user_id:  booking.customer_id,
      type:     'booking.cbm_reconciled',
      title:    'Cargo received at warehouse',
      body:     notifBody,
      metadata: { booking_id: booking.id, actual_cbm: actualCbm, reconciliation_status: reconciliationStatus },
    });

    // 6. Update local state
    setBookings((prev) =>
      prev.map((b) => b.id === booking.id
        ? { ...b, status: 'goods_received', actual_cbm_at_loading: actualCbm, cbm_reconciliation_status: reconciliationStatus }
        : b,
      ),
    );

    setReceiptModal(null);
    setReceiptSaving(false);
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtered = statusFilter === 'all'
    ? bookings
    : bookings.filter((b) => b.status === statusFilter);

  const pendingCount = bookings.filter((b) => b.status === 'pending').length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#f8fafc]">

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 sm:px-10 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo1.png" alt="" width={40} height={40} className="h-9 w-auto" />
            <span className="text-xl font-extrabold tracking-tight">
              <span style={{ color: '#0f2044' }}>Share</span><span style={{ color: '#f97316' }}>Con</span><span style={{ color: '#0f2044' }}>Load</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {/* Notification bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen(v => !v)}
                className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-lg"
              >
                🔔
                {unreadNotifs.length > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                    style={{ backgroundColor: '#f97316' }}
                  >
                    {unreadNotifs.length > 9 ? '9+' : unreadNotifs.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-11 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-800">New Messages</span>
                    <button type="button" onClick={() => setNotifOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                  </div>
                  {unreadNotifs.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-400 text-sm">No new messages</div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                      {unreadNotifs.map(notif => (
                        <button
                          key={notif.id}
                          type="button"
                          onClick={() => openFromNotification(notif)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <p className="text-sm font-semibold text-gray-800">{notif.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.body}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(notif.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User info */}
            {userName && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: '#0f2044' }}>
                  {userInitials}
                </div>
                <div className="hidden sm:flex flex-col leading-tight">
                  <span className="text-sm font-medium text-gray-700 max-w-[130px] truncate">{userName}</span>
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full w-fit mt-0.5" style={{ backgroundColor: '#e8eef8', color: '#0f2044' }}>
                    🚢 Operator
                  </span>
                </div>
              </div>
            )}

            <Link href="/operator" className="text-sm font-medium text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
              ← Operator Hub
            </Link>
          </div>
        </div>
      </nav>

      <PageHero
        showMap
        label="Operator Portal"
        title="Manage Bookings"
        description="Review and update shipment statuses for your containers."
      >
        {!loading && pendingCount > 0 && (
          <div className="mt-5 flex items-center gap-3 bg-orange-500/20 border border-orange-400/30 rounded-xl px-4 py-3">
            <span className="text-2xl">⏳</span>
            <div>
              <p className="text-white font-bold text-sm">
                {pendingCount} booking{pendingCount !== 1 ? 's' : ''} awaiting your confirmation
              </p>
              <p className="text-orange-200 text-xs">
                Shippers are waiting, confirm or cancel to keep your rating high.
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
      </PageHero>

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
                onRecordMilestone={(b) => { setMilestoneModal({ booking: b }); setMilestoneType(OPERATOR_MILESTONES[0].value); setMilestoneNotes(''); setMilestoneError(null); }}
                onConfirmReceipt={openReceiptModal}
                isRated={ratedBookingIds.has(booking.id)}
                onRate={() => setRatingModal({ bookingId: booking.id, rateeId: booking.customer_id })}
                onMessage={() => setMessageBooking(booking)}
                messageCount={messageCounts[booking.id] ?? 0}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── CBM Receipt / Reconciliation Modal ───────────────────────────── */}
      {receiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between" style={{ backgroundColor: '#f0f9ff' }}>
              <div>
                <h3 className="font-extrabold text-gray-800">Confirm Goods Receipt &amp; CBM</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {receiptModal.booking.container
                    ? `${receiptModal.booking.container.origin_city} → ${receiptModal.booking.container.destination_city}`
                    : `Booking #${shortId(receiptModal.booking.id)}`}
                </p>
              </div>
              <button onClick={() => setReceiptModal(null)} className="btn btn-ghost btn-sm btn-circle text-gray-400">✕</button>
            </div>

            {receiptModal.step === 'input' && (
              <>
                <div className="px-6 py-5 space-y-4">
                  <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-gray-500">Booked CBM</span><span className="font-bold">{receiptModal.booking.total_cbm} m³</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Original price</span><span className="font-bold">R{receiptModal.booking.total_price.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Price per CBM</span><span className="font-bold">R{receiptModal.booking.container?.price_per_cbm.toFixed(2)}</span></div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Actual CBM Received</label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.01"
                      className="input input-bordered w-full"
                      placeholder="e.g. 4.5"
                      value={receiptModal.actualCbm}
                      onChange={(e) => setReceiptModal((prev) => prev ? { ...prev, actualCbm: e.target.value } : null)}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Recalculation only applies if variance exceeds ±5%.
                    </p>
                  </div>
                  {receiptError && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{receiptError}</p>}
                </div>
                <div className="px-6 pb-6 flex gap-3">
                  <button onClick={() => setReceiptModal(null)} className="btn btn-ghost flex-1 rounded-xl text-gray-500">Cancel</button>
                  <button
                    onClick={handleReceiptSubmit}
                    disabled={receiptSaving}
                    className="btn flex-1 text-white font-bold rounded-xl hover:opacity-90"
                    style={{ backgroundColor: '#0891b2' }}
                  >
                    {receiptSaving ? <span className="loading loading-spinner loading-sm" /> : 'Confirm Receipt'}
                  </button>
                </div>
              </>
            )}

            {receiptModal.step === 'excess_choice' && (
              <>
                <div className="px-6 py-5 space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm space-y-2">
                    <p className="font-bold text-amber-800">⚠️ Excess CBM Detected</p>
                    <div className="flex justify-between text-amber-700"><span>Booked</span><span className="font-bold">{receiptModal.booking.total_cbm} m³</span></div>
                    <div className="flex justify-between text-amber-700"><span>Actual received</span><span className="font-bold">{receiptModal.actualCbm} m³</span></div>
                    <div className="flex justify-between text-amber-700"><span>Excess</span><span className="font-bold">+{receiptModal.excessCbm.toFixed(2)} m³ ({receiptModal.variance.toFixed(1)}%)</span></div>
                  </div>

                  {receiptModal.capacityAvailable ? (
                    <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
                      <p className="font-semibold text-gray-700 mb-2">If you accept the extra space:</p>
                      <div className="flex justify-between"><span className="text-gray-500">New total price</span><span className="font-bold">R{receiptModal.newTotalPrice.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">New Stage 2 (50%)</span><span className="font-bold">R{(receiptModal.newTotalPrice * 0.50).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">New Stage 3 (30%)</span><span className="font-bold">R{(receiptModal.newTotalPrice * 0.30).toFixed(2)}</span></div>
                    </div>
                  ) : (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
                      <p className="font-bold text-red-700">No space available</p>
                      <p className="text-red-600 mt-1">The container does not have sufficient remaining capacity to accept the excess. The booking will proceed at the original {receiptModal.booking.total_cbm} CBM.</p>
                    </div>
                  )}
                  {receiptError && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{receiptError}</p>}
                </div>
                <div className="px-6 pb-6 flex gap-3">
                  {receiptModal.capacityAvailable ? (
                    <>
                      <button
                        onClick={() => finaliseReceipt(receiptModal.booking, parseFloat(receiptModal.actualCbm), receiptModal.variance, 'declined', true)}
                        disabled={receiptSaving}
                        className="btn flex-1 font-bold rounded-xl border-2 border-gray-300 text-gray-600 disabled:opacity-60"
                      >
                        {receiptSaving ? <span className="loading loading-spinner loading-sm" /> : 'Decline Excess'}
                      </button>
                      <button
                        onClick={() => finaliseReceipt(receiptModal.booking, parseFloat(receiptModal.actualCbm), receiptModal.variance, 'accepted', false)}
                        disabled={receiptSaving}
                        className="btn flex-1 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60"
                        style={{ backgroundColor: '#0891b2' }}
                      >
                        {receiptSaving ? <span className="loading loading-spinner loading-sm" /> : 'Accept & Adjust'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => finaliseReceipt(receiptModal.booking, parseFloat(receiptModal.actualCbm), receiptModal.variance, 'declined', true)}
                      disabled={receiptSaving}
                      className="btn flex-1 text-white font-bold rounded-xl disabled:opacity-60"
                      style={{ backgroundColor: '#0891b2' }}
                    >
                      {receiptSaving ? <span className="loading loading-spinner loading-sm" /> : 'Confirm (Decline Excess)'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Milestone Modal ───────────────────────────────────────────────── */}
      {milestoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-gray-800">Record Milestone</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {milestoneModal.booking.container
                    ? `${milestoneModal.booking.container.origin_city} → ${milestoneModal.booking.container.destination_city}`
                    : `Booking #${shortId(milestoneModal.booking.id)}`}
                </p>
              </div>
              <button onClick={() => setMilestoneModal(null)} className="btn btn-ghost btn-sm btn-circle text-gray-400">✕</button>
            </div>

            <div className="px-6 py-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">Milestone</label>
                <select
                  className="select select-bordered w-full"
                  value={milestoneType}
                  onChange={(e) => setMilestoneType(e.target.value)}
                >
                  {OPERATOR_MILESTONES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">Notes <span className="font-normal text-gray-400">(optional)</span></label>
                <textarea
                  className="textarea textarea-bordered w-full h-20 resize-none"
                  placeholder="Any additional notes about this milestone…"
                  value={milestoneNotes}
                  onChange={(e) => setMilestoneNotes(e.target.value)}
                />
              </div>

              {milestoneError && (
                <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{milestoneError}</p>
              )}
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setMilestoneModal(null)} className="btn btn-ghost flex-1 rounded-xl text-gray-500">
                Cancel
              </button>
              <button
                onClick={recordMilestone}
                disabled={recordingMilestone}
                className="btn flex-1 text-white font-bold rounded-xl hover:opacity-90"
                style={{ backgroundColor: '#f97316' }}
              >
                {recordingMilestone ? <span className="loading loading-spinner loading-sm" /> : 'Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Messages Modal ────────────────────────────────────────────────── */}
      {messageBooking && currentUserId && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-base">
                Messages, {messageBooking.id.slice(0, 8).toUpperCase()}
              </h3>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setMessageBooking(null)}>✕</button>
            </div>
            <MessageThread
              bookingId={messageBooking.id}
              bookingRef={messageBooking.id.slice(0, 8).toUpperCase()}
              currentUserId={currentUserId}
              recipientId={messageBooking.customer_id}
            />
          </div>
          <label className="modal-backdrop" aria-label="Close modal" onClick={() => setMessageBooking(null)} />
        </div>
      )}

      {/* ── Rating Modal ──────────────────────────────────────────────────── */}
      {ratingModal && (
        <RatingModal
          bookingId={ratingModal.bookingId}
          rateeId={ratingModal.rateeId}
          title="Rate this customer"
          onClose={() => setRatingModal(null)}
          onSubmitted={() => {
            setRatedBookingIds(prev => new Set([...prev, ratingModal!.bookingId]));
            setRatingModal(null);
          }}
        />
      )}

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
                    <span>💵 R{pendingAction.booking.total_price.toFixed(2)}</span>
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
  onRecordMilestone,
  onConfirmReceipt,
  isRated,
  onRate,
  onMessage,
  messageCount,
}: {
  booking: OperatorBooking;
  onAction: (b: OperatorBooking, newStatus: string) => void;
  onCancel: (b: OperatorBooking) => void;
  onRecordMilestone: (b: OperatorBooking) => void;
  onConfirmReceipt: (b: OperatorBooking) => void;
  isRated: boolean;
  onRate: () => void;
  onMessage: () => void;
  messageCount: number;
}) {
  const nextStatus = NEXT_STATUS[booking.status];
  // confirmed → goods_received is handled by the receipt modal, not the generic action flow
  const actionCfg  = nextStatus && nextStatus !== 'goods_received' ? ACTION_CONFIG[nextStatus] : null;
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
              <Chip icon="💵" label={`R${booking.total_price.toFixed(2)}`} />
              <Chip icon="🕐" label={`Booked ${fmt(booking.created_at)}`} muted />
              <Chip icon="👤" label={`Ref #${shortId(booking.id)}`} muted />
            </div>

            {/* Rating banner */}
            {booking.status === 'delivered' && !isRated && (
              <RatingBanner
                label="Rate this customer"
                onRate={onRate}
              />
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {/* Confirmed → receipt confirmation (CBM reconciliation) */}
              {booking.status === 'confirmed' && (
                <button
                  onClick={() => onConfirmReceipt(booking)}
                  className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#0891b2' }}
                >
                  <span>📋</span>
                  Confirm Receipt &amp; CBM
                </button>
              )}

              {actionCfg && nextStatus && nextStatus !== 'goods_received' && (
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

              <button
                onClick={() => onRecordMilestone(booking)}
                className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                📍 Milestone
              </button>

              <button
                type="button"
                onClick={onMessage}
                className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
              >
                💬 Messages
                {messageCount > 0 && (
                  <span
                    className="w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                    style={{ backgroundColor: '#f97316' }}
                  >
                    {messageCount > 9 ? '9+' : messageCount}
                  </span>
                )}
              </button>

              {booking.status === 'delivered' && (
                <span className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl text-green-600 bg-green-50">
                  ✔️ Delivered, no further action needed
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
