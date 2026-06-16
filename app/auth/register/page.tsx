'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';

import { AlertCircle, Check, Eye, EyeOff, Mail, X } from 'lucide-react';
type FormErrors = {
  full_name?: string;
  email?: string;
  password?: string;
  confirm_password?: string;
  submit?: string;
};

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterContent />
    </Suspense>
  );
}

function RegisterContent() {
  const searchParams = useSearchParams();
  const nextPath     = searchParams.get('next') ?? '';
  const loginHref    = nextPath ? `/auth/login?next=${encodeURIComponent(nextPath)}` : '/auth/login';

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
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/auth/callback`,
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
            <Mail className="w-8 h-8 text-green-500" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Check your email</h1>
          <p className="text-gray-500 text-sm mb-1">We sent a confirmation link to</p>
          <p className="font-semibold text-gray-800 mb-6">{email}</p>
          <p className="text-xs text-gray-400 mb-8">
            Click the link in the email to activate your account. Check your spam folder if you don&apos;t see it.
          </p>
          <div className="flex flex-col gap-2">
            <Link href={loginHref} className="w-full btn text-white font-bold rounded-xl hover:opacity-90" style={{ backgroundColor: '#ff6a00' }}>
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
        style={{ backgroundColor: '#0b103a' }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{ mixBlendMode: 'screen', opacity: 0.25 }}>
          <Image src="/world-map-overlay.png" alt="" fill sizes="100vw" className="object-cover" />
        </div>

        <Link href="/" className="relative flex items-center gap-3 z-10">
          <Image src="/logo1.png" alt="" width={40} height={40} className="h-9 w-auto" />
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-white">Share</span><span style={{ color: '#ff6a00' }}>Con</span><span className="text-white">Load</span>
          </span>
        </Link>

        <div className="relative z-10">
          <h2 className="text-3xl font-extrabold text-white leading-snug mb-4">
            One account.<br />
            <span style={{ color: '#ff6a00' }}>Infinite routes.</span>
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-8">
            Ship goods or list container space, switch roles anytime from one account.
          </p>
          <ul className="flex flex-col gap-3">
            {[
              'Browse containers on 50+ global routes',
              'Book space and declare goods online',
              'Switch to operator mode to list your containers',
              'Track all your shipments in one place',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-gray-300">
                <Check className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" strokeWidth={2.5} />
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
                <span style={{ color: '#0b103a' }}>Share</span><span style={{ color: '#ff6a00' }}>Con</span><span style={{ color: '#0b103a' }}>Load</span>
              </span>
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Create your account</h1>
            <p className="text-gray-400 text-sm mb-6">
              One account. Ship goods or list container space, switch anytime.
            </p>

            {errors.submit && (
              <div className="alert alert-error text-sm mb-5">
                <AlertCircle className="w-4 h-4 shrink-0" />
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
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
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
                      <><Check className="w-3.5 h-3.5" strokeWidth={2.5} />Passwords match</>
                    ) : (
                      <><X className="w-3.5 h-3.5" strokeWidth={2.5} />Passwords do not match</>
                    )}
                  </p>
                )}
                {errors.confirm_password && <p className="text-red-500 text-xs mt-1">{errors.confirm_password}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn text-white font-bold rounded-xl mt-1 hover:opacity-90 transition-opacity disabled:opacity-60"
                style={{ backgroundColor: '#ff6a00' }}
              >
                {loading ? <span className="loading loading-spinner loading-sm" /> : 'Create Account'}
              </button>
            </form>

            <div className="divider text-xs text-gray-300 my-5">OR</div>

            <p className="text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link href={loginHref} className="font-semibold hover:underline" style={{ color: '#ff6a00' }}>
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
