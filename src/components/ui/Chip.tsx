import { HTMLAttributes, ReactNode } from 'react';

export type ChipVariant =
  | 'default'
  | 'accent'
  | 'positive'
  | 'negative'
  | 'warning'
  | 'estimate'
  | 'maybe';

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant;
  children: ReactNode;
}

export function Chip({
  variant = 'default',
  className = '',
  children,
  ...props
}: ChipProps) {
  const styles: Record<ChipVariant, string> = {
    default: 'bg-[var(--surface-2)] text-[var(--text-muted)]',
    accent: 'bg-[var(--accent-soft)] text-[var(--accent)]',
    positive: 'bg-[var(--positive-soft)] text-[var(--positive)]',
    negative: 'bg-[var(--negative-soft)] text-[var(--negative)]',
    warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
    estimate: 'bg-[var(--warning-soft)] text-[var(--warning)]',
    maybe: 'bg-[var(--maybe-soft)] text-[var(--maybe)]',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11px] leading-[14px] font-medium whitespace-nowrap ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

export const Badge = Chip;
