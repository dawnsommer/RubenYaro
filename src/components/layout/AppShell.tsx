import { ReactNode, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { RateBar } from './RateBar';
import { useStore } from '../../store/useStore';

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const privacyMode = useStore((s) => s.settings.privacyMode);
  const theme = useStore((s) => s.settings.theme);

  useEffect(() => {
    document.body.classList.toggle('privacy', privacyMode);
  }, [privacyMode]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />

      <div className="flex-1 min-w-0 flex flex-col pb-16 lg:pb-0">
        <RateBar />

        <main className="flex-1 w-full max-w-[1200px] mx-auto p-4 lg:p-8">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
