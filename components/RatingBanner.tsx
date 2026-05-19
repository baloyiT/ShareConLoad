'use client';

type Props = {
  label: string;
  onRate: () => void;
};

export default function RatingBanner({ label, onRate }: Props) {
  return (
    <div
      style={{
        background: '#fef3c7',
        border: '1px solid #fde68a',
        borderRadius: '6px',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '6px',
      }}
    >
      <span style={{ fontSize: '13px', color: '#92400e', fontWeight: 500 }}>
        ⭐ {label}
      </span>
      <button
        onClick={onRate}
        className="btn btn-xs"
        style={{ background: '#f59e0b', color: 'white', border: 'none' }}
      >
        Rate now
      </button>
    </div>
  );
}
