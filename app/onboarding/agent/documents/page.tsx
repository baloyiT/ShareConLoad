// app/onboarding/agent/documents/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';
import { Check } from 'lucide-react';

type DocKey = 'doc_license' | 'doc_business_reg' | 'doc_identity' | 'doc_proof_address';

const DOCS: { key: DocKey; label: string; required: boolean }[] = [
  { key: 'doc_license',       label: 'Freight Forwarder License',          required: true },
  { key: 'doc_business_reg',  label: 'Business Registration Certificate',   required: true },
  { key: 'doc_identity',      label: 'Identity Document (Contact Person)',   required: true },
  { key: 'doc_proof_address', label: 'Proof of Address',                    required: false },
];

const STEPS = ['Business Details', 'Credentials', 'Documents', 'Bank Details', 'Review'];

export default function AgentOnboardingStep3() {
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
          .from('agent-documents')
          .upload(path, file, { upsert: true });
        if (uploadErr) throw new Error(`Upload failed for ${key}: ${uploadErr.message}`);
        const { data: urlData } = supabase.storage.from('agent-documents').getPublicUrl(path);
        urls[`${key}_url`] = urlData.publicUrl;
      }

      const formData = new FormData();
      Object.entries(urls).forEach(([k, v]) => { if (v) formData.append(k, v); });

      const { saveAgentDocUrls } = await import('@/actions/agentActions');
      const result = await saveAgentDocUrls(null, formData);
      if (result?.error) { setError(result.error); return; }

      router.push('/onboarding/agent/bank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0b103a 0%, #1a3a6b 100%)' }}>
      <nav className="flex items-center px-6 py-4">
        <Link href="/onboarding/agent/credentials" className="flex items-center gap-2.5">
          <Image src="/logo1.png" alt="" width={32} height={32} className="h-7 w-auto" />
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-white">Share</span><span style={{ color: '#ff6a00' }}>Con</span><span className="text-white">Load</span>
          </span>
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 2 ? 'bg-green-500 text-white' : i < 2 ? 'bg-white/60 text-gray-700' : 'bg-white/20 text-white/60'}`}>
                {i < 2 ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className="w-8 h-0.5 bg-white/20" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg">
          <span className="inline-block text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-green-50 text-green-600 mb-3">
            Step 3 of 5 — Documents
          </span>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Upload your documents</h1>
          <p className="text-gray-500 text-sm mb-6">PDF or image files. Max 10MB each.</p>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {DOCS.map(({ key, label, required }) => (
              <div key={key}>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  {label} {required && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => handleFileChange(key, e.target.files?.[0])}
                  className="file-input file-input-bordered w-full text-sm"
                />
                {files[key] && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><Check className="w-3 h-3" strokeWidth={3} /> {files[key]!.name}</p>
                )}
              </div>
            ))}

            <div className="flex gap-3 pt-2">
              <Link href="/onboarding/agent/credentials" className="btn btn-ghost flex-1 rounded-xl text-gray-500">← Back</Link>
              <button
                type="submit"
                disabled={uploading}
                className="btn flex-1 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#16a34a' }}
              >
                {uploading ? <span className="loading loading-spinner loading-sm" /> : 'Upload & Continue →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
