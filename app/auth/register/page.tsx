'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';

type FormErrors = {
  full_name?: string;
  email?: string;
  password?: string;
  confirm_password?: string;
  submit?: string;
};

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName]     = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [errors, setErrors]         = useState<FormErrors>({});
  const [loading, setLoading]       = useState(false);
  const [registered, setRegistered] = useState(false);

  const strength = (() => {
    let s = 0;
    if (password.length >= 8)          s++;
    if (/[A-Z]/.test(password))        s++;
    if (/[0-9]/.test(password))        s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const strengthColor = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e'][strength];

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!fullName.trim())                      errs.full_name        = 'Full name is required.';
    if (!email.trim())                         errs.email            = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(email))     errs.email            = 'Enter a valid email address.';
    if (!password)                             errs.password         = 'Password is required.';
    else if (password.length < 8)             errs.password         = 'Password must be at least 8 characters.';
    if (!confirmPw)                            errs.confirm_password = 'Please confirm your password.';
    else if (password !== confirmPw)           errs.confirm_password = 'Passwords do not match.';
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setErrors({});
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim(), active_role: 'customer' },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setErrors({
        submit: error.message.includes('already registered')
          ? 'An account with this email already exists.'
          : error.message,
      });
      setLoading(false);
      return;
    }
    setRegistered(true);
    setLoading(false);
  }

  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-[#f8fafc]">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: '#f0fdf4' }}>
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Check your email</h1>
          <p className="text-gray-500 text-sm mb-1">We sent a confirmation link to</p>
          <p className="font-semibold text-gray-800 mb-6">{email}</p>
          <p className="text-xs text-gray-400 mb-8">
            Click the link in the email to activate your account. Check your spam folder if you don&apos;t see it.
          </p>
          <div className="flex flex-col gap-2">
            <Link href="/auth/login" className="w-full btn text-white font-bold rounded-xl hover:opacity-90" style={{ backgroundColor: '#f97316' }}>
              Go to Login
            </Link>
            <Link href="/" className="w-full btn btn-ghost rounded-xl text-sm text-gray-500">Back to Home</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel: brand ─────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 relative overflow-hidden p-10"
        style={{ backgroundColor: '#0f2044' }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ mixBlendMode: 'screen', opacity: 0.25 }}>
          <Image src="/world-map-overlay.png" alt="" fill className="object-cover" />
        </div>

        <Link href="/" className="relative flex items-center gap-3 z-10">
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-white">Share</span><span style={{ color: '#f97316' }}>Con</span><span className="text-white">Load</span>
          </span>
        </Link>

        <div className="relative z-10">
          <h2 className="text-3xl font-extrabold text-white leading-snug mb-4">
            One account.<br />
            <span style={{ color: '#f97316' }}>Infinite routes.</span>
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-8">
            Ship goods or list container space — switch roles anytime from one account.
          </p>
          <ul className="flex flex-col gap-3">
            {[
              'Browse containers on 50+ global routes',
              'Book space and declare goods online',
              'Switch to operator mode to list your containers',
              'Track all your shipments in one place',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-gray-300">
                <svg className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-gray-600">
          © {new Date().getFullYear()} ShareConLoad
        </p>
      </div>

      {/* ── Right panel: form ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-[#f8fafc]">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/logo1.png" alt="" width={40} height={40} className="h-9 w-auto" />
              <span className="text-xl font-extrabold tracking-tight">
                <span style={{ color: '#0f2044' }}>Share</span><span style={{ color: '#f97316' }}>Con</span><span style={{ color: '#0f2044' }}>Load</span>
              </span>
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Create your account</h1>
            <p className="text-gray-400 text-sm mb-6">
              One account. Ship goods or list container space — switch anytime.
            </p>

            {errors.submit && (
              <div className="alert alert-error text-sm mb-5">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
                </svg>
                {errors.submit}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); setErrors((p) => ({ ...p, full_name: undefined })); }}
                  className={`input input-bordered w-full ${errors.full_name ? 'input-error' : ''}`}
                  autoComplete="name"
                />
                {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email address</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
                  className={`input input-bordered w-full ${errors.email ? 'input-error' : ''}`}
                  autoComplete="email"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
                    className={`input input-bordered w-full pr-12 ${errors.password ? 'input-error' : ''}`}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                    {showPw ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-1 flex-1 rounded-full transition-colors" style={{ backgroundColor: i <= strength ? strengthColor : '#e5e7eb' }} />
                      ))}
                    </div>
                    <p className="text-xs font-medium" style={{ color: strengthColor }}>{strengthLabel}</p>
                  </div>
                )}
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm Password</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={confirmPw}
                  onChange={(e) => { setConfirmPw(e.target.value); setErrors((p) => ({ ...p, confirm_password: undefined })); }}
                  className={`input input-bordered w-full ${errors.confirm_password ? 'input-error' : ''}`}
                  autoComplete="new-password"
                />
                {confirmPw.length > 0 && (
                  <p className={`text-xs mt-1 flex items-center gap-1 ${password === confirmPw ? 'text-green-500' : 'text-red-400'}`}>
                    {password === confirmPw ? (
                      <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Passwords match</>
                    ) : (
                      <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>Passwords do not match</>
                    )}
                  </p>
                )}
                {errors.confirm_password && <p className="text-red-500 text-xs mt-1">{errors.confirm_password}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn text-white font-bold rounded-xl mt-1 hover:opacity-90 transition-opacity disabled:opacity-60"
                style={{ backgroundColor: '#f97316' }}
              >
                {loading ? <span className="loading loading-spinner loading-sm" /> : 'Create Account'}
              </button>
            </form>

            <div className="divider text-xs text-gray-300 my-5">OR</div>

            <p className="text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link href="/auth/login" className="font-semibold hover:underline" style={{ color: '#f97316' }}>
                Sign in
              </Link>
            </p>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            <Link href="/" className="hover:text-gray-600 transition-colors">← Back to Home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
