'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';

export default function ResetPasswordPage() {
  const router = useRouter();

  const [ready,    setReady]    = useState(false);
  const [invalid,  setInvalid]  = useState(false);
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);

  useEffect(() => {
    // Supabase exchanges the token from the URL and fires PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });

    // If the page loads with no recovery token (direct navigation), mark invalid
    const timer = setTimeout(() => {
      setInvalid((prev) => !prev && !ready);
    }, 3000);

    return () => { subscription.unsubscribe(); clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8)       { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm)      { setError('Passwords do not match.'); return; }

    setError(null);
    setLoading(true);

    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) { setError(err.message); return; }
    setDone(true);
    setTimeout(() => router.replace('/auth/login'), 2500);
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
            Set a new<br />
            <span style={{ color: '#f97316' }}>password.</span>
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Choose a strong password that you haven&apos;t used before.
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

            {/* Success state */}
            {done && (
              <div className="flex flex-col items-center text-center gap-4 py-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#f0fdf4' }}
                >
                  <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-gray-900 mb-1">Password updated</h1>
                  <p className="text-sm text-gray-400">Redirecting you to sign in…</p>
                </div>
              </div>
            )}

            {/* Invalid / expired link */}
            {!done && invalid && (
              <div className="flex flex-col items-center text-center gap-4 py-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#fef2f2' }}
                >
                  <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-gray-900 mb-1">Link expired or invalid</h1>
                  <p className="text-sm text-gray-400">This reset link has expired or already been used. Request a new one.</p>
                </div>
                <Link
                  href="/auth/forgot-password"
                  className="btn btn-sm rounded-xl text-white font-semibold hover:opacity-90"
                  style={{ backgroundColor: '#f97316' }}
                >
                  Request new link
                </Link>
              </div>
            )}

            {/* Waiting for token exchange */}
            {!done && !invalid && !ready && (
              <div className="flex flex-col items-center gap-3 py-8">
                <span className="loading loading-spinner loading-md" style={{ color: '#f97316' }} />
                <p className="text-sm text-gray-400">Verifying reset link…</p>
              </div>
            )}

            {/* Password form */}
            {!done && !invalid && ready && (
              <>
                <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Set new password</h1>
                <p className="text-gray-400 text-sm mb-6">Must be at least 8 characters.</p>

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
                    <label className="block text-sm font-semibold text-gray-700 mb-1">New password</label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(null); }}
                        className="input input-bordered w-full pr-12"
                        autoComplete="new-password"
                        autoFocus
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
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm new password</label>
                    <input
                      type={showPw ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirm}
                      onChange={(e) => { setConfirm(e.target.value); setError(null); }}
                      className="input input-bordered w-full"
                      autoComplete="new-password"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full btn text-white font-bold rounded-xl mt-1 hover:opacity-90 transition-opacity disabled:opacity-60"
                    style={{ backgroundColor: '#f97316' }}
                  >
                    {loading ? <span className="loading loading-spinner loading-sm" /> : 'Update password'}
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
