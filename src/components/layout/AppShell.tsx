import { ReactNode, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { RateBar } from './RateBar';
import { CommandPalette } from './CommandPalette';
import { useStore } from '../../store/useStore';

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

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
    } else {
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', Boolean(prefersDark));
    }
  }, [theme]);

  // Global keyboard shortcuts (§6.7 & §8)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }

      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isEditable) return;

      if (e.key === '/') {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
        const s = useStore.getState();
        s.updateSettings({
          displayCurrency: s.settings.displayCurrency === 'PKR' ? 'USD' : 'PKR',
        });
      } else if (e.key === 'p' && !e.metaKey && !e.ctrlKey) {
        const s = useStore.getState();
        s.updateSettings({ privacyMode: !s.settings.privacyMode });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />

      <div className="flex-1 min-w-0 flex flex-col pb-16 lg:pb-0">
        <RateBar onOpenCommandPalette={() => setPaletteOpen(true)} />

        <main className="flex-1 w-full max-w-[1200px] mx-auto p-4 lg:p-8">
          {children}
        </main>
      </div>

      <BottomNav />

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
