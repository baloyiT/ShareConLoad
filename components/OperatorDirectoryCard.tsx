import Link from 'next/link';
import { BadgeCheck, UserCheck } from 'lucide-react';
import { verificationLabel } from '@/services/operatorCompliance';
import type { DirectoryOperator, OperatorCoverage } from '@/services/freightTypes';

const MAX_COVERAGE_ON_CARD = 3;

function place(city: string | null, country: string): string {
  return city ? `${city}, ${country}` : country;
}

export function formatCoverage(c: OperatorCoverage): string {
  const route = `${place(c.origin_city, c.origin_country)} to ${place(c.destination_city, c.destination_country)}`;
  return c.transport_mode ? `${route} (${c.transport_mode})` : route;
}

export function VerificationBadge({ level }: { level: DirectoryOperator['verification_level'] }) {
  const label = verificationLabel(level);
  if (!label) return null;
  const Icon = level === 'business_verified' ? BadgeCheck : UserCheck;
  return (
    <Link
      href="/operator-verification"
      className="inline-flex items-center gap-1 text-xs font-semibold text-[#081D3A] bg-[#1FA8FF]/10 rounded-full px-2.5 py-1 hover:bg-[#1FA8FF]/20"
    >
      <Icon className="w-3.5 h-3.5 text-[#1FA8FF]" />
      {label}
    </Link>
  );
}

export default function OperatorDirectoryCard({ operator }: { operator: DirectoryOperator }) {
  const shown = operator.coverage.slice(0, MAX_COVERAGE_ON_CARD);
  const more = operator.coverage.length - shown.length;
  return (
    <article className="bg-white rounded-2xl border border-[#E5E7EB] p-5 grid grid-cols-1 gap-3 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-heading text-lg font-semibold text-[#081D3A] break-words min-w-0">
          <Link href={`/directory/${operator.id}`} className="hover:text-[#FF6A00]">
            {operator.display_name}
          </Link>
        </h2>
        <VerificationBadge level={operator.verification_level} />
      </div>

      {operator.public_description && (
        <p className="text-sm text-[#333B48] line-clamp-3 break-words">{operator.public_description}</p>
      )}

      {operator.services.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Services">
          {operator.services.map((s) => (
            <li key={s} className="text-xs text-[#333B48] bg-gray-100 rounded-full px-2.5 py-1 break-words">{s}</li>
          ))}
        </ul>
      )}

      {shown.length > 0 && (
        <ul className="grid gap-1 text-sm text-[#6B7280]" aria-label="Coverage">
          {shown.map((c) => (
            <li key={c.id} className="break-words">{formatCoverage(c)}</li>
          ))}
          {more > 0 && <li>and more routes</li>}
        </ul>
      )}
    </article>
  );
}
