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

  // ── Password strength ──────────────────────────────────────────────────────
  const strength = (() => {
    let score = 0;
    if (password.length >= 8)          score++;
    if (/[A-Z]/.test(password))        score++;
    if (/[0-9]/.test(password))        score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  })();

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const strengthColor = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e'][strength];

  // ── Validation ─────────────────────────────────────────────────────────────
  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!fullName.trim())                      errs.full_name        = 'Full name is required.';
    if (!email.trim())                         errs.email            = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(email))      errs.email            = 'Enter a valid email address.';
    if (!password)                             errs.password         = 'Password is required.';
    else if (password.length < 8)              errs.password         = 'Password must be at least 8 characters.';
    if (!confirmPw)                            errs.confirm_password = 'Please confirm your password.';
    else if (password !== confirmPw)           errs.confirm_password = 'Passwords do not match.';
    return errs;
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
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
      console.error('Registration error:', error);
      setErrors({
        submit:
          error.message.includes('already registered')
            ? 'An account with this email already exists.'
            : error.message,
      });
      setLoading(false);
      return;
    }

    setRegistered(true);
    setLoading(false);
  }

  // ── Confirmation screen ────────────────────────────────────────────────────
  if (registered) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4 py-16"
        style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}
      >
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: '#f0fdf4' }}
          >
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>

          <h1 className="text-2xl font-extrabold text-gray-800 mb-2">Check your email</h1>
          <p className="text-gray-500 text-sm mb-1">We sent a confirmation link to</p>
          <p className="font-semibold text-gray-800 mb-6">{email}</p>
          <p className="text-xs text-gray-400 mb-8">
            Click the link in the email to activate your account. Check your spam folder if you don&apos;t see it.
          </p>

          <div className="flex flex-col gap-2">
            <Link
              href="/auth/login"
              className="w-full btn text-white font-bold rounded-xl hover:opacity-90"
              style={{ backgroundColor: '#f97316' }}
            >
              Go to Login
            </Link>
            <Link href="/" className="w-full btn btn-ghost rounded-xl text-sm text-gray-500">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-16"
      style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}
    >
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo_v4.png" alt="ShareConLoad" width={48} height={48} className="rounded-xl shadow-lg" />
            <span className="text-2xl font-extrabold text-white">ShareConLoad</span>
          </Link>
          <p className="text-gray-400 text-sm mt-2">Global Container Sharing Marketplace</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-2xl font-extrabold text-gray-800 mb-1">Create your account</h1>
          <p className="text-gray-400 text-sm mb-6">
            One account. Ship goods or list container space — switch anytime.
          </p>

          {/* Global error */}
          {errors.submit && (
            <div className="alert alert-error text-sm mb-5">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
              </svg>
              {errors.submit}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

            {/* Full name */}
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

            {/* Email */}
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

            {/* Password */}
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
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
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

              {/* Strength meter */}
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full transition-colors"
                        style={{ backgroundColor: i <= strength ? strengthColor : '#e5e7eb' }}
                      />
                    ))}
                  </div>
                  <p className="text-xs font-medium" style={{ color: strengthColor }}>
                    {strengthLabel}
                  </p>
                </div>
              )}

              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            {/* Confirm password */}
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
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Passwords match
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Passwords do not match
                    </>
                  )}
                </p>
              )}
              {errors.confirm_password && <p className="text-red-500 text-xs mt-1">{errors.confirm_password}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn text-white font-bold rounded-xl mt-2 hover:opacity-90 transition-opacity disabled:opacity-60"
              style={{ backgroundColor: '#f97316' }}
            >
              {loading ? <span className="loading loading-spinner loading-sm" /> : 'Create Account'}
            </button>

          </form>

          {/* Divider */}
          <div className="divider text-xs text-gray-300 my-5">OR</div>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/auth/login" className="font-semibold hover:underline" style={{ color: '#f97316' }}>
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          <Link href="/" className="hover:text-gray-300">← Back to Home</Link>
        </p>
      </div>
    </div>
  );
}
