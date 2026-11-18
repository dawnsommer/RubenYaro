import { ReactNode, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { RateBar } from './RateBar';

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState<'PKR' | 'USD'>('PKR');
  const [privacyMode, setPrivacyMode] = useState(false);
  const [marketRate, setMarketRate] = useState(281.4);
  const [effectiveRate, setEffectiveRate] = useState(300);
  const [taxPercent, setTaxPercent] = useState(5);

  useEffect(() => {
    document.body.classList.toggle('privacy', privacyMode);
  }, [privacyMode]);

  const handleToggleTheme = () => {
    document.documentElement.classList.toggle('dark');
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
      />

      <div className="flex-1 min-w-0 flex flex-col pb-16 lg:pb-0">
        <RateBar
          marketRate={marketRate}
          effectiveRate={effectiveRate}
          taxPercent={taxPercent}
          displayCurrency={displayCurrency}
          onDisplayCurrencyChange={setDisplayCurrency}
          privacyMode={privacyMode}
          onTogglePrivacy={() => setPrivacyMode((p) => !p)}
          onToggleTheme={handleToggleTheme}
          onMarketRateChange={setMarketRate}
          onEffectiveRateChange={setEffectiveRate}
          onTaxPercentChange={setTaxPercent}
        />

        <main className="flex-1 w-full max-w-[1200px] mx-auto p-4 lg:p-8">
          {children}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
