'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';
import { createMeasurementAgentProfile } from '@/actions/measurementAgentActions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuizQuestion {
  question: string;
  options: { label: string; text: string }[];
  answer: string; // label of the correct option
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    question: 'What unit is used to measure cargo volume in shipping?',
    options: [
      { label: 'A', text: 'Kilograms' },
      { label: 'B', text: 'CBM (Cubic Meters)' },
      { label: 'C', text: 'Litres' },
      { label: 'D', text: 'Pallets' },
    ],
    answer: 'B',
  },
  {
    question: 'How do you calculate volume in CBM?',
    options: [
      { label: 'A', text: 'Length × Width' },
      { label: 'B', text: 'Length × Width × Height' },
      { label: 'C', text: 'Weight ÷ Density' },
      { label: 'D', text: 'Area × Time' },
    ],
    answer: 'B',
  },
  {
    question: 'What does CBM stand for?',
    options: [
      { label: 'A', text: 'Cargo Base Measurement' },
      { label: 'B', text: 'Cubic Bench Mark' },
      { label: 'C', text: 'Cubic Meter' },
      { label: 'D', text: 'Container Box Measure' },
    ],
    answer: 'C',
  },
  {
    question: 'A box is 1m × 0.5m × 0.4m. What is its volume in CBM?',
    options: [
      { label: 'A', text: '1.9 CBM' },
      { label: 'B', text: '0.2 CBM' },
      { label: 'C', text: '2.0 CBM' },
      { label: 'D', text: '0.5 CBM' },
    ],
    answer: 'B',
  },
  {
    question: 'Which of these items requires special declaration?',
    options: [
      { label: 'A', text: 'Books' },
      { label: 'B', text: 'Hazardous chemicals' },
      { label: 'C', text: 'Clothing' },
      { label: 'D', text: 'Furniture' },
    ],
    answer: 'B',
  },
];

const PASS_SCORE = 4;

// ---------------------------------------------------------------------------
// UploadSlot — defined OUTSIDE the page component to prevent remounting
// ---------------------------------------------------------------------------

interface UploadSlotProps {
  label: string;
  inputName: string;
  userId: string;
  onUploaded: (url: string) => void;
}

function UploadSlot({ label, inputName, userId, onUploaded }: UploadSlotProps) {
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
    const path = `${userId}/${inputName}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('measurement-agent-docs')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      console.error('UploadSlot: upload error', uploadError);
      setStatus('error');
      setErrorMsg(uploadError.message);
      return;
    }

    const { data } = supabase.storage
      .from('measurement-agent-docs')
      .getPublicUrl(path);

    const publicUrl = data.publicUrl;
    setUrl(publicUrl);
    onUploaded(publicUrl);
    setStatus('done');
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="block text-sm font-semibold text-gray-700">{label}</label>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
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
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
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

const STEP_LABELS = ['Personal Info', 'Location', 'Quiz', 'Documents'];

export default function MeasurementAgentOnboardingPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createMeasurementAgentProfile, null);

  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState('');

  // Step 1 state
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Step 2 state
  const [baseCity, setBaseCity] = useState('');
  const [baseCountry, setBaseCountry] = useState('');

  // Step 3 quiz state
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  // Step 4 document URLs
  const [idDocumentUrl, setIdDocumentUrl] = useState('');
  const [selfieUrl, setSelfieUrl] = useState('');
  const [equipmentPhotoUrl, setEquipmentPhotoUrl] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace('/auth/login?next=/onboarding/measurement-agent');
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
    return baseCity.trim().length > 0 && baseCountry.trim().length > 0;
  }

  function step3Valid() {
    return quizSubmitted && quizScore >= PASS_SCORE;
  }

  function step4Valid() {
    return idDocumentUrl && selfieUrl && equipmentPhotoUrl;
  }

  // ---------------------------------------------------------------------------
  // Quiz handlers
  // ---------------------------------------------------------------------------

  function handleSelectAnswer(questionIndex: number, label: string) {
    if (quizSubmitted) return;
    setAnswers((prev) => ({ ...prev, [questionIndex]: label }));
  }

  function handleSubmitQuiz() {
    const score = QUIZ_QUESTIONS.reduce((acc, q, i) => {
      return acc + (answers[i] === q.answer ? 1 : 0);
    }, 0);
    setQuizScore(score);
    setQuizSubmitted(true);
  }

  function handleResetQuiz() {
    setAnswers({});
    setQuizScore(0);
    setQuizSubmitted(false);
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
      style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}
    >
      {/* Nav */}
      <nav className="flex items-center px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-white">Share</span>
            <span style={{ color: '#f97316' }}>Con</span>
            <span className="text-white">Load</span>
          </span>
        </Link>
      </nav>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg">

          <h1 className="text-2xl font-extrabold text-gray-800 mb-1">
            Measurement Agent Onboarding
          </h1>
          <p className="text-gray-400 text-sm mb-6">
            Complete all steps to submit your measurement agent application.
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
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
              </svg>
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
                style={{ backgroundColor: '#f97316' }}
                disabled={!step1Valid()}
                onClick={handleNext}
              >
                Next
              </button>
            </div>
          )}

          {/* ----------------------------------------------------------------
              STEP 2: Location
          ---------------------------------------------------------------- */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-blue-700 bg-blue-50 rounded-lg px-4 py-3">
                This is your fixed base location. You&apos;ll be matched with cargo near this city.
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
                  style={{ backgroundColor: '#f97316' }}
                  disabled={!step2Valid()}
                  onClick={handleNext}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------
              STEP 3: Certification Quiz
          ---------------------------------------------------------------- */}
          {step === 3 && (
            <div className="flex flex-col gap-6">
              <p className="text-sm text-gray-500">
                Answer all 5 questions. You need at least {PASS_SCORE}/5 to proceed.
              </p>

              {QUIZ_QUESTIONS.map((q, qi) => {
                const selected = answers[qi];
                const isCorrect = selected === q.answer;

                return (
                  <div key={qi} className="card bg-base-100 border border-base-200 shadow-sm">
                    <div className="card-body p-4 gap-3">
                      <p className="font-semibold text-gray-800 text-sm">
                        {qi + 1}. {q.question}
                      </p>
                      <div className="flex flex-col gap-2">
                        {q.options.map((opt) => {
                          let optClass =
                            'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors';

                          if (!quizSubmitted) {
                            optClass +=
                              selected === opt.label
                                ? ' border-orange-400 bg-orange-50 font-semibold'
                                : ' border-gray-200 hover:border-orange-300 hover:bg-orange-50';
                          } else {
                            if (opt.label === q.answer) {
                              optClass += ' border-green-500 bg-green-50 font-semibold text-green-800';
                            } else if (opt.label === selected && !isCorrect) {
                              optClass += ' border-red-400 bg-red-50 text-red-700';
                            } else {
                              optClass += ' border-gray-200 opacity-60';
                            }
                          }

                          return (
                            <div
                              key={opt.label}
                              className={optClass}
                              onClick={() => handleSelectAnswer(qi, opt.label)}
                            >
                              <span className="font-bold text-xs w-5 shrink-0">{opt.label}</span>
                              <span>{opt.text}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Quiz result */}
              {quizSubmitted && quizScore >= PASS_SCORE && (
                <div className="alert alert-success text-sm">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Quiz passed! Score: {quizScore}/5
                </div>
              )}

              {quizSubmitted && quizScore < PASS_SCORE && (
                <div className="alert alert-error text-sm">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
                  </svg>
                  You need at least 4/5 to pass. Please review and try again. (Score: {quizScore}/5)
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  className="btn btn-outline flex-1"
                  onClick={handleBack}
                >
                  Back
                </button>

                {!quizSubmitted && (
                  <button
                    type="button"
                    className="btn flex-1 text-white font-bold"
                    style={{ backgroundColor: '#f97316' }}
                    disabled={Object.keys(answers).length < QUIZ_QUESTIONS.length}
                    onClick={handleSubmitQuiz}
                  >
                    Submit Quiz
                  </button>
                )}

                {quizSubmitted && quizScore < PASS_SCORE && (
                  <button
                    type="button"
                    className="btn flex-1 btn-warning text-white font-bold"
                    onClick={handleResetQuiz}
                  >
                    Reset
                  </button>
                )}

                {step3Valid() && (
                  <button
                    type="button"
                    className="btn flex-1 text-white font-bold"
                    style={{ backgroundColor: '#f97316' }}
                    onClick={handleNext}
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------
              STEP 4: Document Upload + final submit
          ---------------------------------------------------------------- */}
          {step === 4 && (
            <form action={formAction} className="flex flex-col gap-5">
              {/* Hidden fields carrying values from earlier steps */}
              <input type="hidden" name="full_name" value={fullName} />
              <input type="hidden" name="phone_number" value={phoneNumber} />
              <input type="hidden" name="base_city" value={baseCity} />
              <input type="hidden" name="base_country" value={baseCountry} />

              <p className="text-sm text-gray-500">
                Upload the following documents. Accepted formats: images or PDF.
              </p>

              {userId ? (
                <>
                  <UploadSlot
                    label="ID Document *"
                    inputName="id_document_url"
                    userId={userId}
                    onUploaded={setIdDocumentUrl}
                  />
                  <UploadSlot
                    label="Selfie *"
                    inputName="selfie_url"
                    userId={userId}
                    onUploaded={setSelfieUrl}
                  />
                  <UploadSlot
                    label="Equipment Photo *"
                    inputName="equipment_photo_url"
                    userId={userId}
                    onUploaded={setEquipmentPhotoUrl}
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
                  type="submit"
                  disabled={isPending || !step4Valid()}
                  className="btn flex-1 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: '#f97316' }}
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
