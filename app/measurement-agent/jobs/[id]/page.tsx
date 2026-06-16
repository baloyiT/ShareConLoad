'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';
import { Camera, CheckCircle2 } from 'lucide-react';

type Job = {
  id: string;
  pickup_address: string;
  pickup_city: string;
  pickup_country: string;
  quoted_fee: number;
  status: string;
  assigned_at: string | null;
};

type ItemForm = {
  description: string;
  quantity: number;
  length_m: string;
  width_m: string;
  height_m: string;
  weight_kg: string;
};

const PHOTO_TYPES = ['cargo_1', 'cargo_2', 'cargo_3', 'cargo_4', 'tape_measure', 'scale', 'location'] as const;
type PhotoType = typeof PHOTO_TYPES[number];

const PHOTO_LABELS: Record<PhotoType, string> = {
  cargo_1: 'Cargo 1',
  cargo_2: 'Cargo 2',
  cargo_3: 'Cargo 3',
  cargo_4: 'Cargo 4',
  tape_measure: 'Tape Measure',
  scale: 'Scale',
  location: 'Location',
};

function emptyItem(): ItemForm {
  return { description: '', quantity: 1, length_m: '', width_m: '', height_m: '', weight_kg: '' };
}

function calcCbm(item: ItemForm): number {
  const l = parseFloat(item.length_m);
  const w = parseFloat(item.width_m);
  const h = parseFloat(item.height_m);
  if (isNaN(l) || isNaN(w) || isNaN(h)) return 0;
  return Math.round(l * w * h * 1000) / 1000;
}

// MUST be outside the page component to prevent remounting on state changes
function UploadSlot({
  photoType,
  label,
  file,
  onChange,
}: {
  photoType: PhotoType;
  label: string;
  file: File | null;
  onChange: (type: PhotoType, file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = file ? URL.createObjectURL(file) : null;

  return (
    <div
      onClick={() => inputRef.current?.click()}
      className="aspect-square bg-gray-100 rounded-xl overflow-hidden cursor-pointer hover:bg-gray-200 flex flex-col items-center justify-center border-2 border-dashed border-gray-300"
    >
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt={label} className="w-full h-full object-cover" />
      ) : (
        <>
          <Camera className="w-6 h-6 text-gray-400" />
          <span className="text-[10px] text-gray-500 mt-1 text-center px-1">{label}</span>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) onChange(photoType, e.target.files[0]); }}
      />
    </div>
  );
}

export default function AgentJobDetailPage() {
  const params = useParams();
  const jobId = params.id as string;
  const router = useRouter();
  const [job, setJob]               = useState<Job | null>(null);
  const [agentProfileId, setAgentProfileId] = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [items, setItems]           = useState<ItemForm[]>([emptyItem()]);
  const [photos, setPhotos]         = useState<Partial<Record<PhotoType, File>>>({});
  const [agentNotes, setAgentNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role_type')
        .eq('user_id', user.id)
        .single();

      if (!profile || profile.role_type !== 'measurement_agent') { router.push('/'); return; }

      const { data: agentProfile } = await supabase
        .from('measurement_agent_profiles')
        .select('id')
        .eq('profile_id', profile.id)
        .single();

      if (!agentProfile) { router.push('/measurement-agent'); return; }
      setAgentProfileId(agentProfile.id);

      const { data: jobData } = await supabase
        .from('measurement_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('measurement_agent_profile_id', agentProfile.id)
        .single();

      if (!jobData) { router.push('/measurement-agent/jobs'); return; }
      setJob(jobData as Job);
      setLoading(false);
    }
    init();
  }, [jobId, router]);

  async function handleStartJob() {
    if (!job) return;
    const { error: updateError } = await supabase
      .from('measurement_jobs')
      .update({ status: 'in_progress', started_at: new Date().toISOString() })
      .eq('id', job.id);
    if (!updateError) setJob({ ...job, status: 'in_progress' });
  }

  function updateItem(index: number, field: keyof ItemForm, value: string | number) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addItem() { setItems((prev) => [...prev, emptyItem()]); }
  function removeItem(i: number) { setItems((prev) => prev.filter((_, idx) => idx !== i)); }

  function handlePhotoChange(type: PhotoType, file: File) {
    setPhotos((prev) => ({ ...prev, [type]: file }));
  }

  async function handleSubmitReport() {
    if (!job || !agentProfileId) return;

    const missingPhotos = PHOTO_TYPES.filter((t) => !photos[t]);
    if (missingPhotos.length > 0) {
      setError(`Missing photos: ${missingPhotos.map((t) => PHOTO_LABELS[t]).join(', ')}`);
      return;
    }
    if (items.length === 0 || items.some((i) => !i.description.trim())) {
      setError('All items must have a description.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();

    // Upload photos
    const uploadedPhotos: Array<{ type: PhotoType; url: string }> = [];
    for (const photoType of PHOTO_TYPES) {
      const file = photos[photoType]!;
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${agentProfileId}/${job.id}/${photoType}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('measurement-report-photos')
        .upload(path, file, { upsert: true });
      if (uploadError) { setError(`Photo upload failed: ${uploadError.message}`); setSubmitting(false); return; }
      const { data: urlData } = supabase.storage.from('measurement-report-photos').getPublicUrl(uploadData.path);
      uploadedPhotos.push({ type: photoType, url: urlData.publicUrl });
    }

    // Calculate totals
    const itemsWithCbm = items.map((item) => {
      const cbmPerUnit = calcCbm(item);
      const qty = Number(item.quantity) || 1;
      return {
        description: item.description.trim(),
        quantity: qty,
        length_m: parseFloat(item.length_m) || null,
        width_m: parseFloat(item.width_m) || null,
        height_m: parseFloat(item.height_m) || null,
        weight_kg: parseFloat(item.weight_kg) || null,
        cbm_per_unit: cbmPerUnit || null,
        total_cbm: cbmPerUnit ? Math.round(cbmPerUnit * qty * 1000) / 1000 : null,
      };
    });
    const totalCbm = itemsWithCbm.reduce((sum, i) => sum + (i.total_cbm ?? 0), 0);
    const totalWeight = itemsWithCbm.reduce((sum, i) => sum + (i.weight_kg ?? 0) * (i.quantity ?? 1), 0);

    // Generate report ref
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { count } = await supabase
      .from('measurement_reports')
      .select('id', { count: 'exact', head: true });
    const seq = String((count ?? 0) + 1).padStart(3, '0');
    const reportRef = `MCR-${today}-${seq}`;

    // Insert report
    const { data: reportRow, error: reportError } = await supabase
      .from('measurement_reports')
      .insert({
        job_id: job.id,
        total_cbm: Math.round(totalCbm * 1000) / 1000,
        total_weight_kg: totalWeight || null,
        item_count: items.length,
        platform_report_ref: reportRef,
        agent_notes: agentNotes.trim() || null,
      })
      .select('id')
      .single();

    if (reportError || !reportRow) {
      setError('Failed to create report: ' + (reportError?.message ?? 'unknown error'));
      setSubmitting(false);
      return;
    }

    // Insert items
    await supabase.from('measurement_job_items').insert(
      itemsWithCbm.map((item) => ({ ...item, job_id: job.id }))
    );

    // Insert photo records
    await supabase.from('measurement_report_photos').insert(
      uploadedPhotos.map((p) => ({
        report_id: reportRow.id,
        photo_type: p.type,
        file_url: p.url,
      }))
    );

    // Update job to completed
    await supabase
      .from('measurement_jobs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', job.id);

    // Trigger payout via Edge Function (best-effort; don't block on errors)
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/trigger-measurement-agent-payout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ jobId: job.id }),
        }
      );
    } catch (payoutErr) {
      console.error('Payout trigger failed (non-blocking):', payoutErr);
    }

    // Increment agent job counter via RPC
    await supabase.rpc('increment_agent_jobs', { agent_id: agentProfileId });

    router.push('/measurement-agent/jobs');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" style={{ color: '#ff6a00' }} />
      </div>
    );
  }
  if (!job) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/measurement-agent/jobs" className="text-sm text-gray-400 hover:underline">← My Jobs</Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-2 mb-1">Job — {job.pickup_city}</h1>
        <p className="text-sm text-gray-500 mb-6">{job.pickup_address}</p>

        {job.status === 'assigned' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <p className="text-gray-600 mb-6">Travel to the shipper&apos;s location and start the measurement when you arrive.</p>
            <button
              onClick={handleStartJob}
              className="btn text-white font-bold px-8 rounded-xl"
              style={{ backgroundColor: '#ff6a00' }}
            >
              Start Job
            </button>
          </div>
        )}

        {job.status === 'in_progress' && (
          <>
            {error && <div className="alert alert-error text-sm mb-4">{error}</div>}

            {/* Items */}
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Measured Items</p>
              {items.map((item, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-3 mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-gray-700">Item {i + 1}</span>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(i)} className="btn btn-xs btn-ghost text-red-400">Remove</button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(i, 'description', e.target.value)}
                    placeholder="Description"
                    className="input input-bordered input-sm w-full mb-2"
                  />
                  <div className="grid grid-cols-4 gap-2">
                    {(['length_m', 'width_m', 'height_m'] as const).map((dim) => (
                      <div key={dim}>
                        <label className="text-[10px] text-gray-400">{dim === 'length_m' ? 'L (m)' : dim === 'width_m' ? 'W (m)' : 'H (m)'}</label>
                        <input type="number" step="0.01" min="0" value={item[dim]}
                          onChange={(e) => updateItem(i, dim, e.target.value)}
                          className="input input-bordered input-xs w-full" />
                      </div>
                    ))}
                    <div>
                      <label className="text-[10px] text-gray-400">Qty</label>
                      <input type="number" min="1" value={item.quantity}
                        onChange={(e) => updateItem(i, 'quantity', parseInt(e.target.value) || 1)}
                        className="input input-bordered input-xs w-full" />
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <div>
                      <label className="text-[10px] text-gray-400">Weight (kg)</label>
                      <input type="number" step="0.1" min="0" value={item.weight_kg}
                        onChange={(e) => updateItem(i, 'weight_kg', e.target.value)}
                        className="input input-bordered input-xs w-24" />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400">CBM per unit</p>
                      <p className="text-sm font-bold" style={{ color: '#ff6a00' }}>{calcCbm(item).toFixed(3)}</p>
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addItem} className="btn btn-sm btn-ghost w-full">+ Add Item</button>
              <div className="mt-3 pt-3 border-t flex justify-between text-sm font-bold">
                <span>Total CBM</span>
                <span style={{ color: '#ff6a00' }}>
                  {items.reduce((sum, item) => sum + calcCbm(item) * (Number(item.quantity) || 1), 0).toFixed(3)}
                </span>
              </div>
            </div>

            {/* Photos */}
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Required Photos (7)</p>
              <p className="text-xs text-gray-400 mb-4">All 7 photos are required before you can submit.</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {PHOTO_TYPES.map((type) => (
                  <UploadSlot
                    key={type}
                    photoType={type}
                    label={PHOTO_LABELS[type]}
                    file={photos[type] ?? null}
                    onChange={handlePhotoChange}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">{Object.keys(photos).length} / 7 uploaded</p>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-2">Agent Notes (optional)</label>
              <textarea
                rows={3}
                value={agentNotes}
                onChange={(e) => setAgentNotes(e.target.value)}
                placeholder="Any notes about the cargo condition, access, or discrepancies…"
                className="textarea textarea-bordered w-full resize-none text-sm"
              />
            </div>

            <button
              onClick={handleSubmitReport}
              disabled={submitting}
              className="btn w-full text-white font-bold rounded-xl text-base disabled:opacity-60"
              style={{ backgroundColor: '#ff6a00' }}
            >
              {submitting ? <span className="loading loading-spinner loading-sm" /> : 'Submit Report & Complete Job'}
            </button>
          </>
        )}

        {job.status === 'completed' && (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <CheckCircle2 className="w-10 h-10 mb-3 mx-auto text-green-500" />
            <h2 className="text-lg font-bold text-gray-800 mb-2">Job Complete</h2>
            <p className="text-sm text-gray-500">Your payout of 80% of the job fee has been triggered.</p>
          </div>
        )}
      </div>
    </div>
  );
}
