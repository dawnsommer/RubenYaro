import {
  GraduationCap,
  BookOpen,
  FileCheck,
  Plane,
  Home,
  Briefcase,
  CreditCard,
  ShieldCheck,
  Sparkles,
  Receipt,
  LucideIcon,
} from 'lucide-react';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  GraduationCap,
  BookOpen,
  FileCheck,
  Plane,
  Home,
  Briefcase,
  CreditCard,
  ShieldCheck,
  Sparkles,
  Receipt,
};

export interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  className?: string;
}

export function IconPicker({ value, onChange, className = '' }: IconPickerProps) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`} role="radiogroup" aria-label="Icon picker">
      {Object.entries(CATEGORY_ICONS).map(([name, Icon]) => {
        const selected = value === name;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={name}
            onClick={() => onChange(name)}
            className={`w-8 h-8 rounded-[10px] grid place-items-center border transition-colors cursor-pointer ${
              selected
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}
