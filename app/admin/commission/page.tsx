'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/services/supabaseClient';
import PageHero from '@/components/PageHero';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier = {
  min:  number;
  max:  number | null;
  rate: number; // stored as decimal (0.12), displayed as percent (12)
};

type CommissionConfig = {
  id:              string;
  commission_type: 'fixed' | 'tiered';
  fixed_rate:      number;
  tiers:           Tier[];
  updated_at:      string;
};

// ─── Default tiers (mirrors DB seed) ──────────────────────────────────────────

const DEFAULT_TIERS: Tier[] = [
  { min: 0,     max: 5000,  rate: 0.12 },
  { min: 5001,  max: 20000, rate: 0.10 },
  { min: 20001, max: 50000, rate: 0.08 },
  { min: 50001, max: null,  rate: 0.06 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: string) {
  return new Date(d).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function pct(rate: number) {
  return (rate * 100).toFixed(2).replace(/\.?0+$/, '');
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminCommissionPage() {
  const [config,   setConfig]   = useState<CommissionConfig | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);

  // Working copies
  const [type,      setType]      = useState<'fixed' | 'tiered'>('tiered');
  const [fixedPct,  setFixedPct]  = useState('5');
  const [tiers,     setTiers]     = useState<Tier[]>(DEFAULT_TIERS);

  useEffect(() => {
    async function load() {
      const { data, error: err } = await supabase
        .from('platform_commission_config')
        .select('id, commission_type, fixed_rate, tiers, updated_at')
        .single();

      if (err || !data) {
        setError('Could not load commission config. Check that you are logged in as admin.');
      } else {
        const cfg = data as CommissionConfig;
        setConfig(cfg);
        setType(cfg.commission_type);
        setFixedPct(pct(cfg.fixed_rate));
        setTiers(cfg.tiers.length ? cfg.tiers : DEFAULT_TIERS);
      }
      setLoading(false);
    }
    load();
  }, []);

  // ── Tier row helpers ───────────────────────────────────────────────────────

  function updateTier(idx: number, field: keyof Tier, raw: string) {
    setTiers((prev) => {
      const next = [...prev];
      if (field === 'max') {
        next[idx] = { ...next[idx], max: raw === '' ? null : Number(raw) };
      } else if (field === 'rate') {
        next[idx] = { ...next[idx], rate: Number(raw) / 100 };
      } else {
        next[idx] = { ...next[idx], min: Number(raw) };
      }
      return next;
    });
  }

  function addTier() {
    setTiers((prev) => [
      ...prev,
      { min: 0, max: null, rate: 0.05 },
    ]);
  }

  function removeTier(idx: number) {
    setTiers((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!config) return;
    setError(null);
    setSuccess(false);
    setSaving(true);

    const payload: Partial<CommissionConfig> & { updated_at: string } = {
      commission_type: type,
      fixed_rate:      type === 'fixed' ? Number(fixedPct) / 100 : config.fixed_rate,
      tiers:           type === 'tiered' ? tiers : config.tiers,
      updated_at:      new Date().toISOString(),
    };

    const { error: err } = await supabase
      .from('platform_commission_config')
      .update(payload)
      .eq('id', config.id);

    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
      setConfig((prev) => prev ? { ...prev, ...payload } as CommissionConfig : prev);
      setTimeout(() => setSuccess(false), 3000);
    }
    setSaving(false);
  }

  // ── Preview ───────────────────────────────────────────────────────────────

  function previewCommission(gross: number): string {
    if (type === 'fixed') {
      const rate = Number(fixedPct) / 100;
      const c = Math.round(gross * rate * 100) / 100;
      return `R${c.toFixed(2)} (${fixedPct}%)`;
    }
    const tier = tiers.find(t => gross >= t.min && (t.max === null || gross <= t.max));
    if (!tier) return '—';
    const c = Math.round(gross * tier.rate * 100) / 100;
    return `R${c.toFixed(2)} (${pct(tier.rate)}%)`;
  }

  const PREVIEW_AMOUNTS = [2500, 10000, 35000, 75000];

  return (
    <div className="min-h-screen bg-gray-50 font-sans">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 sm:px-10 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo1.png" alt="" width={40} height={40} className="h-9 w-auto" />
            <span className="text-xl font-extrabold tracking-tight">
              <span style={{ color: '#0f2044' }}>Share</span>
              <span style={{ color: '#f97316' }}>Con</span>
              <span style={{ color: '#0f2044' }}>Load</span>
            </span>
          </Link>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-800">← Admin</Link>
        </div>
      </nav>

      <PageHero
        gradient
        label="Admin"
        title="Commission Settings"
        description={<>Set a fixed rate or configure tiered rates based on shipment value.{config && <span className="ml-2">Last updated: {fmt(config.updated_at)}</span>}</>}
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

        {error   && <div className="alert alert-error text-sm">{error}</div>}
        {success && <div className="alert text-sm font-semibold" style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>Commission settings saved successfully.</div>}

        {loading ? (
          <div className="flex justify-center py-24">
            <span className="loading loading-spinner loading-lg" style={{ color: '#f97316' }} />
          </div>
        ) : (
          <>
            {/* ── Commission Type Toggle ─────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-bold text-gray-800 mb-4">Commission Type</h2>
              <div className="flex gap-3">
                {(['tiered', 'fixed'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className="flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all"
                    style={type === t
                      ? { backgroundColor: '#0f2044', color: '#fff', borderColor: '#0f2044' }
                      : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}
                  >
                    {t === 'tiered' ? 'Tiered (by value)' : 'Fixed rate'}
                  </button>
                ))}
              </div>

              {type === 'tiered' && (
                <p className="text-xs text-gray-400 mt-3">
                  Commission rate decreases as shipment value increases — operators pay less as their volumes grow.
                </p>
              )}
              {type === 'fixed' && (
                <p className="text-xs text-gray-400 mt-3">
                  A single percentage applied to every payout regardless of amount.
                </p>
              )}
            </div>

            {/* ── Fixed Rate Editor ──────────────────────────────────────── */}
            {type === 'fixed' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-bold text-gray-800 mb-4">Fixed Commission Rate</h2>
                <div className="flex items-center gap-3 max-w-xs">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="0.1"
                    value={fixedPct}
                    onChange={(e) => setFixedPct(e.target.value)}
                    className="input input-bordered flex-1 text-right font-mono text-lg font-bold"
                    style={{ borderColor: '#e5e7eb' }}
                  />
                  <span className="text-2xl font-extrabold text-gray-500">%</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">Enter the rate as a percentage (e.g. 5 = 5%)</p>
              </div>
            )}

            {/* ── Tiered Rate Editor ─────────────────────────────────────── */}
            {type === 'tiered' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-bold text-gray-800">Commission Tiers</h2>
                  <button
                    onClick={addTier}
                    className="btn btn-sm font-bold rounded-lg text-white"
                    style={{ backgroundColor: '#f97316' }}
                  >
                    + Add Tier
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="table w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        {['Min Amount (R)', 'Max Amount (R)', 'Rate (%)', ''].map((h) => (
                          <th key={h} className="py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-left">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tiers.map((tier, idx) => (
                        <tr key={idx} className="border-b border-gray-50">
                          <td className="py-2 px-4">
                            <input
                              type="number"
                              min="0"
                              value={tier.min}
                              onChange={(e) => updateTier(idx, 'min', e.target.value)}
                              className="input input-sm input-bordered w-28 font-mono"
                            />
                          </td>
                          <td className="py-2 px-4">
                            <input
                              type="number"
                              min="0"
                              value={tier.max ?? ''}
                              placeholder="No limit"
                              onChange={(e) => updateTier(idx, 'max', e.target.value)}
                              className="input input-sm input-bordered w-28 font-mono"
                            />
                          </td>
                          <td className="py-2 px-4">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={parseFloat((tier.rate * 100).toFixed(4))}
                                onChange={(e) => updateTier(idx, 'rate', e.target.value)}
                                className="input input-sm input-bordered w-20 font-mono text-right"
                              />
                              <span className="text-gray-400 font-bold">%</span>
                            </div>
                          </td>
                          <td className="py-2 px-4">
                            <button
                              onClick={() => removeTier(idx)}
                              className="btn btn-ghost btn-sm text-red-400 hover:text-red-600"
                              title="Remove tier"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    Leave Max blank for the highest tier (&ldquo;R50 001 and above&rdquo;).
                    Tiers are matched from top to bottom — ensure ranges are non-overlapping.
                  </p>
                </div>
              </div>
            )}

            {/* ── Live Preview ───────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-bold text-gray-800 mb-4">Preview</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {PREVIEW_AMOUNTS.map((amt) => (
                  <div key={amt} className="rounded-xl border border-gray-100 p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">R{amt.toLocaleString()}</p>
                    <p className="text-sm font-bold" style={{ color: '#0f2044' }}>
                      {previewCommission(amt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Save Button ────────────────────────────────────────────── */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn font-bold text-white px-8 rounded-xl hover:opacity-90"
                style={{ backgroundColor: '#0f2044' }}
              >
                {saving ? <span className="loading loading-spinner loading-sm" /> : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
