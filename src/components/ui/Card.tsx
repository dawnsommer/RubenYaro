import { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  muted?: boolean;
  noPadding?: boolean;
}

export function Card({
  title,
  subtitle,
  action,
  muted = false,
  noPadding = false,
  className = '',
  children,
  ...props
}: CardProps) {
  return (
    <section
      className={`rounded-[18px] border border-[var(--border)] ${
        muted ? 'bg-[var(--surface-2)]' : 'bg-[var(--surface)] shadow-[var(--shadow-sm)]'
      } ${noPadding ? '' : 'p-4 md:p-5'} ${className}`}
      {...props}
    >
      {(title || action) && (
        <div
          className={`flex items-center justify-between gap-2 ${
            noPadding ? 'px-4 pt-4 md:px-5 md:pt-5 pb-3' : 'mb-3'
          }`}
        >
          <div>
            {typeof title === 'string' ? (
              <h2 className="text-[15px] leading-[22px] font-semibold tracking-[-0.01em] text-[var(--text)]">
                {title}
              </h2>
            ) : (
              title
            )}
            {subtitle && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
