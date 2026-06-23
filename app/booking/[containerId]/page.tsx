'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/services/supabaseClient';
import { notify } from '@/services/notificationService';
import { Container } from '@/components/ContainerCard';
import PageHero from '@/components/PageHero';

import { AlertCircle, ArrowRight, Check, Circle, IdCard, Info, Package, Plus, Search } from 'lucide-react';
// ─── Types ────────────────────────────────────────────────────────────────────

type ItemForm = {
  _key: string;
  description: string;
  category: string;
  quantity: string;
  estimated_value: string;
  weight_kg: string;
  volume_cbm: string;
  photos: File[];
};

type FormErrors = Partial<{
  total_cbm: string;
  items: string;
  agreed_terms: string;
  cbm_step1: string;
  submit: string;
  [key: string]: string | undefined;
}>;

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Electronics',
  'Clothing & Apparel',
  'Furniture',
  'Food & Beverages',
  'Automotive Parts',
  'Machinery & Equipment',
  'Personal Effects',
  'Building Materials',
  'Cosmetics & Health',
  'Other',
];

function emptyItem(): ItemForm {
  return {
    _key: crypto.randomUUID(),
    description: '',
    category: '',
    quantity: '1',
    estimated_value: '',
    weight_kg: '',
    volume_cbm: '',
    photos: [],
  };
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookingPage() {
  const { containerId } = useParams<{ containerId: string }>();
  const router = useRouter();

  // Container data
  const [container, setContainer] = useState<Container | null>(null);
  const [loadingContainer, setLoadingContainer] = useState(true);
  const [containerError, setContainerError] = useState(false);

  // Form state
  const [totalCbm, setTotalCbm] = useState('');
  const [items, setItems] = useState<ItemForm[]>([emptyItem()]);
  const [photoPreviews, setPhotoPreviews] = useState<Record<string, string[]>>({});
  const [agreedTerms, setAgreedTerms] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Submission state
  const [kycStatus, setKycStatus] = useState<string | null>(null);
  const [kycLoading, setKycLoading] = useState(true);

  // Agent state
  const [agentProfileId, setAgentProfileId] = useState<string | null>(null);
  const [managedShippers, setManagedShippers] = useState<{ id: string; name: string }[]>([]);
  const [selectedShipperId, setSelectedShipperId] = useState<string>('');

  // CBM declaration state
  const [cbmDeclarationType, setCbmDeclarationType] = useState<'self_declared' | 'measurement_verified'>('self_declared');
  const [cbmStep1Ack, setCbmStep1Ack] = useState(false);
  const [showCbmModal, setShowCbmModal] = useState(false);

  // ── Fetch container ────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchContainer() {
      const { data, error } = await supabase
        .from('containers')
        .select('*')
        .eq('id', containerId)
        .single();

      if (error || !data) {
        console.error('Failed to fetch container:', error);
        setContainerError(true);
      } else {
        setContainer(data as Container);
      }
      setLoadingContainer(false);
    }
    if (containerId) fetchContainer();
  }, [containerId]);

  // ── Check customer KYC status ─────────────────────────────────────────────
  useEffect(() => {
    async function checkKyc() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setKycLoading(false); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role_type', 'customer')
        .maybeSingle();

      if (!profile) { setKycLoading(false); return; }

      const { data: kyc } = await supabase
        .from('customer_kyc')
        .select('status')
        .eq('profile_id', profile.id)
        .maybeSingle();

      setKycStatus(kyc?.status ?? null);
      setKycLoading(false);
    }
    checkKyc();
  }, []);

  // Detect agent session and load managed shippers
  useEffect(() => {
    async function detectAgent() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role_type', 'agent')
        .maybeSingle();

      if (!profile) return;

      const { data: ap } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (!ap) return;
      setAgentProfileId(ap.id);

      const { data: shippers } = await supabase
        .from('agent_managed_shippers')
        .select('id, name')
        .eq('agent_profile_id', ap.id)
        .order('name', { ascending: true });

      setManagedShippers(shippers ?? []);
    }
    detectAgent();
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────
  const cbmValue = parseFloat(totalCbm) || 0;
  const estimatedTotal = container ? cbmValue * container.price_per_cbm : 0;
  const totalDeclaredValue = items.reduce(
    (sum, item) => sum + (parseFloat(item.estimated_value) || 0) * (parseInt(item.quantity) || 1),
    0
  );

  // ── Item helpers ───────────────────────────────────────────────────────────
  const addItem = useCallback(() => {
    setItems((prev) => [...prev, emptyItem()]);
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i._key !== key));
  }, []);

  const updateItem = useCallback(
    (key: string, field: keyof Omit<ItemForm, '_key' | 'photos'>, value: string) => {
      setItems((prev) =>
        prev.map((item) => (item._key === key ? { ...item, [field]: value } : item))
      );
    },
    []
  );

  const addItemPhoto = useCallback((key: string, files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    const oversized = fileArray.find((f) => f.size > 5 * 1024 * 1024);
    if (oversized) {
      setErrors((e) => ({ ...e, [`photo_size_${key}`]: `"${oversized.name}" exceeds 5 MB limit.` }));
      return;
    }
    setErrors((e) => ({ ...e, [`photo_size_${key}`]: undefined }));
    const target = items.find((i) => i._key === key);
    if (!target) return;
    const slots = 3 - target.photos.length;
    if (slots <= 0) return;
    const newFiles = fileArray.slice(0, slots);
    const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
    setItems((prev) =>
      prev.map((i) => {
        if (i._key !== key) return i;
        const remaining = 3 - i.photos.length;
        if (remaining <= 0) return i;
        return { ...i, photos: [...i.photos, ...newFiles.slice(0, remaining)] };
      })
    );
    setPhotoPreviews((prev) => ({
      ...prev,
      [key]: [...(prev[key] ?? []), ...newPreviews],
    }));
  }, [items]);

  const removeItemPhoto = useCallback((key: string, index: number) => {
    setPhotoPreviews((prev) => {
      const preview = prev[key]?.[index];
      if (preview) URL.revokeObjectURL(preview);
      const updated = [...(prev[key] ?? [])];
      updated.splice(index, 1);
      return { ...prev, [key]: updated };
    });
    setItems((prev) =>
      prev.map((i) => {
        if (i._key !== key) return i;
        const updated = [...i.photos];
        updated.splice(index, 1);
        return { ...i, photos: updated };
      })
    );
    setErrors((prev) => ({ ...prev, [`photo_size_${key}`]: undefined }));
  }, []);

  // ── Validation ─────────────────────────────────────────────────────────────
  function validate(): FormErrors {
    const errs: FormErrors = {};

    if (!totalCbm || cbmValue <= 0) {
      errs.total_cbm = 'Enter the CBM you need (must be greater than 0).';
    } else if (container && cbmValue > container.available_capacity_cbm) {
      errs.total_cbm = `Only ${container.available_capacity_cbm} CBM is available.`;
    }

    if (items.length === 0) {
      errs.items = 'Add at least one shipment item.';
    }

    items.forEach((item, i) => {
      if (!item.description.trim()) {
        errs[`item_desc_${i}`] = 'Description is required.';
      }
      if (!item.estimated_value || parseFloat(item.estimated_value) < 0) {
        errs[`item_value_${i}`] = 'Enter a valid declared value.';
      }
    });

    if (!agreedTerms) {
      errs.agreed_terms = 'You must confirm the declaration to proceed.';
    }

    return errs;
  }

  // ── CBM disclaimer constant ────────────────────────────────────────────────
  const CBM_DISCLAIMER = 'I confirm my declared CBM is accurate. A ±5% variance is allowed. Any extra CBM used will be billed; any unused CBM will be credited against your Stage 2 payment.';

  // ── Perform submit (core booking logic) ────────────────────────────────────
  async function performSubmit() {
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = `/auth/login?next=/booking/${containerId}`;
        return;
      }

      // ── Step 1: Insert booking ───────────────────────────────────────────
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          container_id: containerId,
          customer_id: user.id,
          total_cbm: cbmValue,
          total_price: estimatedTotal,
          status: 'pending',
          cbm_declaration_type: cbmDeclarationType,
          cbm_disclaimer_acknowledged_count: cbmDeclarationType === 'self_declared' ? 2 : 0,
          ...(agentProfileId && { agent_profile_id: agentProfileId }),
          ...(selectedShipperId && { managed_shipper_id: selectedShipperId }),
        })
        .select('id')
        .single();

      if (bookingError || !booking) throw bookingError ?? new Error('Booking insert returned no data');

      // ── Step 2: Insert shipment items ────────────────────────────────────
      const shipmentRows = items.map((item) => ({
        booking_id: booking.id,
        description: item.category ? `[${item.category}] ${item.description}` : item.description,
        declared_value: parseFloat(item.estimated_value) || 0,
        quantity: parseInt(item.quantity) || 1,
        weight_kg: item.weight_kg ? parseFloat(item.weight_kg) : null,
        volume_cbm: item.volume_cbm ? parseFloat(item.volume_cbm) : null,
      }));

      const { data: insertedItems, error: itemsError } = await supabase
        .from('shipment_items')
        .insert(shipmentRows)
        .select('id');
      if (itemsError || !insertedItems) throw itemsError ?? new Error('shipment_items insert returned no data');

      // ── Step 2b: Upload item photos (non-blocking) ──────────────────────────────
      try {
        for (let i = 0; i < items.length; i++) {
          const itemPhotos = items[i].photos;
          if (itemPhotos.length === 0) continue;
          const urls: string[] = [];
          for (const file of itemPhotos) {
            const ext = file.name.split('.').pop() ?? 'jpg';
            const filePath = `${booking.id}/${i}/${crypto.randomUUID()}.${ext}`;
            const { error: uploadError } = await supabase.storage
              .from('item-photos')
              .upload(filePath, file);
            if (uploadError) throw uploadError;
            const { data: urlData } = supabase.storage
              .from('item-photos')
              .getPublicUrl(filePath);
            urls.push(urlData.publicUrl);
          }
          if (!insertedItems[i]) {
            console.warn(`No insertedItem at index ${i} — skipping photo_urls patch`);
            continue;
          }
          await supabase
            .from('shipment_items')
            .update({ photo_urls: urls })
            .eq('id', insertedItems[i].id);
        }
      } catch (photoErr) {
        console.error('Item photo upload failed (non-blocking):', photoErr);
      }

      // ── Step 3: Insert declaration ───────────────────────────────────────
      const goodsDescription = items
        .map((item) => `${item.description} (${item.category || 'General'})`)
        .join('; ');

      const { error: declError } = await supabase.from('declarations').insert({
        booking_id: booking.id,
        goods_description: goodsDescription,
        total_declared_value: totalDeclaredValue,
        agreed_terms: true,
        submitted_at: new Date().toISOString(),
      });
      if (declError) throw declError;

      // ── Step 4: Reduce container available capacity ──────────────────────
      const { error: capacityError } = await supabase
        .from('containers')
        .update({ available_capacity_cbm: container!.available_capacity_cbm - cbmValue })
        .eq('id', containerId);
      if (capacityError) throw capacityError;

      // ── Step 5: Fire notification ────────────────────────────────────────
      await notify('booking.created', {
        bookingId: booking.id,
        recipientId: user.id,
        route: `${container!.origin_city} → ${container!.destination_city}`,
        totalCbm: cbmValue,
        totalPrice: estimatedTotal,
      });

      router.push(`/payments/${booking.id}`);
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? JSON.stringify(err);
      console.error('Booking submission error:', msg);
      setErrors({ submit: `Booking failed: ${msg}` });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Submit (validates then gates on CBM modal for self_declared) ───────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();

    if (cbmDeclarationType === 'self_declared' && !cbmStep1Ack) {
      errs.cbm_step1 = 'You must check the CBM accuracy acknowledgement.';
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      document.querySelector('[data-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setErrors({});

    if (cbmDeclarationType === 'self_declared') {
      setShowCbmModal(true);
      return;
    }

    await performSubmit();
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loadingContainer || kycLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="loading loading-spinner loading-lg" style={{ color: '#ff6a00' }} />
      </div>
    );
  }

  // ── KYC gate ──────────────────────────────────────────────────────────────
  if (kycStatus !== 'verified') {
    const isPending = kycStatus === 'pending_review';
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-50 px-4 text-center">
        <div>{isPending ? <Search className="w-12 h-12 text-gray-400" /> : <IdCard className="w-12 h-12 text-gray-400" />}</div>
        <div className="max-w-sm">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {isPending ? 'Verification In Progress' : 'Identity Verification Required'}
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            {isPending
              ? 'Your identity is currently under review. You will be notified once approved — this usually takes 1–2 business days.'
              : 'International shipping regulations require us to verify your identity before you can book container space.'}
          </p>
          {isPending ? (
            <div className="flex flex-col gap-3">
              <Link href="/onboarding/customer/status" className="btn text-white font-bold rounded-xl w-full" style={{ backgroundColor: '#ff6a00' }}>
                Check Verification Status
              </Link>
              <Link href="/" className="btn btn-ghost rounded-xl text-gray-500 w-full">← Browse Containers</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Link href="/onboarding/customer" className="btn text-white font-bold rounded-xl w-full" style={{ backgroundColor: '#ff6a00' }}>
                {kycStatus === 'rejected' ? 'Resubmit Verification' : 'Verify My Identity'}
              </Link>
              <Link href="/" className="btn btn-ghost rounded-xl text-gray-500 w-full">← Browse Containers</Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Container not found ────────────────────────────────────────────────────
  if (containerError || !container) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 text-center px-4">
        <Package className="w-16 h-16 text-gray-300" />
        <h1 className="text-2xl font-bold text-gray-800">Container not found</h1>
        <p className="text-gray-400 text-sm max-w-xs">
          This container may no longer be available.
        </p>
        <Link href="/" className="btn btn-sm mt-2 text-white" style={{ backgroundColor: '#0b103a' }}>
          ← Back to listings
        </Link>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 font-sans">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 sm:px-10 flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo1.png" alt="" width={40} height={40} className="h-9 w-auto" />
            <span className="text-xl font-extrabold tracking-tight">
              <span style={{ color: '#0b103a' }}>Share</span><span style={{ color: '#ff6a00' }}>Con</span><span style={{ color: '#0b103a' }}>Load</span>
            </span>
          </Link>
          <Link
            href={`/container/${containerId}`}
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            ← Back to container
          </Link>
        </div>
      </nav>

      <PageHero
        gradient
        label="Booking"
        title={`${container.origin_city} → ${container.destination_city}`}
        description={`${container.origin_country} → ${container.destination_country} · Departs ${fmt(container.departure_date)}`}
      />

      {/* Global submit error */}
      {errors.submit && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
          <div className="alert alert-error text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {errors.submit}
          </div>
        </div>
      )}

      {/* Main layout */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* ── Left column ────────────────────────────────────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* ── SECTION 1: Container Summary ─────────────────────────────── */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ backgroundColor: '#0b103a' }}>1</span>
                <h2 className="font-bold text-gray-800">Container Summary</h2>
              </div>
              <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat label="Origin" value={container.origin_city} sub={container.origin_country} />
                <Stat label="Destination" value={container.destination_city} sub={container.destination_country} />
                <Stat label="Departure" value={fmt(container.departure_date)} />
                <Stat label="Arrival Est." value={container.arrival_date ? fmt(container.arrival_date) : 'TBC'} />
                <Stat label="Available" value={`${container.available_capacity_cbm} CBM`} highlight />
                <Stat label="Price / CBM" value={`R${container.price_per_cbm}`} highlight />
                {container.operator_name && (
                  <div className="col-span-2">
                    <Stat label="Operator" value={container.operator_name} />
                  </div>
                )}
              </div>
            </section>

            {/* ── SECTION 2: CBM Declaration ───────────────────────────────── */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ backgroundColor: '#0b103a' }}>2</span>
                <h2 className="font-bold text-gray-800">CBM Declaration</h2>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 mb-4">How do you know your cargo dimensions?</p>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" name="cbmType" value="self_declared"
                      checked={cbmDeclarationType === 'self_declared'}
                      onChange={() => setCbmDeclarationType('self_declared')}
                      className="radio radio-sm" style={{ accentColor: '#ff6a00' }} />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">I know my dimensions (self-declare)</p>
                      <p className="text-xs text-gray-400">I will provide my own CBM estimate</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" name="cbmType" value="measurement_verified"
                      checked={cbmDeclarationType === 'measurement_verified'}
                      onChange={() => setCbmDeclarationType('measurement_verified')}
                      className="radio radio-sm" style={{ accentColor: '#ff6a00' }} />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">I have an official measurement report</p>
                      <p className="text-xs text-gray-400">My CBM was verified by a ShareConLoad measurement agent</p>
                    </div>
                  </label>
                </div>
                {cbmDeclarationType === 'measurement_verified' && (
                  <a href="/measurement-service" target="_blank" rel="noopener noreferrer"
                    className="text-xs text-orange-500 hover:underline mt-3 block">
                    → Don&apos;t have a report yet? Request a measurement agent
                  </a>
                )}

                {/* Step 1 acknowledgement for self-declared */}
                {cbmDeclarationType === 'self_declared' && (
                  <label className="flex items-start gap-3 cursor-pointer mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl"
                    data-error={errors.cbm_step1 ? 'true' : undefined}>
                    <input type="checkbox" checked={cbmStep1Ack}
                      onChange={(e) => { setCbmStep1Ack(e.target.checked); setErrors((prev) => ({ ...prev, cbm_step1: undefined })); }}
                      className="checkbox checkbox-sm mt-0.5 shrink-0" style={{ accentColor: '#ff6a00' }} />
                    <span className="text-xs text-amber-800 leading-relaxed">
                      I understand that my CBM declaration affects my booking price and may be verified at loading. A ±5% variance is allowed; any extra CBM used will be billed and any unused CBM credited.
                    </span>
                  </label>
                )}
                {errors.cbm_step1 && (
                  <p className="text-red-500 text-xs mt-2" data-error="true">{errors.cbm_step1}</p>
                )}
              </div>
            </section>

            {/* ── SECTION 3: Booking Input ──────────────────────────────────── */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ backgroundColor: '#0b103a' }}>3</span>
                <h2 className="font-bold text-gray-800">Booking Details</h2>
              </div>
              <div className="p-6">
                <label className="block mb-1 text-sm font-semibold text-gray-700">
                  CBM Required <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  How much container space do you need? Max {container.available_capacity_cbm} CBM available.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    placeholder="e.g. 5"
                    min={0.1}
                    step={0.1}
                    max={container.available_capacity_cbm}
                    value={totalCbm}
                    onChange={(e) => {
                      setTotalCbm(e.target.value);
                      setErrors((prev) => ({ ...prev, total_cbm: undefined }));
                    }}
                    className={`input input-bordered w-40 text-sm ${errors.total_cbm ? 'input-error' : ''}`}
                    data-error={errors.total_cbm ? 'true' : undefined}
                  />
                  <span className="text-gray-500 text-sm">CBM</span>
                  {cbmValue > 0 && container && (
                    <span className="text-sm font-semibold ml-2" style={{ color: '#ff6a00' }}>
                      = R{(cbmValue * container.price_per_cbm).toFixed(2)}
                    </span>
                  )}
                </div>
                {errors.total_cbm && (
                  <p className="text-red-500 text-xs mt-1.5" data-error="true">{errors.total_cbm}</p>
                )}
              </div>
            </section>

            {/* ── SECTION 2b: Booking on behalf of (agents only) ─────────────── */}
            {agentProfileId && managedShippers.length > 0 && (
              <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ backgroundColor: '#16a34a' }}>A</span>
                  <h2 className="font-bold text-gray-800">Booking on behalf of</h2>
                  <span className="badge badge-sm text-white border-none ml-1" style={{ backgroundColor: '#16a34a' }}>Agent</span>
                </div>
                <div className="p-6">
                  <label className="block mb-1 text-sm font-semibold text-gray-700">
                    Select Shipper <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <p className="text-xs text-gray-400 mb-2">
                    Which of your managed shippers is this booking for?
                  </p>
                  <select
                    value={selectedShipperId}
                    onChange={(e) => setSelectedShipperId(e.target.value)}
                    className="select select-bordered w-full text-sm"
                  >
                    <option value="">No shipper selected</option>
                    {managedShippers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </section>
            )}

            {/* ── SECTION 4: Shipment Items ─────────────────────────────────── */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ backgroundColor: '#0b103a' }}>4</span>
                  <h2 className="font-bold text-gray-800">Shipment Items</h2>
                  <span className="badge badge-sm bg-gray-100 text-gray-600 border-none">{items.length}</span>
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="btn btn-sm text-white gap-1 text-xs"
                  style={{ backgroundColor: '#0b103a' }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Item
                </button>
              </div>

              <div className="p-6 flex flex-col gap-5">
                {errors.items && (
                  <p className="text-red-500 text-xs" data-error="true">{errors.items}</p>
                )}

                {items.map((item, idx) => (
                  <div
                    key={item._key}
                    className="border border-gray-200 rounded-xl p-4 relative"
                  >
                    {/* Item header */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-semibold text-gray-600">Item {idx + 1}</span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(item._key)}
                          className="btn btn-ghost btn-xs text-red-400 hover:text-red-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Description */}
                      <div className="sm:col-span-2">
                        <label className="label py-0 mb-1">
                          <span className="label-text text-xs font-semibold text-gray-600">
                            Description <span className="text-red-500">*</span>
                          </span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Samsung 65-inch Smart TV"
                          value={item.description}
                          onChange={(e) => {
                            updateItem(item._key, 'description', e.target.value);
                            setErrors((prev) => ({ ...prev, [`item_desc_${idx}`]: undefined }));
                          }}
                          className={`input input-bordered input-sm w-full text-sm ${errors[`item_desc_${idx}`] ? 'input-error' : ''}`}
                          data-error={errors[`item_desc_${idx}`] ? 'true' : undefined}
                        />
                        {errors[`item_desc_${idx}`] && (
                          <p className="text-red-500 text-xs mt-1">{errors[`item_desc_${idx}`]}</p>
                        )}
                      </div>

                      {/* Category */}
                      <div>
                        <label className="label py-0 mb-1">
                          <span className="label-text text-xs font-semibold text-gray-600">Category</span>
                        </label>
                        <select
                          value={item.category}
                          onChange={(e) => updateItem(item._key, 'category', e.target.value)}
                          className="select select-bordered select-sm w-full text-sm"
                        >
                          <option value="">Select category</option>
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div>
                        <label className="label py-0 mb-1">
                          <span className="label-text text-xs font-semibold text-gray-600">Quantity</span>
                        </label>
                        <input
                          type="number"
                          placeholder="1"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(item._key, 'quantity', e.target.value)}
                          className="input input-bordered input-sm w-full text-sm"
                        />
                      </div>

                      {/* Declared Value · Weight · Volume — per unit with live totals */}
                      <div className="sm:col-span-2">
                        <div className="flex items-center gap-2 mb-2 pt-1">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Per unit</span>
                          {parseInt(item.quantity) > 1 && (
                            <span className="text-xs text-gray-400">— totals calculated for ×{item.quantity} units</span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                          {/* Declared Value per unit */}
                          <div>
                            <label className="label py-0 mb-1 flex items-center justify-between gap-1">
                              <span className="label-text text-xs font-semibold text-gray-600">
                                Declared Value (ZAR) <span className="text-red-500">*</span>
                              </span>
                              <span className="text-[10px] text-gray-400 italic shrink-0">per unit</span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R</span>
                              <input
                                type="number"
                                placeholder="0.00"
                                min={0}
                                step={0.01}
                                value={item.estimated_value}
                                onChange={(e) => {
                                  updateItem(item._key, 'estimated_value', e.target.value);
                                  setErrors((prev) => ({ ...prev, [`item_value_${idx}`]: undefined }));
                                }}
                                className={`input input-bordered input-sm w-full pl-7 text-sm ${errors[`item_value_${idx}`] ? 'input-error' : ''}`}
                                data-error={errors[`item_value_${idx}`] ? 'true' : undefined}
                              />
                            </div>
                            {parseInt(item.quantity) > 1 && parseFloat(item.estimated_value) > 0 && (
                              <p className="text-xs text-orange-500 font-medium mt-1">
                                = R{(parseFloat(item.estimated_value) * parseInt(item.quantity)).toFixed(2)} total
                              </p>
                            )}
                            {errors[`item_value_${idx}`] && (
                              <p className="text-red-500 text-xs mt-1">{errors[`item_value_${idx}`]}</p>
                            )}
                          </div>

                          {/* Weight per unit */}
                          <div>
                            <label className="label py-0 mb-1 flex items-center justify-between gap-1">
                              <span className="label-text text-xs font-semibold text-gray-600">Weight (kg)</span>
                              <span className="text-[10px] text-gray-400 italic shrink-0">per unit</span>
                            </label>
                            <input
                              type="number"
                              placeholder="0.0"
                              min={0}
                              step={0.1}
                              value={item.weight_kg}
                              onChange={(e) => updateItem(item._key, 'weight_kg', e.target.value)}
                              className="input input-bordered input-sm w-full text-sm"
                            />
                            {parseInt(item.quantity) > 1 && parseFloat(item.weight_kg) > 0 && (
                              <p className="text-xs text-orange-500 font-medium mt-1">
                                = {(parseFloat(item.weight_kg) * parseInt(item.quantity)).toFixed(1)} kg total
                              </p>
                            )}
                          </div>

                          {/* Volume per unit */}
                          <div>
                            <label className="label py-0 mb-1 flex items-center justify-between gap-1">
                              <span className="label-text text-xs font-semibold text-gray-600">Volume (CBM)</span>
                              <span className="text-[10px] text-gray-400 italic shrink-0">per unit</span>
                            </label>
                            <input
                              type="number"
                              placeholder="0.00"
                              min={0}
                              step={0.01}
                              value={item.volume_cbm}
                              onChange={(e) => updateItem(item._key, 'volume_cbm', e.target.value)}
                              className="input input-bordered input-sm w-full text-sm"
                            />
                            {parseInt(item.quantity) > 1 && parseFloat(item.volume_cbm) > 0 && (
                              <p className="text-xs text-orange-500 font-medium mt-1">
                                = {(parseFloat(item.volume_cbm) * parseInt(item.quantity)).toFixed(2)} CBM total
                              </p>
                            )}
                          </div>

                        </div>
                      </div>
                    </div>

                    {/* Photo upload */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-600">
                          Item Photos
                          <span className="font-normal text-gray-400 ml-1">(optional · up to 3 · JPG/PNG/WEBP)</span>
                        </span>
                        {item.photos.length < 3 && (
                          <button
                            type="button"
                            onClick={() =>
                              (document.getElementById(`photo-input-${item._key}`) as HTMLInputElement | null)?.click()
                            }
                            className="btn btn-xs btn-outline border-gray-300 text-gray-600 hover:border-orange-400 hover:text-orange-500 gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add Photo
                          </button>
                        )}
                      </div>
                      <input
                        id={`photo-input-${item._key}`}
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          addItemPhoto(item._key, e.target.files);
                          e.target.value = '';
                        }}
                      />
                      {(photoPreviews[item._key] ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(photoPreviews[item._key] ?? []).map((url, photoIdx) => (
                            <div
                              key={photoIdx}
                              className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 group"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt={`Item ${idx + 1} photo ${photoIdx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => removeItemPhoto(item._key, photoIdx)}
                                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="Remove photo"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {errors[`photo_size_${item._key}`] && (
                        <p className="text-red-500 text-xs mt-1">{errors[`photo_size_${item._key}`]}</p>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addItem}
                  className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:border-orange-300 hover:text-orange-400 transition-colors"
                >
                  + Add another item
                </button>
              </div>
            </section>

            {/* ── SECTION 5: Goods Declaration ──────────────────────────────── */}
            <section
              className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${errors.agreed_terms ? 'border-red-300' : 'border-gray-100'}`}
              data-error={errors.agreed_terms ? 'true' : undefined}
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ backgroundColor: '#0b103a' }}>5</span>
                <h2 className="font-bold text-gray-800">Goods Declaration</h2>
                <span className="badge badge-sm badge-error text-white border-none ml-1">Required</span>
              </div>
              <div className="p-6">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-800">
                  <p className="font-semibold mb-1">Declaration Notice</p>
                  <p className="text-xs leading-relaxed">
                    By submitting this booking you declare that the goods described are accurate,
                    legally owned, and do not include any prohibited, restricted, or hazardous materials
                    as defined by international shipping regulations.
                  </p>
                </div>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => {
                      setAgreedTerms(e.target.checked);
                      setErrors((prev) => ({ ...prev, agreed_terms: undefined }));
                    }}
                    className="checkbox checkbox-sm mt-0.5 shrink-0"
                    style={{ accentColor: '#ff6a00' }}
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors leading-relaxed">
                    I confirm that all information provided is accurate, complete, and that the shipment
                    contains{' '}
                    <strong>no prohibited, restricted, or hazardous goods</strong>. I understand that
                    false declarations may result in cancellation and legal liability.
                  </span>
                </label>

                {errors.agreed_terms && (
                  <p className="text-red-500 text-xs mt-3 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    {errors.agreed_terms}
                  </p>
                )}
              </div>
            </section>

            {/* Inline submit CTA — desktop only (mobile reaches the sidebar button right below) */}
            <button
              type="submit"
              disabled={submitting}
              className="hidden lg:flex items-center justify-center w-full btn text-white font-bold py-3 rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
              style={{ backgroundColor: '#ff6a00' }}
            >
              {submitting ? <span className="loading loading-spinner loading-sm" /> : 'Submit Booking'}
            </button>
          </div>

          {/* ── Right column: Order Summary ─────────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-24">
              <h2 className="font-bold text-gray-800 mb-5">Order Summary</h2>

              {/* Route */}
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-4">
                <span>{container.origin_city}</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <span>{container.destination_city}</span>
              </div>

              <div className="flex flex-col gap-3 text-sm mb-5">
                <SummaryRow label="Price / CBM" value={`R${container.price_per_cbm}`} />
                <SummaryRow
                  label="Space requested"
                  value={cbmValue > 0 ? `${cbmValue} CBM` : '—'}
                />
                <SummaryRow
                  label="Shipment items"
                  value={`${items.length} item${items.length !== 1 ? 's' : ''}`}
                />
                <SummaryRow
                  label="Total declared value"
                  value={totalDeclaredValue > 0 ? `R${totalDeclaredValue.toFixed(2)}` : '—'}
                />
                <div className="divider my-0" />
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-800">Estimated Total</span>
                  <span className="text-xl font-extrabold" style={{ color: '#ff6a00' }}>
                    {estimatedTotal > 0 ? `R${estimatedTotal.toFixed(2)}` : '—'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">Final price confirmed after operator review.</p>
              </div>

              {/* Status indicators */}
              <div className="flex flex-col gap-1.5 mb-6">
                <StatusRow ok={cbmValue > 0} label="CBM entered" />
                <StatusRow ok={items.some((i) => i.description.trim())} label="Shipment items added" />
                <StatusRow ok={agreedTerms} label="Declaration confirmed" />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full btn text-white font-bold py-3 rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
                style={{ backgroundColor: '#ff6a00' }}
              >
                {submitting ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  'Submit Booking'
                )}
              </button>

              <p className="text-xs text-gray-400 text-center mt-3">
                No payment charged until the operator confirms.
              </p>
            </div>
          </div>

        </div>
      </form>

      {/* CBM confirmation modal */}
      {showCbmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
          onClick={() => setShowCbmModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-extrabold text-gray-800 mb-3">Confirm CBM Declaration</h3>
            <p className="text-sm text-gray-600 mb-5">{CBM_DISCLAIMER}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCbmModal(false)}
                className="btn btn-ghost flex-1 rounded-xl">Cancel</button>
              <button
                onClick={async () => { setShowCbmModal(false); await performSubmit(); }}
                className="btn flex-1 text-white font-bold rounded-xl"
                style={{ backgroundColor: '#ff6a00' }}>
                I Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small reusable sub-components ────────────────────────────────────────────

function Stat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`font-semibold text-sm ${highlight ? 'text-orange-500' : 'text-gray-800'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-gray-600">
      <span>{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok ? (
        <Check className="w-4 h-4 text-green-500 shrink-0" />
      ) : (
        <Circle className="w-4 h-4 text-gray-300 shrink-0" />
      )}
      <span className={ok ? 'text-gray-700' : 'text-gray-400'}>{label}</span>
    </div>
  );
}
