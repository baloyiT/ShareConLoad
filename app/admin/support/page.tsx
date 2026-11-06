'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

type SupportTicket = {
  id: string;
  requester_id: string | null;
  booking_id: string | null;
  subject: string;
  description: string | null;
  priority: string;
  status: string;
  created_at: string;
};

type Requester = { email: string; full_name: string | null };

export default function AdminSupportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<SupportTicket[]>([]);
  const [requesters, setRequesters] = useState<Record<string, Requester>>({});

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/'); return; }
      const { data: profiles } = await supabase.from('profiles').select('is_admin').eq('user_id', user.id);
      const isAdmin = Array.isArray(profiles) && profiles.some((p) => p.is_admin === true);
      if (!isAdmin) { router.replace('/'); return; }

      const [tickets, people] = await Promise.all([
        supabase
          .from('support_tickets')
          .select('id, requester_id, booking_id, subject, description, priority, status, created_at')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.rpc('admin_get_users'),
      ]);
      if (tickets.error) {
        console.error('Load support tickets failed:', tickets.error);
        setError('Could not load tickets.');
      } else {
        setRows((tickets.data ?? []) as SupportTicket[]);
      }
      if (people.error) {
        console.error('Load ticket requesters failed:', people.error);
      } else {
        const found: Record<string, Requester> = {};
        for (const p of (people.data ?? []) as (Requester & { user_id: string })[]) {
          found[p.user_id] = { email: p.email, full_name: p.full_name };
        }
        setRequesters(found);
      }
      setLoading(false);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/admin" className="text-sm text-gray-500 hover:underline">Back to admin</Link>
      <h1 className="text-2xl font-bold text-[#081D3A] mt-2 mb-6">Support tickets</h1>

      {loading && <span className="loading loading-spinner" />}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && rows.length === 0 && <p className="text-sm text-gray-500">No tickets yet.</p>}

      <ul className="grid gap-3">
        {rows.map((r) => {
          const requester = r.requester_id ? requesters[r.requester_id] : undefined;
          return (
            <li key={r.id} data-testid="ticket-row" className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-[#081D3A] break-words min-w-0">{r.subject}</p>
                <p className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString('en-GB')}</p>
              </div>
              <p className="text-sm text-gray-700 mt-1 break-words">
                {requester
                  ? <>{requester.full_name ? `${requester.full_name} · ` : ''}<a href={`mailto:${requester.email}`} className="underline">{requester.email}</a></>
                  : 'Customer details unavailable'}
                {r.booking_id && ` · Booking #${r.booking_id.slice(0, 8).toUpperCase()}`}
              </p>
              {r.description && <p className="text-sm text-gray-800 mt-2 whitespace-pre-wrap break-words">{r.description}</p>}
              <div className="flex gap-2 mt-2">
                <span className="badge badge-ghost">{r.status}</span>
                <span className="badge badge-ghost">{r.priority}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
