export const CATEGORY_PALETTE = [
  '#6366F1',
  '#0EA5E9',
  '#14B8A6',
  '#22C55E',
  '#EAB308',
  '#F97316',
  '#EF4444',
  '#EC4899',
  '#A855F7',
  '#64748B',
] as const;

export interface ColorSwatchProps {
  value: string;
  onChange: (color: string) => void;
  colors?: readonly string[];
  className?: string;
}

export function ColorSwatch({
  value,
  onChange,
  colors = CATEGORY_PALETTE,
  className = '',
}: ColorSwatchProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} role="radiogroup" aria-label="Color swatch">
      {colors.map((color) => {
        const selected = value.toLowerCase() === color.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`Color ${color}`}
            onClick={() => onChange(color)}
            className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
              selected ? 'ring-2 ring-[var(--text)] ring-offset-2 ring-offset-[var(--surface)] scale-110' : 'hover:scale-105'
            }`}
            style={{ backgroundColor: color }}
          />
        );
      })}
    </div>
  );
}
