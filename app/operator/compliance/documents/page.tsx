'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';

type DocStatus = 'under_review' | 'approved' | 'rejected';

type DocType =
  | 'identity'
  | 'business_registration'
  | 'proof_of_warehouse_address'
  | 'tax_clearance'
  | 'banking_confirmation'
  | 'cargo_insurance'
  | 'freight_forwarding_license';

type DocRecord = {
  id: string;
  doc_type: DocType;
  file_url: string;
  status: DocStatus;
  admin_notes: string | null;
  uploaded_at: string;
};

type DocSlot = {
  type: DocType;
  label: string;
  desc: string;
  optional: boolean;
  record: DocRecord | null;
  uploading: boolean;
  error: string | null;
};

const DOC_DEFS: { type: DocType; label: string; desc: string; optional?: boolean }[] = [
  { type: 'identity',                   label: 'Proof of Identity',           desc: 'Valid passport or national ID of the director or owner' },
  { type: 'business_registration',      label: 'Business Registration',       desc: "Certificate of incorporation or registration from your country's business registry" },
  { type: 'proof_of_warehouse_address', label: 'Proof of Business Address',   desc: 'Utility bill, lease agreement, or rates notice confirming your business or office address' },
  { type: 'tax_clearance',              label: 'Tax Clearance Certificate',   desc: "Tax compliance certificate from your country's revenue authority, required for payout approval" },
  { type: 'banking_confirmation',       label: 'Banking Confirmation',        desc: 'Official letter from your bank confirming your account details' },
  { type: 'cargo_insurance',            label: 'Cargo Insurance Certificate', desc: 'Cargo or freight insurance policy covering goods in your care, custody, and control', optional: true },
  { type: 'freight_forwarding_license', label: 'Freight Forwarding License',  desc: "Freight forwarding or customs broker license issued by your country's relevant authority (if applicable)", optional: true },
];

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg':      'jpg',
  'image/png':       'png',
  'image/webp':      'webp',
};

const STATUS_BADGE: Record<DocStatus, { label: string; className: string }> = {
  under_review: { label: 'Under Review', className: 'bg-amber-100 text-amber-700' },
  approved:     { label: 'Verified',     className: 'bg-green-100 text-green-700' },
  rejected:     { label: 'Failed',       className: 'bg-red-100 text-red-600'     },
};

export default function ComplianceDocumentsPage() {
  const router = useRouter();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [operatorProfileId, setOperatorProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [slots, setSlots] = useState<DocSlot[]>(
    DOC_DEFS.map((d) => ({ ...d, optional: d.optional ?? false, record: null, uploading: false, error: null }))
  );

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/login?next=/operator/compliance/documents'); return; }

      const { data: profile } = await supabase
        .from('profiles').select('id')
        .eq('user_id', user.id).eq('role_type', 'operator').single();
      if (!profile) { setPageError('Operator profile not found.'); setLoading(false); return; }

      const { data: op } = await supabase
        .from('operator_profiles').select('id')
        .eq('profile_id', profile.id).single();
      if (!op) { setPageError('Operator details not found.'); setLoading(false); return; }

      setOperatorProfileId(op.id);

      const { data: docs } = await supabase
        .from('compliance_documents')
        .select('id, doc_type, file_url, status, admin_notes, uploaded_at')
        .eq('operator_profile_id', op.id);

      const recordMap: Record<string, DocRecord> = {};
      for (const d of (docs ?? []) as DocRecord[]) recordMap[d.doc_type] = d;

      setSlots(DOC_DEFS.map((d) => ({
        ...d,
        optional: d.optional ?? false,
        record: recordMap[d.type] ?? null,
        uploading: false,
        error: null,
      })));
      setLoading(false);
    }
    load();
  }, [router]);

  function setSlot(type: DocType, patch: Partial<DocSlot>) {
    setSlots((prev) => prev.map((s) => s.type === type ? { ...s, ...patch } : s));
  }

  async function handleFile(docType: DocType, file: File) {
    if (!operatorProfileId) return;

    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setSlot(docType, { error: 'Only PDF, JPG, PNG or WEBP accepted.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSlot(docType, { error: 'File must be under 10 MB.' });
      return;
    }

    setSlot(docType, { uploading: true, error: null });

    const ext  = MIME_TO_EXT[file.type];
    const path = `${operatorProfileId}/${docType}.${ext}`;

    const { error: storageErr } = await supabase.storage
      .from('compliance-documents')
      .upload(path, file, { upsert: true });

    if (storageErr) {
      setSlot(docType, { uploading: false, error: storageErr.message });
      return;
    }

    const { data: upserted, error: dbErr } = await supabase
      .from('compliance_documents')
      .upsert(
        {
          operator_profile_id: operatorProfileId,
          doc_type: docType,
          file_url: path,
          status: 'under_review',
          admin_notes: null,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: 'operator_profile_id,doc_type' }
      )
      .select('id, doc_type, file_url, status, admin_notes, uploaded_at')
      .single();

    if (dbErr || !upserted) {
      setSlot(docType, { uploading: false, error: dbErr?.message ?? 'Failed to save record.' });
      return;
    }

    setSlot(docType, { uploading: false, record: upserted as DocRecord });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-gray-800">Documents</h1>
        <p className="text-sm text-gray-400 mt-0.5">Required documents for KYC and payout eligibility.</p>
      </div>

      {pageError && <div className="alert alert-error text-sm mb-4">{pageError}</div>}

      <div className="flex flex-col gap-4">
        {slots.map((slot) => {
          const badge = slot.record ? STATUS_BADGE[slot.record.status] : null;
          const isApproved = slot.record?.status === 'approved';

          return (
            <div key={slot.type} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <p className="text-sm font-semibold text-gray-700">{slot.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{slot.desc}</p>
                </div>
                {badge && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${badge.className}`}>
                    {badge.label}
                  </span>
                )}
                {!slot.record && !slot.uploading && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 bg-gray-100 text-gray-500">
                    {slot.optional ? 'Optional' : 'Not uploaded'}
                  </span>
                )}
              </div>

              {/* Rejection reason */}
              {slot.record?.status === 'rejected' && (
                <div className="mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <p className="text-xs font-semibold text-red-600 mb-0.5">Reason for failure</p>
                  <p className="text-xs text-red-500">
                    {slot.record.admin_notes ?? 'No reason provided, contact support if you need clarification.'}
                  </p>
                </div>
              )}

              {/* Error */}
              {slot.error && (
                <p className="text-xs text-red-500 mt-2">{slot.error}</p>
              )}

              {/* Upload area, hidden if approved */}
              {!isApproved && (
                <div className="mt-3">
                  <input
                    ref={(el) => { fileInputRefs.current[slot.type] = el; }}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(slot.type, file);
                      e.target.value = '';
                    }}
                  />
                  {slot.uploading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="loading loading-spinner loading-xs" style={{ color: '#f97316' }} />
                      Uploading…
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRefs.current[slot.type]?.click()}
                      className="btn btn-sm rounded-xl text-xs font-semibold"
                      style={slot.record
                        ? { backgroundColor: '#f3f4f6', color: '#374151' }
                        : { backgroundColor: '#0f2044', color: '#ffffff' }}
                    >
                      {slot.record ? 'Replace file' : 'Upload document'}
                    </button>
                  )}
                </div>
              )}

              {/* Approved lock message */}
              {isApproved && (
                <p className="text-xs text-green-600 mt-2">
                  Document verified, no changes required.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
