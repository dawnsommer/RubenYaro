import { ReactNode, useEffect, useState } from 'react';
import { BottomNav } from './BottomNav';
import { TopBar } from './TopBar';
import { CommandPalette } from './CommandPalette';
import { useStore } from '../../store/useStore';

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
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
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <TopBar onOpenCommandPalette={() => setPaletteOpen(true)} />

      <main className="w-full max-w-[1120px] mx-auto px-4 lg:px-6 pt-5 lg:pt-8 pb-28 lg:pb-16">
        {children}
      </main>

      <BottomNav />

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
