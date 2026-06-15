'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

type MeasurementBand = {
  id: string;
  zone_name: string;
  base_fee: number;
  active: boolean;
  created_at: string;
};

type TransporterBand = {
  id: string;
  zone_name: string;
  origin_city: string;
  origin_country: string;
  base_fee: number;
  per_cbm_fee: number;
  vehicle_type: string | null;
  active: boolean;
  created_at: string;
};

function fmtMoney(v: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(v);
}

export default function AdminRateBandsPage() {
  const router = useRouter();
  const [tab, setTab]           = useState<'measurement' | 'transporter'>('measurement');
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Measurement state
  const [mBands, setMBands]         = useState<MeasurementBand[]>([]);
  const [mZoneName, setMZoneName]   = useState('');
  const [mBaseFee, setMBaseFee]     = useState('');

  // Transporter state
  const [tBands, setTBands]               = useState<TransporterBand[]>([]);
  const [tZoneName, setTZoneName]         = useState('');
  const [tOriginCity, setTOriginCity]     = useState('');
  const [tOriginCountry, setTOriginCountry] = useState('');
  const [tBaseFee, setTBaseFee]           = useState('');
  const [tPerCbmFee, setTPerCbmFee]       = useState('');
  const [tVehicleType, setTVehicleType]   = useState('');

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }
      const { data: profiles } = await supabase.from('profiles').select('is_admin').eq('user_id', user.id);
      const isAdmin = Array.isArray(profiles) && profiles.some((p) => p.is_admin === true);
      if (!isAdmin) { router.push('/'); return; }
      await Promise.all([loadMeasurement(), loadTransporter()]);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMeasurement() {
    setLoading(true);
    const { data } = await supabase
      .from('measurement_rate_bands')
      .select('*')
      .order('created_at', { ascending: false });
    setMBands((data ?? []) as MeasurementBand[]);
    setLoading(false);
  }

  async function loadTransporter() {
    setLoading(true);
    const { data } = await supabase
      .from('transporter_rate_bands')
      .select('*')
      .order('created_at', { ascending: false });
    setTBands((data ?? []) as TransporterBand[]);
    setLoading(false);
  }

  async function handleCreateMeasurement(e: React.FormEvent) {
    e.preventDefault();
    if (!mZoneName.trim() || !mBaseFee.trim()) { setError('Zone name and base fee are required.'); return; }
    const fee = parseFloat(mBaseFee);
    if (isNaN(fee) || fee <= 0) { setError('Base fee must be a positive number.'); return; }
    setSaving(true); setError(null);
    const { error: insertError } = await supabase
      .from('measurement_rate_bands')
      .insert({ zone_name: mZoneName.trim(), base_fee: fee });
    if (insertError) { setError(insertError.message); } else { setMZoneName(''); setMBaseFee(''); await loadMeasurement(); }
    setSaving(false);
  }

  async function handleToggleMeasurement(band: MeasurementBand) {
    await supabase.from('measurement_rate_bands').update({ active: !band.active }).eq('id', band.id);
    await loadMeasurement();
  }

  async function handleCreateTransporter(e: React.FormEvent) {
    e.preventDefault();
    if (!tZoneName.trim() || !tOriginCity.trim() || !tOriginCountry.trim() || !tBaseFee.trim()) {
      setError('Zone name, origin city, origin country, and base fee are required.'); return;
    }
    const fee = parseFloat(tBaseFee);
    if (isNaN(fee) || fee <= 0) { setError('Base fee must be a positive number.'); return; }
    const perCbm = tPerCbmFee ? parseFloat(tPerCbmFee) : 0;
    if (isNaN(perCbm) || perCbm < 0) { setError('Per-CBM fee must be zero or a positive number.'); return; }
    setSaving(true); setError(null);
    const { error: insertError } = await supabase
      .from('transporter_rate_bands')
      .insert({
        zone_name: tZoneName.trim(),
        origin_city: tOriginCity.trim(),
        origin_country: tOriginCountry.trim(),
        base_fee: fee,
        per_cbm_fee: perCbm,
        vehicle_type: tVehicleType.trim() || null,
      });
    if (insertError) {
      setError(insertError.message);
    } else {
      setTZoneName(''); setTOriginCity(''); setTOriginCountry('');
      setTBaseFee(''); setTPerCbmFee(''); setTVehicleType('');
      await loadTransporter();
    }
    setSaving(false);
  }

  async function handleToggleTransporter(band: TransporterBand) {
    await supabase.from('transporter_rate_bands').update({ active: !band.active }).eq('id', band.id);
    await loadTransporter();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-6">
          <Link href="/admin" className="text-sm text-gray-400 hover:underline">← Admin</Link>
          <h1 className="text-2xl font-extrabold text-gray-800 mt-1">Rate Bands</h1>
        </div>

        {/* Tabs */}
        <div className="tabs tabs-boxed bg-white shadow-sm mb-6 p-1 rounded-xl w-fit">
          <button
            className={`tab tab-sm font-semibold rounded-lg ${tab === 'measurement' ? 'tab-active text-white' : 'text-gray-500'}`}
            style={tab === 'measurement' ? { backgroundColor: '#f97316' } : {}}
            onClick={() => { setTab('measurement'); setError(null); }}
          >
            Measurement
          </button>
          <button
            className={`tab tab-sm font-semibold rounded-lg ${tab === 'transporter' ? 'tab-active text-white' : 'text-gray-500'}`}
            style={tab === 'transporter' ? { backgroundColor: '#f97316' } : {}}
            onClick={() => { setTab('transporter'); setError(null); }}
          >
            Transporter
          </button>
        </div>

        {error && <div className="alert alert-error text-sm mb-4">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
          </div>
        ) : tab === 'measurement' ? (
          <>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-8">
              {mBands.length === 0 ? (
                <div className="text-center py-12 text-gray-400">No measurement rate bands yet.</div>
              ) : (
                <table className="table w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 bg-gray-50">
                      <th>Zone Name</th><th>Base Fee</th><th>Status</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mBands.map((band) => (
                      <tr key={band.id} className="hover:bg-gray-50">
                        <td className="font-semibold text-sm text-gray-800">{band.zone_name}</td>
                        <td className="text-sm text-gray-700">{fmtMoney(band.base_fee)}</td>
                        <td>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${band.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {band.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <button onClick={() => handleToggleMeasurement(band)} className="btn btn-xs btn-ghost">
                            {band.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-800 mb-4">Add Measurement Rate Band</h2>
              <form onSubmit={handleCreateMeasurement} className="flex gap-3 flex-wrap">
                <input type="text" value={mZoneName} onChange={(e) => setMZoneName(e.target.value)}
                  placeholder="Zone name (e.g. Johannesburg Metro)"
                  className="input input-bordered input-sm flex-1 min-w-48" />
                <input type="number" value={mBaseFee} onChange={(e) => setMBaseFee(e.target.value)}
                  placeholder="Base fee (ZAR)" min="1" step="0.01"
                  className="input input-bordered input-sm w-40" />
                <button type="submit" disabled={saving}
                  className="btn btn-sm text-white font-bold disabled:opacity-60"
                  style={{ backgroundColor: '#f97316' }}>
                  {saving ? <span className="loading loading-spinner loading-xs" /> : 'Add'}
                </button>
              </form>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-8">
              {tBands.length === 0 ? (
                <div className="text-center py-12 text-gray-400">No transporter rate bands yet.</div>
              ) : (
                <table className="table w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 bg-gray-50">
                      <th>Zone</th><th>Origin City</th><th>Country</th><th>Base Fee</th><th>Per CBM</th><th>Vehicle</th><th>Status</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tBands.map((band) => (
                      <tr key={band.id} className="hover:bg-gray-50">
                        <td className="font-semibold text-sm text-gray-800">{band.zone_name}</td>
                        <td className="text-sm text-gray-700">{band.origin_city}</td>
                        <td className="text-sm text-gray-500">{band.origin_country}</td>
                        <td className="text-sm text-gray-700">{fmtMoney(band.base_fee)}</td>
                        <td className="text-sm text-gray-700">{fmtMoney(band.per_cbm_fee)}</td>
                        <td className="text-sm text-gray-500">{band.vehicle_type ?? '—'}</td>
                        <td>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${band.active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {band.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <button onClick={() => handleToggleTransporter(band)} className="btn btn-xs btn-ghost">
                            {band.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-base font-bold text-gray-800 mb-4">Add Transporter Rate Band</h2>
              <form onSubmit={handleCreateTransporter}>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input type="text" value={tZoneName} onChange={(e) => setTZoneName(e.target.value)}
                    placeholder="Zone name" className="input input-bordered input-sm col-span-2" />
                  <input type="text" value={tOriginCity} onChange={(e) => setTOriginCity(e.target.value)}
                    placeholder="Origin city (e.g. Johannesburg)" className="input input-bordered input-sm" />
                  <input type="text" value={tOriginCountry} onChange={(e) => setTOriginCountry(e.target.value)}
                    placeholder="Country (e.g. South Africa)" className="input input-bordered input-sm" />
                  <input type="number" value={tBaseFee} onChange={(e) => setTBaseFee(e.target.value)}
                    placeholder="Base fee (ZAR)" min="1" step="0.01" className="input input-bordered input-sm" />
                  <input type="number" value={tPerCbmFee} onChange={(e) => setTPerCbmFee(e.target.value)}
                    placeholder="Per-CBM fee (ZAR, optional)" min="0" step="0.01" className="input input-bordered input-sm" />
                  <input type="text" value={tVehicleType} onChange={(e) => setTVehicleType(e.target.value)}
                    placeholder="Vehicle type (optional)" className="input input-bordered input-sm col-span-2" />
                </div>
                <button type="submit" disabled={saving}
                  className="btn btn-sm text-white font-bold disabled:opacity-60"
                  style={{ backgroundColor: '#f97316' }}>
                  {saving ? <span className="loading loading-spinner loading-xs" /> : 'Add Rate Band'}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
