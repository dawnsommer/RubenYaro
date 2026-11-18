import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from './nav';

export function BottomNav() {
  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[var(--border)] backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
      style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 88%, transparent)' }}
    >
      <div className="grid grid-cols-6 h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ to, short, icon: Icon, ...rest }) => (
          <NavLink
            key={to}
            to={to}
            end={'end' in rest ? rest.end : undefined}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 text-[10.5px] font-medium transition-colors ${
                isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`grid place-items-center w-11 h-7 rounded-full transition-colors ${
                    isActive ? 'bg-[var(--accent-soft)]' : ''
                  }`}
                >
                  <Icon className="w-[19px] h-[19px]" />
                </span>
                <span>{short}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
