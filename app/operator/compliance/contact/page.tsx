'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';
import ComplianceStepper from '@/components/ComplianceStepper';

type ContactForm = {
  contact_person: string;
  phone_number:   string;
  address:        string;
  country:        string;
};

const COUNTRIES = [
  'South Africa', 'Afghanistan', 'Albania', 'Algeria', 'Angola', 'Argentina',
  'Australia', 'Austria', 'Azerbaijan', 'Bahrain', 'Bangladesh', 'Belarus',
  'Belgium', 'Benin', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil',
  'Bulgaria', 'Burkina Faso', 'Cameroon', 'Canada', 'Chad', 'Chile', 'China',
  'Colombia', 'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus',
  'Czech Republic', 'Denmark', 'Dominican Republic', 'Ecuador', 'Egypt',
  'El Salvador', 'Ethiopia', 'Finland', 'France', 'Gabon', 'Germany', 'Ghana',
  'Greece', 'Guatemala', 'Guinea', 'Honduras', 'Hungary', 'India', 'Indonesia',
  'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Ivory Coast', 'Jamaica',
  'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait', 'Lebanon', 'Libya',
  'Lithuania', 'Madagascar', 'Malawi', 'Malaysia', 'Mali', 'Mauritania',
  'Mauritius', 'Mexico', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia',
  'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'Norway',
  'Oman', 'Pakistan', 'Panama', 'Paraguay', 'Peru', 'Philippines', 'Poland',
  'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saudi Arabia',
  'Senegal', 'Serbia', 'Sierra Leone', 'Singapore', 'Somalia', 'South Korea',
  'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Sweden', 'Switzerland',
  'Syria', 'Taiwan', 'Tanzania', 'Thailand', 'Togo', 'Tunisia', 'Turkey',
  'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States',
  'Uruguay', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
].sort((a, b) => {
  if (a === 'South Africa') return -1;
  if (b === 'South Africa') return 1;
  return a.localeCompare(b);
});

export default function ComplianceContactPage() {
  const router = useRouter();

  const [profileId, setProfileId] = useState<string | null>(null);
  const [form,      setForm]      = useState<ContactForm>({ contact_person: '', phone_number: '', address: '', country: 'South Africa' });
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/login?next=/operator/compliance/contact'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role_type', 'operator')
        .single();

      if (!profile) { setError('Operator profile not found.'); setLoading(false); return; }
      setProfileId(profile.id);

      const { data: op } = await supabase
        .from('operator_profiles')
        .select('contact_person, phone_number, address, country')
        .eq('profile_id', profile.id)
        .single();

      if (op) {
        setForm({
          contact_person: op.contact_person ?? '',
          phone_number:   op.phone_number   ?? '',
          address:        op.address        ?? '',
          country:        op.country        ?? 'South Africa',
        });
      }
      setLoading(false);
    }
    load();
  }, [router]);

  function update(field: keyof ContactForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.phone_number.trim()) { setError('Phone number is required.'); return; }
    if (!profileId) return;

    setSaving(true);
    setError(null);

    const { error: updateErr } = await supabase
      .from('operator_profiles')
      .update({
        contact_person: form.contact_person.trim() || null,
        phone_number:   form.phone_number.trim(),
        address:        form.address.trim() || null,
        country:        form.country,
      })
      .eq('profile_id', profileId);

    if (updateErr) { setError(updateErr.message); setSaving(false); return; }
    router.push('/operator/bank');
  }

  if (loading) {
    return <div className="flex justify-center py-24"><span className="loading loading-spinner loading-lg" style={{ color: '#ff6a00' }} /></div>;
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <ComplianceStepper current={2} />
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-gray-800">Contact Details</h1>
        <p className="text-sm text-gray-400 mt-0.5">Used for operational communication and payout notifications.</p>
      </div>

      {error && <div className="alert alert-error text-sm mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Contact Person</label>
          <p className="text-xs text-gray-400 mb-1.5">Full name of the person we should contact for operational matters.</p>
          <input
            type="text"
            value={form.contact_person}
            onChange={(e) => update('contact_person', e.target.value)}
            placeholder="e.g. John Dlamini"
            className="input input-bordered w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={form.phone_number}
            onChange={(e) => update('phone_number', e.target.value)}
            placeholder="+27 82 123 4567"
            className="input input-bordered w-full font-mono"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Business Address</label>
          <textarea
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
            placeholder="Street address, city, postal code"
            className="textarea textarea-bordered w-full h-24 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Country</label>
          <select
            value={form.country}
            onChange={(e) => update('country', e.target.value)}
            className="select select-bordered w-full"
          >
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60 mt-2"
          style={{ backgroundColor: '#0b103a' }}
        >
          {saving ? <span className="loading loading-spinner loading-sm" /> : 'Save & Continue →'}
        </button>
      </form>
    </div>
  );
}
