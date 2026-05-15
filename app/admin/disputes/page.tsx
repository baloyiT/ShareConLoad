'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/services/supabaseClient';
import PageHero from '@/components/PageHero';

type Dispute = {
  id: string;
  booking_id: string;
  dispute_type: string;
  description: string;
  status: string;
  resolution_notes: string | null;
  created_at: string;
  submitted_by_profile: { full_name: string | null } | null;
  booking: { containers: { origin_city: string; destination_city: string } | null } | null;
};

const STATUS_COLOURS: Record<string, string> = {
  open:         '#f97316',
  under_review: '#3b82f6',
  resolved:     '#22c55e',
  closed:       '#6b7280',
};

const DISPUTE_TYPE_LABELS: Record<string, string> = {
  cargo_damage:   'Cargo Damage',
  short_delivery: 'Short Delivery',
  overcharge:     'Overcharge',
  delay:          'Delay',
  other:          'Other',
};

const NEXT_STATUSES: Record<string, string[]> = {
  open:         ['under_review', 'closed'],
  under_review: ['resolved', 'closed'],
  resolved:     ['closed'],
  closed:       [],
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminDisputesPage() {
  const [disputes,         setDisputes]         = useState<Dispute[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState<string | null>(null);
  const [statusFilter,     setStatusFilter]     = useState<string>('all');
  const [selected,         setSelected]         = useState<Dispute | null>(null);
  const [resolutionNotes,  setResolutionNotes]  = useState('');
  const [newStatus,        setNewStatus]        = useState('');
  const [updating,         setUpdating]         = useState(false);
  const [updateError,      setUpdateError]      = useState<string | null>(null);

  async function fetchDisputes() {
    const { data, error: err } = await supabase
      .from('disputes')
      .select(`
        id, booking_id, dispute_type, description, status, resolution_notes, created_at,
        submitted_by_profile:profiles!disputes_submitted_by_fkey(full_name),
        booking:bookings(containers(origin_city, destination_city))
      `)
      .order('created_at', { ascending: false });

    if (err) { setError(err.message); }
    else { setDisputes((data ?? []) as unknown as Dispute[]); }
    setLoading(false);
  }

  useEffect(() => { fetchDisputes(); }, []);

  const filtered = statusFilter === 'all' ? disputes : disputes.filter((d) => d.status === statusFilter);

  function openModal(d: Dispute) {
    setSelected(d);
    setResolutionNotes(d.resolution_notes ?? '');
    setNewStatus(d.status);
    setUpdateError(null);
  }

  async function saveUpdate() {
    if (!selected) return;
    setUpdating(true);
    setUpdateError(null);

    const { error: err } = await supabase
      .from('disputes')
      .update({
        status:           newStatus,
        resolution_notes: resolutionNotes.trim() || null,
        ...(newStatus === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
      })
      .eq('id', selected.id);

    if (err) { setUpdateError(err.message); setUpdating(false); return; }

    setDisputes((prev) =>
      prev.map((d) => d.id === selected.id
        ? { ...d, status: newStatus, resolution_notes: resolutionNotes.trim() || null }
        : d),
    );
    setSelected(null);
    setUpdating(false);
  }

  const STATUS_TABS = ['all', 'open', 'under_review', 'resolved', 'closed'];

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
          <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-800">← Admin</Link>
        </div>
      </nav>

      <PageHero gradient label="Admin" title="Disputes" description="Review and resolve customer disputes." />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {error && <div className="alert alert-error text-sm mb-4">{error}</div>}

        {/* Status filter */}
        <div className="flex gap-2 flex-wrap mb-6">
          {STATUS_TABS.map((s) => {
            const count  = s === 'all' ? disputes.length : disputes.filter((d) => d.status === s).length;
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors"
                style={active
                  ? { backgroundColor: '#0f2044', color: '#fff', borderColor: '#0f2044' }
                  : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}
              >
                {s === 'all' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                {count > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                    style={active ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' } : { backgroundColor: '#f3f4f6', color: '#374151' }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 text-center">
            <p className="text-gray-400">No disputes found.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['ID', 'Customer', 'Route', 'Type', 'Status', 'Submitted', ''].map((h) => (
                      <th key={h} className="py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => {
                    const route = d.booking?.containers
                      ? `${d.booking.containers.origin_city} → ${d.booking.containers.destination_city}`
                      : '—';
                    return (
                      <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-xs text-gray-400">{d.id.slice(0, 8)}…</td>
                        <td className="py-3.5 px-4 text-sm text-gray-700">
                          {d.submitted_by_profile?.full_name ?? <span className="text-gray-400 italic">Unknown</span>}
                        </td>
                        <td className="py-3.5 px-4 text-sm font-medium text-gray-700">{route}</td>
                        <td className="py-3.5 px-4">
                          <span className="badge badge-sm bg-gray-100 text-gray-600 border-0">
                            {DISPUTE_TYPE_LABELS[d.dispute_type] ?? d.dispute_type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="badge badge-sm text-white font-semibold capitalize"
                            style={{ backgroundColor: STATUS_COLOURS[d.status] ?? '#6b7280' }}>
                            {d.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-sm text-gray-500">{fmt(d.created_at)}</td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => openModal(d)}
                            className="btn btn-ghost btn-xs text-gray-400 hover:text-gray-700 rounded-lg"
                          >
                            Review →
                          </button>
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

      {/* Review modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-extrabold text-gray-800">Review Dispute</h3>
              <button onClick={() => setSelected(null)} className="btn btn-ghost btn-sm btn-circle text-gray-400">✕</button>
            </div>

            <div className="px-6 py-4 flex flex-col gap-4">
              <div className="bg-gray-50 rounded-xl p-4 text-sm flex flex-col gap-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Type</span>
                  <span className="font-semibold">{DISPUTE_TYPE_LABELS[selected.dispute_type] ?? selected.dispute_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Submitted</span>
                  <span>{fmt(selected.created_at)}</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Description</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3">{selected.description}</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">Update Status</label>
                <select className="select select-bordered w-full" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                  <option value={selected.status}>{selected.status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())} (current)</option>
                  {NEXT_STATUSES[selected.status]?.map((s) => (
                    <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-gray-700">Resolution Notes</label>
                <textarea
                  className="textarea textarea-bordered w-full h-24 resize-none"
                  placeholder="Add notes about your decision or resolution…"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                />
              </div>

              {updateError && (
                <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{updateError}</p>
              )}
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setSelected(null)} className="btn btn-ghost flex-1 rounded-xl text-gray-500">
                Cancel
              </button>
              <button
                onClick={saveUpdate}
                disabled={updating}
                className="btn flex-1 text-white font-bold rounded-xl hover:opacity-90"
                style={{ backgroundColor: '#0f2044' }}
              >
                {updating ? <span className="loading loading-spinner loading-sm" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
