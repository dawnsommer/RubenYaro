import { HTMLAttributes, ReactNode } from 'react';

export type ChipVariant =
  | 'default'
  | 'accent'
  | 'positive'
  | 'negative'
  | 'warning'
  | 'estimate';

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
    default: 'border border-[var(--border)] text-[var(--text-muted)] bg-transparent',
    accent: 'border border-transparent bg-[var(--accent-soft)] text-[var(--accent)]',
    positive: 'border border-[var(--positive)] text-[var(--positive)] bg-transparent',
    negative: 'border border-[var(--negative)] text-[var(--negative)] bg-transparent',
    warning: 'border border-[var(--warning)] text-[var(--warning)] bg-transparent',
    estimate: 'border border-dashed border-[var(--warning)] text-[var(--warning)] bg-transparent',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] leading-[14px] font-medium ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}

export const Badge = Chip;
