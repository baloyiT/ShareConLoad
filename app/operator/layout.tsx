'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import OperatorSidebar from '@/components/OperatorSidebar';

export default function OperatorLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">

      {/* ── Top Navbar ── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm h-14 flex items-center px-4 sm:px-6 gap-3">
        {/* Hamburger (mobile) */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image src="/logo1.png" alt="" width={36} height={36} className="h-8 w-auto" />
          <span className="text-lg font-extrabold tracking-tight hidden sm:block">
            <span style={{ color: '#0f2044' }}>Share</span><span style={{ color: '#f97316' }}>Con</span><span style={{ color: '#0f2044' }}>Load</span>
          </span>
        </Link>

        <div className="flex-1" />

        <span className="text-xs font-bold px-2.5 py-1 rounded-full hidden sm:inline-block" style={{ backgroundColor: '#fff7ed', color: '#f97316' }}>
          Operator Portal
        </span>
      </nav>

      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar (desktop) ── */}
        <aside className="hidden lg:flex flex-col w-56 xl:w-64 shrink-0 bg-white border-r border-gray-100 sticky top-14 self-start h-[calc(100vh-3.5rem)] overflow-y-auto">
          <OperatorSidebar />
        </aside>

        {/* ── Mobile sidebar overlay ── */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="fixed top-0 left-0 h-full w-64 bg-white z-50 shadow-xl flex flex-col lg:hidden">
              {/* Close button */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <Link href="/" className="flex items-center gap-2">
                  <Image src="/logo1.png" alt="" width={32} height={32} className="h-7 w-auto" />
                  <span className="text-base font-extrabold tracking-tight">
                    <span style={{ color: '#0f2044' }}>Share</span><span style={{ color: '#f97316' }}>Con</span><span style={{ color: '#0f2044' }}>Load</span>
                  </span>
                </Link>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <OperatorSidebar onClose={() => setSidebarOpen(false)} />
              </div>
            </aside>
          </>
        )}

        {/* ── Main content ── */}
        <main className="flex-1 min-w-0 overflow-x-hidden">
          {children}
        </main>

      </div>
    </div>
  );
}
