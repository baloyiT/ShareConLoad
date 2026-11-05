'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';
import ComplianceStepper from '@/components/ComplianceStepper';
import { ID_TYPES, TRADING_NAME_MAX_LENGTH, isBlankTradingName } from '@/services/operatorCompliance';

type ProfileForm = {
  entity_type:         string;
  legal_name:          string;
  trading_name:        string;
  registration_number: string;
  vat_number:          string;
  id_type:             string;
  id_number:           string;
  public_description:  string;
};

export default function ComplianceProfilePage() {
  const router = useRouter();

  const [profileId,  setProfileId]  = useState<string | null>(null);
  const [form,       setForm]       = useState<ProfileForm>({ entity_type: 'company', legal_name: '', trading_name: '', registration_number: '', vat_number: '', id_type: 'passport', id_number: '', public_description: '' });
  const [locked,     setLocked]     = useState(false);
  const [tradingLocked, setTradingLocked] = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/login?next=/operator/compliance/profile'); return; }

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
        .select('entity_type, legal_name, trading_name, registration_number, vat_number, id_type, id_number, public_description, verification_level')
        .eq('profile_id', profile.id)
        .single();

      if (op) {
        setForm({
          entity_type:         op.entity_type         ?? 'company',
          legal_name:          op.legal_name          ?? '',
          trading_name:        op.trading_name        ?? '',
          registration_number: op.registration_number ?? '',
          vat_number:          op.vat_number          ?? '',
          id_type:             op.id_type             ?? 'passport',
          id_number:           op.id_number           ?? '',
          public_description:  op.public_description  ?? '',
        });
        setLocked(op.verification_level !== 'registered');
        // A verified operator with no trading name may still add one, once.
        setTradingLocked(op.verification_level !== 'registered' && !isBlankTradingName(op.trading_name));
      }
      setLoading(false);
    }
    load();
  }, [router]);

  function update(field: keyof ProfileForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!locked) {
      if (!form.legal_name.trim()) { setError('Legal name is required.'); return; }
      if (form.entity_type === 'individual' && !form.id_number.trim()) { setError('ID number is required.'); return; }
      if (form.entity_type !== 'individual' && !form.registration_number.trim()) { setError('Registration number is required for companies.'); return; }
    }
    const tradingBlank = isBlankTradingName(form.trading_name);
    if (form.entity_type === 'individual' && tradingBlank) { setError('Trading name is required.'); return; }
    if (Array.from(form.trading_name.trim()).length > TRADING_NAME_MAX_LENGTH) {
      setError(`Trading name must be ${TRADING_NAME_MAX_LENGTH} characters or fewer.`);
      return;
    }
    if (!profileId) return;

    setSaving(true);
    setError(null);

    const individual = form.entity_type === 'individual';
    const publicDescription = form.public_description.trim() || null;
    const vatNumber = individual ? null : (form.vat_number.trim() || null);

    // Identity fields are fixed once verified: the database refuses any change, so never send them.
    const tradingName = tradingLocked ? {} : { trading_name: tradingBlank ? null : form.trading_name.trim() };
    const updates = locked
      ? { public_description: publicDescription, ...tradingName, ...(individual ? {} : { vat_number: vatNumber }) }
      : {
          public_description:  publicDescription,
          ...tradingName,
          vat_number:          vatNumber,
          entity_type:         form.entity_type,
          legal_name:          form.legal_name.trim(),
          registration_number: individual ? null : (form.registration_number.trim() || null),
          id_type:             individual ? form.id_type : null,
          id_number:           individual ? (form.id_number.trim() || null) : null,
        };

    const { error: upsertErr } = await supabase
      .from('operator_profiles')
      .update(updates)
      .eq('profile_id', profileId);

    if (upsertErr) { setError(upsertErr.message); setSaving(false); return; }
    // Navigate to next step, sidebar re-fetches on pathname change
    router.push('/operator/compliance/contact');
  }

  const isIndividual = form.entity_type === 'individual';

  if (loading) {
    return <div className="flex justify-center py-24"><span className="loading loading-spinner loading-lg" style={{ color: '#ff6a00' }} /></div>;
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <ComplianceStepper current="profile" />
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-gray-800">Business Profile</h1>
        <p className="text-sm text-gray-400 mt-0.5">Your legal details, and how you appear in the directory.</p>
      </div>

      {error && <div className="alert alert-error text-sm mb-4">{error}</div>}
      {locked && (
        <div className="alert text-sm mb-4">
          Your legal name, entity type, identity numbers{tradingLocked ? ' and trading name' : ''} are verified and cannot be changed here. To change them, contact support@shareconload.com.
        </div>
      )}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">

        <div>
          <label htmlFor="entity_type" className="block text-sm font-semibold text-gray-700 mb-1">Entity Type</label>
          <select
            id="entity_type"
            disabled={locked}
            value={form.entity_type}
            onChange={(e) => update('entity_type', e.target.value)}
            className="select select-bordered w-full"
          >
            <option value="individual">Individual</option>
            <option value="company">Company / Close Corporation</option>
            <option value="partnership">Partnership</option>
            <option value="trust">Trust</option>
          </select>
        </div>

        <div>
          <label htmlFor="legal_name" className="block text-sm font-semibold text-gray-700 mb-1">
            {isIndividual ? 'Full Legal Name' : 'Registered Company Name'} <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-400 mb-1.5">
            {isIndividual ? 'Your full name exactly as it appears on your ID.' : 'Your registered legal entity name.'}
          </p>
          <input
            id="legal_name"
            disabled={locked}
            type="text"
            value={form.legal_name}
            onChange={(e) => update('legal_name', e.target.value)}
            placeholder={isIndividual ? 'e.g. Thabo Mokoena' : 'e.g. Acme Logistics (Pty) Ltd'}
            className="input input-bordered w-full"
            required
          />
        </div>

        <div>
          <label htmlFor="trading_name" className="block text-sm font-semibold text-gray-700 mb-1">
            Trading name (the name shown publicly in the directory)
            {isIndividual
              ? <> <span className="text-red-500">*</span></>
              : <> <span className="text-gray-400 font-normal">(optional)</span></>}
          </label>
          <p className="text-xs text-gray-400 mb-1.5">
            {isIndividual
              ? 'This is the name customers see. Your legal name is not published.'
              : 'If you leave this blank, your registered company name is shown.'}
            {!tradingLocked && (locked
              ? ' You are verified, so this name locks as soon as you save it.'
              : ' This name locks once you are verified.')}
          </p>
          <input
            id="trading_name"
            disabled={tradingLocked}
            type="text"
            value={form.trading_name}
            onChange={(e) => update('trading_name', e.target.value)}
            maxLength={TRADING_NAME_MAX_LENGTH}
            className="input input-bordered w-full"
          />
        </div>

        {isIndividual && (
          <>
            <div>
              <label htmlFor="id_type" className="block text-sm font-semibold text-gray-700 mb-1">ID Type <span className="text-red-500">*</span></label>
              <select id="id_type" disabled={locked} value={form.id_type} onChange={(e) => update('id_type', e.target.value)} className="select select-bordered w-full">
                {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="id_number" className="block text-sm font-semibold text-gray-700 mb-1">ID Number <span className="text-red-500">*</span></label>
              <input id="id_number" disabled={locked} type="text" value={form.id_number} onChange={(e) => update('id_number', e.target.value)}
                placeholder="Your ID or passport number" className="input input-bordered w-full" />
            </div>
          </>
        )}

        {!isIndividual && (
          <>
            <div>
              <label htmlFor="registration_number" className="block text-sm font-semibold text-gray-700 mb-1">
                Registration Number <span className="text-red-500">*</span>
              </label>
              <input
                id="registration_number"
                disabled={locked}
                type="text"
                value={form.registration_number}
                onChange={(e) => update('registration_number', e.target.value)}
                placeholder="e.g. 2018/123456/07"
                className="input input-bordered w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                VAT Number <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={form.vat_number}
                onChange={(e) => update('vat_number', e.target.value)}
                placeholder="e.g. 4120123456"
                className="input input-bordered w-full"
              />
            </div>
          </>
        )}

        <div>
          <label htmlFor="public_description" className="block text-sm font-semibold text-gray-700 mb-1">Public description (shown in the directory)</label>
          <p className="text-xs text-gray-400 mb-1.5">A short description of what you do.</p>
          <textarea
            id="public_description"
            value={form.public_description}
            onChange={(e) => update('public_description', e.target.value)}
            maxLength={500}
            className="textarea textarea-bordered w-full h-24 resize-none"
          />
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
