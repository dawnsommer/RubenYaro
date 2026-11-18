export interface ProgressProps {
  value: number; // 0..100
  variant?: 'linear' | 'ring';
  tone?: 'accent' | 'positive' | 'negative' | 'warning';
  size?: number; // for ring
  strokeWidth?: number;
  className?: string;
  label?: string;
}

export function Progress({
  value,
  variant = 'linear',
  tone = 'accent',
  size = 28,
  strokeWidth = 3.5,
  className = '',
  label,
}: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

  const toneColor: Record<NonNullable<ProgressProps['tone']>, string> = {
    accent: 'var(--accent)',
    positive: 'var(--positive)',
    negative: 'var(--negative)',
    warning: 'var(--warning)',
  };

  if (variant === 'ring') {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const dash = (clamped / 100) * circumference;

    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
        className={className}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={toneColor[tone]}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? 'Progress'}
      className={`h-1.5 w-full rounded-full bg-[var(--surface-2)] overflow-hidden ${className}`}
    >
      <div
        className="h-full rounded-full transition-all duration-200"
        style={{ width: `${clamped}%`, backgroundColor: toneColor[tone] }}
      />
    </div>
  );
}
