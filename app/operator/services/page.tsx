'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';
import ComplianceStepper from '@/components/ComplianceStepper';
import CoverageEditor from '@/components/CoverageEditor';
import type { OperatorService, ServiceCategory } from '@/services/freightTypes';

export default function OperatorServicesPage() {
  const router = useRouter();

  const [operatorProfileId, setOperatorProfileId] = useState<string | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth/login?next=/operator/services'); return; }

      // A user can hold several profile rows, so take the operator ones and look for the details.
      const { data: profiles } = await supabase
        .from('profiles').select('id').eq('user_id', user.id).eq('role_type', 'operator');
      const profileIds = (profiles ?? []).map((p) => p.id as string);
      const { data: ops } = profileIds.length > 0
        ? await supabase.from('operator_profiles').select('id').in('profile_id', profileIds).limit(1)
        : { data: [] as { id: string }[] };
      const op = ops?.[0];
      if (!op) { setError('Operator profile not found.'); setLoading(false); return; }
      setOperatorProfileId(op.id);

      const [cats, mine] = await Promise.all([
        supabase.from('service_categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('operator_services').select('*').eq('operator_profile_id', op.id),
      ]);
      if (cats.error || mine.error) {
        console.error('Could not load services:', cats.error ?? mine.error);
        setError('We could not load the services. Please refresh and try again.');
      }
      setCategories((cats.data ?? []) as ServiceCategory[]);
      setSelected(new Set(((mine.data ?? []) as OperatorService[]).map((s) => s.service_category_id)));
      setLoading(false);
    }
    load();
  }, [router]);

  async function toggle(categoryId: string, on: boolean) {
    if (!operatorProfileId) return;
    setError(null);
    const apply = (value: boolean) => setSelected((prev) => {
      const next = new Set(prev);
      if (value) next.add(categoryId); else next.delete(categoryId);
      return next;
    });
    apply(on);
    const { error: err } = on
      ? await supabase.from('operator_services').insert({ operator_profile_id: operatorProfileId, service_category_id: categoryId })
      : await supabase.from('operator_services').delete()
          .eq('operator_profile_id', operatorProfileId).eq('service_category_id', categoryId);
    if (err) {
      console.error('Could not update service:', err);
      apply(!on);
      setError('We could not save that change. Please try again.');
    }
  }

  if (loading) {
    return <div className="flex justify-center py-24"><span className="loading loading-spinner loading-lg" style={{ color: '#FF6A00' }} /></div>;
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <ComplianceStepper current="services" />
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-gray-800">Services &amp; coverage</h1>
        <p className="text-sm text-gray-400 mt-0.5">Tell customers what you offer and the routes you cover. Both appear in the directory.</p>
      </div>

      {error && <div role="alert" className="alert alert-error text-sm mb-4">{error}</div>}

      {operatorProfileId && (
        <div className="flex flex-col gap-6">
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-800 mb-3">Services you offer</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={selected.has(c.id)}
                    onChange={(e) => toggle(c.id, e.target.checked)}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-base font-bold text-gray-800 mb-3">Routes you cover</h2>
            <CoverageEditor operatorProfileId={operatorProfileId} />
          </section>

          <Link href="/operator/compliance/documents" className="btn text-white border-0 self-start" style={{ backgroundColor: '#FF6A00' }}>
            Continue
          </Link>
        </div>
      )}
    </div>
  );
}
