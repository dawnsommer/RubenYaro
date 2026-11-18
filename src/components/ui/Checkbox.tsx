import { Check } from 'lucide-react';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  round?: boolean; // round for tasks per §7.4
  disabled?: boolean;
  className?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  round = true,
  disabled = false,
  className = '',
}: CheckboxProps) {
  return (
    <label
      className={`inline-flex items-center gap-2.5 select-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${className}`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center transition-colors duration-150 ${
          round ? 'rounded-full' : 'rounded-[5px]'
        } ${
          checked
            ? 'bg-[var(--accent)] border-2 border-[var(--accent)] text-white'
            : 'border-2 border-[var(--border)] bg-transparent hover:border-[var(--accent)]'
        }`}
      >
        {checked && <Check className="w-3 h-3 stroke-[2.5]" />}
      </button>
      {label && (
        <span
          className={`text-sm ${
            checked ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text)]'
          }`}
        >
          {label}
        </span>
      )}
    </label>
  );
}
