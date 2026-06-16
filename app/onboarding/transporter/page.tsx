'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';
import { createTransporterProfile } from '@/actions/transporterActions';

import { AlertCircle, Check } from 'lucide-react';
// ---------------------------------------------------------------------------
// UploadSlot — defined OUTSIDE the page component to prevent remounting
// ---------------------------------------------------------------------------

interface UploadSlotProps {
  label: string;
  inputName: string;
  userId: string;
  bucket: string;
  pathPrefix: string;
  accept?: string;
  required?: boolean;
  onUploaded: (url: string) => void;
}

function UploadSlot({
  label,
  inputName,
  userId,
  bucket,
  pathPrefix,
  accept = 'image/*,application/pdf',
  required = false,
  onUploaded,
}: UploadSlotProps) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [url, setUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('uploading');
    setErrorMsg('');

    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `${userId}/${pathPrefix}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true });

    if (uploadError) {
      console.error('UploadSlot: upload error', uploadError);
      setStatus('error');
      setErrorMsg(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);

    const publicUrl = data.publicUrl;
    setUrl(publicUrl);
    onUploaded(publicUrl);
    setStatus('done');
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="block text-sm font-semibold text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Hidden form field carrying the URL */}
      <input type="hidden" name={inputName} value={url} />

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => inputRef.current?.click()}
          disabled={status === 'uploading'}
        >
          {status === 'uploading' ? (
            <span className="loading loading-spinner loading-xs" />
          ) : status === 'done' ? (
            'Re-upload'
          ) : (
            'Choose file'
          )}
        </button>

        {status === 'done' && (
          <span className="text-green-600 text-sm font-medium flex items-center gap-1">
            <Check className="w-4 h-4" strokeWidth={2.5} />
            Uploaded
          </span>
        )}

        {status === 'error' && (
          <span className="text-red-500 text-sm">{errorMsg || 'Upload failed'}</span>
        )}

        {status === 'idle' && (
          <span className="text-gray-400 text-sm">No file chosen</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const STEP_LABELS = ['Personal Info', 'Location & Vehicle', 'Documents', 'Photos & Submit'];

const VEHICLE_TYPES = [
  { value: 'bakkie', label: 'Bakkie' },
  { value: 'small_truck', label: 'Small Truck' },
  { value: 'large_truck', label: 'Large Truck' },
];

export default function TransporterOnboardingPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createTransporterProfile, null);

  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState('');

  // Step 1 state
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Step 2 state
  const [baseCity, setBaseCity] = useState('');
  const [baseCountry, setBaseCountry] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleCapacityKg, setVehicleCapacityKg] = useState('');
  const [vehicleCapacityCbm, setVehicleCapacityCbm] = useState('');
  const [vehicleRegistrationNumber, setVehicleRegistrationNumber] = useState('');

  // Step 3 document URLs
  const [driversLicenceUrl, setDriversLicenceUrl] = useState('');
  const [vehicleOwnershipUrl, setVehicleOwnershipUrl] = useState('');

  // Step 4 vehicle photo URLs
  const [vehiclePhoto1Url, setVehiclePhoto1Url] = useState('');
  const [vehiclePhoto2Url, setVehiclePhoto2Url] = useState('');
  const [vehiclePhoto3Url, setVehiclePhoto3Url] = useState('');
  const [vehiclePhoto4Url, setVehiclePhoto4Url] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/auth/login?next=/onboarding/transporter');
      else setUserId(data.user.id);
    });
  }, [router]);

  // ---------------------------------------------------------------------------
  // Step validation
  // ---------------------------------------------------------------------------

  function step1Valid() {
    return fullName.trim().length > 0 && phoneNumber.trim().length > 0;
  }

  function step2Valid() {
    return (
      baseCity.trim().length > 0 &&
      baseCountry.trim().length > 0 &&
      vehicleType.length > 0 &&
      vehicleCapacityKg.trim().length > 0 &&
      vehicleCapacityCbm.trim().length > 0 &&
      vehicleRegistrationNumber.trim().length > 0
    );
  }

  function step3Valid() {
    return driversLicenceUrl.length > 0 && vehicleOwnershipUrl.length > 0;
  }

  function step4Valid() {
    return vehiclePhoto1Url.length > 0;
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  function handleNext() {
    setStep((s) => Math.min(s + 1, 4));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 1));
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function stepClass(stepNum: number) {
    return step >= stepNum ? 'step step-primary' : 'step';
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0b103a 0%, #1a3a6b 100%)' }}
    >
      {/* Nav */}
      <nav className="flex items-center px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo1.png" alt="" width={32} height={32} className="h-7 w-auto" />
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-white">Share</span>
            <span style={{ color: '#ff6a00' }}>Con</span>
            <span className="text-white">Load</span>
          </span>
        </Link>
      </nav>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg">

          <h1 className="text-2xl font-extrabold text-gray-800 mb-1">
            Transporter Onboarding
          </h1>
          <p className="text-gray-400 text-sm mb-6">
            Complete all steps to submit your transporter application.
          </p>

          {/* DaisyUI step indicator */}
          <ul className="steps steps-horizontal w-full mb-8 text-xs">
            {STEP_LABELS.map((label, i) => (
              <li key={label} className={stepClass(i + 1)} data-content={step > i + 1 ? '✓' : undefined}>
                {label}
              </li>
            ))}
          </ul>

          {/* Server action error */}
          {state?.error && (
            <div className="alert alert-error text-sm mb-5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {state.error}
            </div>
          )}

          {/* ----------------------------------------------------------------
              STEP 1: Personal Info
          ---------------------------------------------------------------- */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Full Name <span className="text-red-500">*</span></span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Phone Number <span className="text-red-500">*</span></span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="+27 82 123 4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>

              <button
                type="button"
                className="btn w-full text-white font-bold rounded-xl mt-2"
                style={{ backgroundColor: '#ff6a00' }}
                disabled={!step1Valid()}
                onClick={handleNext}
              >
                Next
              </button>
            </div>
          )}

          {/* ----------------------------------------------------------------
              STEP 2: Location & Vehicle
          ---------------------------------------------------------------- */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-blue-700 bg-blue-50 rounded-lg px-4 py-3">
                Your base city is where you&apos;ll be matched with nearby pickup jobs.
              </p>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Base City <span className="text-red-500">*</span></span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="e.g. Johannesburg"
                  value={baseCity}
                  onChange={(e) => setBaseCity(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Base Country <span className="text-red-500">*</span></span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="e.g. South Africa"
                  value={baseCountry}
                  onChange={(e) => setBaseCountry(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Vehicle Type <span className="text-red-500">*</span></span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                >
                  <option value="">Select vehicle type</option>
                  {VEHICLE_TYPES.map((vt) => (
                    <option key={vt.value} value={vt.value}>{vt.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Vehicle Capacity (kg) <span className="text-red-500">*</span></span>
                </label>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  placeholder="e.g. 1000"
                  min="0"
                  value={vehicleCapacityKg}
                  onChange={(e) => setVehicleCapacityKg(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Vehicle Capacity (CBM) <span className="text-red-500">*</span></span>
                </label>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  placeholder="e.g. 5.0"
                  min="0"
                  step="0.1"
                  value={vehicleCapacityCbm}
                  onChange={(e) => setVehicleCapacityCbm(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Vehicle Registration Number <span className="text-red-500">*</span></span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="e.g. GP 123-456"
                  value={vehicleRegistrationNumber}
                  onChange={(e) => setVehicleRegistrationNumber(e.target.value)}
                />
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  className="btn btn-outline flex-1"
                  onClick={handleBack}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn flex-1 text-white font-bold"
                  style={{ backgroundColor: '#ff6a00' }}
                  disabled={!step2Valid()}
                  onClick={handleNext}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------
              STEP 3: Vehicle Documents
          ---------------------------------------------------------------- */}
          {step === 3 && (
            <div className="flex flex-col gap-5">
              <p className="text-sm text-gray-500">
                Upload the following documents. Accepted formats: images or PDF.
              </p>

              {userId ? (
                <>
                  <UploadSlot
                    label="Driver's Licence"
                    inputName="drivers_licence_url"
                    userId={userId}
                    bucket="transporter-docs"
                    pathPrefix="drivers-licence"
                    required
                    onUploaded={setDriversLicenceUrl}
                  />
                  <UploadSlot
                    label="Vehicle Ownership Document"
                    inputName="vehicle_ownership_url"
                    userId={userId}
                    bucket="transporter-docs"
                    pathPrefix="vehicle-ownership"
                    required
                    onUploaded={setVehicleOwnershipUrl}
                  />
                </>
              ) : (
                <div className="flex justify-center py-6">
                  <span className="loading loading-spinner loading-md" />
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  className="btn btn-outline flex-1"
                  onClick={handleBack}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="btn flex-1 text-white font-bold"
                  style={{ backgroundColor: '#ff6a00' }}
                  disabled={!step3Valid()}
                  onClick={handleNext}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------
              STEP 4: Vehicle Photos + Submit
          ---------------------------------------------------------------- */}
          {step === 4 && (
            <form action={formAction} className="flex flex-col gap-5">
              {/* Hidden fields carrying values from all earlier steps */}
              <input type="hidden" name="full_name" value={fullName} />
              <input type="hidden" name="phone_number" value={phoneNumber} />
              <input type="hidden" name="base_city" value={baseCity} />
              <input type="hidden" name="base_country" value={baseCountry} />
              <input type="hidden" name="vehicle_type" value={vehicleType} />
              <input type="hidden" name="vehicle_capacity_kg" value={vehicleCapacityKg} />
              <input type="hidden" name="vehicle_capacity_cbm" value={vehicleCapacityCbm} />
              <input type="hidden" name="vehicle_registration_number" value={vehicleRegistrationNumber} />
              <input type="hidden" name="drivers_licence_url" value={driversLicenceUrl} />
              <input type="hidden" name="vehicle_ownership_url" value={vehicleOwnershipUrl} />

              <p className="text-sm text-gray-500">
                Upload vehicle photos. At least 1 photo is required; others are optional.
              </p>

              {userId ? (
                <>
                  <UploadSlot
                    label="Vehicle Photo 1"
                    inputName="vehicle_photo_1_url"
                    userId={userId}
                    bucket="transporter-docs"
                    pathPrefix="vehicle-photo-1"
                    accept="image/*"
                    required
                    onUploaded={setVehiclePhoto1Url}
                  />
                  <UploadSlot
                    label="Vehicle Photo 2"
                    inputName="vehicle_photo_2_url"
                    userId={userId}
                    bucket="transporter-docs"
                    pathPrefix="vehicle-photo-2"
                    accept="image/*"
                    onUploaded={setVehiclePhoto2Url}
                  />
                  <UploadSlot
                    label="Vehicle Photo 3"
                    inputName="vehicle_photo_3_url"
                    userId={userId}
                    bucket="transporter-docs"
                    pathPrefix="vehicle-photo-3"
                    accept="image/*"
                    onUploaded={setVehiclePhoto3Url}
                  />
                  <UploadSlot
                    label="Vehicle Photo 4"
                    inputName="vehicle_photo_4_url"
                    userId={userId}
                    bucket="transporter-docs"
                    pathPrefix="vehicle-photo-4"
                    accept="image/*"
                    onUploaded={setVehiclePhoto4Url}
                  />
                </>
              ) : (
                <div className="flex justify-center py-6">
                  <span className="loading loading-spinner loading-md" />
                </div>
              )}

              {/* Suppress unused-variable warnings for optional photo state */}
              {vehiclePhoto2Url && vehiclePhoto3Url && vehiclePhoto4Url && null}

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  className="btn btn-outline flex-1"
                  onClick={handleBack}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isPending || !step4Valid()}
                  className="btn flex-1 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: '#ff6a00' }}
                >
                  {isPending ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    'Submit Application'
                  )}
                </button>
              </div>
            </form>
          )}

          <p className="text-center text-sm text-gray-400 mt-6">
            <Link href="/onboarding" className="hover:underline">
              Back to role selection
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
