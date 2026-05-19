'use client';

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
      <span className="text-[13px] font-medium" style={{ color: '#92400e' }}>
        ⭐ {label}
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
