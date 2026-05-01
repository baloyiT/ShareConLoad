'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { switchToCustomer } from '@/actions/operatorActions';

export default function OnboardingPage() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}
    >
      {/* Nav */}
      <nav className="flex items-center px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo_v4.png" alt="ShareConLoad" width={36} height={36} className="rounded-md" />
          <span className="text-xl font-bold text-white">ShareConLoad</span>
        </Link>
      </nav>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white text-center mb-2">
          How would you like to use ShareConLoad?
        </h1>
        <p className="text-gray-400 text-sm mb-10 text-center">
          You can switch roles any time after setup.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">

          {/* Operator card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: '#fff7ed' }}
            >
              🚢
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-800">I Have Container Space</h2>
              <p className="text-gray-500 text-sm mt-1">
                List available container space and earn from unused capacity
              </p>
            </div>
            <button
              onClick={() => router.push('/onboarding/operator')}
              className="btn w-full text-white font-bold rounded-xl mt-auto hover:opacity-90"
              style={{ backgroundColor: '#0f2044' }}
            >
              Join as Space Provider
            </button>
          </div>

          {/* Customer card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: '#fff7ed' }}
            >
              📦
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-800">I Need Container Space</h2>
              <p className="text-gray-500 text-sm mt-1">
                Book container space for your cargo quickly and securely
              </p>
            </div>
            <form action={switchToCustomer}>
              <button
                type="submit"
                className="btn w-full text-white font-bold rounded-xl mt-auto hover:opacity-90"
                style={{ backgroundColor: '#f97316' }}
              >
                Continue
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
