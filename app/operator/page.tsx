'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';
import PageHero from '@/components/PageHero';
import { notify } from '@/services/notificationService';

// ─── Types ────────────────────────────────────────────────────────────────────

type Container = {
  id: string;
  origin_city: string;
  origin_country: string;
  destination_city: string;
  destination_country: string;
  departure_date: string;
  arrival_date: string | null;
  total_capacity_cbm: number;
  available_capacity_cbm: number;
  price_per_cbm: number;
  status: string;
  created_at: string;
  departure_notice_sent_at: string | null;
};

type StatusFilter = 'all' | 'open' | 'closed' | 'in_transit' | 'delivered';

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all',        label: 'All'        },
  { value: 'open',       label: 'Open'       },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered',  label: 'Delivered'  },
  { value: 'closed',     label: 'Closed'     },
];

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  open:       { bg: '#f0fdf4', color: '#22c55e', label: 'Open'       },
  closed:     { bg: '#f9fafb', color: '#6b7280', label: 'Closed'     },
  in_transit: { bg: '#eff6ff', color: '#3b82f6', label: 'In Transit' },
  delivered:  { bg: '#f5f3ff', color: '#8b5cf6', label: 'Delivered'  },
};

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dep   = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((dep.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OperatorDashboard() {
  const router = useRouter();

  const [containers, setContainers]     = useState<Container[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [userName, setUserName]         = useState('');
  const [userInitials, setUserInitials] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [sendingNotice,  setSendingNotice]  = useState<string | null>(null);
  const [noticeError,    setNoticeError]    = useState<string | null>(null);
  const [noticeSent,     setNoticeSent]     = useState<string | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    async function fetchContainers() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login?next=/operator'); return; }

      const fullName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? '';
      setUserName(fullName);
      setUserInitials(
        fullName.includes(' ')
          ? fullName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
          : fullName[0]?.toUpperCase() ?? '',
      );

      const { data, error } = await supabase
        .from('containers')
        .select('*')
        .eq('operator_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        setError('Could not load your containers. Please try again.');
      } else {
        const list = data as Container[];
        setContainers(list);
        if (list.length > 0) {
          const ids = list.map((c) => c.id);
          const { count } = await supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .in('container_id', ids)
            .eq('status', 'pending');
          setPendingCount(count ?? 0);
        }
      }
      // Unread message notifications
      const { count: msgCount } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('event', 'message.new')
        .eq('read', false);
      setUnreadMessages(msgCount ?? 0);

      setLoading(false);
    }
    fetchContainers();
  }, [router]);

  async function sendDepartureNotice(container: Container) {
    setSendingNotice(container.id);
    setNoticeError(null);
    setNoticeSent(null);

    const { error: updateErr } = await supabase
      .from('containers')
      .update({ departure_notice_sent_at: new Date().toISOString() })
      .eq('id', container.id);

    if (updateErr) {
      setNoticeError(updateErr.message);
      setSendingNotice(null);
      return;
    }

    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, customer_id')
      .eq('container_id', container.id)
      .in('status', ['confirmed', 'loaded']);

    for (const b of bookings ?? []) {
      await notify('container.departure_notice', {
        bookingId:     b.id,
        recipientId:   b.customer_id,
        route:         `${container.origin_city} → ${container.destination_city}`,
        departureDate: container.departure_date,
      });
    }

    setContainers((prev) =>
      prev.map((c) =>
        c.id === container.id ? { ...c, departure_notice_sent_at: new Date().toISOString() } : c,
      ),
    );
    setNoticeSent(container.id);
    setSendingNotice(null);
  }

  const filtered = statusFilter === 'all' ? containers : containers.filter((c) => c.status === statusFilter);

  return (
    <div className="bg-[#f8fafc]">

      <PageHero
        showMap
        label="Operator Portal"
        title="My Containers"
        description="Manage your listed container space."
        rightSlot={
          <Link
            href="/operator/create"
            className="btn text-white font-bold rounded-xl hover:opacity-90 self-start sm:self-auto"
            style={{ backgroundColor: '#f97316' }}
          >
            + Create Container
          </Link>
        }
      >
        {(() => {
          const urgent = containers.filter((c) => {
            const d = daysUntil(c.departure_date);
            return !c.departure_notice_sent_at && d >= 0 && d <= 10;
          });
          if (urgent.length === 0) return null;
          return (
            <div className="relative max-w-6xl mx-auto w-full mt-4">
              <div className="flex items-start gap-3 bg-amber-500/20 border border-amber-400/30 rounded-xl px-4 py-3">
                <span className="text-2xl shrink-0">⚠️</span>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">
                    {urgent.length} container{urgent.length !== 1 ? 's' : ''} departing within 10 days — notice not yet sent
                  </p>
                  <p className="text-amber-200 text-xs mt-0.5">
                    The system auto-sends customer notices at T-7 days (daily at 06:00 UTC). You can also send manually now.
                  </p>
                </div>
              </div>
            </div>
          );
        })()}
      </PageHero>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

        {/* Summary cards */}
        {!loading && !error && (pendingCount > 0 || unreadMessages > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pendingCount > 0 && (
              <Link
                href="/operator/bookings?filter=pending"
                className="flex items-center gap-4 bg-white rounded-2xl border border-orange-100 shadow-sm px-5 py-4 hover:shadow-md transition-shadow"
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: '#fff7ed' }}>⏳</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-medium">Awaiting confirmation</p>
                  <p className="text-xl font-extrabold" style={{ color: '#f97316' }}>{pendingCount}</p>
                </div>
                <span className="text-gray-300 text-lg">→</span>
              </Link>
            )}
            {unreadMessages > 0 && (
              <Link
                href="/operator/bookings"
                className="flex items-center gap-4 bg-white rounded-2xl border border-blue-100 shadow-sm px-5 py-4 hover:shadow-md transition-shadow"
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: '#eff6ff' }}>💬</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-medium">Unread messages</p>
                  <p className="text-xl font-extrabold text-blue-600">{unreadMessages}</p>
                </div>
                <span className="text-gray-300 text-lg">→</span>
              </Link>
            )}
          </div>
        )}

        {/* Status filter tabs */}
        {!loading && !error && containers.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {STATUS_TABS.map((tab) => {
              const count = tab.value === 'all' ? containers.length : containers.filter((c) => c.status === tab.value).length;
              const active = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className="flex items-center gap-1.5 btn btn-sm rounded-xl border transition-all"
                  style={active
                    ? { backgroundColor: '#0f2044', borderColor: '#0f2044', color: '#fff' }
                    : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}
                >
                  {tab.label}
                  {count > 0 && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                      style={active
                        ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }
                        : { backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {noticeError && (
          <div className="alert alert-error text-sm">{noticeError}</div>
        )}
        {noticeSent && (
          <div className="alert text-sm font-semibold" style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
            ✓ Departure notice sent — customers have been notified.
          </div>
        )}

        {/* Loading / Error */}
        {loading && <div className="flex justify-center py-24"><span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} /></div>}
        {error   && <div className="alert alert-error text-sm max-w-lg">{error}</div>}

        {/* Empty state */}
        {!loading && !error && containers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4" style={{ backgroundColor: '#fff7ed' }}>📦</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No containers yet</h3>
            <p className="text-gray-400 text-sm max-w-xs mb-6">Create your first container listing to start accepting bookings.</p>
            <Link href="/operator/create" className="btn text-white font-bold rounded-xl hover:opacity-90" style={{ backgroundColor: '#f97316' }}>
              + Create Container
            </Link>
          </div>
        )}

        {/* Filtered empty */}
        {!loading && !error && containers.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100">
            <p className="text-gray-400 text-sm">No containers with status &quot;{statusFilter}&quot;.</p>
            <button onClick={() => setStatusFilter('all')} className="mt-3 text-sm font-semibold hover:underline" style={{ color: '#f97316' }}>Clear filter</button>
          </div>
        )}

        {/* Desktop table */}
        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="hidden sm:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="table w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wider text-gray-400">
                    <th className="font-semibold py-3 px-6">Route</th>
                    <th className="font-semibold py-3 px-4">Departure</th>
                    <th className="font-semibold py-3 px-4">Status</th>
                    <th className="font-semibold py-3 px-4">Capacity</th>
                    <th className="font-semibold py-3 px-4">Price / CBM</th>
                    <th className="font-semibold py-3 px-4">Notice</th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const style  = STATUS_STYLES[c.status] ?? { bg: '#f9fafb', color: '#6b7280', label: c.status };
                    const pctFull = Math.round(((c.total_capacity_cbm - c.available_capacity_cbm) / c.total_capacity_cbm) * 100);
                    return (
                      <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-6">
                          <p className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
                            {c.origin_city}
                            <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                            {c.destination_city}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{c.origin_country} → {c.destination_country}</p>
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-700 whitespace-nowrap">{fmt(c.departure_date)}</td>
                        <td className="py-4 px-4">
                          <span className="badge badge-sm font-semibold" style={{ backgroundColor: style.bg, color: style.color }}>{style.label}</span>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-xs text-gray-500 mb-1">{c.available_capacity_cbm} / {c.total_capacity_cbm} CBM free</p>
                          <progress className="progress w-28 h-1.5" style={{ accentColor: pctFull > 80 ? '#f97316' : '#0f2044' }} value={pctFull} max={100} />
                        </td>
                        <td className="py-4 px-4 font-semibold text-sm" style={{ color: '#f97316' }}>R{c.price_per_cbm}</td>
                        <td className="py-4 px-4">
                          {c.departure_notice_sent_at ? (
                            <span className="text-xs font-semibold text-green-600 flex items-center gap-1">✓ Sent</span>
                          ) : (() => {
                            const d = daysUntil(c.departure_date);
                            const urgent = d >= 0 && d <= 7;
                            return (
                              <button
                                onClick={() => sendDepartureNotice(c)}
                                disabled={sendingNotice === c.id || c.status === 'delivered' || c.status === 'closed'}
                                className="btn btn-xs rounded-lg text-white font-semibold hover:opacity-90 disabled:opacity-50"
                                style={{ backgroundColor: urgent ? '#ef4444' : '#f97316' }}
                              >
                                {sendingNotice === c.id
                                  ? <span className="loading loading-spinner loading-xs" />
                                  : urgent ? `⚠️ T-${d}d` : '7-Day Notice'}
                              </button>
                            );
                          })()}
                        </td>
                        <td className="py-4 px-4">
                          <Link href={`/container/${c.id}`} className="btn btn-ghost btn-xs text-gray-500 hover:text-gray-800 rounded-lg">View →</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="flex flex-col gap-4 sm:hidden">
              {filtered.map((c) => {
                const style   = STATUS_STYLES[c.status] ?? { bg: '#f9fafb', color: '#6b7280', label: c.status };
                const pctFull = Math.round(((c.total_capacity_cbm - c.available_capacity_cbm) / c.total_capacity_cbm) * 100);
                return (
                  <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                          {c.origin_city}
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                          {c.destination_city}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{c.origin_country} → {c.destination_country}</p>
                      </div>
                      <span className="badge badge-sm font-semibold" style={{ backgroundColor: style.bg, color: style.color }}>{style.label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-400">Departure</p>
                        <p className="font-medium text-gray-700">{fmt(c.departure_date)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Price / CBM</p>
                        <p className="font-bold" style={{ color: '#f97316' }}>R{c.price_per_cbm}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">{c.available_capacity_cbm} / {c.total_capacity_cbm} CBM available</p>
                      <progress className="progress w-full h-1.5" style={{ accentColor: pctFull > 80 ? '#f97316' : '#0f2044' }} value={pctFull} max={100} />
                    </div>
                    {!c.departure_notice_sent_at ? (() => {
                      const d = daysUntil(c.departure_date);
                      const urgent = d >= 0 && d <= 7;
                      return (
                        <button
                          onClick={() => sendDepartureNotice(c)}
                          disabled={sendingNotice === c.id}
                          className="btn btn-sm rounded-xl text-white font-semibold hover:opacity-90 disabled:opacity-50 w-full"
                          style={{ backgroundColor: urgent ? '#ef4444' : '#f97316' }}
                        >
                          {sendingNotice === c.id
                            ? <span className="loading loading-spinner loading-sm" />
                            : urgent
                              ? `⚠️ Urgent — Send Notice (T-${d}d)`
                              : '📢 Send 7-Day Departure Notice'}
                        </button>
                      );
                    })() : (
                      <p className="text-xs text-green-600 font-semibold text-center">✓ Departure notice sent</p>
                    )}
                    <Link href={`/container/${c.id}`} className="btn btn-sm btn-ghost rounded-xl text-sm font-semibold border border-gray-200 mt-1">
                      View Details →
                    </Link>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
