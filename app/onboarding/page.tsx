// app/onboarding/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabaseClient';
import { switchToCustomer } from '@/actions/operatorActions';

type HeldRole = 'operator' | 'agent';

export default function OnboardingPage() {
  const router = useRouter();
  const [heldRoles, setHeldRoles] = useState<HeldRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setIsAuthed(true);

      const { data } = await supabase
        .from('profiles')
        .select('role_type')
        .eq('user_id', user.id);

      const roles: HeldRole[] = [];
      data?.forEach((p) => {
        if (p.role_type === 'operator') roles.push('operator');
        if (p.role_type === 'agent') roles.push('agent');
      });
      setHeldRoles(roles);
      setLoading(false);
    }
    load();
  }, []);

  const operatorHeld = heldRoles.includes('operator');
  const agentHeld = heldRoles.includes('agent');

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}>
      <nav className="flex items-center px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-white">Share</span>
            <span style={{ color: '#f97316' }}>Con</span>
            <span className="text-white">Load</span>
          </span>
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white text-center mb-2">
          {isAuthed ? 'Expand your account' : 'How would you like to use ShareConLoad?'}
        </h1>
        <p className="text-gray-400 text-sm mb-10 text-center">
          {isAuthed ? 'Add a new role or switch to an existing one.' : 'You can switch roles any time after setup.'}
        </p>

        {loading ? (
          <div className="flex justify-center py-8"><span className="loading loading-spinner loading-lg text-white" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl">

            {/* Operator card */}
            <div className={`bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-4 ${operatorHeld && isAuthed ? 'opacity-80' : ''}`}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: '#fff7ed' }}>🚢</div>
              <div>
                <h2 className="text-lg font-extrabold text-gray-800">I Have Container Space</h2>
                <p className="text-gray-500 text-sm mt-1">List available container space and earn from unused capacity</p>
              </div>
              {operatorHeld && isAuthed ? (
                <div className="flex flex-col gap-2 mt-auto">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-green-600">
                    <span>✓</span> You have this role
                  </div>
                  <Link
                    href="/operator"
                    className="btn w-full font-bold rounded-xl hover:opacity-90 text-sm"
                    style={{ backgroundColor: '#e8eef8', color: '#0f2044' }}
                  >
                    Go to Operator Portal
                  </Link>
                </div>
              ) : (
                <button
                  onClick={() => router.push('/onboarding/operator')}
                  className="btn w-full text-white font-bold rounded-xl mt-auto hover:opacity-90"
                  style={{ backgroundColor: '#0f2044' }}
                >
                  {isAuthed ? 'Register as Operator' : 'Join as Space Provider'}
                </button>
              )}
            </div>

            {/* Shipper card */}
            <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: '#fff7ed' }}>📦</div>
              <div>
                <h2 className="text-lg font-extrabold text-gray-800">I Need Container Space</h2>
                <p className="text-gray-500 text-sm mt-1">Book container space for your cargo quickly and securely</p>
              </div>
              {isAuthed ? (
                <div className="flex flex-col gap-2 mt-auto">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-green-600">
                    <span>✓</span> You have this role
                  </div>
                  <Link
                    href="/bookings"
                    className="btn w-full font-bold rounded-xl hover:opacity-90 text-sm"
                    style={{ backgroundColor: '#fff7ed', color: '#f97316' }}
                  >
                    Go to My Bookings
                  </Link>
                </div>
              ) : (
                <form action={switchToCustomer}>
                  <button type="submit" className="btn w-full text-white font-bold rounded-xl mt-auto hover:opacity-90" style={{ backgroundColor: '#f97316' }}>
                    Continue
                  </button>
                </form>
              )}
            </div>

            {/* Agent card */}
            <div className={`bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-4 ${agentHeld && isAuthed ? 'opacity-80' : ''}`}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: '#f0fdf4' }}>🤝</div>
              <div>
                <h2 className="text-lg font-extrabold text-gray-800">I Am a Freight Agent</h2>
                <p className="text-gray-500 text-sm mt-1">Manage shippers, book space on their behalf, and coordinate cargo</p>
              </div>
              {agentHeld && isAuthed ? (
                <div className="flex flex-col gap-2 mt-auto">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-green-600">
                    <span>✓</span> You have this role
                  </div>
                  <Link
                    href="/agent"
                    className="btn w-full font-bold rounded-xl hover:opacity-90 text-sm"
                    style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}
                  >
                    Go to Agent Portal
                  </Link>
                </div>
              ) : (
                <button
                  onClick={() => router.push('/onboarding/agent')}
                  className="btn w-full text-white font-bold rounded-xl mt-auto hover:opacity-90"
                  style={{ backgroundColor: '#16a34a' }}
                >
                  {isAuthed ? 'Register as Agent' : 'Join as Agent'}
                </button>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
