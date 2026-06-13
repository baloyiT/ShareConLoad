'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';

const STEPS = ['Personal Details', 'Documents', 'Review'];

const DOCS = [
  { key: 'id_document',      label: 'Identity Document (ID / Passport)',  required: true  },
  { key: 'proof_of_address', label: 'Proof of Address',                   required: false },
] as const;

type DocKey = typeof DOCS[number]['key'];

export default function CustomerKycDocuments() {
  const router = useRouter();
  const [files, setFiles] = useState<Partial<Record<DocKey, File>>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(key: DocKey, file: File | undefined) {
    setFiles((prev) => ({ ...prev, [key]: file }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const missing = DOCS.filter((d) => d.required && !files[d.key]);
    if (missing.length > 0) {
      setError(`Please upload: ${missing.map((d) => d.label).join(', ')}`);
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError('Not authenticated.'); return; }

      const urls: Partial<Record<string, string>> = {};

      for (const { key } of DOCS) {
        const file = files[key];
        if (!file) continue;
        const ext = file.name.split('.').pop();
        const path = `${user.id}/${key}_${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('customer-kyc')
          .upload(path, file, { upsert: true });
        if (uploadErr) throw new Error(`Upload failed for ${key}: ${uploadErr.message}`);
        const { data: urlData } = supabase.storage.from('customer-kyc').getPublicUrl(path);
        urls[`${key}_url`] = urlData.publicUrl;
      }

      const formData = new FormData();
      if (urls['id_document_url'])      formData.append('id_document_url',      urls['id_document_url']);
      if (urls['proof_of_address_url']) formData.append('proof_of_address_url', urls['proof_of_address_url']);

      const { saveCustomerKycDocs } = await import('@/actions/customerKycActions');
      const result = await saveCustomerKycDocs(null, formData);
      if (result?.error) { setError(result.error); return; }

      router.push('/onboarding/customer/status');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}>
      <nav className="flex items-center px-6 py-4">
        <Link href="/onboarding/customer" className="text-2xl font-extrabold tracking-tight">
          <span className="text-white">Share</span><span style={{ color: '#f97316' }}>Con</span><span className="text-white">Load</span>
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold`}
                style={i === 1 ? { backgroundColor: '#f97316', color: '#fff' } : i < 1 ? { backgroundColor: 'rgba(255,255,255,0.6)', color: '#374151' } : { backgroundColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)' }}
              >
                {i < 1 ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="w-8 h-0.5 bg-white/20" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg">
          <span className="inline-block text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-orange-50 text-orange-500 mb-3">
            Step 2 of 2 — Documents
          </span>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Upload your documents</h1>
          <p className="text-gray-500 text-sm mb-6">PDF, JPG, or PNG. Max 10MB each.</p>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {DOCS.map(({ key, label, required }) => (
              <div key={key}>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  {label} {required && <span className="text-red-500">*</span>}
                  {!required && <span className="text-gray-400 font-normal"> (optional)</span>}
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileChange(key, e.target.files?.[0])}
                  className="file-input file-input-bordered w-full text-sm"
                />
                {files[key] && (
                  <p className="text-xs text-green-600 mt-1">✓ {files[key]!.name}</p>
                )}
              </div>
            ))}

            <div className="flex gap-3 pt-2">
              <Link href="/onboarding/customer" className="btn btn-ghost flex-1 rounded-xl text-gray-500">← Back</Link>
              <button
                type="submit"
                disabled={uploading}
                className="btn flex-1 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#f97316' }}
              >
                {uploading ? <span className="loading loading-spinner loading-sm" /> : 'Submit for Review →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
