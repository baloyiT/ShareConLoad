'use client';

import { Star } from 'lucide-react';

type Props = {
  label: string;
  onRate: () => void;
};

export default function RatingBanner({ label, onRate }: Props) {
  return (
    <div
      className="flex items-center justify-between rounded-md border px-3 py-2 mb-1.5"
      style={{ background: '#fef3c7', borderColor: '#fde68a' }}
    >
      <span className="text-[13px] font-medium flex items-center gap-1.5" style={{ color: '#92400e' }}>
        <Star className="w-3.5 h-3.5" fill="#92400e" strokeWidth={0} /> {label}
      </span>
      <button
        onClick={onRate}
        className="btn btn-xs border-0"
        style={{ background: '#f59e0b', color: 'white' }}
      >
        Rate now
      </button>
    </div>
  );
}
