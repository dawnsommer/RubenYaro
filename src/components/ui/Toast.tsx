import { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

export interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, toast.durationMs ?? 5000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-[10px] bg-[var(--text)] text-[var(--bg)] px-4 py-2.5 text-sm shadow-[0_8px_30px_rgb(0_0_0_/_0.08)]"
    >
      <span>{toast.message}</span>
      {toast.actionLabel && toast.onAction && (
        <button
          type="button"
          onClick={() => {
            toast.onAction?.();
            onDismiss();
          }}
          className="font-semibold underline underline-offset-2 cursor-pointer"
        >
          {toast.actionLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="opacity-70 hover:opacity-100 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
