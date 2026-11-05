'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, Phone } from 'lucide-react';
import { supabase } from '@/services/supabaseClient';
import type { DirectoryOperator } from '@/services/freightTypes';
import { formatCoverage, VerificationBadge } from '@/components/OperatorDirectoryCard';
import { buildEnquiryContactUrl } from '@/components/HomeEnquiryForm';
import PublicNav from '@/components/PublicNav';
import PublicFooter from '@/components/PublicFooter';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface OperatorContact {
  public_phone: string | null;
  public_email: string | null;
}

type ProfileState =
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'error' }
  | { kind: 'ready'; operator: DirectoryOperator };

type ContactState =
  | { kind: 'hidden' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'shown'; contact: OperatorContact | null };

export default function DirectoryOperatorPage() {
  const params = useParams<{ operatorId: string }>();
  const operatorId = params.operatorId;
  const [profile, setProfile] = useState<ProfileState>({ kind: 'loading' });
  const [contact, setContact] = useState<ContactState>({ kind: 'hidden' });

  useEffect(() => {
    let cancelled = false;
    setContact({ kind: 'hidden' });
    if (!UUID_RE.test(operatorId)) {
      setProfile({ kind: 'not_found' });
      return;
    }
    setProfile({ kind: 'loading' });
    supabase.rpc('get_directory_operator', { op_id: operatorId }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.error('Could not load directory operator:', error);
        setProfile({ kind: 'error' });
        return;
      }
      const rows = (data ?? []) as DirectoryOperator[];
      setProfile(rows.length > 0 ? { kind: 'ready', operator: rows[0] } : { kind: 'not_found' });
    });
    return () => { cancelled = true; };
  }, [operatorId]);

  // Only runs when the visitor asks, because the function records a view.
  async function showContact() {
    setContact({ kind: 'loading' });
    const { data, error } = await supabase.rpc('get_operator_contact', { op_id: operatorId });
    if (error) {
      console.error('Could not load operator contact:', error);
      setContact({ kind: 'error' });
      return;
    }
    const rows = (data ?? []) as OperatorContact[];
    setContact({ kind: 'shown', contact: rows[0] ?? null });
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-[#333B48]">
      <PublicNav />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-10 grid grid-cols-1 gap-6 content-start">
        <Link href="/directory" className="text-sm font-semibold text-[#081D3A] underline justify-self-start">
          Back to the directory
        </Link>

        {profile.kind === 'loading' && <p className="text-sm text-[#6B7280]">Loading...</p>}

        {profile.kind === 'error' && (
          <p role="alert" className="text-sm text-red-600">We could not load this operator. Please try again.</p>
        )}

        {profile.kind === 'not_found' && (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 grid gap-3">
            <h1 className="font-heading text-2xl font-bold text-[#081D3A]">Operator not found</h1>
            <p className="text-sm">
              This operator is not listed, or the link is wrong. You can search the directory, or tell us what you
              are moving and we will help.
            </p>
          </div>
        )}

        {profile.kind === 'ready' && (
          <OperatorProfile
            operator={profile.operator}
            contact={contact}
            onShowContact={showContact}
          />
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

function OperatorProfile({ operator, contact, onShowContact }: {
  operator: DirectoryOperator;
  contact: ContactState;
  onShowContact: () => void;
}) {
  const enquiryUrl = buildEnquiryContactUrl('', '', '');
  return (
    <article className="bg-white rounded-2xl border border-[#E5E7EB] p-6 grid grid-cols-1 gap-5 min-w-0">
      <header className="grid grid-cols-1 gap-2">
        <h1 className="font-heading text-2xl font-bold text-[#081D3A] break-words">{operator.display_name}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <VerificationBadge level={operator.verification_level} />
          <Link href="/operator-verification" className="text-xs text-[#6B7280] underline">
            What this means
          </Link>
        </div>
      </header>

      {operator.public_description && <p className="text-sm break-words">{operator.public_description}</p>}

      <section className="grid grid-cols-1 gap-2">
        <h2 className="text-sm font-semibold text-[#081D3A]">Services</h2>
        {operator.services.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {operator.services.map((s) => (
              <li key={s} className="text-xs bg-gray-100 rounded-full px-2.5 py-1 break-words">{s}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#6B7280]">No services listed yet</p>
        )}
      </section>

      <section className="grid grid-cols-1 gap-2">
        <h2 className="text-sm font-semibold text-[#081D3A]">Coverage</h2>
        {operator.coverage.length > 0 ? (
          <ul className="grid grid-cols-1 gap-1 text-sm text-[#6B7280]">
            {operator.coverage.map((c) => <li key={c.id} className="break-words">{formatCoverage(c)}</li>)}
          </ul>
        ) : (
          <p className="text-sm text-[#6B7280]">No routes listed yet</p>
        )}
      </section>

      <section className="grid grid-cols-1 gap-3 border-t border-[#E5E7EB] pt-5">
        <h2 className="text-sm font-semibold text-[#081D3A]">Contact</h2>
        {(contact.kind === 'hidden' || contact.kind === 'loading') && (
          <button
            type="button"
            onClick={onShowContact}
            disabled={contact.kind === 'loading'}
            className="justify-self-start text-sm font-semibold text-white bg-[#FF6A00] px-5 py-3 rounded-xl hover:opacity-90 disabled:opacity-60"
          >
            Contact this operator
          </button>
        )}
        {contact.kind === 'error' && (
          <p role="alert" className="text-sm text-red-600">We could not load the contact details. Please try again.</p>
        )}
        {contact.kind === 'shown' && (contact.contact?.public_phone || contact.contact?.public_email) && (
          <ul className="grid grid-cols-1 gap-2 text-sm min-w-0">
            {contact.contact?.public_phone && (
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 shrink-0 text-[#6B7280]" />
                <a href={`tel:${contact.contact.public_phone.replace(/\s+/g, '')}`} className="underline break-all">
                  {contact.contact.public_phone}
                </a>
              </li>
            )}
            {contact.contact?.public_email && (
              <li className="flex items-center gap-2 min-w-0">
                <Mail className="w-4 h-4 shrink-0 text-[#6B7280]" />
                <a href={`mailto:${contact.contact.public_email}`} className="underline break-all">
                  {contact.contact.public_email}
                </a>
              </li>
            )}
          </ul>
        )}
        {contact.kind === 'shown' && !contact.contact?.public_phone && !contact.contact?.public_email && (
          <p className="text-sm">
            This operator has not shared public contact details.{' '}
            <Link href={enquiryUrl} className="font-semibold text-[#081D3A] underline">
              Send an enquiry and we will help
            </Link>
          </p>
        )}
      </section>
    </article>
  );
}
