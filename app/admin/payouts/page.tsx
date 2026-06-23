'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/services/supabaseClient';
import PageHero from '@/components/PageHero';
import PayoutOverrideModal, { formatCountdown } from '@/components/PayoutOverrideModal';

type OperatorProfile = {
  legal_name:              string | null;
  status:                  string;
  payout_enabled:          boolean;
  payout_hold:             boolean;
  paystack_recipient_code: string | null;
};

type Payout = {
  id:                      string;
  booking_id:              string;
  operator_id:             string;
  gross_amount:            number;
  net_amount:              number | null;
  commission_amount:       number | null;
  status:                  string;
  eligible_after:          string | null;
  paystack_transfer_code:  string | null;
  failure_reason:          string | null;
  completed_at:            string | null;
  created_at:              string;
  metadata:                { overridden?: boolean; override_reason?: string; auto_triggered?: boolean } | null;
  operator_profile:        OperatorProfile | null;
  has_active_dispute:      boolean;
  booking:                 { containers: { origin_city: string; destination_city: string } | null } | null;
};

const STATUS_COLOURS: Record<string, string> = {
  pending:    '#f59e0b',
  processing: '#3b82f6',
  completed:  '#22c55e',
  failed:     '#ef4444',
};

type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'failed';

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ZAR(n: number) {
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type BlockReason =
  | { type: 'no_profile' | 'no_bank' | 'compliance_not_approved' | 'payout_disabled' | 'on_hold' | 'active_dispute'; message: string }
  | { type: 'refund_window'; message: string; msRemaining: number };

// supabase-js returns `data: null` on a non-2xx Edge Function response and puts the real
// body in `error.context` (a Response). Read it so admins see the actual failure reason
// instead of the generic "Edge Function returned a non-2xx status code".
async function extractFnError(fnErr: unknown, data: { error?: string } | null, fallback: string): Promise<string> {
  if (data?.error) return data.error;
  const ctx = (fnErr as { context?: { json?: () => Promise<unknown> } } | null)?.context;
  if (ctx?.json) {
    try {
      const body = (await ctx.json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      /* response body was not JSON — fall through to message */
    }
  }
  return (fnErr as { message?: string } | null)?.message ?? fallback;
}

// Block reasons an admin can resolve from the Operators page (vs. the time-based refund window).
const ADMIN_RESOLVABLE: BlockReason['type'][] = ['no_bank', 'compliance_not_approved', 'payout_disabled', 'on_hold'];

function getBlockReason(op: OperatorProfile | null, hasActiveDispute: boolean, eligibleAfter: string | null, now: number): BlockReason | null {
  if (!op) return { type: 'no_profile', message: 'No operator profile' };
  if (!op.paystack_recipient_code) return { type: 'no_bank', message: 'No bank account registered' };
  if (!['active', 'trusted'].includes(op.status)) return { type: 'compliance_not_approved', message: 'Operator compliance is not approved' };
  if (!op.payout_enabled) return { type: 'payout_disabled', message: 'Payouts disabled by admin' };
  if (op.payout_hold) return { type: 'on_hold', message: 'Operator on payout hold' };
  if (hasActiveDispute) return { type: 'active_dispute', message: 'Active dispute on this booking' };
  if (eligibleAfter) {
    const msRemaining = new Date(eligibleAfter).getTime() - now;
    if (msRemaining > 0) {
      return { type: 'refund_window', message: `Eligible in ${formatCountdown(msRemaining)}`, msRemaining };
    }
  }
  return null;
}

export default function AdminPayoutsPage() {
  const [payouts,      setPayouts]      = useState<Payout[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [triggering,   setTriggering]   = useState<string | null>(null);
  const [triggerError, setTriggerError] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now());
  const [adminProfileId, setAdminProfileId] = useState<string | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<{ payoutId: string; msRemaining: number } | null>(null);
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchAdminProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profile) setAdminProfileId(profile.id);
    }
    fetchAdminProfile();
  }, []);

  useEffect(() => {
    async function fetchPayouts() {
      // Step 1: fetch payouts + bookings (no operator_profiles, no FK path exists)
      const { data: payoutRows, error: err } = await supabase
        .from('payouts')
        .select(`
          id, booking_id, operator_id,
          gross_amount, net_amount, commission_amount,
          status, eligible_after, paystack_transfer_code, failure_reason,
          completed_at, created_at, metadata,
          booking:bookings(containers(origin_city, destination_city))
        `)
        .order('created_at', { ascending: false });

      if (err) { setError(err.message); setLoading(false); return; }

      // Step 2: fetch operator profiles via profiles.user_id for all operator_ids
      const operatorIds = [...new Set((payoutRows ?? []).map((p) => p.operator_id as string))];
      let profileMap: Record<string, OperatorProfile> = {};

      if (operatorIds.length > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select(`user_id, op:operator_profiles!profile_id(legal_name, status, payout_enabled, payout_hold, paystack_recipient_code)`)
          .in('user_id', operatorIds)
          .eq('role_type', 'operator');

        profileMap = Object.fromEntries(
          (profileRows ?? []).map((r) => [r.user_id, (r.op as unknown as OperatorProfile)])
        );
      }

      // Step 2.5: fetch active disputes for all booking_ids
      const bookingIds = [...new Set((payoutRows ?? []).map((p) => p.booking_id as string))];
      let activeDisputeBookingIds = new Set<string>();

      if (bookingIds.length > 0) {
        const { data: disputeRows } = await supabase
          .from('disputes')
          .select('booking_id')
          .in('booking_id', bookingIds)
          .not('status', 'in', '("resolved","closed")');

        activeDisputeBookingIds = new Set((disputeRows ?? []).map((d) => d.booking_id as string));
      }

      // Step 3: merge
      const merged = (payoutRows ?? []).map((p) => ({
        ...p,
        operator_profile: profileMap[p.operator_id as string] ?? null,
        has_active_dispute: activeDisputeBookingIds.has(p.booking_id as string),
      }));

      setPayouts(merged as unknown as Payout[]);
      setLoading(false);
    }
    fetchPayouts();
  }, []);

  async function handleTrigger(payoutId: string) {
    setTriggering(payoutId);
    setTriggerError((prev) => { const n = { ...prev }; delete n[payoutId]; return n; });

    const { data, error: fnErr } = await supabase.functions.invoke('trigger-payout', {
      body: { payoutId },
    });

    if (fnErr || !data?.success) {
      const msg = await extractFnError(fnErr, data, 'Payout trigger failed.');
      setTriggerError((prev) => ({ ...prev, [payoutId]: msg }));
      setTriggering(null);
      return;
    }

    setPayouts((prev) =>
      prev.map((p) =>
        p.id === payoutId
          ? { ...p, status: 'processing', paystack_transfer_code: data.transferCode ?? p.paystack_transfer_code, net_amount: data.netAmount ?? p.net_amount }
          : p
      )
    );
    setTriggering(null);
  }

  async function handleOverrideConfirm(reason: string) {
    if (!overrideTarget) return;
    setOverrideSubmitting(true);
    setOverrideError(null);

    const { data, error: fnErr } = await supabase.functions.invoke('trigger-payout', {
      body: {
        payoutId:       overrideTarget.payoutId,
        override:       true,
        overrideReason: reason,
        adminProfileId,
      },
    });

    if (fnErr || !data?.success) {
      setOverrideError(await extractFnError(fnErr, data, 'Override trigger failed.'));
      setOverrideSubmitting(false);
      return;
    }

    setPayouts((prev) =>
      prev.map((p) =>
        p.id === overrideTarget.payoutId
          ? {
              ...p,
              status: 'processing',
              paystack_transfer_code: data.transferCode ?? p.paystack_transfer_code,
              net_amount: data.netAmount ?? p.net_amount,
              metadata: { ...p.metadata, overridden: true, override_reason: reason },
            }
          : p
      )
    );
    setOverrideSubmitting(false);
    setOverrideTarget(null);
  }

  const filtered = statusFilter === 'all' ? payouts : payouts.filter((p) => p.status === statusFilter);

  const totalPaid    = payouts.filter((p) => p.status === 'completed').reduce((s, p) => s + (p.net_amount ?? p.gross_amount), 0);
  const pendingAmt   = payouts.filter((p) => p.status === 'pending').reduce((s, p) => s + p.gross_amount, 0);
  const totalRecords = payouts.length;
  const failedCount  = payouts.filter((p) => p.status === 'failed').length;

  const STATUS_TABS: StatusFilter[] = ['all', 'pending', 'processing', 'completed', 'failed'];

  return (
    <div className="min-h-screen bg-gray-50 font-sans">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 sm:px-10 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo1.png" alt="" width={40} height={40} className="h-9 w-auto" />
            <span className="text-xl font-extrabold tracking-tight">
              <span style={{ color: '#0b103a' }}>Share</span><span style={{ color: '#ff6a00' }}>Con</span><span style={{ color: '#0b103a' }}>Load</span>
            </span>
          </Link>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-800">← Admin</Link>
        </div>
      </nav>

      <PageHero gradient label="Admin" title="Payouts" description="Approve and trigger operator payout transfers via Paystack." />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {error && <div className="alert alert-error text-sm mb-4">{error}</div>}

        {/* Summary cards */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Paid Out</p>
              <p className="text-xl font-extrabold" style={{ color: '#22c55e' }}>{ZAR(totalPaid)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Pending</p>
              <p className="text-xl font-extrabold" style={{ color: '#f59e0b' }}>{ZAR(pendingAmt)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Records</p>
              <p className="text-xl font-extrabold text-gray-800">{totalRecords}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Failed</p>
              <p className="text-xl font-extrabold" style={{ color: '#ef4444' }}>{failedCount}</p>
            </div>
          </div>
        )}

        {/* Status filter */}
        <div className="flex gap-2 flex-wrap mb-6">
          {STATUS_TABS.map((s) => {
            const count  = s === 'all' ? payouts.length : payouts.filter((p) => p.status === s).length;
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors"
                style={active
                  ? { backgroundColor: '#0b103a', color: '#fff', borderColor: '#0b103a' }
                  : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
                {count > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
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

        {loading ? (
          <div className="flex justify-center py-24">
            <span className="loading loading-spinner loading-lg" style={{ color: '#ff6a00' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20">
            <p className="text-gray-400 text-sm">No payouts found.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Operator', 'Route', 'Gross', 'Net (after commission)', 'Status', 'Transfer Code', 'Date', 'Action'].map((h) => (
                      <th key={h} className="py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-left whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const route     = p.booking?.containers
                      ? `${p.booking.containers.origin_city} → ${p.booking.containers.destination_city}`
                      : '-';
                    const blockReason = p.status === 'pending' ? getBlockReason(p.operator_profile, p.has_active_dispute, p.eligible_after, now) : null;
                    const isTriggering = triggering === p.id;

                    return (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="text-sm font-semibold text-gray-800">
                            {p.operator_profile?.legal_name ?? <span className="text-gray-400 italic">Unknown</span>}
                          </p>
                          <p className="text-xs font-mono text-gray-400">{p.id.slice(0, 8)}…</p>
                        </td>
                        <td className="py-3.5 px-4 text-sm text-gray-700 whitespace-nowrap">{route}</td>
                        <td className="py-3.5 px-4 text-sm font-semibold text-gray-800 whitespace-nowrap">
                          {ZAR(p.gross_amount)}
                        </td>
                        <td className="py-3.5 px-4 text-sm whitespace-nowrap">
                          {p.net_amount != null ? (
                            <span className="font-semibold" style={{ color: '#22c55e' }}>{ZAR(p.net_amount)}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                          {p.commission_amount != null && (
                            <p className="text-xs text-gray-400">
                              commission: {ZAR(p.commission_amount)}
                              {p.gross_amount > 0 && (
                                <> · {Math.round((p.commission_amount / p.gross_amount) * 100)}%</>
                              )}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="badge badge-sm text-white font-semibold capitalize"
                            style={{ backgroundColor: STATUS_COLOURS[p.status] ?? '#6b7280' }}>
                            {p.status}
                          </span>
                          {p.metadata?.auto_triggered && (
                            <span className="badge badge-sm badge-outline ml-1">
                              ⚙ Auto
                            </span>
                          )}
                          {p.metadata?.overridden && (
                            <span
                              className="badge badge-sm badge-outline ml-1"
                              title={p.metadata.override_reason ?? undefined}
                            >
                              ⚡ Overridden
                            </span>
                          )}
                          {p.failure_reason && (
                            <p className="text-xs text-red-400 mt-1 max-w-[140px] truncate">{p.failure_reason}</p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-gray-400 whitespace-nowrap">
                          {p.paystack_transfer_code ?? '-'}
                        </td>
                        <td className="py-3.5 px-4 text-sm text-gray-500 whitespace-nowrap">{fmt(p.created_at)}</td>
                        <td className="py-3.5 px-4">
                          {p.status === 'pending' && (
                            <div>
                              <button
                                onClick={() => handleTrigger(p.id)}
                                disabled={!!blockReason || isTriggering}
                                title={blockReason?.message ?? undefined}
                                className="btn btn-sm text-white font-bold rounded-lg hover:opacity-90 disabled:opacity-40 whitespace-nowrap"
                                style={{ backgroundColor: '#0b103a' }}
                              >
                                {isTriggering
                                  ? <span className="loading loading-spinner loading-xs" />
                                  : 'Trigger →'}
                              </button>
                              {blockReason && (
                                <p className="text-xs text-amber-600 mt-1 max-w-[140px]">{blockReason.message}</p>
                              )}
                              {blockReason?.type === 'refund_window' && (
                                <button
                                  type="button"
                                  onClick={() => setOverrideTarget({ payoutId: p.id, msRemaining: blockReason.msRemaining })}
                                  disabled={overrideSubmitting}
                                  className="text-xs text-orange-600 underline mt-1 block disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                                >
                                  Force trigger
                                </button>
                              )}
                              {blockReason && ADMIN_RESOLVABLE.includes(blockReason.type) && (
                                <Link
                                  href="/admin/operators"
                                  className="text-xs text-orange-600 underline mt-1 block"
                                >
                                  Manage operator →
                                </Link>
                              )}
                              {triggerError[p.id] && (
                                <p className="text-xs text-red-500 mt-1 max-w-[120px]">{triggerError[p.id]}</p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {overrideTarget && (
        <PayoutOverrideModal
          msRemaining={overrideTarget.msRemaining}
          onCancel={() => { setOverrideTarget(null); setOverrideError(null); }}
          onConfirm={handleOverrideConfirm}
          submitting={overrideSubmitting}
          error={overrideError}
        />
      )}
    </div>
  );
}
