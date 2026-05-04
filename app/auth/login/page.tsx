'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';

type FormErrors = {
  email?: string;
  password?: string;
  submit?: string;
};

export default function LoginPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const nextPath     = searchParams.get('next') ?? '/';

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [errors, setErrors]     = useState<FormErrors>({});
  const [loading, setLoading]   = useState(false);

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!email.trim())                     errs.email    = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email    = 'Enter a valid email address.';
    if (!password)                         errs.password = 'Password is required.';
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setErrors({});
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErrors({
        submit: error.message === 'Invalid login credentials'
          ? 'Incorrect email or password. Please try again.'
          : error.message,
      });
      setLoading(false);
      return;
    }
    router.push(nextPath);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel: brand ─────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 relative overflow-hidden p-10"
        style={{ backgroundColor: '#0f2044' }}
      >
        {/* World map overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{ mixBlendMode: 'screen', opacity: 0.25 }}>
          <Image src="/world-map-overlay.png" alt="" fill className="object-cover" />
        </div>

        {/* Logo */}
        <Link href="/" className="relative flex items-center gap-3 z-10">
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-white">Share</span><span style={{ color: '#f97316' }}>Con</span><span className="text-white">Load</span>
          </span>
        </Link>

        {/* Tagline */}
        <div className="relative z-10">
          <h2 className="text-3xl font-extrabold text-white leading-snug mb-4">
            Share the Load.<br />
            <span style={{ color: '#f97316' }}>Connect the World.</span>
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Join thousands of shippers and carriers moving goods smarter across the globe.
          </p>

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
            <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Welcome back</h1>
            <p className="text-gray-400 text-sm mb-6">Sign in to your account to continue.</p>

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
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-semibold text-gray-700">Password</label>
                  <Link href="/auth/forgot-password" className="text-xs hover:underline" style={{ color: '#f97316' }}>
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
                    className={`input input-bordered w-full pr-12 ${errors.password ? 'input-error' : ''}`}
                    autoComplete="current-password"
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
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn text-white font-bold rounded-xl mt-1 hover:opacity-90 transition-opacity disabled:opacity-60"
                style={{ backgroundColor: '#f97316' }}
              >
                {loading ? <span className="loading loading-spinner loading-sm" /> : 'Sign In'}
              </button>
            </form>

            <div className="divider text-xs text-gray-300 my-5">OR</div>

            <p className="text-center text-sm text-gray-500">
              Don&apos;t have an account?{' '}
              <Link href="/auth/register" className="font-semibold hover:underline" style={{ color: '#f97316' }}>
                Create one
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
