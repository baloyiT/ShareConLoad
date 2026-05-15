'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/services/supabaseClient';
import PageHero from '@/components/PageHero';

// ─── Types ────────────────────────────────────────────────────────────────────

type Dispute = {
  id: string;
  dispute_type: string;
  description: string;
  status: string;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  booking: {
    id: string;
    containers: { origin_city: string; destination_city: string } | null;
  } | null;
};

type Evidence = {
  id: string;
  file_url: string;
  file_name: string;
  description: string | null;
  created_at: string;
};

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  cargo_damage:     'Cargo Damage',
  cargo_missing:    'Cargo Missing',
  short_delivery:   'Short Delivery',
  shipment_delay:   'Shipment Delay',
  delay:            'Unreasonable Delay',
  overcharge:       'Overcharge',
  customs_issue:    'Customs Issue',
  refund_request:   'Refund Request',
  operator_conduct: 'Operator Conduct',
  other:            'Other',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  submitted:          { label: 'Submitted',        color: '#f59e0b', bg: '#fffbeb' },
  under_review:       { label: 'Under Review',     color: '#3b82f6', bg: '#eff6ff' },
  awaiting_evidence:  { label: 'Awaiting Evidence',color: '#f97316', bg: '#fff7ed' },
  resolved_customer:  { label: 'Resolved',         color: '#22c55e', bg: '#f0fdf4' },
  resolved_operator:  { label: 'Resolved',         color: '#22c55e', bg: '#f0fdf4' },
  closed:             { label: 'Closed',           color: '#6b7280', bg: '#f9fafb' },
};

const RESOLVED_STATUSES = new Set(['resolved_customer', 'resolved_operator', 'closed']);
const UPLOAD_CLOSED     = new Set(['resolved_customer', 'resolved_operator', 'closed']);

const STORAGE_BUCKET = 'dispute-evidence';

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DisputeDetailPage() {
  const { id: disputeId } = useParams<{ id: string }>();
  const router = useRouter();

  const [dispute,     setDispute]     = useState<Dispute | null>(null);
  const [evidence,    setEvidence]    = useState<Evidence[]>([]);
  const [profileId,   setProfileId]   = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  // Upload state
  const fileInputRef                    = useRef<HTMLInputElement>(null);
  const [uploadFile,     setUploadFile]     = useState<File | null>(null);
  const [uploadDesc,     setUploadDesc]     = useState('');
  const [uploading,      setUploading]      = useState(false);
  const [uploadError,    setUploadError]    = useState<string | null>(null);
  const [uploadSuccess,  setUploadSuccess]  = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace(`/auth/login?next=/disputes/${disputeId}`); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) { setError('Profile not found.'); setLoading(false); return; }
      setProfileId(profile.id);

      const [disputeRes, evidenceRes] = await Promise.all([
        supabase
          .from('disputes')
          .select(`
            id, dispute_type, description, status, resolution_notes, resolved_at, created_at,
            booking:bookings!disputes_booking_id_fkey(id, containers(origin_city, destination_city))
          `)
          .eq('id', disputeId)
          .single(),
        supabase
          .from('dispute_evidence')
          .select('id, file_url, file_name, description, created_at')
          .eq('dispute_id', disputeId)
          .order('created_at', { ascending: true }),
      ]);

      if (disputeRes.error || !disputeRes.data) {
        setError('Dispute not found or access denied.');
      } else {
        setDispute(disputeRes.data as unknown as Dispute);
        setEvidence((evidenceRes.data ?? []) as Evidence[]);
      }
      setLoading(false);
    }
    if (disputeId) load();
  }, [disputeId, router]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile || !profileId || !dispute) return;

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    const ext      = uploadFile.name.split('.').pop() ?? 'bin';
    const path     = `${disputeId}/${Date.now()}.${ext}`;

    const { error: storageErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, uploadFile, { upsert: false });

    if (storageErr) {
      setUploadError(storageErr.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);

    const { error: insertErr } = await supabase.from('dispute_evidence').insert({
      dispute_id:  disputeId,
      uploaded_by: profileId,
      file_url:    urlData.publicUrl,
      file_name:   uploadFile.name,
      description: uploadDesc.trim() || null,
    });

    if (insertErr) {
      setUploadError(insertErr.message);
      setUploading(false);
      return;
    }

    // Refresh evidence list
    const { data: refreshed } = await supabase
      .from('dispute_evidence')
      .select('id, file_url, file_name, description, created_at')
      .eq('dispute_id', disputeId)
      .order('created_at', { ascending: true });

    setEvidence((refreshed ?? []) as Evidence[]);
    setUploadFile(null);
    setUploadDesc('');
    setUploadSuccess(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploading(false);
  }

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
      </div>
    );
  }

  if (error || !dispute) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 text-center px-4">
        <p className="text-gray-500">{error ?? 'Dispute not found.'}</p>
        <Link href="/bookings" className="btn btn-sm text-white" style={{ backgroundColor: '#0f2044' }}>
          ← My Bookings
        </Link>
      </div>
    );
  }

  const stCfg  = STATUS_CONFIG[dispute.status] ?? STATUS_CONFIG.submitted;
  const route  = dispute.booking?.containers
    ? `${dispute.booking.containers.origin_city} → ${dispute.booking.containers.destination_city}`
    : 'Route unavailable';
  const isResolved = RESOLVED_STATUSES.has(dispute.status);
  const canUpload  = !UPLOAD_CLOSED.has(dispute.status);

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
          <Link href="/bookings" className="text-sm text-gray-500 hover:text-gray-800">← My Bookings</Link>
        </div>
      </nav>

      <PageHero
        gradient
        label="Dispute"
        title={route}
        description={<span className="font-mono">#{disputeId.slice(0, 8).toUpperCase()}</span>}
        rightSlot={
          <span
            className="text-sm font-bold px-3 py-1.5 rounded-full mt-1"
            style={{ backgroundColor: stCfg.bg, color: stCfg.color }}
          >
            {stCfg.label}
          </span>
        }
      />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

        {/* Dispute detail card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">Dispute Details</h2>
            <span className="text-xs text-gray-400">Submitted {fmt(dispute.created_at)}</span>
          </div>
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Type</span>
              <span className="font-semibold text-gray-800">{TYPE_LABELS[dispute.dispute_type] ?? dispute.dispute_type}</span>
            </div>
            {dispute.booking && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Booking</span>
                <Link
                  href={`/payments/${dispute.booking.id}`}
                  className="font-mono text-xs text-blue-600 hover:underline"
                >
                  #{dispute.booking.id.slice(0, 8).toUpperCase()}
                </Link>
              </div>
            )}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1.5">Description</p>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{dispute.description}</p>
            </div>
          </div>
        </div>

        {/* Awaiting evidence notice */}
        {dispute.status === 'awaiting_evidence' && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-sm text-orange-800">
            <p className="font-semibold mb-0.5">Action required — please upload supporting evidence</p>
            <p className="text-xs text-orange-600">
              Our team has requested additional evidence to proceed with your case.
              Upload relevant photos, documents, or other files below.
            </p>
          </div>
        )}

        {/* Resolution card */}
        {isResolved && dispute.resolution_notes && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-800 mb-3">Resolution</h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{dispute.resolution_notes}</p>
            {dispute.resolved_at && (
              <p className="text-xs text-gray-400 mt-3">Resolved on {fmt(dispute.resolved_at)}</p>
            )}
          </div>
        )}

        {/* Evidence list */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4">
            Evidence
            {evidence.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">({evidence.length} file{evidence.length !== 1 ? 's' : ''})</span>
            )}
          </h2>

          {evidence.length === 0 ? (
            <p className="text-sm text-gray-400">No evidence uploaded yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {evidence.map((ev) => (
                <a
                  key={ev.id}
                  href={ev.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#f0f4ff' }}>
                    <svg className="w-4 h-4" style={{ color: '#0f2044' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate group-hover:text-blue-600">{ev.file_name}</p>
                    {ev.description && <p className="text-xs text-gray-400 truncate">{ev.description}</p>}
                    <p className="text-xs text-gray-300">{fmt(ev.created_at)}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Upload form */}
        {canUpload && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-800 mb-1">Upload Evidence</h2>
            <p className="text-xs text-gray-400 mb-4">
              Accepted: images, PDFs, and documents up to 10 MB each.
            </p>

            {uploadSuccess && (
              <div className="alert mb-4 text-sm font-medium" style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                File uploaded successfully.
              </div>
            )}
            {uploadError && (
              <div className="alert alert-error text-sm mb-4">{uploadError}</div>
            )}

            <form onSubmit={handleUpload} className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  File <span className="text-red-500">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  className="file-input file-input-bordered w-full text-sm"
                  onChange={(e) => {
                    setUploadFile(e.target.files?.[0] ?? null);
                    setUploadSuccess(false);
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Photo of damaged goods upon arrival"
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  className="input input-bordered w-full text-sm"
                  maxLength={200}
                />
              </div>

              <button
                type="submit"
                disabled={!uploadFile || uploading}
                className="btn text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60 self-start"
                style={{ backgroundColor: '#0f2044' }}
              >
                {uploading
                  ? <span className="loading loading-spinner loading-sm" />
                  : 'Upload File'}
              </button>
            </form>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex gap-3">
          <Link href="/bookings" className="btn btn-ghost flex-1 rounded-xl text-gray-500 text-sm">
            ← My Bookings
          </Link>
          {dispute.booking && (
            <Link
              href={`/payments/${dispute.booking.id}`}
              className="btn btn-ghost flex-1 rounded-xl text-gray-500 text-sm"
            >
              View Payment
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
