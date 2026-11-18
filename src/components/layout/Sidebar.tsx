import { NavLink } from 'react-router-dom';
import {
  LayoutGrid,
  Receipt,
  Wallet,
  CheckCircle2,
  LineChart,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/costs', label: 'Costs', icon: Receipt },
  { to: '/accounts', label: 'Accounts', icon: Wallet },
  { to: '/tasks', label: 'Tasks', icon: CheckCircle2 },
  { to: '/planner', label: 'Planner', icon: LineChart },
];

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  return (
    <aside
      aria-label="Primary navigation"
      className={`hidden lg:flex flex-col gap-1 p-3 border-r border-[var(--border)] bg-[var(--surface)] transition-[width] duration-150 shrink-0 ${
        collapsed ? 'w-16 items-center' : 'w-60'
      }`}
    >
      <div
        className={`flex items-center ${
          collapsed ? 'justify-center' : 'justify-between px-2'
        } pb-5 pt-1`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-[10px] bg-[var(--accent)] grid place-items-center text-white font-bold text-sm shrink-0">
            R
          </div>
          {!collapsed && (
            <span className="font-semibold text-[var(--text)] truncate">RubenYaro</span>
          )}
        </div>
        {!collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            className="w-7 h-7 rounded-[8px] grid place-items-center text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] cursor-pointer"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Expand sidebar"
          className="mb-2 w-9 h-9 rounded-[10px] grid place-items-center text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] cursor-pointer"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
      )}

      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          title={collapsed ? label : undefined}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-[10px] text-sm transition-colors ${
              collapsed ? 'justify-center w-10 h-10' : 'px-3 py-2'
            } ${
              isActive
                ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
                : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
            }`
          }
        >
          <Icon className="w-[18px] h-[18px] shrink-0" />
          {!collapsed && <span>{label}</span>}
        </NavLink>
      ))}

      <div className="flex-1" />

      <NavLink
        to="/settings"
        title={collapsed ? 'Settings' : undefined}
        className={({ isActive }) =>
          `flex items-center gap-3 rounded-[10px] text-sm transition-colors ${
            collapsed ? 'justify-center w-10 h-10' : 'px-3 py-2'
          } ${
            isActive
              ? 'bg-[var(--accent-soft)] text-[var(--accent)] font-medium'
              : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
          }`
        }
      >
        <Settings2 className="w-[18px] h-[18px] shrink-0" />
        {!collapsed && <span>Settings</span>}
      </NavLink>
    </aside>
  );
}
