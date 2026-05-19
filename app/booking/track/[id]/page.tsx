'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/services/supabaseClient';
import MilestoneTimeline from '@/components/MilestoneTimeline';
import PageHero from '@/components/PageHero';
import MessageThread from '@/components/MessageThread';

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingContainer = {
  operator_id: string;
  origin_city: string;
  origin_country: string;
  destination_city: string;
  destination_country: string;
  departure_date: string;
  price_per_cbm: number;
};

type Booking = {
  id: string;
  container_id: string;
  customer_id: string;
  total_cbm: number;
  total_price: number;
  status: string;
  created_at: string;
  containers: BookingContainer;
};

type HistoryEntry = {
  id: string;
  booking_id: string;
  status: string;
  notes: string | null;
  changed_at: string;
};

type ShipmentMilestone = {
  id: string;
  milestone: string;
  notes: string | null;
  occurred_at: string;
};

// ─── Timeline definition ──────────────────────────────────────────────────────

type StepState = 'completed' | 'current' | 'upcoming';

type TimelineStep = {
  status: string;
  label: string;
  description: string;
  icon: React.ReactNode;
};

const LIFECYCLE: string[] = ['pending', 'confirmed', 'loaded', 'in_transit', 'delivered'];

const STEP_META: Record<string, { label: string; description: string }> = {
  pending:    { label: 'Pending',    description: 'Booking submitted, awaiting operator confirmation.' },
  confirmed:  { label: 'Confirmed',  description: 'Operator has confirmed your booking.'              },
  loaded:     { label: 'Loaded',     description: 'Goods have been loaded into the container.'         },
  in_transit: { label: 'In Transit', description: 'Container is on its way to the destination.'        },
  delivered:  { label: 'Delivered',  description: 'Goods have arrived at the destination.'             },
};

const STATUS_BADGE: Record<string, { bg: string; label: string }> = {
  pending:    { bg: '#f59e0b', label: 'Pending'    },
  confirmed:  { bg: '#3b82f6', label: 'Confirmed'  },
  loaded:     { bg: '#8b5cf6', label: 'Loaded'     },
  in_transit: { bg: '#06b6d4', label: 'In Transit' },
  delivered:  { bg: '#22c55e', label: 'Delivered'  },
  cancelled:  { bg: '#ef4444', label: 'Cancelled'  },
};

function fmt(dateStr: string, withTime = false) {
  const opts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime && { hour: '2-digit', minute: '2-digit' }),
  };
  return new Date(dateStr).toLocaleDateString('en-GB', opts);
}

function stepState(stepStatus: string, currentStatus: string): StepState {
  if (currentStatus === 'cancelled') {
    const stepIdx   = LIFECYCLE.indexOf(stepStatus);
    const cancelIdx = LIFECYCLE.indexOf('pending'); // treat cancelled as stuck at pending
    return stepIdx < cancelIdx ? 'completed' : stepIdx === cancelIdx ? 'current' : 'upcoming';
  }
  const stepIdx    = LIFECYCLE.indexOf(stepStatus);
  const currentIdx = LIFECYCLE.indexOf(currentStatus);
  if (stepIdx < currentIdx)  return 'completed';
  if (stepIdx === currentIdx) return 'current';
  return 'upcoming';
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

const STEP_ICONS: Record<string, React.ReactNode> = {
  pending:    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  confirmed:  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  loaded:     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" /></svg>,
  in_transit: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>,
  delivered:  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookingTrackPage() {
  const { id } = useParams<{ id: string }>();

  const [booking,       setBooking]       = useState<Booking | null>(null);
  const [history,       setHistory]       = useState<HistoryEntry[]>([]);
  const [milestones,    setMilestones]    = useState<ShipmentMilestone[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [notFound,      setNotFound]      = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [bookingRes, historyRes, milestonesRes, authRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('*, containers(*)')
          .eq('id', id)
          .single(),
        supabase
          .from('booking_status_history')
          .select('*')
          .eq('booking_id', id)
          .order('changed_at', { ascending: true }),
        supabase
          .from('shipment_milestones')
          .select('id, milestone, notes, occurred_at')
          .eq('booking_id', id)
          .order('occurred_at', { ascending: true }),
        supabase.auth.getUser(),
      ]);

      if (authRes.data.user) setCurrentUserId(authRes.data.user.id);

      if (bookingRes.error || !bookingRes.data) {
        console.error('Booking fetch error:', bookingRes.error);
        setNotFound(true);
      } else {
        setBooking(bookingRes.data as Booking);
        setHistory((historyRes.data ?? []) as HistoryEntry[]);
        setMilestones((milestonesRes.data ?? []) as ShipmentMilestone[]);
      }
      setLoading(false);
    }

    if (id) load();
  }, [id]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (notFound || !booking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 text-center px-4">
        <div className="text-6xl">🔍</div>
        <h1 className="text-2xl font-bold text-gray-800">Booking not found</h1>
        <p className="text-gray-400 text-sm max-w-xs">
          This booking ID does not exist or you do not have access to it.
        </p>
        <Link href="/" className="btn btn-sm mt-2 text-white" style={{ backgroundColor: '#0f2044' }}>
          ← Back to Home
        </Link>
      </div>
    );
  }

  const { containers: container } = booking;
  const badge   = STATUS_BADGE[booking.status] ?? { bg: '#6b7280', label: booking.status };
  const isCancelled = booking.status === 'cancelled';

  // Map history entries by status for quick lookup of timestamps
  const historyByStatus: Record<string, HistoryEntry> = {};
  for (const entry of history) {
    historyByStatus[entry.status] = entry;
  }

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
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
            ← Home
          </Link>
        </div>
      </nav>

      <PageHero
        gradient
        label="Booking Tracking"
        title={`${container.origin_city} → ${container.destination_city}`}
        description={`${container.origin_country} → ${container.destination_country}`}
        rightSlot={
          <div className="flex flex-col items-start sm:items-end gap-1">
            <span
              className="badge text-white font-semibold px-3 py-2 text-sm"
              style={{ backgroundColor: badge.bg }}
            >
              {badge.label}
            </span>
            <p className="text-xs text-gray-400 font-mono">Ref: {booking.id.slice(0, 8)}…</p>
          </div>
        }
      />

      {/* Cancelled banner */}
      {isCancelled && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-5">
          <div className="alert alert-error text-sm">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            This booking has been cancelled.
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

        {/* ── Left: booking summary ────────────────────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Details card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Booking Details
            </h2>
            <div className="flex flex-col gap-3 text-sm">
              <DetailRow label="Booking ID">
                <span className="font-mono text-xs text-gray-600 break-all">{booking.id}</span>
              </DetailRow>
              <DetailRow label="Booked On">
                {fmt(booking.created_at, true)}
              </DetailRow>
              <DetailRow label="Departure">
                {fmt(container.departure_date)}
              </DetailRow>
              <DetailRow label="CBM Booked">
                <span className="font-semibold">{booking.total_cbm} CBM</span>
              </DetailRow>
              <DetailRow label="Price / CBM">
                R{container.price_per_cbm}
              </DetailRow>
              <div className="pt-1 border-t border-gray-100 flex items-center justify-between">
                <span className="text-gray-500 font-medium">Total Price</span>
                <span className="text-lg font-extrabold" style={{ color: '#f97316' }}>
                  R{booking.total_price.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Current status card */}
          <div
            className="rounded-2xl p-5 text-white"
            style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}
          >
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Current Status</p>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: badge.bg }}
              >
                {STEP_ICONS[booking.status] ?? <CheckIcon />}
              </div>
              <div>
                <p className="font-extrabold text-lg">{badge.label}</p>
                <p className="text-gray-400 text-xs">
                  {STEP_META[booking.status]?.description ?? ''}
                </p>
              </div>
            </div>
          </div>

          {/* Payment CTA */}
          {!['cancelled', 'delivered'].includes(booking.status) && (
            <Link
              href={`/payments/${booking.id}`}
              className="btn text-white font-bold rounded-xl hover:opacity-90 w-full"
              style={{ backgroundColor: '#f97316' }}
            >
              Make Payment →
            </Link>
          )}

        </div>

        {/* ── Right: timeline ──────────────────────────────────────────────── */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-6">
              Shipment Timeline
            </h2>

            <div className="relative flex flex-col">
              {LIFECYCLE.map((status, idx) => {
                const state        = stepState(status, booking.status);
                const meta         = STEP_META[status];
                const historyEntry = historyByStatus[status];
                const isLast       = idx === LIFECYCLE.length - 1;

                return (
                  <div key={status} className="flex gap-4 relative">

                    {/* Connector line + node */}
                    <div className="flex flex-col items-center">
                      <StepNode state={state} icon={STEP_ICONS[status]} />
                      {!isLast && (
                        <div
                          className="w-0.5 flex-1 my-1 min-h-[2.5rem]"
                          style={{
                            backgroundColor:
                              state === 'completed' ? '#f97316' : '#e5e7eb',
                          }}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className={`pb-6 flex-1 ${isLast ? 'pb-0' : ''}`}>
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p
                            className={`font-bold text-sm ${
                              state === 'upcoming' ? 'text-gray-400' : 'text-gray-800'
                            }`}
                          >
                            {meta.label}
                          </p>
                          <p
                            className={`text-xs mt-0.5 leading-relaxed max-w-xs ${
                              state === 'upcoming' ? 'text-gray-300' : 'text-gray-500'
                            }`}
                          >
                            {meta.description}
                          </p>

                          {/* Notes from history */}
                          {historyEntry?.notes && (
                            <p className="text-xs text-gray-400 italic mt-1.5 bg-gray-50 rounded-lg px-2 py-1">
                              "{historyEntry.notes}"
                            </p>
                          )}
                        </div>

                        {/* Timestamp */}
                        {historyEntry ? (
                          <span className="text-xs text-gray-400 whitespace-nowrap shrink-0 mt-0.5">
                            {fmt(historyEntry.changed_at, true)}
                          </span>
                        ) : state === 'current' ? (
                          <span
                            className="text-xs font-semibold whitespace-nowrap shrink-0"
                            style={{ color: '#f97316' }}
                          >
                            Now
                          </span>
                        ) : null}
                      </div>
                    </div>

                  </div>
                );
              })}

              {/* Cancelled entry (appended after lifecycle if applicable) */}
              {isCancelled && (
                <div className="flex gap-4 mt-1">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-500 text-white shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1 pb-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="font-bold text-sm text-red-500">Cancelled</p>
                        <p className="text-xs text-gray-400 mt-0.5">This booking has been cancelled.</p>
                        {historyByStatus['cancelled']?.notes && (
                          <p className="text-xs text-gray-400 italic mt-1.5 bg-gray-50 rounded-lg px-2 py-1">
                            "{historyByStatus['cancelled'].notes}"
                          </p>
                        )}
                      </div>
                      {historyByStatus['cancelled'] && (
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {fmt(historyByStatus['cancelled'].changed_at, true)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* History log */}
            {history.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-100">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Activity Log
                </h3>
                <div className="flex flex-col gap-2">
                  {[...history].reverse().map((entry) => {
                    const b = STATUS_BADGE[entry.status] ?? { bg: '#6b7280', label: entry.status };
                    return (
                      <div key={entry.id} className="flex items-start gap-3 text-xs">
                        <span
                          className="badge badge-sm text-white font-medium shrink-0 mt-0.5"
                          style={{ backgroundColor: b.bg }}
                        >
                          {b.label}
                        </span>
                        <div className="flex-1">
                          {entry.notes && (
                            <span className="text-gray-500">{entry.notes} · </span>
                          )}
                          <span className="text-gray-400">{fmt(entry.changed_at, true)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Shipment milestones card */}
          {milestones.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-6">
                Shipment Milestones
              </h2>
              <MilestoneTimeline milestones={milestones} />
            </div>
          )}

          {/* Messages section */}
          {booking && currentUserId && booking.containers?.operator_id && (
            <div className="mt-8">
              <h3 className="font-bold text-base mb-3" style={{ color: '#111827' }}>
                Messages
              </h3>
              <MessageThread
                bookingId={booking.id}
                bookingRef={booking.id.slice(0, 8).toUpperCase()}
                currentUserId={currentUserId}
                recipientId={booking.containers.operator_id}
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepNode({ state, icon }: { state: StepState; icon: React.ReactNode }) {
  if (state === 'completed') {
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0"
        style={{ backgroundColor: '#f97316' }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }

  if (state === 'current') {
    return (
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 ring-4 ring-indigo-100"
        style={{ backgroundColor: '#0f2044' }}
      >
        {icon}
      </div>
    );
  }

  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-gray-300 shrink-0 border-2 border-gray-200 bg-white">
      {icon}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className="text-gray-700 text-right">{children}</span>
    </div>
  );
}
