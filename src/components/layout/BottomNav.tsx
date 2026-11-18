import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Receipt,
  Plus,
  CheckCircle2,
  MoreHorizontal,
  Wallet,
  LineChart,
  Settings2,
  CreditCard,
  ArrowLeftRight,
} from 'lucide-react';
import { Sheet } from '../ui/Sheet';

export interface BottomNavProps {
  onQuickAdd?: (kind: 'cost' | 'payment' | 'transaction' | 'task') => void;
}

export function BottomNav({ onQuickAdd }: BottomNavProps) {
  const [quickOpen, setQuickOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();

  const handleQuick = (kind: 'cost' | 'payment' | 'transaction' | 'task', fallbackRoute: string) => {
    setQuickOpen(false);
    if (onQuickAdd) {
      onQuickAdd(kind);
    } else {
      navigate(fallbackRoute);
    }
  };

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-[var(--surface)] border-t border-[var(--border)] grid grid-cols-5 items-center px-2"
      >
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium py-1 ${
              isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
            }`
          }
        >
          <LayoutGrid className="w-4 h-4" />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/costs"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium py-1 ${
              isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
            }`
          }
        >
          <Receipt className="w-4 h-4" />
          <span>Costs</span>
        </NavLink>

        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => setQuickOpen(true)}
            aria-label="Quick add"
            className="w-9 h-9 rounded-full bg-[var(--accent)] text-white grid place-items-center shadow-xs cursor-pointer"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <NavLink
          to="/tasks"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium py-1 ${
              isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
            }`
          }
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Tasks</span>
        </NavLink>

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="More navigation"
          className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium py-1 text-[var(--text-muted)] cursor-pointer"
        >
          <MoreHorizontal className="w-4 h-4" />
          <span>More</span>
        </button>
      </nav>

      <Sheet open={quickOpen} onClose={() => setQuickOpen(false)} title="Quick add">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleQuick('cost', '/costs')}
            className="flex items-center gap-3 p-3.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] text-left text-sm font-medium hover:border-[var(--accent)] cursor-pointer"
          >
            <Receipt className="w-4 h-4 text-[var(--accent)]" />
            <span>Cost</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuick('payment', '/costs')}
            className="flex items-center gap-3 p-3.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] text-left text-sm font-medium hover:border-[var(--accent)] cursor-pointer"
          >
            <CreditCard className="w-4 h-4 text-[var(--positive)]" />
            <span>Payment</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuick('transaction', '/accounts')}
            className="flex items-center gap-3 p-3.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] text-left text-sm font-medium hover:border-[var(--accent)] cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4 text-[var(--accent)]" />
            <span>Transaction</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuick('task', '/tasks')}
            className="flex items-center gap-3 p-3.5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] text-left text-sm font-medium hover:border-[var(--accent)] cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-[var(--accent)]" />
            <span>Task</span>
          </button>
        </div>
      </Sheet>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <div className="space-y-1">
          <NavLink
            to="/accounts"
            onClick={() => setMoreOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm hover:bg-[var(--surface-2)]"
          >
            <Wallet className="w-4 h-4 text-[var(--text-muted)]" />
            <span>Accounts</span>
          </NavLink>
          <NavLink
            to="/planner"
            onClick={() => setMoreOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm hover:bg-[var(--surface-2)]"
          >
            <LineChart className="w-4 h-4 text-[var(--text-muted)]" />
            <span>Planner</span>
          </NavLink>
          <NavLink
            to="/settings"
            onClick={() => setMoreOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm hover:bg-[var(--surface-2)]"
          >
            <Settings2 className="w-4 h-4 text-[var(--text-muted)]" />
            <span>Settings</span>
          </NavLink>
        </div>
      </Sheet>
    </>
  );
}
