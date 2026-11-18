import { InputHTMLAttributes } from 'react';

export interface DateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
}

export function DateInput({
  value,
  onChange,
  label,
  id,
  className = '',
  ...props
}: DateInputProps) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-[var(--text-muted)] mb-1">
          {label}
        </label>
      )}
      <input
        id={id}
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? e.target.value : null)}
        className="field num"
        {...props}
      />
    </div>
  );
}
