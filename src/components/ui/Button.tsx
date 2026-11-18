import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  tooltip?: string;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      iconOnly = false,
      tooltip,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const base =
      'inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none';

    const sizeStyles =
      size === 'sm'
        ? iconOnly
          ? 'h-8 w-8 text-xs'
          : 'h-8 px-3 text-xs'
        : iconOnly
          ? 'h-9 w-9 text-sm'
          : 'h-9 px-4 text-sm';

    const variantStyles: Record<ButtonVariant, string> = {
      primary: 'bg-[var(--accent)] text-white hover:opacity-90',
      secondary:
        'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--border)]',
      ghost: 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
      danger: 'bg-[var(--negative)] text-white hover:opacity-90',
    };

    return (
      <button
        ref={ref}
        title={tooltip}
        aria-label={props['aria-label'] ?? tooltip}
        className={`${base} ${sizeStyles} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
