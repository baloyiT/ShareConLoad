type Props = {
  average: number;
  count: number;
  size?: 'sm' | 'md';
};

export default function StarDisplay({ average, count, size = 'md' }: Props) {
  const filled   = Math.round(average);
  const starSize = size === 'sm' ? '13px' : '17px';
  const textSize = size === 'sm' ? '12px' : '14px';
  const subSize  = size === 'sm' ? '11px' : '12px';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          style={{ fontSize: starSize, color: i <= filled ? '#f59e0b' : '#d1d5db', lineHeight: 1 }}
        >
          ★
        </span>
      ))}
      <span style={{ fontSize: textSize, fontWeight: 600, color: '#374151', marginLeft: '4px' }}>
        {average.toFixed(1)}
      </span>
      <span style={{ fontSize: subSize, color: '#9ca3af', marginLeft: '2px' }}>
        ({count})
      </span>
    </div>
  );
}
