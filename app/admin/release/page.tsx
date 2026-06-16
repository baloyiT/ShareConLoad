'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/services/supabaseClient';
import PageHero from '@/components/PageHero';
import { logAudit } from '@/services/auditLogger';
import { notify } from '@/services/notificationService';
import { Check } from 'lucide-react';

type ReleaseAuth = {
  id: string;
  booking_id: string;
  final_payment_confirmed: boolean;
  customs_cleared: boolean;
  consignee_verified: boolean;
  operator_confirmed: boolean;
  status: string;
  notes: string | null;
  authorized_at: string | null;
  created_at: string;
  booking: {
    customer_id: string;
    total_price: number;
    containers: { origin_city: string; destination_city: string } | null;
  } | null;
};

type BoolField = 'final_payment_confirmed' | 'customs_cleared' | 'consignee_verified' | 'operator_confirmed';

const CONDITIONS: { field: BoolField; label: string; description: string }[] = [
  { field: 'final_payment_confirmed', label: 'Final Payment',      description: '30% final release payment received.'   },
  { field: 'customs_cleared',         label: 'Customs Cleared',    description: 'Customs has cleared the cargo.'         },
  { field: 'consignee_verified',      label: 'Consignee Verified', description: 'Consignee identity confirmed.'           },
  { field: 'operator_confirmed',      label: 'Operator Confirmed', description: 'Operator approved cargo release.'        },
];

const STATUS_COLOURS: Record<string, string> = {
  pending:    '#f59e0b',
  authorized: '#22c55e',
  released:   '#3b82f6',
  held:       '#ef4444',
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminReleasePage() {
  const [records,  setRecords]  = useState<ReleaseAuth[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [adminId,  setAdminId]  = useState<string | null>(null);
  const [saving,   setSaving]   = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setAdminId(user.id);

      const { data, error: err } = await supabase
        .from('cargo_release_authorizations')
        .select(`
          id, booking_id, final_payment_confirmed, customs_cleared,
          consignee_verified, operator_confirmed, status, notes, authorized_at, created_at,
          booking:bookings(customer_id, total_price, containers(origin_city, destination_city))
        `)
        .order('created_at', { ascending: false });

      if (err) { setError(err.message); }
      else { setRecords((data ?? []) as unknown as ReleaseAuth[]); }
      setLoading(false);
    }
    init();
  }, []);

  async function toggleCondition(record: ReleaseAuth, field: BoolField) {
    setSaving(record.id + field);
    const newVal = !record[field];

    const updatedRecord = { ...record, [field]: newVal };
    const allMet = CONDITIONS.every((c) => updatedRecord[c.field]);
    const newStatus = allMet && record.status === 'pending' ? 'authorized' : record.status;

    const { error: err } = await supabase
      .from('cargo_release_authorizations')
      .update({
        [field]:       newVal,
        status:        newStatus,
        ...(newStatus === 'authorized' ? { authorized_by: adminId, authorized_at: new Date().toISOString() } : {}),
      })
      .eq('id', record.id);

    if (!err) {
      setRecords((prev) =>
        prev.map((r) => r.id === record.id
          ? { ...r, [field]: newVal, status: newStatus }
          : r),
      );

      if (newStatus === 'authorized') {
        await logAudit({
          action:      'cargo_release.authorized',
          target_type: 'cargo_release_authorization',
          target_id:   record.id,
          actor_id:    adminId ?? undefined,
        });
        if (record.booking?.customer_id && record.booking.containers) {
          await notify('cargo.released', {
            bookingId:   record.booking_id,
            recipientId: record.booking.customer_id,
            route:       `${record.booking.containers.origin_city} → ${record.booking.containers.destination_city}`,
          });
        }
      }
    } else {
      setError(err.message);
    }
    setSaving(null);
  }

  async function updateStatus(record: ReleaseAuth, status: string) {
    setSaving(record.id + 'status');
    const { error: err } = await supabase
      .from('cargo_release_authorizations')
      .update({ status })
      .eq('id', record.id);

    if (!err) {
      setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, status } : r));
    } else {
      setError(err.message);
    }
    setSaving(null);
  }

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

      <PageHero gradient label="Admin" title="Cargo Release" description="All four conditions must be confirmed before cargo can be released." />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {error && <div className="alert alert-error text-sm mb-4">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-24">
            <span className="loading loading-spinner loading-lg" style={{ color: '#ff6a00' }} />
          </div>
        ) : records.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20">
            <p className="text-gray-400 text-sm">No cargo release records found.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {records.map((r) => {
              const conditionsMet = CONDITIONS.every((c) => r[c.field]);
              const route = r.booking?.containers
                ? `${r.booking.containers.origin_city} → ${r.booking.containers.destination_city}`
                : 'Route unavailable';

              return (
                <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Card header */}
                  <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-gray-800">{route}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">
                        Booking: {r.booking_id.slice(0, 8).toUpperCase()} · Created {fmt(r.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className="badge text-white font-semibold capitalize"
                        style={{ backgroundColor: STATUS_COLOURS[r.status] ?? '#6b7280' }}
                      >
                        {r.status}
                      </span>
                      {r.status === 'authorized' && (
                        <button
                          onClick={() => updateStatus(r, 'released')}
                          disabled={!!saving}
                          className="btn btn-sm text-white font-bold rounded-xl"
                          style={{ backgroundColor: '#3b82f6' }}
                        >
                          Mark Released
                        </button>
                      )}
                      {r.status === 'pending' && !conditionsMet && (
                        <button
                          onClick={() => updateStatus(r, 'held')}
                          disabled={!!saving}
                          className="btn btn-sm rounded-xl text-red-500 border border-red-200 hover:bg-red-50"
                        >
                          Place Hold
                        </button>
                      )}
                      {r.status === 'held' && (
                        <button
                          onClick={() => updateStatus(r, 'pending')}
                          disabled={!!saving}
                          className="btn btn-sm rounded-xl text-gray-500 border border-gray-200"
                        >
                          Remove Hold
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Conditions */}
                  <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CONDITIONS.map((cond) => {
                      const isChecked = r[cond.field];
                      const isSaving  = saving === r.id + cond.field;
                      return (
                        <div
                          key={cond.field}
                          className="flex items-center justify-between p-3 rounded-xl border"
                          style={isChecked
                            ? { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }
                            : { backgroundColor: '#fafafa', borderColor: '#e5e7eb' }}
                        >
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{cond.label}</p>
                            <p className="text-xs text-gray-400">{cond.description}</p>
                          </div>
                          <button
                            onClick={() => toggleCondition(r, cond.field)}
                            disabled={!!saving || r.status === 'released'}
                            className="btn btn-sm rounded-xl font-semibold shrink-0 ml-3"
                            style={isChecked
                              ? { backgroundColor: '#22c55e', color: '#fff', border: 'none' }
                              : { backgroundColor: '#fff', color: '#6b7280', border: '1px solid #d1d5db' }}
                          >
                            {isSaving
                              ? <span className="loading loading-spinner loading-xs" />
                              : isChecked ? <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5" strokeWidth={3} /> Confirmed</span> : 'Confirm'}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {conditionsMet && r.status !== 'released' && (
                    <div className="mx-6 mb-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm text-green-700 font-semibold">
                      <Check className="w-4 h-4" strokeWidth={3} /> All conditions met, cargo authorized for release
                      {r.authorized_at && <span className="font-normal text-green-500 ml-1">({fmt(r.authorized_at)})</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
