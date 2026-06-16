'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

type Job = {
  id: string;
  pickup_address: string;
  pickup_city: string;
  pickup_country: string;
  quoted_fee: number;
  status: string;
  payment_ref: string | null;
  created_at: string;
  assigned_at: string | null;
  completed_at: string | null;
};

type ReportItem = {
  id: string;
  description: string;
  quantity: number;
  length_m: number | null;
  width_m: number | null;
  height_m: number | null;
  weight_kg: number | null;
  total_cbm: number | null;
};

type Report = {
  id: string;
  total_cbm: number;
  total_weight_kg: number | null;
  item_count: number | null;
  platform_report_ref: string | null;
  agent_notes: string | null;
  generated_at: string;
  measurement_job_items: ReportItem[];
};

type Photo = { id: string; photo_type: string; file_url: string; signedUrl?: string };

const STATUS_STEPS = ['pending_payment', 'paid', 'assigned', 'in_progress', 'completed'] as const;
const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Awaiting Payment',
  paid:            'Payment Confirmed',
  assigned:        'Agent Assigned',
  in_progress:     'Measurement Underway',
  completed:       'Report Ready',
  cancelled:       'Cancelled',
};

async function getSignedUrl(storedUrl: string, bucket: string): Promise<string | null> {
  const marker = `/object/public/${bucket}/`;
  const idx = storedUrl.indexOf(marker);
  if (idx < 0) return null;
  const path = decodeURIComponent(storedUrl.slice(idx + marker.length));
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

function fmtMoney(v: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(v);
}

function JobTrackContent({ jobId }: { jobId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [job, setJob]           = useState<Job | null>(null);
  const [report, setReport]     = useState<Report | null>(null);
  const [photos, setPhotos]     = useState<Photo[]>([]);
  const [loading, setLoading]   = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      if (searchParams.get('verify') === '1') {
        setVerifying(true);
        const { data: jobData } = await supabase
          .from('measurement_jobs')
          .select('payment_ref')
          .eq('id', jobId)
          .single();

        if (jobData?.payment_ref) {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/verify-measurement-payment`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.access_token ?? ''}`,
              },
              body: JSON.stringify({ reference: jobData.payment_ref }),
            }
          );
          const result = await res.json();
          setVerifyMsg(
            res.ok
              ? 'Payment confirmed! An agent will be assigned shortly.'
              : (result.error ?? 'Verification failed.')
          );
        }
        setVerifying(false);
      }

      await loadJob();
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  async function loadJob() {
    setLoading(true);
    const { data: jobData } = await supabase
      .from('measurement_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (!jobData) { router.push('/'); return; }
    setJob(jobData as Job);

    if (jobData.status === 'completed') {
      const { data: reportData } = await supabase
        .from('measurement_reports')
        .select('*, measurement_job_items(*)')
        .eq('job_id', jobId)
        .single();

      if (reportData) {
        setReport(reportData as Report);

        const { data: photoData } = await supabase
          .from('measurement_report_photos')
          .select('*')
          .eq('report_id', reportData.id);

        const withSigned = await Promise.all(
          ((photoData ?? []) as Photo[]).map(async (p) => ({
            ...p,
            signedUrl: await getSignedUrl(p.file_url, 'measurement-report-photos') ?? undefined,
          }))
        );
        setPhotos(withSigned);
      }
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" style={{ color: '#ff6a00' }} />
      </div>
    );
  }

  if (!job) return null;

  const stepIndex = STATUS_STEPS.indexOf(job.status as typeof STATUS_STEPS[number]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/measurement-service" className="text-sm text-gray-400 hover:underline">← Measurement Service</Link>
        <h1 className="text-2xl font-extrabold text-gray-800 mt-2 mb-6">Measurement Job</h1>

        {verifying && (
          <div className="alert mb-4">
            <span className="loading loading-spinner loading-sm" />
            <span className="text-sm">Verifying payment…</span>
          </div>
        )}

        {verifyMsg && (
          <div className={`alert text-sm mb-4 ${verifyMsg.includes('confirmed') ? 'alert-success' : 'alert-error'}`}>
            {verifyMsg}
          </div>
        )}

        {/* Status steps */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Progress</p>
          <div className="flex items-start justify-between">
            {STATUS_STEPS.map((s, i) => (
              <div key={s} className="flex flex-col items-center flex-1">
                <div className={`w-4 h-4 rounded-full border-2 ${i <= stepIndex ? 'border-orange-500 bg-orange-500' : 'border-gray-300 bg-white'}`} />
                <span className="text-[10px] text-gray-500 mt-1 text-center leading-tight px-1">{STATUS_LABELS[s]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Job details */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Job Details</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Address</span><span className="font-medium">{job.pickup_address}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">City</span><span className="font-medium">{job.pickup_city}, {job.pickup_country}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Service Fee</span><span className="font-medium">{fmtMoney(job.quoted_fee)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="font-medium">{STATUS_LABELS[job.status] ?? job.status}</span></div>
          </div>
        </div>

        {/* Report */}
        {report && (
          <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Measurement Report</p>
              {report.platform_report_ref && (
                <span className="text-xs font-mono text-gray-400">{report.platform_report_ref}</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="text-center">
                <p className="text-2xl font-extrabold text-gray-800">{report.total_cbm.toFixed(3)}</p>
                <p className="text-xs text-gray-500">Total CBM</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-gray-800">{report.total_weight_kg ?? '—'}</p>
                <p className="text-xs text-gray-500">Weight (kg)</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-extrabold text-gray-800">{report.item_count ?? 0}</p>
                <p className="text-xs text-gray-500">Items</p>
              </div>
            </div>

            {report.measurement_job_items?.length > 0 && (
              <table className="table table-xs w-full mb-4">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th>Description</th><th>Qty</th><th>L×W×H (m)</th><th>CBM</th>
                  </tr>
                </thead>
                <tbody>
                  {report.measurement_job_items.map((item) => (
                    <tr key={item.id}>
                      <td className="text-sm">{item.description}</td>
                      <td className="text-sm">{item.quantity}</td>
                      <td className="text-sm text-gray-500">
                        {item.length_m ?? '?'} × {item.width_m ?? '?'} × {item.height_m ?? '?'}
                      </td>
                      <td className="text-sm font-semibold">{item.total_cbm?.toFixed(3) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {report.agent_notes && (
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600">
                <p className="text-xs font-bold text-gray-400 mb-1">Agent Notes</p>
                {report.agent_notes}
              </div>
            )}

            {photos.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Evidence Photos</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {photos.map((photo) => (
                    <a key={photo.id} href={photo.signedUrl ?? '#'} target="_blank" rel="noopener noreferrer"
                      className="block aspect-square bg-gray-100 rounded-xl overflow-hidden hover:opacity-80 transition-opacity">
                      {photo.signedUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo.signedUrl} alt={photo.photo_type} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-xs text-gray-400">{photo.photo_type}</div>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MeasurementJobTrackPage({ params }: { params: { jobId: string } }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" style={{ color: '#ff6a00' }} />
      </div>
    }>
      <JobTrackContent jobId={params.jobId} />
    </Suspense>
  );
}
