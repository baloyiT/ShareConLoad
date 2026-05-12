'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/services/supabaseClient';

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('');
  const [error,   setError]   = useState<string | null>(null);
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError('Email is required.'); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setError('Enter a valid email address.'); return; }

    setError(null);
    setLoading(true);

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    setLoading(false);

    if (err) { setError(err.message); return; }
    setSent(true);
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel ───────────────────────────────────────────────────── */}
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
            Reset your<br />
            <span style={{ color: '#f97316' }}>password.</span>
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            We&apos;ll send a secure link to your email so you can set a new password.
          </p>
        </div>
        <p className="relative z-10 text-xs text-gray-600">© {new Date().getFullYear()} ShareConLoad</p>
      </div>

      {/* ── Right panel ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-[#f8fafc]">
        <div className="w-full max-w-md">

          <div className="flex justify-center mb-8 lg:hidden">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/logo1.png" alt="" width={40} height={40} className="h-9 w-auto" />
              <span className="text-xl font-extrabold tracking-tight">
                <span style={{ color: '#0f2044' }}>Share</span><span style={{ color: '#f97316' }}>Con</span><span style={{ color: '#0f2044' }}>Load</span>
              </span>
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

            {sent ? (
              <div className="flex flex-col items-center text-center gap-4 py-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#fff7ed' }}
                >
                  <svg className="w-7 h-7" style={{ color: '#f97316' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-gray-900 mb-1">Check your inbox</h1>
                  <p className="text-sm text-gray-400">
                    We sent a password reset link to <span className="font-semibold text-gray-600">{email}</span>.
                    The link expires in 1 hour.
                  </p>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Didn&apos;t receive it?{' '}
                  <button
                    onClick={() => setSent(false)}
                    className="font-semibold hover:underline"
                    style={{ color: '#f97316' }}
                  >
                    Try again
                  </button>
                </p>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Forgot password?</h1>
                <p className="text-gray-400 text-sm mb-6">
                  Enter the email address on your account and we&apos;ll send you a reset link.
                </p>

                {error && (
                  <div className="alert alert-error text-sm mb-5">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
                    </svg>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Email address</label>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(null); }}
                      className={`input input-bordered w-full ${error ? 'input-error' : ''}`}
                      autoComplete="email"
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full btn text-white font-bold rounded-xl mt-1 hover:opacity-90 transition-opacity disabled:opacity-60"
                    style={{ backgroundColor: '#f97316' }}
                  >
                    {loading ? <span className="loading loading-spinner loading-sm" /> : 'Send reset link'}
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            <Link href="/auth/login" className="hover:text-gray-600 transition-colors">← Back to Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
