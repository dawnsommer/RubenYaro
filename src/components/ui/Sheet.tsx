import { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Max width on desktop. Default 'md' (448px). */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Small centred modal (desktop) / bottom sheet (mobile).
 * v2: no more right-side drawers — use for short forms only; edit larger things inline.
 */
export function Sheet({ open, onClose, title, children, footer, size = 'md' }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const width = size === 'sm' ? 'sm:max-w-sm' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={`relative z-10 w-full ${width} max-h-[88vh] bg-[var(--surface)] border border-[var(--border)] rounded-t-[24px] sm:rounded-[24px] flex flex-col shadow-[var(--shadow-lg)] animate-pop-in`}
      >
        <div className="sm:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-[var(--surface-3)]" />
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <div className="text-[17px] leading-[24px] font-semibold tracking-[-0.01em] text-[var(--text)] min-w-0">
            {title}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 shrink-0 rounded-full grid place-items-center text-[var(--text-muted)] bg-[var(--surface-2)] hover:text-[var(--text)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-5">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-[var(--border)] flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
