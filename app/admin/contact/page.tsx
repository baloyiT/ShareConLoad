'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  country: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
};

export default function AdminContactPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ContactSubmission[]>([]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/'); return; }
      const { data: profiles } = await supabase.from('profiles').select('is_admin').eq('user_id', user.id);
      const isAdmin = Array.isArray(profiles) && profiles.some((p) => p.is_admin === true);
      if (!isAdmin) { router.replace('/'); return; }

      const { data, error: loadError } = await supabase
        .from('contact_submissions')
        .select('id, name, email, phone, country, subject, message, status, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (loadError) {
        console.error('Load contact submissions failed:', loadError);
        setError('Could not load submissions.');
      } else {
        setRows((data ?? []) as ContactSubmission[]);
      }
      setLoading(false);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/admin" className="text-sm text-gray-500 hover:underline">Back to admin</Link>
      <h1 className="text-2xl font-bold text-[#081D3A] mt-2 mb-6">Contact submissions</h1>

      {loading && <span className="loading loading-spinner" />}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && rows.length === 0 && <p className="text-sm text-gray-500">No submissions yet.</p>}

      <ul className="grid gap-3">
        {rows.map((r) => (
          <li key={r.id} data-testid="contact-row" className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-[#081D3A]">{r.subject}</p>
              <p className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString('en-GB')}</p>
            </div>
            <p className="text-sm text-gray-700 mt-1">
              {r.name} · {r.email} · {r.phone ?? 'no phone'} · {r.country}
            </p>
            <p className="text-sm text-gray-800 mt-2 whitespace-pre-wrap break-words">{r.message}</p>
            <span className="badge badge-ghost mt-2">{r.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
