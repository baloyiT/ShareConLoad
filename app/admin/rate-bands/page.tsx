'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

type RateBand = {
  id: string;
  zone_name: string;
  base_fee: number;
  active: boolean;
  created_at: string;
};

function fmtMoney(v: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(v);
}

export default function AdminRateBandsPage() {
  const router = useRouter();
  const [bands, setBands]       = useState<RateBand[]>([]);
  const [loading, setLoading]   = useState(true);
  const [zoneName, setZoneName] = useState('');
  const [baseFee, setBaseFee]   = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }
      const { data: profiles } = await supabase.from('profiles').select('is_admin').eq('user_id', user.id);
      const isAdmin = Array.isArray(profiles) && profiles.some((p) => p.is_admin === true);
      if (!isAdmin) { router.push('/'); return; }
      await load();
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('measurement_rate_bands')
      .select('*')
      .order('created_at', { ascending: false });
    setBands((data ?? []) as RateBand[]);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!zoneName.trim() || !baseFee.trim()) { setError('Zone name and base fee are required.'); return; }
    const fee = parseFloat(baseFee);
    if (isNaN(fee) || fee <= 0) { setError('Base fee must be a positive number.'); return; }
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase
      .from('measurement_rate_bands')
      .insert({ zone_name: zoneName.trim(), base_fee: fee });
    if (insertError) { setError(insertError.message); } else { setZoneName(''); setBaseFee(''); await load(); }
    setSaving(false);
  }

  async function handleToggleActive(band: RateBand) {
    await supabase
      .from('measurement_rate_bands')
      .update({ active: !band.active })
      .eq('id', band.id);
    await load();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/admin" className="text-sm text-gray-400 hover:underline">← Admin</Link>
            <h1 className="text-2xl font-extrabold text-gray-800 mt-1">Measurement Rate Bands</h1>
          </div>
        </div>

        {error && <div className="alert alert-error text-sm mb-4">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-8">
            {bands.length === 0 ? (
              <div className="text-center py-12 text-gray-400">No rate bands yet. Create one below.</div>
            ) : (
              <table className="table w-full">
                <thead>
                  <tr className="text-xs text-gray-500 bg-gray-50">
                    <th>Zone Name</th>
                    <th>Base Fee</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bands.map((band) => (
                    <tr key={band.id} className="hover:bg-gray-50">
                      <td className="font-semibold text-sm text-gray-800">{band.zone_name}</td>
                      <td className="text-sm text-gray-700">{fmtMoney(band.base_fee)}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${band.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {band.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => handleToggleActive(band)}
                          className="btn btn-xs btn-ghost"
                        >
                          {band.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-base font-bold text-gray-800 mb-4">Add Rate Band</h2>
          <form onSubmit={handleCreate} className="flex gap-3 flex-wrap">
            <input
              type="text"
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              placeholder="Zone name (e.g. Johannesburg Metro)"
              className="input input-bordered input-sm flex-1 min-w-48"
            />
            <input
              type="number"
              value={baseFee}
              onChange={(e) => setBaseFee(e.target.value)}
              placeholder="Base fee (ZAR)"
              min="1"
              step="0.01"
              className="input input-bordered input-sm w-40"
            />
            <button
              type="submit"
              disabled={saving}
              className="btn btn-sm text-white font-bold disabled:opacity-60"
              style={{ backgroundColor: '#f97316' }}
            >
              {saving ? <span className="loading loading-spinner loading-xs" /> : 'Add'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
